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
from src.services.ai_validator_service import generate_ai_description

IMG_SIZE = 224
CLASS_NAMES = ["Colon ACA", "Colon Benign", "Lung ACA", "Lung Benign", "Lung SCC"]

def predict_image(file, model_type="classification"):
    """
    Fungsi prediksi gambar histopatologi.
    model_type: "classification" atau "segmentation"
    """

    contents = file.read()

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

    try:
        last_conv_layer_name = get_last_conv_layer(model)

        heatmap = make_gradcam_heatmap(
            img_array,
            base_model=model,
            last_conv_layer_name=last_conv_layer_name,
            pred_index=predicted_class_index
        )

        original_img = np.array(image)
        gradcam_image = overlay_heatmap(original_img, heatmap)

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
        "gradcam_image": gradcam_base64,
        "ai_description": ai_description,  
    }