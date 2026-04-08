from flask import Blueprint, request, jsonify
from src.controllers.prediction_controller import ImageController

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
        return jsonify({"error": "No file uploaded"}), 400

    model_type = request.form.get("model_type", "classification")  
    try:
        result = ImageController.predict_image(file, model_type=model_type)
        return jsonify(result)
    except Exception as e:
        return jsonify({"error": str(e)}), 500