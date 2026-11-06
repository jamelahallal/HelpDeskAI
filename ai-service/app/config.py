import os

AI_PROVIDER = os.getenv("AI_PROVIDER", "fake")
GROQ_API_KEY = os.getenv("GROQ_API_KEY", "")
GROQ_MODEL = os.getenv("GROQ_MODEL", "llama-3.3-70b-versatile")
AI_TIMEOUT_SECONDS = float(os.getenv("AI_TIMEOUT_SECONDS", "15"))
AI_SERVICE_TOKEN = os.getenv("AI_SERVICE_TOKEN", "")