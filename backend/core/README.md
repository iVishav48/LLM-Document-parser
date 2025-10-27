python -m venv .venv - creating virtual environment
.venv\Scripts\activate - activate virtual environment
pip install -r requirements.txt - installing dependencies

Environment Variables Required:
- RABBITMQ_URL: RabbitMQ connection URL
- GOOGLE_API_KEY: Google API key for Gemini (free tier available)

python src/app.py - running the worker
