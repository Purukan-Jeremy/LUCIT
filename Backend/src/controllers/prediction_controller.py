import numpy as np
import cv2
import base64
from io import BytesIO
from PIL import Image

from src.models.model_loader import ImageClassifier
from src.repositories.analysis_repository import ResultRepository
from src.services.gradcam_service import (
    get_last_conv_layer,
    make_gradcam_heatmap,
    overlay_heatmap,
)
from src.services.ai_validator_service import ImageValidator

IMG_SIZE = 224
CLASS_NAMES = ["Colon ACA", "Colon Benign", "Lung ACA", "Lung Benign", "Lung SCC"]

class ImageController:
    @staticmethod
    def predict_image(file, model_type="classification"):
        """
        Fungsi prediksi gambar histopatologi.
        model_type: "classification" atau "segmentation"
        """

        contents = file.read()

        print("Validating image with Gemini...")
        validation = ImageValidator.validate_histopathology(contents)
        print("Validation result:", validation)

        if not validation.get("is_histopathology", False):
            return {
                "status": "error",
                "message": "Not Histopathology Image"
            }

        if model_type == "classification":
            model = ImageClassifier.load_model()
        elif model_type == "segmentation":
            return {"status": "error", "message": "Segmentation belum tersedia"}
        else:
            return {"status": "error", "message": f"Unknown model_type: {model_type}"}

        target_size = _resolve_target_size(model)
        image = Image.open(BytesIO(contents)).convert("RGB")
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

        print(f"Predicted class: {predicted_class}")
        print(f"Confidence: {confidence:.4f}")
        print(f"Top predictions: {top_predictions}")

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

        print("Generating AI description...")
        ai_description_future = _gradcam_executor.submit(
            ImageValidator.generate_ai_description,
            image_bytes=contents,
            prediction=predicted_class,
            confidence=confidence,
            gradcam_base64=None,
        )

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
                "not represent absolute diagnostic certainty and can still be influenced by staining "
                "variation, tissue preparation quality, scanner artifacts, and distribution shifts "
                "between training data and real-world slides. Therefore, this AI interpretation should "
                "be used as decision-support only, not as a standalone diagnosis. Final interpretation "
                "must integrate pathology review, clinical findings, and additional diagnostic context. "
                "As a practical next step, consider reviewing suspicious regions at higher magnification, "
                "correlating with other tissue sections from the same case, and confirming the conclusion "
                "through specialist pathologist assessment."
            )

        print("AI description generated")

        result = {
            "status": "success",
            "prediction": predicted_class,
            "confidence": confidence,
            "top_predictions": top_predictions,
            "gradcam_heatmap": heatmap_base64,
            "gradcam_image": gradcam_base64,
            "ai_description": ai_description,
            "warning": low_confidence_warning,
        }
        return ResultRepository.store_analysis_result(result)


def predict_image(file, model_type="classification"):
<<<<<<< Updated upstream
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
=======
    return ImageController.predict_image(file, model_type=model_type)


AnalysisController = ImageController
>>>>>>> Stashed changes
