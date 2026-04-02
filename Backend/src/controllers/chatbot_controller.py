from src.services.chatbot_service import generate_chat_response


def send_chat_message(data: dict):
    if not data:
        return {"status": "error", "message": "No data provided"}, 400

    message = (data.get("message") or "").strip()
    if not message:
        return {"status": "error", "message": "Message is required"}, 400

    analysis_context = data.get("analysis_context") or {}
    chat_history = data.get("chat_history") or []

    try:
        reply = generate_chat_response(
            message=message,
            analysis_context=analysis_context,
            chat_history=chat_history,
        )
        return {"status": "success", "reply": reply}, 200
    except Exception as e:
        return {"status": "error", "message": str(e)}, 500
