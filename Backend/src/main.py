from flask import Flask, jsonify, request
from flask_cors import CORS
from src.config.supabase import supabase
from src.config.settings import (
    ALLOWED_ORIGINS,
    FLASK_ENV,
    FLASK_SECRET_KEY,
    SESSION_COOKIE_HTTPONLY,
    SESSION_COOKIE_SAMESITE,
    SESSION_COOKIE_SECURE,
)
from src.models.model_loader import load_model
from src.routes.chatbot_routes import chatbot_bp
from src.routes.user_routes import user_bp
from src.routes.prediction_routes import prediction_bp

app = Flask(__name__)
app.config["SECRET_KEY"] = FLASK_SECRET_KEY
app.config["SESSION_COOKIE_SECURE"] = SESSION_COOKIE_SECURE
app.config["SESSION_COOKIE_HTTPONLY"] = SESSION_COOKIE_HTTPONLY
app.config["SESSION_COOKIE_SAMESITE"] = SESSION_COOKIE_SAMESITE

CORS(
    app,
    supports_credentials=True,
    origins=ALLOWED_ORIGINS,
)


app.register_blueprint(user_bp)
app.register_blueprint(chatbot_bp)
app.register_blueprint(prediction_bp, url_prefix="/api")


try:
    load_model()
except Exception as preload_error:
    print(f"Model preload skipped: {preload_error}")

@app.route("/", methods=["GET"])
def root():
    return jsonify({"status": "Backend Supabase connected"})

@app.route("/testing", methods=["GET"])
def test_supabase():
    try:
        res = supabase.table("tbl_users").select("*").limit(1).execute()
        return jsonify({
            "success": True,
            "data": res.data
        })
    except Exception as e:
        return jsonify({"success": False, "error": str(e)}), 500

if __name__ == "__main__":
    app.run(debug=FLASK_ENV == "development", host="0.0.0.0", port=8000)
