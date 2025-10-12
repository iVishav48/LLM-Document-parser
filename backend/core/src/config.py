import os
from dotenv import load_dotenv

load_dotenv(dotenv_path=os.path.join(os.path.dirname(__file__), "../../.env"))

RABBITMQ_URL = os.environ.get("RABBITMQ_URL")

OPENAI_API_KEY = os.environ.get("OPENAI_API_KEY")

LANGSMITH_TRACING = os.environ.get("LANGSMITH_TRACING") or "true"
LANGSMITH_API_KEY = os.environ.get("LANGSMITH_API_KEY")

if not RABBITMQ_URL:
    raise ValueError("RABBITMQ_URL environment variable is not set.")
if not OPENAI_API_KEY:
    raise ValueError("OPENAI_API_KEY environment variable is not set.")
