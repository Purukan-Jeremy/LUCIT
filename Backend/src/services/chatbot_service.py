import google.generativeai as genai
from src.config.settings import GEMINI_API_KEY, GEMINI_CHAT_MODEL

OUT_OF_SCOPE_REPLY = "I'm sorry, but I can only answer questions related to the analysis results."


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
        "analysis",
        "result",
        "prediction",
        "confidence",
        "accuracy",
        "heatmap",
        "overlay",
        "histopathology",
        "tissue",
        "cancer",
        "kanker",
        "lung",
        "colon",
        "benign",
        "aca",
        "scc",
        "description",
        "model",
        "image",
        "disease",
        "diagnosis",
        "stage",
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
        follow_up_tokens = ["what", "this", "that", "why", "how", "explain"]
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

        if not GEMINI_API_KEY:
            return "Chatbot is unavailable because GEMINI_API_KEY is not configured."

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
            else "No previous conversation."
        )

        prompt = f"""You are an AI assistant for a histopathology analysis application.

Your Tasks:
- Answer user questions based on the available analysis results.
- Focus on interpreting the model results, confidence, and the AI description already generated.
- Use clear and concise English.
- Do not claim a definitive diagnosis. Explain that these results are supportive and not a final medical diagnosis.
- If the question is outside the context of the analysis results, answer exactly with this sentence and do not add anything else:
{OUT_OF_SCOPE_REPLY}

Analysis Context:
- Model type: {model_type}
- Prediction: {prediction}
- Confidence: {confidence_text}
- AI Description: {ai_description or "No additional description available."}

Conversation History:
{history_text}

User Question:
{message}

Answer in 1-3 short paragraphs, relevant to the analysis results above."""

        last_error = None
        for model_name in _chat_candidate_models():
            try:
                print(f"[Chatbot] Attempting with model: {model_name}")
                model = genai.GenerativeModel(model_name)
                response = model.generate_content(prompt)

                if not response.candidates:
                    print(f"[Chatbot] Model '{model_name}' returned no candidates.")
                    continue

                try:
                    text = response.text
                except (AttributeError, ValueError) as e:
                    print(f"[Chatbot] Could not extract text from '{model_name}': {e}")
                    if response.candidates:
                        candidate = response.candidates[0]
                        parts = getattr(candidate.content, "parts", [])
                        text = "".join([getattr(p, "text", "") for p in parts])
                    else:
                        text = ""

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
        return "Chatbot is temporarily unavailable. Please try again in a few moments."


def generate_chat_response(message: str, analysis_context: dict, chat_history: list | None = None) -> str:
    return LLMService.generate_chat_response(message, analysis_context, chat_history)
