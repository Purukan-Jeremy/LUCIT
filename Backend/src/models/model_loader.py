import tensorflow as tf
import os

_model_cache = {}

def load_model(model_name="mobilenetv2.keras"):
    """
    Load model Keras dan cache supaya tidak load berulang.
    Jika model sudah ada di cache, akan dikembalikan langsung.
    """
    global _model_cache

    tf.keras.backend.clear_session()

    if model_name not in _model_cache:
        model_path = os.path.join("src", "models", model_name)
        if not os.path.exists(model_path):
            raise FileNotFoundError(f"Model file not found: {model_path}")
        _model_cache[model_name] = tf.keras.models.load_model(model_path)
        print(f"Model {model_name} loaded successfully")

    return _model_cache[model_name]


def clear_model_cache(model_name=None):
    """
    Hapus cache model.
    - model_name=None → hapus semua cache
    - model_name="mobilenetv2t.keras" → hapus cache model tertentu
    """
    global _model_cache
    if model_name:
        _model_cache.pop(model_name, None)
    else:
        _model_cache = {}
    tf.keras.backend.clear_session()
    print("Model cache cleared")
