import google.generativeai as genai
from src.config.settings import GEMINI_API_KEY, GEMINI_CHAT_MODEL


def generate_chat_response(message: str, analysis_context: dict, chat_history: list | None = None) -> str:
    if not GEMINI_API_KEY:
        return "Chatbot tidak tersedia karena GEMINI_API_KEY belum dikonfigurasi."

    genai.configure(api_key=GEMINI_API_KEY)
    model = genai.GenerativeModel(GEMINI_CHAT_MODEL)

    prediction = analysis_context.get("prediction", "Unknown")
    confidence = analysis_context.get("confidence")
    model_type = analysis_context.get("model_type", "classification")
    ai_description = analysis_context.get("ai_description", "")

    confidence_text = (
        f"{float(confidence) * 100:.2f}%"
        if isinstance(confidence, (int, float))
        else "N/A"
    )

    history_lines = []
    for item in chat_history or []:
        role = "User" if item.get("role") == "user" else "Assistant"
        text = (item.get("text") or "").strip()
        if text:
            history_lines.append(f"{role}: {text}")

    history_text = (
        "\n".join(history_lines)
        if history_lines
        else "Belum ada percakapan sebelumnya."
    )

    prompt = f"""Anda adalah asisten AI untuk aplikasi analisis histopatologi.

Tugas Anda:
- Menjawab pertanyaan user berdasarkan hasil analisis yang tersedia.
- Fokus pada interpretasi hasil model, confidence, dan deskripsi AI yang sudah dihasilkan.
- Gunakan Bahasa Indonesia yang jelas dan ringkas.
- Jangan mengklaim diagnosis pasti. Jelaskan bahwa hasil ini bersifat pendukung, bukan diagnosis medis final.
- Jika pertanyaan di luar konteks hasil analisis, jawab persis dengan kalimat ini dan jangan tambahkan apa pun lagi:
Tugas saya adalah membantu Anda memahami hasil analisis histopatologi yang telah dilakukan.

Konteks analisis:
- Tipe model: {model_type}
- Prediksi: {prediction}
- Confidence: {confidence_text}
- Deskripsi AI: {ai_description or "Tidak ada deskripsi tambahan."}

Riwayat percakapan:
{history_text}

Pertanyaan user:
{message}

Jawab dalam 1-3 paragraf singkat, relevan dengan hasil analisis di atas."""

    try:
        response = model.generate_content(prompt)
        text = (response.text or "").strip().replace("**", "").replace("*", "")
        return text or "Maaf, saya tidak dapat menghasilkan jawaban saat ini."
    except Exception:
        return "Chatbot sedang tidak tersedia untuk sementara. Silakan coba lagi dalam beberapa saat."
