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
    """
    Preprocess mode:
    - auto (default): if model has Rescaling layer => keep 0..255, else divide 255
    - rescale_01: divide by 255
    - imagenet_tf: tf-style preprocess_input (to -1..1)
    - none: no normalization
    """
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
        print(
            f"Ignoring CLASS_NAMES env because length mismatch: "
            f"{len(parsed)} != {num_classes}"
        )

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

    print(f"Predicted class: {predicted_class} | Confidence: {confidence:.4f}")

    min_confidence = float(os.getenv("MIN_CONFIDENCE", "0.35"))
    low_confidence_warning = None

    if confidence < min_confidence:
        print(
            f"Low confidence detected: {confidence:.4f} < {min_confidence:.2f}. "
            "Returning result with warning instead of hard reject."
        )
        low_confidence_warning = (
            "Confidence model rendah untuk klasifikasi paru/usus besar. "
            "Silakan verifikasi manual dengan ahli patologi."
        )

    # ── Grad-CAM ────────────────────────────────────────
    print("Generating Grad-CAM heatmap...")
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

    # ── AI Description ───────────────────────────────────
    print("Generating AI description...")
    ai_description_future = _gradcam_executor.submit(
        generate_ai_description,
        image_bytes=contents,
        prediction=predicted_class,
        confidence=confidence,
        gradcam_base64=gradcam_base64,
    )
    
    ai_description = ai_description_future.result()

    if not isinstance(ai_description, str) or not ai_description.strip():
        risk_phrase = (
            "higher-risk malignant pattern"
            if any(token in predicted_class.lower() for token in ["aca", "scc", "malignant"])
            else "lower-risk benign pattern"
            if "benign" in predicted_class.lower()
            else "non-specific pattern"
        )

        ai_description = (
            f"Based on the model output, this sample is classified as {predicted_class} "
            f"with an estimated confidence of {confidence * 100:.2f}%. The visual features "
            f"identified by the network are more consistent with a {risk_phrase} than with "
            "other available classes in the same model. A high confidence score suggests that "
            "the internal feature matching process was stable for this image, but confidence does "
            "not represent absolute diagnostic certainty. This AI interpretation should be used "
            "as decision-support only, not as a standalone diagnosis."
        )

    print("AI description generated")

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
    print("[Segmentation] Loading segmentation model...")
    seg_model = load_segmentation_model()

    print("[Segmentation] Running segmentation pipeline...")
    seg_result = run_segmentation(
        image_bytes=contents,
        seg_model=seg_model,
    )

    print("[Segmentation] Generating AI description...")
    try:
        area_stats = seg_result.get("area_stats", {})
        # Use cancer_percent directly from area_stats
        cancer_percentage = area_stats.get("cancer_percent", 0.0)

        # Interpretasi level
        if cancer_percentage > 50:
            severity = "extensive cancer involvement"
        elif cancer_percentage > 20:
            severity = "moderate cancer involvement"
        elif cancer_percentage > 5:
            severity = "small cancer region detected"
        else:
            severity = "minimal or no significant cancer region"

        ai_description = (
            f"The segmentation model identified regions of interest within the histopathology image. "
            f"Approximately {cancer_percentage:.2f}% of the tissue area is classified as cancer region, "
            f"suggesting {severity}. The segmentation mask highlights areas that are morphologically "
            f"different from surrounding tissue. This result is intended as a decision-support tool "
            f"and should not be used as a standalone medical diagnosis. Expert pathology review is recommended."
        )

    except Exception as e:
        print("[Segmentation] AI description error:", e)
        ai_description = (
            "The segmentation model generated a cancer mask, but additional interpretation "
            "could not be completed. Please refer to the visual output and consult a medical expert."
        )

    print("[Segmentation] Done.")
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
                "message": "Not Histopathology Image"
            }

        if model_type == "none":
            return {
                "status": "error", 
                "message": "No model selected. Please select Classification or Segmentation."
            }

        if model_type == "classification":
            image = Image.open(BytesIO(contents)).convert("RGB")
            result = _run_classification(contents, image)
        elif model_type == "segmentation":
            result = _run_segmentation(contents)
        else:
            return {"status": "error", "message": f"Unknown model_type: {model_type}"}

        return ResultRepository.store_analysis_result(result)


class HistoryController:
    @staticmethod
    def get_history():
        return {
            "status": "success",
            "data": ResultRepository.get_history(),
        }

    @staticmethod
    def filter_history(query):
        return {
            "status": "success",
            "data": ResultRepository.filter_history(query),
        }


# ──────────────────────────────────────────────
# module-level wrapper functions
# ──────────────────────────────────────────────

def predict_image(file, model_type="classification"):
    return ImageController.predict_image(file, model_type=model_type)


def get_history():
    return HistoryController.get_history()


def filter_history(query):
    return HistoryController.filter_history(query)


AnalysisController = ImageController
