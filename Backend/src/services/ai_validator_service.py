import google.generativeai as genai
import base64
import json
import hashlib
import time
import os
from io import BytesIO
import numpy as np
from PIL import Image
from src.config.settings import GEMINI_API_KEY, GEMINI_DESCRIPTION_MODEL


def _candidate_models():
    preferred = (GEMINI_DESCRIPTION_MODEL or "").strip()
    models = [
        preferred,
        "gemini-2.0-flash",
        "gemini-1.5-flash",
        "gemini-1.5-pro",
    ]
    return [m for i, m in enumerate(models) if m and m not in models[:i]]


def get_description_model(model_name: str | None = None):
    genai.configure(api_key=GEMINI_API_KEY)
    return genai.GenerativeModel(model_name or GEMINI_DESCRIPTION_MODEL)


def _generate_with_fallback(prompt: str, image_base64: str):
    last_error = None
    for model_name in _candidate_models():
        try:
            response = get_description_model(model_name).generate_content(
                [
                    prompt,
                    {
                        "mime_type": "image/jpeg",
                        "data": image_base64,
                    },
                ]
            )
            return response, model_name
        except Exception as e:
            last_error = e
            print(f"Gemini model '{model_name}' failed: {e}")

    raise RuntimeError(f"All Gemini model candidates failed. Last error: {last_error}")


def _build_local_description(prediction: str, confidence: float) -> str:
    confidence_pct = max(0.0, min(1.0, float(confidence))) * 100
    label = (prediction or "Unknown").strip()
    label_lower = label.lower()

    if "benign" in label_lower:
        risk_text = "cenderung lebih rendah"
        recommendation = (
            "Hasil ini tetap perlu dikonfirmasi dengan evaluasi klinis dan pemeriksaan "
            "patologi oleh dokter spesialis."
        )
    elif any(word in label_lower for word in ["aca", "scc", "malignant"]):
        risk_text = "cenderung lebih tinggi"
        recommendation = (
            "Temuan ini perlu ditindaklanjuti dengan korelasi klinis, pemeriksaan "
            "patologi lanjutan, dan keputusan medis oleh dokter spesialis."
        )
    else:
        risk_text = "belum spesifik"
        recommendation = (
            "Interpretasi akhir harus mempertimbangkan data klinis, pemeriksaan "
            "histopatologi lengkap, dan penilaian dokter."
        )

    organ_text = (
        "jaringan paru"
        if "lung" in label_lower
        else "jaringan kolon"
        if "colon" in label_lower
        else "jaringan yang dianalisis"
    )


def _heuristic_histopathology_check(image_bytes: bytes) -> dict:
    """
    Lightweight fallback check for H&E-like histopathology color characteristics.
    This is heuristic-only and is used when Gemini validation is unavailable.
    """
    try:
        image = Image.open(BytesIO(image_bytes)).convert("RGB")
        # Downsample for speed/stability.
        image = image.resize((256, 256))
        rgb = np.array(image, dtype=np.uint8)

        # Convert RGB -> HSV in OpenCV-like ranges manually.
        # Use Pillow conversion for simplicity and reliability.
        hsv = np.array(image.convert("HSV"), dtype=np.uint8)
        h = hsv[..., 0]  # 0..255
        s = hsv[..., 1]
        v = hsv[..., 2]

        # H&E-like stain mask:
        # Pink/magenta near high hue end plus purple region, with enough saturation/brightness.
        pink_magenta = (h >= 200) | (h <= 15)
        purple = (h >= 165) & (h < 200)
        stain_mask = (pink_magenta | purple) & (s > 35) & (v > 35)

        # Tissue coverage to avoid mostly flat/non-tissue images.
        tissue_mask = (s > 22) & (v > 25)

        stain_ratio = float(np.mean(stain_mask))
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
        print(f"Heuristic validation failed: {e}")
        return {
            "is_histopathology": False,
            "organ": "unknown",
            "validation_status": "heuristic_failed",
        }

    return (
        f"Berdasarkan hasil analisis model, sampel diprediksi sebagai {label} "
        f"dengan tingkat keyakinan sekitar {confidence_pct:.2f}%. Temuan ini menunjukkan bahwa "
        f"pola visual yang dominan pada {organ_text} lebih konsisten dengan karakteristik kelas tersebut "
        f"dibandingkan kelas lain dalam model yang sama. Secara umum, pola morfologi yang dikenali model "
        f"menunjukkan kecenderungan risiko yang {risk_text}, sehingga hasil ini dapat digunakan sebagai "
        f"indikator awal dalam proses telaah klinis. Nilai confidence yang tinggi menandakan konsistensi "
        f"prediksi pada citra masukan, tetapi confidence bukan ukuran kepastian diagnosis absolut karena "
        f"masih dipengaruhi kualitas preparat, variasi pewarnaan, artefak gambar, dan distribusi data latih model. "
        f"Dalam praktiknya, interpretasi hasil AI sebaiknya dibaca bersama temuan mikroskopis lain, konteks klinis pasien, "
        f"serta informasi laboratorium/penunjang yang relevan agar keputusan medis lebih komprehensif. "
        f"Hasil ini bersifat pendukung dan tidak menggantikan diagnosis medis final oleh dokter. "
        f"{recommendation} Sebagai langkah berikut, pertimbangkan evaluasi komparatif pada area jaringan lain, "
        f"review ulang slide oleh ahli patologi, dan pemantauan berkala bila dibutuhkan sesuai kondisi klinis."
    )

validation_cache = {}

last_request_time = 0

MIN_REQUEST_INTERVAL = 3

def validate_histopathology(image_bytes):

    global last_request_time

    image_hash = hashlib.md5(image_bytes).hexdigest()

    if image_hash in validation_cache:
        print("Using cached validation")
        return validation_cache[image_hash]

    current_time = time.time()

    if current_time - last_request_time < MIN_REQUEST_INTERVAL:
        # Keep a very short cooldown to reduce duplicate calls, but do not auto-approve.
        wait_seconds = MIN_REQUEST_INTERVAL - (current_time - last_request_time)
        print(f"Validation cooldown active ({wait_seconds:.2f}s). Continuing with strict validation.")

    last_request_time = current_time

    try:

        image_base64 = base64.b64encode(image_bytes).decode("utf-8")

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
        text = text.replace("```json", "").replace("```", "").strip()

        result = json.loads(text)
        result["is_histopathology"] = bool(result.get("is_histopathology", False))
        result["organ"] = str(result.get("organ", "unknown")).lower()
        result["validation_status"] = "ok"
        print(f"Validation generated using Gemini model: {used_model}")

        validation_cache[image_hash] = result

        return result

    except Exception as e:

        print("Gemini validation failed:", e)
        fallback_result = _heuristic_histopathology_check(image_bytes)
        print(f"Heuristic validation result: {fallback_result}")
        return fallback_result


def generate_ai_description(image_bytes, prediction: str, confidence: float, gradcam_base64: str = None) -> str:
    """
    Generate AI description menggunakan Gemini API
    
    Args:
        image_bytes: Raw image bytes
        prediction: Hasil prediksi (e.g., "Lung ACA")
        confidence: Confidence score (0-1)
        gradcam_base64: Optional Grad-CAM visualization base64
    
    Returns:
        AI-generated description in Bahasa Indonesia
    """
    
    if not GEMINI_API_KEY:
        print("Warning: GEMINI_API_KEY not configured")
        return "AI description unavailable: API key not configured"
    
    try:
        image_base64 = base64.b64encode(image_bytes).decode("utf-8")
        
        prompt = f"""Anda adalah asisten AI medis yang ahli dalam analisis histopatologi.

Saya telah menganalisis gambar histopatologi dengan hasil berikut:
- Prediksi: {prediction}
- Confidence: {(confidence * 100):.2f}%

Tolong analisis gambar histopatologi ini dan berikan deskripsi medis yang detail dalam Bahasa Indonesia. Jawab HANYA dalam Bahasa Indonesia, dalam paragraf yang mengalir, tanpa numbering atau bullets. Panjang total: sekitar 12-15 kalimat."""

        response, used_model = _generate_with_fallback(prompt, image_base64)
        
        description = (response.text or "").strip()
        description = description.replace("**", "").replace("*", "").strip()

        if not description:
            print(
                f"Gemini returned empty description using model: {used_model}. "
                "Falling back to local description."
            )
            return _build_local_description(prediction=prediction, confidence=confidence)

        print(
            f"AI Description generated successfully ({len(description)} characters) "
            f"using model: {used_model}"
        )
        return description
    
    except Exception as e:
        print(f"Error generating AI description: {str(e)}")
        import traceback
        traceback.print_exc()

        # Always return a useful description even if Gemini is unavailable.
        return _build_local_description(prediction=prediction, confidence=confidence)
