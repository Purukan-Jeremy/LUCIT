import numpy as np
import cv2
import base64
from io import BytesIO
from PIL import Image

from src.models.model_loader import load_model
from src.services.gradcam_service import (
    get_last_conv_layer,
    make_gradcam_heatmap,
    overlay_heatmap,
)
from src.services.ai_validator_service import (validate_histopathology,generate_ai_description)

IMG_SIZE = 224
CLASS_NAMES = ["Colon ACA", "Colon Benign", "Lung ACA", "Lung Benign", "Lung SCC"]

def predict_image(file, model_type="classification"):
    """
    Fungsi prediksi gambar histopatologi.
    model_type: "classification" atau "segmentation"
    """

    contents = file.read()

    print("Validating image with Gemini...")

    validation = validate_histopathology(contents)

    print("Validation result:", validation)

    if not validation.get("is_histopathology", False):
        return {
            "status": "error",
            "message": "Gambar bukan histopatologi"
        }


    image = Image.open(BytesIO(contents)).convert("RGB")
    image = image.resize((IMG_SIZE, IMG_SIZE))

    img_array = np.array(image) / 255.0
    img_array = np.expand_dims(img_array, axis=0)

    if model_type == "classification":
        model = load_model()
    elif model_type == "segmentation":
        return {"status": "error", "message": "Segmentation belum tersedia"}
    else:
        return {"status": "error", "message": f"Unknown model_type: {model_type}"}

    predictions = model.predict(img_array)

    if isinstance(predictions, list):
        predictions = predictions[0]

    if hasattr(predictions, 'numpy'):
        predictions = predictions.numpy()

    predicted_class_index = int(np.argmax(predictions[0]))
    confidence = float(np.max(predictions[0]))

    if predicted_class_index >= len(CLASS_NAMES):
        predicted_class = "Unknown"
    else:
        predicted_class = CLASS_NAMES[predicted_class_index]

    print(f"Predicted class: {predicted_class}")
    print(f"Confidence: {confidence:.4f}")

    MIN_CONFIDENCE = 0.70

    if confidence < MIN_CONFIDENCE:
        print("Rejected: confidence too low")

        return {
            "status": "error",
            "message": "Gambar bukan histopatologi paru-paru atau usus besar",
            "confidence": confidence
        }

 
    try:

        last_conv_layer_name = get_last_conv_layer(model)

        heatmap = make_gradcam_heatmap(
            img_array,
            base_model=model,
            last_conv_layer_name=last_conv_layer_name,
            pred_index=predicted_class_index
        )

        original_img = np.array(image)
        heatmap_resized = cv2.resize(heatmap, (original_img.shape[1], original_img.shape[0]))
        heatmap_blurred = cv2.GaussianBlur(heatmap_resized, (25, 25), 0)
        heatmap_uint8 = np.uint8(255 * heatmap_blurred)
        heatmap_color = cv2.applyColorMap(heatmap_uint8, cv2.COLORMAP_JET)

        gradcam_image = overlay_heatmap(original_img, heatmap)

        _, heatmap_buffer = cv2.imencode(".jpg", heatmap_color)
        heatmap_base64 = base64.b64encode(heatmap_buffer).decode("utf-8")

        _, buffer = cv2.imencode(".jpg", gradcam_image)
        gradcam_base64 = base64.b64encode(buffer).decode("utf-8")

        print("Grad-CAM generated successfully")

    except Exception as e:

        print(f"Grad-CAM error: {str(e)}")

        import traceback
        traceback.print_exc()

        original_img = np.array(image)

        _, buffer = cv2.imencode(".jpg", original_img)
        gradcam_base64 = base64.b64encode(buffer).decode("utf-8")
        heatmap_base64 = None

 
    print("Generating AI description...")

    ai_description = generate_ai_description(
        image_bytes=contents,
        prediction=predicted_class,
        confidence=confidence,
        gradcam_base64=gradcam_base64
    )

    print("AI description generated")

    return {
        "status": "success",
        "prediction": predicted_class,
        "confidence": confidence,
        "gradcam_heatmap": heatmap_base64,
        "gradcam_image": gradcam_base64,
        "ai_description": ai_description,
    }
