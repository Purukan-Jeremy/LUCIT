import os
from dotenv import load_dotenv

load_dotenv()

GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")
GEMINI_DESCRIPTION_MODEL = os.getenv("GEMINI_DESCRIPTION_MODEL", "gemini-2.5-flash")
GEMINI_CHAT_MODEL = os.getenv("GEMINI_CHAT_MODEL", "gemini-2.5-flash-lite")
<<<<<<< HEAD
FLASK_SECRET_KEY = os.getenv("FLASK_SECRET_KEY", "lucit-dev-secret-key")
=======
FLASK_SECRET_KEY = os.getenv("FLASK_SECRET_KEY", "lucit-dev-secret-key")
>>>>>>> 5cd513b7aaed11bcf82c0f962059743e0015108f
