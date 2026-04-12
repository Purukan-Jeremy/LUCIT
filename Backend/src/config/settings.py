import os
from dotenv import load_dotenv

load_dotenv()

GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")
GEMINI_DESCRIPTION_MODEL = os.getenv("GEMINI_DESCRIPTION_MODEL", "gemini-2.0-flash")
GEMINI_CHAT_MODEL = os.getenv("GEMINI_CHAT_MODEL", "gemini-1.5-flash")
FLASK_SECRET_KEY = os.getenv("FLASK_SECRET_KEY", "lucit-dev-secret-key")
