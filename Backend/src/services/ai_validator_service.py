from src.services.vertex_rest_client import VertexRestClient, VertexApiError
import base64
import json
import hashlib
from io import BytesIO
import numpy as np
from PIL import Image
from src.config.settings import GEMINI_DESCRIPTION_MODEL

# Variables that were for GenAI are removed
validation_cache = {}
description_cache = {}
segmentation_description_cache = {}  


def _candidate_models():
    preferred = (GEMINI_DESCRIPTION_MODEL or "").strip()
    models = [
        preferred,
        "gemini-2.5-flash"
    ]
    return [m for i, m in enumerate(models) if m and m not in models[:i]]


# Removed get_description_model since we use REST Client directly


def _encode_image_for_gemini(image_bytes: bytes, max_side: int = 768, quality: int = 82) -> str:
    image = Image.open(BytesIO(image_bytes)).convert("RGB")
    width, height = image.size
    longest_side = max(width, height)

    if longest_side > max_side:
        scale = max_side / float(longest_side)
        resized = (
            max(1, int(round(width * scale))),
            max(1, int(round(height * scale))),
        )
        resample_method = (
            Image.Resampling.LANCZOS if hasattr(Image, "Resampling") else Image.LANCZOS
        )
        image = image.resize(resized, resample_method)

    buffer = BytesIO()
    image.save(buffer, format="JPEG", quality=quality, optimize=True)
    return base64.b64encode(buffer.getvalue()).decode("utf-8")


def _generate_with_fallback(prompt: str, image_base64: str):
    last_error = None
    for model_name in _candidate_models():
        try:
            # We skip passing the raw text response as an object wrapper,
            # and just return the extracted text string directly for compatibility with callers 
            # if we adapt the callers to expect plain strings.
            # Wait, current callers expect `response.text`.
            # Let's wrap the text in a mock object so we don't have to refactor callers.
            text = VertexRestClient.generate_content(model_id=model_name, prompt=prompt, image_base64=image_base64)
            
            class MockResponse:
                def __init__(self, text):
                    self.text = text
            return MockResponse(text), model_name
        except Exception as e:
            last_error = e
            print(f"Vertex API model '{model_name}' failed: {e}")

    raise RuntimeError(f"All Gemini model candidates failed. Last error: {last_error}")


def _build_local_description(prediction: str, confidence: float) -> str:
    confidence_pct = max(0.0, min(1.0, float(confidence))) * 100
    label = (prediction or "Unknown").strip()
    label_lower = label.lower()

    if "benign" in label_lower:
        risk_text = "tends to be lower"
        recommendation = (
            "This result should still be confirmed with clinical evaluation and "
            "pathological examination by a specialist physician."
        )
    elif any(word in label_lower for word in ["aca", "scc", "malignant"]):
        risk_text = "tends to be higher"
        recommendation = (
            "These findings should be followed up with clinical correlation, "
            "further pathological examination, and medical decisions by a specialist physician."
        )
    else:
        risk_text = "is not yet specific"
        recommendation = (
            "Final interpretation must consider clinical data, complete "
            "histopathology examination, and physician assessment."
        )

    organ_text = (
        "lung tissue"
        if "lung" in label_lower
        else "colon tissue"
        if "colon" in label_lower
        else "the analyzed tissue"
    )

    return (
        f"Based on the model analysis results, the sample is predicted as {label} "
        f"with a confidence level of approximately {confidence_pct:.2f}%. This finding indicates that "
        f"the dominant visual patterns in {organ_text} are more consistent with the characteristics of that class "
        f"compared to other classes in the same model. Generally, the morphological patterns recognized by the model "
        f"show a risk tendency that {risk_text}, so this result can be used as an initial indicator in the clinical review process. "
        f"A high confidence value indicates consistency of prediction on the input image, but confidence is not an absolute "
        f"measure of diagnostic certainty as it is still influenced by specimen quality, staining variations, image artifacts, "
        f"and the model's training data distribution. In practice, AI result interpretations should be read alongside other "
        f"microscopic findings, patient clinical context, and relevant laboratory or supporting information so that medical "
        f"decisions are more comprehensive. This result is supportive and does not replace a final medical diagnosis by a doctor. "
        f"{recommendation} As a next step, consider comparative evaluation on other tissue areas, slide review by a pathologist, "
        f"and periodic monitoring as needed according to clinical conditions."
    )


def _build_local_segmentation_description(area_stats: dict) -> str:
    cancer_pct = float(area_stats.get("cancer_percent", 0.0))
    normal_pct = float(area_stats.get("normal_percent", 100.0))

    if cancer_pct > 50:
        severity_text  = "extensive cancer cells involvement"
        risk_text      = "high"
        recommendation = (
            "These findings are strongly recommended for immediate follow-up with "
            "a complete pathological examination and specialist consultation."
        )
    elif cancer_pct > 20:
        severity_text  = "moderate cancer cells involvement"
        risk_text      = "medium to high"
        recommendation = (
            "This result should be confirmed with further histopathology "
            "examination by a specialist physician."
        )
    elif cancer_pct > 5:
        severity_text  = "small but detected cancer cells area"
        risk_text      = "low to medium"
        recommendation = (
            "Periodic monitoring and further clinical evaluation are recommended "
            "to confirm these findings."
        )
    else:
        severity_text  = "minimal or non-significant cancer cells area"
        risk_text      = "low"
        recommendation = (
            "This result still needs to be confirmed through clinical evaluation and "
            "pathology examination by a specialist physician."
        )

    return (
        f"Based on the model segmentation results, {severity_text} was found in the analyzed histopathology image. "
        f"Approximately {cancer_pct:.2f}% of the total tissue area was identified as an area potentially containing "
        f"cancer cells, while the remaining {normal_pct:.2f}% is tissue not marked with red color on the overlay. "
        f"The spatial distribution pattern of the cancer area on this image shows a risk tendency that is {risk_text} "
        f"based on the proportion of the area detected. Segmentation was performed using a U-Net based deep learning model "
        f"that automatically identifies morphological boundaries between normal and abnormal tissue. It should be understood "
        f"that segmentation results are influenced by specimen quality, H&E staining variation, image artifacts, and the "
        f"threshold used in the mask binarization process. The red overlay visualization on the image shows the specific area "
        f"identified as a region of interest by the model, which can assist pathologists in reviewing priority areas. "
        f"This segmentation result is supportive of clinical decisions and does not replace a final medical diagnosis. "
        f"{recommendation} As a further step, it is recommended to conduct a slide review by a pathologist and "
        f"correlation with patient clinical data and other relevant supporting examinations."
    )


def generate_ai_description_segmentation(
    image_bytes: bytes,
    area_stats: dict,
    overlay_base64: str = None,
) -> str:
    # Using the local fallback immediately if REST config errors out implicitly,
    # but we will just pass it to the generator and let it handle the error.

    image_hash = hashlib.md5(image_bytes).hexdigest()
    stats_hash = hashlib.md5(json.dumps(area_stats, sort_keys=True).encode()).hexdigest()
    cache_key  = f"seg:{image_hash}:{stats_hash}"

    if cache_key in segmentation_description_cache:
        print("Using cached AI segmentation description.")
        return segmentation_description_cache[cache_key]

    cancer_pct  = float(area_stats.get("cancer_percent", 0.0))
    normal_pct  = float(area_stats.get("normal_percent", 100.0))

    try:
        if overlay_base64:
            image_base64 = overlay_base64
        else:
            image_base64 = _encode_image_for_gemini(image_bytes, max_side=768, quality=82)

        prompt = f"""You are a medical AI assistant expert in histopathology analysis and cancer segmentation.

I have performed automatic segmentation on a histopathology image using a U-Net model with the following results:
- Area detected as cancer : {cancer_pct:.2f}%
- Area detected as normal: {normal_pct:.2f}%
- In the overlay image, the red areas indicate regions identified as cancer by the model, while areas not marked in red represent normal tissue.

Please analyze this histopathology image (with the segmentation overlay) and provide a detailed medical description in English. \
Include interpretations of the spatial distribution of cancer areas, observed morphological characteristics, and the level of tissue involvement. \
Do not mention pixel counts, neoplastic, biopsy, resection, prognosis, cancer stage, metastasis, post-therapy recurrence, \
or treatment strategy plans. \
Answer ONLY in English, in a flowing paragraph without numbering or bullets. Total length: approximately 12-15 sentences."""

        response, used_model = _generate_with_fallback(prompt, image_base64)

        description = (response.text or "").strip()
        description = description.replace("**", "").replace("*", "").strip()

        if not description:
            return _build_local_segmentation_description(area_stats)

        print(f"AI Segmentation Description generated successfully using model: {used_model}")
        segmentation_description_cache[cache_key] = description
        return description

    except Exception as e:
        print(f"Error generating AI segmentation description: {str(e)}")
        return _build_local_segmentation_description(area_stats)


def _heuristic_histopathology_check(image_bytes: bytes) -> dict:
    try:
        image = Image.open(BytesIO(image_bytes)).convert("RGB")
        image = image.resize((256, 256))
        hsv = np.array(image.convert("HSV"), dtype=np.uint8)
        h = hsv[..., 0]
        s = hsv[..., 1]
        v = hsv[..., 2]

        pink_magenta = (h >= 200) | (h <= 15)
        purple = (h >= 165) & (h < 200)
        stain_mask = (pink_magenta | purple) & (s > 35) & (v > 35)
        tissue_mask = (s > 22) & (v > 25)

        stain_ratio  = float(np.mean(stain_mask))
        tissue_ratio = float(np.mean(tissue_mask))

        is_histopathology = bool(stain_ratio >= 0.16 and tissue_ratio >= 0.22)

        return {
            "is_histopathology": is_histopathology,
            "organ": "unknown",
            "validation_status": "heuristic",
            "stain_ratio": round(stain_ratio, 4),
            "tissue_ratio": round(tissue_ratio, 4),
        }
    except Exception as e:
        return {
            "is_histopathology": False,
            "organ": "unknown",
            "validation_status": "heuristic_failed",
        }


def validate_histopathology(image_bytes):
    image_hash = hashlib.md5(image_bytes).hexdigest()

    if image_hash in validation_cache:
        return validation_cache[image_hash]

    try:
        image_base64 = _encode_image_for_gemini(image_bytes, max_side=640, quality=74)

        prompt = """
        Analyze this medical image.

        Answer ONLY in JSON format:
        {
            "is_histopathology": true/false,
            "organ": "lung" or "colon" or "unknown"
        }
        """

        response, used_model = _generate_with_fallback(prompt, image_base64)

        text = response.text.strip()
        import re
        match = re.search(r"\{.*\}", text, re.DOTALL)
        if match:
            text = match.group(0)
        else:
            text = text.replace("```json", "").replace("```", "").strip()

        result = json.loads(text)
        result["is_histopathology"] = bool(result.get("is_histopathology", False))
        result["organ"]             = str(result.get("organ", "unknown")).lower()
        result["validation_status"] = "ok"

        validation_cache[image_hash] = result
        return result

    except Exception as e:
        return _heuristic_histopathology_check(image_bytes)


def generate_ai_description(image_bytes, prediction: str, confidence: float, gradcam_base64: str = None) -> str:
    # Removed GEMINI_API_KEY validation here as it's handled by VertexRestClient

    image_hash = hashlib.md5(image_bytes).hexdigest()
    cache_key  = f"{image_hash}:{prediction}:{confidence:.6f}"
    if cache_key in description_cache:
        return description_cache[cache_key]

    try:
        image_base64 = _encode_image_for_gemini(image_bytes, max_side=768, quality=82)

        prompt = f"""You are a medical AI assistant expert in histopathology analysis.

I have analyzed a histopathology image with the following results:
- Prediction: {prediction}
- Confidence: {(confidence * 100):.2f}%

Please analyze this histopathology image and provide a detailed medical description in English. Answer ONLY in English, in a flowing paragraph without numbering or bullets. Total length: approximately 12-15 sentences."""

        response, used_model = _generate_with_fallback(prompt, image_base64)
        
        description = (response.text or "").strip()
        description = description.replace("**", "").replace("*", "").strip()

        if not description:
            return _build_local_description(prediction=prediction, confidence=confidence)

        print(f"AI Description generated successfully using model: {used_model}")
        description_cache[cache_key] = description
        return description
    
    except Exception as e:
        return _build_local_description(prediction=prediction, confidence=confidence)