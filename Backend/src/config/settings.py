import os
from dotenv import load_dotenv

load_dotenv()

GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")
GEMINI_DESCRIPTION_MODEL = os.getenv("GEMINI_DESCRIPTION_MODEL", "gemini-2.0-flash")
GEMINI_CHAT_MODEL = os.getenv("GEMINI_CHAT_MODEL", "gemini-1.5-flash")
FLASK_SECRET_KEY = os.getenv("FLASK_SECRET_KEY", "lucit-dev-secret-key")
SMTP_HOST = os.getenv("SMTP_HOST")
SMTP_PORT = int(os.getenv("SMTP_PORT", "587"))
SMTP_USERNAME = os.getenv("SMTP_USERNAME")
SMTP_PASSWORD = os.getenv("SMTP_PASSWORD")
SMTP_USE_TLS = os.getenv("SMTP_USE_TLS", "true").lower() == "true"
SMTP_SENDER_EMAIL = os.getenv("SMTP_SENDER_EMAIL") or SMTP_USERNAME
PASSWORD_RESET_OTP_EXPIRY_MINUTES = int(os.getenv("PASSWORD_RESET_OTP_EXPIRY_MINUTES", "10"))
