import google.generativeai as genai
import base64
from src.config.settings import GEMINI_API_KEY

genai.configure(api_key=GEMINI_API_KEY)
model = genai.GenerativeModel("gemini-2.5-flash")  

def validate_histopathology(image_bytes):
    """
    Validasi apakah gambar termasuk histopatologi dan menentukan organ.
    Diubah menjadi sync agar bisa dipakai di Flask.
    """
    image_base64 = base64.b64encode(image_bytes).decode("utf-8")

    prompt = """
    Analyze this medical image.

    Answer ONLY in JSON format:
    {
        "is_histopathology": true/false,
        "organ": "lung" or "colon" or "unknown"
    }

    Determine:
    1. Is this a histopathology microscopic image?
    2. If yes, is it lung or colon tissue?
    """

    response = model.generate_content(
        [
            prompt,
            {
                "mime_type": "image/jpeg",
                "data": image_base64,
            },
        ]
    )

    try:
        result = eval(response.text)  
        return result
    except:
        return {
            "is_histopathology": False,
            "organ": "unknown"
        }


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

        response = model.generate_content(
            [
                prompt,
                {
                    "mime_type": "image/jpeg",
                    "data": image_base64,
                },
            ]
        )
        
        description = response.text.strip()
        
        description = description.replace("**", "").replace("*", "")
        
        print(f"AI Description generated successfully ({len(description)} characters)")
        return description
    
    except Exception as e:
        print(f"Error generating AI description: {str(e)}")
        import traceback
        traceback.print_exc()
        
        return "AI description generation failed"
