import numpy as np
import cv2
import base64
import os
import tensorflow as tf
from concurrent.futures import ThreadPoolExecutor
from io import BytesIO
from PIL import Image

from src.models.model_loader import load_model, load_segmentation_model
from src.repositories.analysis_repository import ResultRepository
from src.services.gradcam_service import (
    get_last_conv_layer,
    make_gradcam_heatmap,
    overlay_heatmap,
)
from src.services.ai_validator_service import (
    generate_ai_description,
    generate_ai_description_segmentation,
    validate_histopathology,
)
from src.services.segmentation_service import run_segmentation

DEFAULT_CLASS_NAMES = ["Colon ACA", "Colon Benign", "Lung ACA", "Lung Benign", "Lung SCC"]
_gradcam_executor = ThreadPoolExecutor(max_workers=2)


# ──────────────────────────────────────────────
# Helpers
# ──────────────────────────────────────────────

def _resolve_target_size(model):
    input_shape = getattr(model, "input_shape", None)
    if isinstance(input_shape, list) and input_shape:
        input_shape = input_shape[0]

    if not input_shape or len(input_shape) < 4:
        return (224, 224)

    height = input_shape[1] if input_shape[1] else 224
    width = input_shape[2] if input_shape[2] else 224
    return (int(width), int(height))


def _has_rescaling_layer(model):
    for layer in model.layers[:8]:
        if layer.__class__.__name__ == "Rescaling":
            return True
    return False


def _preprocess_image(image_array, model):
    mode = os.getenv("PREPROCESS_MODE", "auto").strip().lower()
    x = image_array.astype(np.float32)

    if mode == "rescale_01":
        x = x / 255.0
    elif mode == "imagenet_tf":
        x = tf.keras.applications.imagenet_utils.preprocess_input(x, mode="tf")
    elif mode == "none":
        pass
    else:
        if not _has_rescaling_layer(model):
            x = x / 255.0

    return np.expand_dims(x, axis=0)


def _resolve_class_names(num_classes):
    raw = os.getenv("CLASS_NAMES", "").strip()
    if raw:
        parsed = [item.strip() for item in raw.split(",") if item.strip()]
        if len(parsed) == num_classes:
            return parsed

    if num_classes == len(DEFAULT_CLASS_NAMES):
        return DEFAULT_CLASS_NAMES

    return [f"Class {i}" for i in range(num_classes)]


# ──────────────────────────────────────────────
# Pipelines
# ──────────────────────────────────────────────

def _run_classification(contents: bytes, image: Image.Image) -> dict:
    model = load_model()
    target_size = _resolve_target_size(model)

    resample_method = (
        Image.Resampling.LANCZOS if hasattr(Image, "Resampling") else Image.LANCZOS
    )
    image = image.resize(target_size, resample_method)
    image_array = np.array(image)
    img_array = _preprocess_image(image_array, model)

    predictions = model.predict(img_array, verbose=0)

    if isinstance(predictions, list):
        predictions = predictions[0]

    if hasattr(predictions, "numpy"):
        predictions = predictions.numpy()

    num_classes = int(predictions.shape[-1])
    class_names = _resolve_class_names(num_classes)

    predicted_class_index = int(np.argmax(predictions[0]))
    confidence = float(np.max(predictions[0]))
    predicted_class = class_names[predicted_class_index]

    top_indices = np.argsort(predictions[0])[::-1][: min(3, num_classes)]
    top_predictions = [
        {
            "class": class_names[int(i)],
            "score": float(predictions[0][int(i)]),
        }
        for i in top_indices
    ]

    min_confidence = float(os.getenv("MIN_CONFIDENCE", "0.35"))
    low_confidence_warning = None

    if confidence < min_confidence:
        low_confidence_warning = (
            "Confidence model rendah. Verifikasi manual diperlukan."
        )

    # Grad-CAM
    try:
        last_conv_layer_name = get_last_conv_layer(model)
        heatmap = make_gradcam_heatmap(img_array, model, last_conv_layer_name, predicted_class_index)
        
        # Convert PIL image (RGB) to BGR for OpenCV functions
        original_img_bgr = cv2.cvtColor(np.array(image), cv2.COLOR_RGB2BGR)
        
        # Generate overlay and colorized heatmap
        gradcam_image_bgr, heatmap_color_bgr = overlay_heatmap(original_img_bgr, heatmap)

        # Encode colorized heatmap
        _, heatmap_buffer = cv2.imencode(".jpg", heatmap_color_bgr)
        heatmap_base64 = base64.b64encode(heatmap_buffer).decode("utf-8")

        # Encode overlay image
        _, buffer = cv2.imencode(".jpg", gradcam_image_bgr)
        gradcam_base64 = base64.b64encode(buffer).decode("utf-8")
        
        print("[Predict] Grad-CAM generated successfully")
    except Exception as e:
        print(f"[Predict] Grad-CAM failed: {str(e)}")
        # Fallback to original image if Grad-CAM fails
        _, buffer = cv2.imencode(".jpg", cv2.cvtColor(np.array(image), cv2.COLOR_RGB2BGR))
        gradcam_base64 = base64.b64encode(buffer).decode("utf-8")
        heatmap_base64 = None

    # AI Description
    ai_description = _gradcam_executor.submit(
        generate_ai_description,
        image_bytes=contents,
        prediction=predicted_class,
        confidence=confidence,
        gradcam_base64=gradcam_base64,
    ).result()

    return {
        "status": "success",
        "model_type": "classification",
        "prediction": predicted_class,
        "confidence": confidence,
        "top_predictions": top_predictions,
        "gradcam_heatmap": heatmap_base64,
        "gradcam_image": gradcam_base64,
        "ai_description": ai_description,
        "warning": low_confidence_warning,
    }


def _run_segmentation(contents: bytes) -> dict:
    seg_model = load_segmentation_model()
    seg_result = run_segmentation(image_bytes=contents, seg_model=seg_model)
    ai_description = generate_ai_description_segmentation(
        image_bytes=contents,
        area_stats=seg_result.get("area_stats", {}),
        overlay_base64=seg_result.get("overlay_base64"),
    )

    return {
        "status": "success",
        "model_type": "segmentation",
        "gradcam_heatmap": None,
        "gradcam_image": seg_result["overlay_base64"],
        "segmentation_mask": seg_result["mask_base64"],
        "ai_description": ai_description,
        "area_stats": seg_result["area_stats"],
        "mask_shape": seg_result["mask_shape"],
    }


# ──────────────────────────────────────────────
# Controllers
# ──────────────────────────────────────────────

class ImageController:
    @staticmethod
    def predict_image(file, user_id, model_type="classification"):
        try:
            contents = file.read()
            
            # Validation
            print(f"[Predict] Validating image for user {user_id}...")
            validation = validate_histopathology(contents)
            if not validation.get("is_histopathology", False):
                print("[Predict] Validation failed: Not histopathology")
                return {"status": "error", "message": "Not Histopathology Image"}

            if model_type == "classification":
                print("[Predict] Running classification...")
                image = Image.open(BytesIO(contents)).convert("RGB")
                result = _run_classification(contents, image)
            elif model_type == "segmentation":
                print("[Predict] Running segmentation...")
                result = _run_segmentation(contents)
            else:
                return {"status": "error", "message": f"Unknown model_type: {model_type}"}

            # Original image for storage
            print("[Predict] Storing result in repository...")
            original_b64 = base64.b64encode(contents).decode("utf-8")
            return ResultRepository.store_analysis_result(user_id, result, f"data:image/jpeg;base64,{original_b64}")
        except Exception as e:
            print(f"[Predict] CRITICAL ERROR: {str(e)}")
            import traceback
            traceback.print_exc()
            raise e


class HistoryController:
    @staticmethod
    def get_history(user_id):
        return ResultRepository.get_history(user_id)

    @staticmethod
    def filter_history(user_id, query):
        return ResultRepository.filter_history(user_id, query)

    @staticmethod
    def delete_history_item(user_id, history_id):
        success = ResultRepository.delete_history_item(user_id, history_id)
        return {"status": "success" if success else "error"}


# ──────────────────────────────────────────────
# Wrapper functions
# ──────────────────────────────────────────────

def predict_image(file, user_id, model_type="classification"):
    return ImageController.predict_image(file, user_id, model_type=model_type)

def get_history(user_id):
    return HistoryController.get_history(user_id)

def filter_history(user_id, query):
    return HistoryController.filter_history(user_id, query)
