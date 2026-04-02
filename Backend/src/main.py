from flask import Flask, jsonify, request
from flask_cors import CORS
from src.config.supabase import supabase
from src.controllers.prediction_controller import predict_image
from src.routes.chatbot_routes import chatbot_bp

app = Flask(__name__)
CORS(app)  
app.register_blueprint(chatbot_bp)

@app.route("/", methods=["GET"])
def root():
    return jsonify({"status": "Backend Supabase connected"})

@app.route("/testing", methods=["GET"])
def test_supabase():
    res = supabase.table("users").select("*").limit(1).execute()
    return jsonify({
        "success": True,
        "data": res.data
    })

@app.route("/api/users", methods=["GET"])
def get_users():
    from src.controllers.user_controller import get_users as get_users_controller
    users = get_users_controller()
    return jsonify(users)

@app.route("/api/users", methods=["POST"])
def create_user():
    data = request.json
    from src.controllers.user_controller import create_user as create_user_controller
    result = create_user_controller(data)
    return jsonify(result)

@app.route("/api/login", methods=["POST"])
def login():
    data = request.json
    from src.controllers.user_controller import login_user
    result = login_user(data)
    return jsonify(result)

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

if __name__ == "__main__":
    app.run(debug=True, port=8000)
