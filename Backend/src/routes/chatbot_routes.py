from flask import Blueprint, jsonify, request
from src.controllers.chatbot_controller import send_chat_message

chatbot_bp = Blueprint("chatbot", __name__, url_prefix="/api")


@chatbot_bp.route("/chat", methods=["POST"])
def chat():
    result, status_code = send_chat_message(request.get_json(silent=True))
    return jsonify(result), status_code