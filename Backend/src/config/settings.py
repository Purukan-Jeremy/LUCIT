import os
from dotenv import load_dotenv

load_dotenv()


def _parse_csv_env(value):
    if not value:
        return []
    return [item.strip() for item in value.split(",") if item.strip()]

VERTEX_API_KEY = os.getenv("VERTEX_API_KEY")
VERTEX_PROJECT_ID = os.getenv("VERTEX_PROJECT_ID")
VERTEX_LOCATION = os.getenv("VERTEX_LOCATION", "us-central1")

GEMINI_DESCRIPTION_MODEL = os.getenv("GEMINI_DESCRIPTION_MODEL", "gemini-2.5-flash")
GEMINI_CHAT_MODEL = os.getenv("GEMINI_CHAT_MODEL", "gemini-2.5-flash")
FLASK_SECRET_KEY = os.getenv("FLASK_SECRET_KEY", "lucit-dev-secret-key")
FLASK_ENV = os.getenv("FLASK_ENV", "production").lower()
FRONTEND_URL = os.getenv("FRONTEND_URL", "https://lucit.dev").strip()
ALLOWED_ORIGINS = _parse_csv_env(os.getenv("ALLOWED_ORIGINS")) or [
    FRONTEND_URL,
    "http://localhost:5173",
    "http://127.0.0.1:5173",
]
SESSION_COOKIE_SECURE = os.getenv(
    "SESSION_COOKIE_SECURE",
    "false" if FLASK_ENV == "development" else "true",
).lower() == "true"
SESSION_COOKIE_SAMESITE = os.getenv("SESSION_COOKIE_SAMESITE", "Lax")
SESSION_COOKIE_HTTPONLY = os.getenv("SESSION_COOKIE_HTTPONLY", "true").lower() == "true"
SMTP_HOST = os.getenv("SMTP_HOST")
SMTP_PORT = int(os.getenv("SMTP_PORT", "587"))
SMTP_USERNAME = os.getenv("SMTP_USERNAME")
SMTP_PASSWORD = os.getenv("SMTP_PASSWORD")
SMTP_USE_TLS = os.getenv("SMTP_USE_TLS", "true").lower() == "true"
SMTP_SENDER_EMAIL = os.getenv("SMTP_SENDER_EMAIL") or SMTP_USERNAME
PASSWORD_RESET_OTP_EXPIRY_MINUTES = int(os.getenv("PASSWORD_RESET_OTP_EXPIRY_MINUTES", "10"))