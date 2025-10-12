import { useState } from 'react'

type PolicyResponse = {
  name: string
  age: string
  sex: 'M' | 'F'
  decision: 'approved' | 'rejected'
  amount: number
  justification: string
}

function App() {
  const [file, setFile] = useState<File | null>(null)
  const [query, setQuery] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [result, setResult] = useState<PolicyResponse | null>(null)

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError(null)
    setResult(null)

    if (!file) {
      setError('File is required.')
      return
    }
    if (!query.trim()) {
      setError('Query is required.')
      return
    }

    setLoading(true)
    try {
      const formData = new FormData()
      formData.append('file', file)
      formData.append('query', query)

      const res = await fetch('http://localhost:8080/api/v1/query', {
        method: 'POST',
        body: formData,
      })

      if (!res.ok) {
        const text = await res.text()
        throw new Error(text || `Request failed with ${res.status}`)
      }

      const raw = await res.json()
      const parsed = normalizeApiResponse(raw)
      if (!parsed) {
        console.error('PolicyChecker: Unable to parse response', raw)
        const fallback = bestEffortExtract(raw)
        setResult(fallback)
      } else {
        setResult(parsed)
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Unknown error occurred'
      setError(message)
    } finally {
      setLoading(false)
    }
  }

  function normalizeApiResponse(raw: unknown): PolicyResponse | null {
    // Fallback extractor when structured parsing fails: search any string for JSON-ish content
    function fallbackExtract(obj: unknown): PolicyResponse | null {
      if (!obj || typeof obj !== 'object') return null
      for (const value of Object.values(obj as Record<string, unknown>)) {
        if (typeof value === 'string') {
          const parsed = parsePotentialJsonString(value)
          if (parsed && typeof parsed === 'object') {
            const maybe = coercePolicy(parsed as Record<string, unknown>)
            if (maybe) return maybe
            const inner = (parsed as Record<string, unknown>).result
            if (inner && typeof inner === 'object') {
              const maybe2 = coercePolicy(inner as Record<string, unknown>)
              if (maybe2) return maybe2
            }
            if (typeof inner === 'string') {
              const parsed2 = parsePotentialJsonString(inner)
              if (parsed2 && typeof parsed2 === 'object') {
                const maybe3 = coercePolicy(parsed2 as Record<string, unknown>)
                if (maybe3) return maybe3
              }
            }
          }
        } else if (value && typeof value === 'object') {
          const maybe = coercePolicy(value as Record<string, unknown>)
          if (maybe) return maybe
        }
      }
      return null
    }
    function parsePotentialJsonString(input: string): unknown {
      try { return JSON.parse(input) } catch {}
      try { return JSON.parse(input.replace(/'/g, '"')) } catch {}
      try { return JSON.parse(input.replace(/\\\"/g, '"')) } catch {}
      try { return JSON.parse(input.replace(/\\"/g, '"')) } catch {}
      return null
    }

    function coercePolicy(obj: Record<string, unknown>): PolicyResponse | null {
      const name = typeof obj.name === 'string' ? obj.name : obj.name != null ? String(obj.name) : ''
      const ageStr = typeof obj.age === 'string' ? obj.age : obj.age != null ? String(obj.age) : ''
      const decisionRaw = typeof obj.decision === 'string' ? obj.decision.toLowerCase() : ''
      const decision = decisionRaw === 'approved' || decisionRaw === 'rejected' ? (decisionRaw as 'approved' | 'rejected') : null
      const amountNum = typeof obj.amount === 'number' ? obj.amount : obj.amount != null && !Number.isNaN(Number(obj.amount)) ? Number(obj.amount) : NaN
      const justification = typeof obj.justification === 'string' ? obj.justification : obj.justification != null ? String(obj.justification) : ''
      const sexRaw = typeof obj.sex === 'string' ? obj.sex.toUpperCase() : ''
      const sex = sexRaw === 'M' || sexRaw === 'F' ? (sexRaw as 'M' | 'F') : 'M'

      if (!decision || !justification || Number.isNaN(amountNum)) {
        return null
      }
      return {
        name,
        age: ageStr,
        sex,
        decision,
        amount: amountNum,
        justification,
      }
    }

    // If the API already returns the expected shape
    if (raw && typeof raw === 'object') {
      const obj = raw as Record<string, unknown>
      const direct = coercePolicy(obj)
      if (direct) return direct

      // Handle nested string payloads like: { success, result: "{'jobId': '...', 'result': '{\\n  \"name\": ...}'}" }
      const topLevelResult = obj.result
      if (typeof topLevelResult === 'string') {
        // First try to parse the outer string as JSON (with single quotes converted)
        const outerParsed = parsePotentialJsonString(topLevelResult)
        if (outerParsed && typeof outerParsed === 'object') {
          const outerObj = outerParsed as Record<string, unknown>
          // Check if the result is directly here
          const directResult = coercePolicy(outerObj)
          if (directResult) return directResult
          
          // Check if there's a nested result string
          const nestedResult = outerObj.result
          if (typeof nestedResult === 'string') {
            const innerParsed = parsePotentialJsonString(nestedResult)
            if (innerParsed && typeof innerParsed === 'object') {
              const innerResult = coercePolicy(innerParsed as Record<string, unknown>)
              if (innerResult) return innerResult
            }
          }
        }
        // Fallback scan if above failed
        const fb = fallbackExtract(obj)
        if (fb) return fb
      } else if (topLevelResult && typeof topLevelResult === 'object') {
        const coerced = coercePolicy(topLevelResult as Record<string, unknown>)
        if (coerced) return coerced
        const fb = fallbackExtract(topLevelResult)
        if (fb) return fb
      }
      // Last-chance fallback
      const fbRoot = fallbackExtract(obj)
      if (fbRoot) return fbRoot
    }
    return null
  }

  function bestEffortExtract(raw: unknown): PolicyResponse {
    const stringify = (v: unknown) => (v == null ? '' : String(v))
    const findInObj = (obj: Record<string, unknown>, key: string): string => {
      for (const [k, v] of Object.entries(obj)) {
        if (k.toLowerCase().includes(key)) return stringify(v)
      }
      return ''
    }

    let amount = 0
    let justification = ''
    let decision: 'approved' | 'rejected' = 'rejected'

    if (raw && typeof raw === 'object') {
      const obj = raw as Record<string, unknown>
      const top = obj.result
      const allCandidates: string[] = []
      for (const v of Object.values(obj)) if (typeof v === 'string') allCandidates.push(v)
      if (typeof top === 'string') allCandidates.unshift(top)

      for (const s of allCandidates) {
        try {
          const p = JSON.parse(s)
          if (p && typeof p === 'object') {
            const po = p as Record<string, unknown>
            justification = justification || findInObj(po, 'justification')
            const amtStr = findInObj(po, 'amount')
            if (amtStr) {
              const n = Number(amtStr)
              if (!Number.isNaN(n)) amount = n
            }
            const decStr = findInObj(po, 'decision').toLowerCase()
            if (decStr === 'approved' || decStr === 'rejected') {
              decision = decStr as 'approved' | 'rejected'
            }
            if (justification && amount !== 0) break
          }
        } catch {
          // If not valid JSON, try regex extraction directly from the string
          const justMatch = s.match(/\"justification\"\s*:\s*\"([\s\S]*?)\"/)
          if (justMatch && !justification) {
            justification = justMatch[1].replace(/\\n/g, '\n').replace(/\\"/g, '"')
          }
          const amtMatch = s.match(/\"amount\"\s*:\s*(-?\d+(?:\.\d+)?)/)
          if (amtMatch) {
            const n = Number(amtMatch[1])
            if (!Number.isNaN(n)) amount = n
          }
          const decMatch = s.match(/\"decision\"\s*:\s*\"(approved|rejected)\"/i)
          if (decMatch) {
            decision = decMatch[1].toLowerCase() as 'approved' | 'rejected'
          }
        }
      }
    }

    return {
      name: '',
      age: '',
      sex: 'M',
      decision,
      amount,
      justification: justification || 'No justification provided by server.',
    }
  }

  return (
    <>
      <div className="min-h-dvh bg-gray-50">
        <header className="border-b bg-white">
          <div className="max-w-3xl mx-auto px-4 py-4">
            <h1 className="text-xl font-semibold text-gray-800">Hospital Policy Checker</h1>
            <p className="text-sm text-gray-500">Claim evaluation powered by LLM</p>
          </div>
        </header>

        <main className="max-w-3xl mx-auto px-4 py-6">
          <form onSubmit={handleSubmit} className="bg-white rounded-lg shadow p-4 md:p-6 space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700">Upload Document<span className="text-red-500"> *</span></label>
              <input
                type="file"
                accept=".pdf,.doc,.docx,.png,.jpg,.jpeg,.txt"
                onChange={(e) => setFile(e.target.files?.[0] ?? null)}
                className="mt-1 block w-full cursor-pointer text-sm file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-medium file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700">Query<span className="text-red-500"> *</span></label>
              <textarea
                rows={4}
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Ask about the policy eligibility..."
                className="mt-1 w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            {error && (
              <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>
            )}

            <div className="flex items-center gap-3">
              <button
                type="submit"
                disabled={loading}
                className="inline-flex items-center justify-center rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-60"
              >
                {loading ? 'Submitting...' : 'Submit Claim'}
              </button>
              <button
                type="button"
                onClick={() => {
                  setFile(null)
                  setQuery('')
                  setError(null)
                  setResult(null)
                }}
                className="text-sm text-gray-500 hover:text-gray-700"
              >
                Reset
              </button>
            </div>
          </form>

          {result && (
            <section className="mt-6 bg-white rounded-lg shadow p-4 md:p-6 space-y-3">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-semibold text-gray-800">Decision</h2>
                <span
                  className={
                    result.decision === 'approved'
                      ? 'rounded-full bg-green-100 text-green-700 text-xs font-medium px-3 py-1'
                      : 'rounded-full bg-red-100 text-red-700 text-xs font-medium px-3 py-1'
                  }
                >
                  {result.decision === 'approved' ? 'Approved' : 'Rejected'}
                </span>
              </div>

              <div className="text-sm">
                <div className="text-gray-500">Amount</div>
                <div className={result.decision === 'approved' ? 'font-semibold text-green-700' : 'font-semibold text-gray-700'}>
                  ₹ {Intl.NumberFormat('en-IN').format(result.amount)}
                </div>
              </div>

              <div>
                <div className="text-sm text-gray-500">Justification</div>
                <p className="mt-1 whitespace-pre-line text-sm text-gray-800">{result.justification}</p>
              </div>
            </section>
          )}
        </main>

        <footer className="max-w-3xl mx-auto px-4 py-6 text-center text-xs text-gray-500">
          © {new Date().getFullYear()} Hospital Policy Checker
        </footer>
      </div>
    </>
  )
}

export default App
