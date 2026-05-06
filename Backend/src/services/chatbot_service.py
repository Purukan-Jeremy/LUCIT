from src.config.settings import GEMINI_CHAT_MODEL
from src.services.vertex_rest_client import VertexRestClient, VertexApiError

OUT_OF_SCOPE_REPLY = "Maaf, saya hanya bisa menjawab pertanyaan yang berkaitan dengan hasil analisis."


def _chat_candidate_models():
    preferred = (GEMINI_CHAT_MODEL or "").strip()
    models = [
        preferred,
        "gemini-2.5-flash"
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
        "hasil",
        "analysis",
        "result",
        "prediction",
        "prediksi",
        "confidence",
        "kepercayaan",
        "accuracy",
        "akurasi",
        "heatmap",
        "overlay",
        "histopathology",
        "histopatologi",
        "tissue",
        "jaringan",
        "cancer",
        "kanker",
        "lung",
        "colon",
        "benign",
        "aca",
        "scc",
        "description",
        "deskripsi",
        "model",
        "image",
        "gambar",
        "disease",
        "penyakit",
        "diagnosis",
        "stage",
        "ringkasan",
        "segmentasi",
    ]
    if any(keyword in text for keyword in strong_analysis_keywords):
        return True

    has_context = _has_analysis_context(analysis_context) or bool(chat_history)
    if has_context:
        off_topic_keywords = [
            "weather",
            "song",
            "music",
            "movie",
            "sports",
            "game",
            "politics",
            "code",
            "programming",
            "recipe",
            "cooking",
        ]
        if any(keyword in text for keyword in off_topic_keywords):
            return False

        # Support short follow-up questions that refer to previous analysis context.
        follow_up_tokens = ["what", "this", "that", "why", "how", "explain", "apa", "ini", "itu", "mengapa", "bagaimana", "jelaskan"]
        if any(token in text for token in follow_up_tokens):
            return True

        if len(text.split()) <= 8:
            return True

    return False


class LLMService:
    @staticmethod
    def generate_chat_response(message: str, analysis_context: dict, chat_history: list | None = None) -> str:
        if not _is_analysis_related(message, analysis_context, chat_history):
            return OUT_OF_SCOPE_REPLY

        # Validation of API configurations is now handled entirely within VertexRestClient

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
            role = "Pengguna" if item.get("role") == "user" else "Asisten"
            text = (item.get("text") or "").strip()
            if text:
                history_lines.append(f"{role}: {text}")

        history_text = (
            "\n".join(history_lines)
            if history_lines
            else "Tidak ada percakapan sebelumnya."
        )

        prompt = f"""Anda adalah asisten AI untuk aplikasi analisis histopatologi.

Tugas Anda:
- Jawab pertanyaan pengguna berdasarkan hasil analisis yang tersedia.
- Fokus pada interpretasi hasil model, tingkat kepercayaan, dan deskripsi AI yang sudah dihasilkan.
- Gunakan bahasa Indonesia yang jelas dan ringkas.
- Jangan mengklaim diagnosis pasti. Jelaskan bahwa hasil ini bersifat suportif dan bukan diagnosis medis final.
- Jika pertanyaan di luar konteks hasil analisis, jawab persis dengan kalimat berikut dan jangan tambahkan apa pun:
{OUT_OF_SCOPE_REPLY}

Konteks Analisis:
- Tipe model: {model_type}
- Prediksi: {prediction}
- Kepercayaan: {confidence_text}
- Deskripsi AI: {ai_description or "Tidak ada deskripsi tambahan yang tersedia."}

Riwayat Percakapan:
{history_text}

Pertanyaan Pengguna:
{message}

Jawab dalam 1-3 paragraf singkat, relevan dengan hasil analisis di atas, dan gunakan bahasa Indonesia saja."""

        last_error = None
        for model_name in _chat_candidate_models():
            try:
                
                # Use raw REST API instead of Google GenAI SDK
                print(f"[Chatbot] Attempting with model: {model_name}")
                text = VertexRestClient.generate_content(model_id=model_name, prompt=prompt)
                
                text = (text or "").strip().replace("**", "").replace("*", "")
                if text:
                    print(f"[Chatbot] Success using model: {model_name}")
                    return text
                else:
                    print(f"[Chatbot] Model '{model_name}' returned empty text.")
            except Exception as e:
                last_error = e
                print(f"[Chatbot] Model '{model_name}' failed: {str(e)}")

        print(f"[Chatbot] All chat model candidates failed. Last error: {last_error}")
        return "Chatbot sedang tidak tersedia sementara. Silakan coba lagi dalam beberapa saat."


def generate_chat_response(message: str, analysis_context: dict, chat_history: list | None = None) -> str:
    return LLMService.generate_chat_response(message, analysis_context, chat_history)
