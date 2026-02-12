from flask import Blueprint, request, jsonify
from src.controllers.user_controller import get_users, create_user

user_bp = Blueprint("user", __name__, url_prefix="/api/users")

@user_bp.route("/", methods=["GET"])
def read_users():
    try:
        users = get_users() 
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
        return jsonify(result)
    except Exception as e:
        return jsonify({"error": str(e)}), 500
