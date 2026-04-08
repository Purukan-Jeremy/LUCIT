from flask import Flask, jsonify, request
from flask_cors import CORS
from src.config.supabase import supabase
from src.controllers.prediction_controller import predict_image
from src.routes.chatbot_routes import chatbot_bp
from src.routes.prediction_routes import prediction_bp  # ← tambahan

app = Flask(__name__)
CORS(app)
app.register_blueprint(chatbot_bp)
app.register_blueprint(prediction_bp, url_prefix="/api")  # ← tambahan


@app.route("/", methods=["GET"])
def root():
    return jsonify({"status": "Backend Supabase connected"})


@app.route("/testing", methods=["GET"])
def test_supabase():
    res = supabase.table("users").select("*").limit(1).execute()
    return jsonify({"success": True, "data": res.data})


@app.route("/api/users", methods=["GET"])
def get_users():
    try:
        from src.controllers.user_controller import get_users as get_users_controller
        users = get_users_controller()
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
        from src.controllers.user_controller import create_user as create_user_controller
        result = create_user_controller(data)
        return jsonify({"status": "success", "data": result}), 201
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
        from src.controllers.user_controller import login_user
        result = login_user(data)
        if result.get("status") == "success":
            return jsonify(result), 200
        return jsonify(result), 401
    except Exception as e:
        return jsonify({"status": "error", "message": str(e)}), 500


# Catatan: /api/predict juga tersedia melalui prediction_bp (prediction_routes.py).
# Route di bawah ini dipertahankan untuk backward compatibility.
@app.route("/api/predict", methods=["POST"])
def predict():
    file = request.files.get("file")
    if not file:
        return jsonify({"error": "No file uploaded"}), 400
    model_type = request.form.get("model_type", "classification")
    try:
        result = predict_image(file, model_type=model_type)
        return jsonify(result)
    except Exception as e:
        return jsonify({"error": str(e)}), 500


if __name__ == "__main__":
    app.run(debug=True, host="0.0.0.0", port=8000)