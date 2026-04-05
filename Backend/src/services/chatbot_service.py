import google.generativeai as genai
from src.config.settings import GEMINI_API_KEY, GEMINI_CHAT_MODEL

OUT_OF_SCOPE_REPLY = "Maaf, saya hanya menjawab terkait dengan hasil analisis."


def _chat_candidate_models():
    preferred = (GEMINI_CHAT_MODEL or "").strip()
    models = [
        preferred,
        "gemini-2.0-flash",
        "gemini-1.5-flash",
    ]
    return [m for i, m in enumerate(models) if m and m not in models[:i]]


def _has_analysis_context(analysis_context: dict) -> bool:
    if not analysis_context:
        return False
    prediction = str(analysis_context.get("prediction", "")).strip().lower()
    ai_description = str(analysis_context.get("ai_description", "")).strip()
    return bool(ai_description) or (prediction not in ("", "unknown", "n/a"))


def _is_analysis_related(message: str, analysis_context: dict, chat_history: list | None = None) -> bool:
    text = (message or "").lower()
    strong_analysis_keywords = [
        "analisis",
        "hasil",
        "prediksi",
        "confidence",
        "akurasi",
        "heatmap",
        "overlay",
        "histopatologi",
        "jaringan",
        "tumor",
        "kanker",
        "lung",
        "colon",
        "benign",
        "aca",
        "scc",
        "deskripsi",
        "model",
        "gambar",
        "penyakit",
        "diagnosis",
        "stadium",
    ]
    if any(keyword in text for keyword in strong_analysis_keywords):
        return True

    has_context = _has_analysis_context(analysis_context) or bool(chat_history)
    if has_context:
        off_topic_keywords = [
            "cuaca",
            "lagu",
            "musik",
            "film",
            "bola",
            "game",
            "politik",
            "kode",
            "programming",
            "resep",
            "masak",
        ]
        if any(keyword in text for keyword in off_topic_keywords):
            return False

        # Support short follow-up questions that refer to previous analysis context.
        follow_up_tokens = ["apa", "ini", "itu", "tersebut", "kenapa", "bagaimana", "jelaskan"]
        if any(token in text for token in follow_up_tokens):
            return True

        if len(text.split()) <= 8:
            return True

    return False


def generate_chat_response(message: str, analysis_context: dict, chat_history: list | None = None) -> str:
    if not _is_analysis_related(message, analysis_context, chat_history):
        return OUT_OF_SCOPE_REPLY

    if not GEMINI_API_KEY:
        return "Chatbot tidak tersedia karena GEMINI_API_KEY belum dikonfigurasi."

    genai.configure(api_key=GEMINI_API_KEY)

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
{OUT_OF_SCOPE_REPLY}

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

    last_error = None
    for model_name in _chat_candidate_models():
        try:
            model = genai.GenerativeModel(model_name)
            response = model.generate_content(prompt)
            text = (response.text or "").strip().replace("**", "").replace("*", "")
            if text:
                return text
        except Exception as e:
            last_error = e
            print(f"Chat model '{model_name}' failed: {e}")

    print(f"All chat model candidates failed: {last_error}")
    return "Chatbot sedang tidak tersedia untuk sementara. Silakan coba lagi dalam beberapa saat."
