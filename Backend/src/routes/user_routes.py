from flask import Blueprint, request, jsonify, session
from src.controllers.user_controller import SignUpController, SignInController, SignOutController, SessionCheckController, UserController

user_bp = Blueprint("user", __name__, url_prefix="/api")

@user_bp.route("/users", methods=["GET"])
def get_users():
    try:
        users = UserController.get_users()
        return jsonify(users)
    except Exception as e:
        return jsonify({"status": "error", "message": str(e)}), 500

@user_bp.route("/users", methods=["POST"])
def register():
    try:
        data = request.get_json(silent=True) or {}
        result = SignUpController.sign_up(data)
        if result.get("status") == "success":
            return jsonify(result), 201
        return jsonify(result), 400
    except Exception as e:
        return jsonify({"status": "error", "message": str(e)}), 500

@user_bp.route("/login", methods=["POST"])
def login():
    try:
        data = request.get_json(silent=True) or {}
        result = SignInController.sign_in(data)
        if result.get("status") == "success":
            return jsonify(result), 200
        return jsonify(result), 401
    except Exception as e:
        return jsonify({"status": "error", "message": str(e)}), 500

@user_bp.route("/logout", methods=["POST"])
def logout():
    try:
        result = SignOutController.sign_out()
        return jsonify(result), 200
    except Exception as e:
        return jsonify({"status": "error", "message": str(e)}), 500

@user_bp.route("/session/check", methods=["GET"])
def check_session():
    try:
        result = SessionCheckController.check_session()
        if result.get("status") == "success":
            return jsonify(result), 200
        return jsonify(result), 401
    except Exception as e:
        return jsonify({"status": "error", "message": str(e)}), 500
