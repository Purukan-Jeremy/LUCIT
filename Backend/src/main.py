from flask import Flask, jsonify, request
from flask_cors import CORS
from src.config.supabase import supabase
from src.config.settings import FLASK_SECRET_KEY
from src.controllers.prediction_controller import filter_history, get_history, predict_image
from src.models.model_loader import load_model
from src.routes.chatbot_routes import chatbot_bp
from src.routes.user_routes import user_bp
from src.routes.prediction_routes import prediction_bp

app = Flask(__name__)
CORS(app)

# Register Blueprints
app.config["SECRET_KEY"] = FLASK_SECRET_KEY
CORS(app)  
app.register_blueprint(chatbot_bp)
app.register_blueprint(user_bp)
app.register_blueprint(prediction_bp, url_prefix="/api")

# Preload model on startup
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
        # Check if tbl_users exists instead of 'users' to match your schema
        # Falls back to 'users' if 'tbl_users' is not the one intended, 
        # but following existing project convention of 'tbl_users'.
        res = supabase.table("tbl_users").select("*").limit(1).execute()
        return jsonify({
            "success": True,
            "data": res.data
        })
    except Exception as e:
        return jsonify({"success": False, "error": str(e)}), 500

@app.route("/api/users", methods=["GET"])
def get_users():
    """
    Endpoint untuk mendapatkan daftar user (jika diperlukan)
    """
    try:
        from src.controllers.user_controller import UserController
        users = UserController.get_users()
        return jsonify(users)
    except Exception as e:
        return jsonify({"status": "error", "error": str(e)}), 500

@app.route("/api/users", methods=["POST"])
def create_user():
    try:
        data = request.get_json(silent=True) or {}
        fullname = data.get("fullname")
        email = data.get("email")
        password = data.get("password")

        if not fullname or not email or not password:
            return jsonify({"status": "error", "error": "fullname, email, and password are required"}), 400

        from src.controllers.user_controller import SignUpController
        result = SignUpController.sign_up(data)
        if result.get("status") == "success":
            return jsonify(result), 201
        return jsonify(result), 400
    except Exception as e:
        return jsonify({"status": "error", "error": str(e)}), 500

@app.route("/api/login", methods=["POST"])
def login():
    try:
        data = request.get_json(silent=True) or {}
        email = data.get("email")
        password = data.get("password")
        if not email or not password:
            return jsonify({"status": "error", "message": "email and password are required"}), 400

        from src.controllers.user_controller import SignInController
        result = SignInController.sign_in(data)
        if result.get("status") == "success":
            return jsonify(result), 200
        return jsonify(result), 401
    except Exception as e:
        return jsonify({"status": "error", "message": str(e)}), 500


@app.route("/api/logout", methods=["POST"])
def logout():
    try:
        from src.controllers.user_controller import SignOutController
        result = SignOutController.sign_out()
        return jsonify(result), 200
    except Exception as e:
        return jsonify({"status": "error", "message": str(e)}), 500


@app.route("/api/session/check", methods=["GET"])
def check_session():
    try:
        from src.controllers.user_controller import SessionCheckController
        result = SessionCheckController.check_session()
        if result.get("status") == "success":
            return jsonify(result), 200
        return jsonify(result), 401
    except Exception as e:
        return jsonify({"status": "error", "message": str(e)}), 500

@app.route("/api/predict", methods=["POST"])
def predict():
    """
    Endpoint untuk prediksi gambar histopatologi dari front-end
    - menerima file image
    - menerima model_type: classification / segmentation
    """
    file = request.files.get("file")
    if not file:
        return jsonify({"error": "No file uploaded"}), 400

    model_type = request.form.get("model_type", "classification")  

    try:
        result = predict_image(file, model_type=model_type)
        return jsonify(result)
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route("/api/history", methods=["GET"])
def history():
    try:
        query = request.args.get("q", "")
        if query.strip():
            return jsonify(filter_history(query)), 200
        return jsonify(get_history()), 200
    except Exception as e:
        return jsonify({"status": "error", "message": str(e)}), 500

if __name__ == "__main__":
    app.run(debug=True, host="0.0.0.0", port=8000)
