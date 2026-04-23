import json
import requests
from src.config.settings import VERTEX_API_KEY, VERTEX_PROJECT_ID, VERTEX_LOCATION

class VertexApiError(Exception):
    pass

class VertexRestClient:
    """
    A minimal REST API client for Vertex AI that uses raw HTTP requests
    with an API Key, mimicking the TypeScript implementation.
    """
    @staticmethod
    def _build_url(model_id: str) -> str:
        if not VERTEX_API_KEY or not VERTEX_PROJECT_ID:
            raise VertexApiError("Vertex AI is not configured (VERTEX_API_KEY and VERTEX_PROJECT_ID required)")
            
        location = VERTEX_LOCATION or "us-central1"
        return f"https://{location}-aiplatform.googleapis.com/v1beta1/projects/{VERTEX_PROJECT_ID}/locations/{location}/publishers/google/models/{model_id}:generateContent?key={VERTEX_API_KEY}"

    @staticmethod
    def generate_content(model_id: str, prompt: str, image_base64: str = None) -> str:
        url = VertexRestClient._build_url(model_id)

        parts = [{"text": prompt}]
        if image_base64:
            parts.append({
                "inline_data": {
                    "mime_type": "image/jpeg",
                    "data": image_base64
                }
            })

        body = {
            "contents": [
                {
                    "role": "user",
                    "parts": parts
                }
            ],
            "generationConfig": {
                "maxOutputTokens": 8192
            }
        }

        try:
            response = requests.post(
                url,
                headers={"Content-Type": "application/json"},
                json=body,
                timeout=60
            )
        except Exception as e:
            raise VertexApiError(f"Vertex AI request failed: {str(e)}")

        if not response.ok:
            response_body = response.text
            raise VertexApiError(f"Vertex AI API error {response.status_code}: {response_body}")

        data = response.json()
        
        try:
            candidate = data.get("candidates", [])[0]
            content = candidate.get("content", {}).get("parts", [])[0].get("text", "")
            return content
        except (IndexError, KeyError, AttributeError):
            raise VertexApiError("Vertex AI returned an unexpected response structure.")