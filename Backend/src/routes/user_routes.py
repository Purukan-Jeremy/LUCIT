from flask import Blueprint, request, jsonify
from src.controllers.user_controller import SignUpController, UserController

user_bp = Blueprint("user", __name__, url_prefix="/api/users")

@user_bp.route("/", methods=["GET"])
def read_users():
    try:
        users = UserController.get_users()
        return jsonify(users)
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@user_bp.route("/", methods=["POST"])
def add_user():
    try:
        data = request.json  
        if not data:
            return jsonify({"error": "No data provided"}), 400

        result = create_user(data)
        
        if result.get("status") == "error":
            # Return the exact message from create_user
            return jsonify({"error": result.get("message")}), 409
            
        return jsonify(result.get("data")), 201
        result = SignUpController.sign_up(data)
        if result.get("status") == "success":
            return jsonify(result), 201
        return jsonify(result), 400
    except Exception as e:
        return jsonify({"error": str(e)}), 500