import os
from pathlib import Path
import tensorflow as tf

_model_cache = {}

def load_model(model_name="mobilenetv2.keras"):
    """
    Load model Keras dan cache supaya tidak load berulang.
    Jika model sudah ada di cache, akan dikembalikan langsung.
    """
    global _model_cache

    tf.keras.backend.clear_session()

    if model_name not in _model_cache:
        project_root = Path(__file__).resolve().parents[2]
        env_model_path = os.getenv("MODEL_PATH", "").strip()
        models_dir = project_root / "src" / "models"

        candidate_paths = []
        if env_model_path:
            candidate_paths.append(Path(env_model_path))
        candidate_paths.append(project_root / "src" / "models" / model_name)

        # Fallback: if default model name is not present, use the first .keras model found.
        if not env_model_path and model_name == "mobilenetv2.keras":
            available_keras_models = sorted(models_dir.glob("*.keras"))
            if available_keras_models:
                candidate_paths.append(available_keras_models[0])

        resolved_model_path = None
        for candidate in candidate_paths:
            normalized = candidate if candidate.is_absolute() else (project_root / candidate)
            if normalized.exists():
                resolved_model_path = normalized
                break

        if resolved_model_path is None:
            searched = "\n".join([f"- {str((c if c.is_absolute() else (project_root / c)).resolve())}" for c in candidate_paths])
            raise FileNotFoundError(
                f"Model file not found: {model_name}\n"
                f"Searched paths:\n{searched}\n"
                "Set MODEL_PATH in Backend/.env or place model in Backend/src/models/"
            )

        _model_cache[model_name] = tf.keras.models.load_model(str(resolved_model_path))
        print(f"Model loaded successfully from: {resolved_model_path}")

    return _model_cache[model_name]


def clear_model_cache(model_name=None):
    """
    Hapus cache model.
    - model_name=None → hapus semua cache
    - model_name="mobilenetv2.keras" → hapus cache model tertentu
    """
    global _model_cache
    if model_name:
        _model_cache.pop(model_name, None)
    else:
        _model_cache = {}
    tf.keras.backend.clear_session()
    print("Model cache cleared")
