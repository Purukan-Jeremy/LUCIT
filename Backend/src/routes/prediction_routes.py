from flask import Blueprint, request, jsonify, session
from src.controllers.prediction_controller import ImageController, HistoryController

prediction_bp = Blueprint("prediction", __name__)

@prediction_bp.route("/predict", methods=["POST"])
def predict():
    """
    Route untuk prediksi gambar
    - file: file image yang diupload
    - model_type: 'classification' atau 'segmentation' (default classification)
    """
    file = request.files.get("file")
    if not file:
        return jsonify({"status": "error", "message": "No file uploaded"}), 400

    # Ensure user is logged in
    current_user = session.get("user")
    if not current_user or not current_user.get("id"):
        return jsonify({"status": "error", "message": "Unauthorized"}), 401

    model_type = request.form.get("model_type", "classification")  
    try:
        # Pass the user_id from session to the controller
        result = ImageController.predict_image(file, current_user["id"], model_type=model_type)
        return jsonify(result)
    except Exception as e:
        import traceback
        traceback.print_exc()
        return jsonify({"status": "error", "message": str(e)}), 500

@prediction_bp.route("/history", methods=["GET"])
def history():
    try:
        current_user = session.get("user")
        if not current_user or not current_user.get("id"):
            return jsonify({"status": "error", "message": "Unauthorized"}), 401

        query = request.args.get("q", "")
        if query.strip():
            return jsonify(HistoryController.filter_history(current_user["id"], query)), 200
        return jsonify(HistoryController.get_history(current_user["id"])), 200
    except Exception as e:
        return jsonify({"status": "error", "message": str(e)}), 500

@prediction_bp.route("/history/<int:history_id>", methods=["DELETE"])
def delete_history(history_id):
    try:
        current_user = session.get("user")
        if not current_user or not current_user.get("id"):
            return jsonify({"status": "error", "message": "Unauthorized"}), 401

        result = HistoryController.delete_history_item(current_user["id"], history_id)
        if result.get("status") == "success":
            return jsonify(result), 200
        return jsonify(result), 404
    except Exception as e:
        return jsonify({"status": "error", "message": str(e)}), 500
