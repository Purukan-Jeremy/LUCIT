import os
from pathlib import Path
import tensorflow as tf
import tensorflow.keras.backend as K

_model_cache = {}


# ══════════════════════════════════════════════════════════════
# Custom objects — wajib ada agar model segmentasi bisa di-load
# ══════════════════════════════════════════════════════════════

class ResizeTo(tf.keras.layers.Layer):
    """Custom layer yang meresize feature map ke ukuran target."""
    def __init__(self, target_size, **kwargs):
        super().__init__(**kwargs)
        self.target_size = tuple(target_size)

    def call(self, x):
        return tf.image.resize(x, self.target_size)

    def get_config(self):
        cfg = super().get_config()
        cfg.update({"target_size": list(self.target_size)})
        return cfg


def dice_coefficient(y_true, y_pred, smooth=1e-6):
    """
    Dice coefficient sebagai metric.
    Cocok untuk binary segmentation dengan output sigmoid.
    """
    y_true_f = K.flatten(tf.cast(y_true, tf.float32))
    y_pred_f = K.flatten(tf.cast(y_pred, tf.float32))
    intersection = K.sum(y_true_f * y_pred_f)
    return (2.0 * intersection + smooth) / (K.sum(y_true_f) + K.sum(y_pred_f) + smooth)


def dice_loss(y_true, y_pred, smooth=1e-6):
    return 1.0 - dice_coefficient(y_true, y_pred, smooth)


def combo_loss(y_true, y_pred):
    """
    Combo loss = BCE + Dice loss.
    Umum dipakai untuk binary segmentation histopatologi.
    """
    bce = tf.keras.losses.binary_crossentropy(y_true, y_pred)
    d_loss = dice_loss(y_true, y_pred)
    return bce + d_loss


# Kumpulkan semua custom objects dalam satu dict
SEGMENTATION_CUSTOM_OBJECTS = {
    "ResizeTo": ResizeTo,
    "combo_loss": combo_loss,
    "dice_coefficient": dice_coefficient,
    "dice_loss": dice_loss,
}


# ══════════════════════════════════════════════════════════════
# Model loader
# ══════════════════════════════════════════════════════════════

def load_model(model_name="mobilenetv2.keras"):
    """
    Load model Keras dan cache supaya tidak load berulang.
    Untuk model segmentasi, gunakan load_segmentation_model().
    """
    global _model_cache

    if model_name not in _model_cache:
        # Clear session to avoid OOM or graph conflicts when loading new models
        tf.keras.backend.clear_session()
        
        project_root = Path(__file__).resolve().parents[2]
        models_dir = project_root / "src" / "models"

        if model_name == "segmentation":
            env_model_path = os.getenv("SEGMENTATION_MODEL_PATH", "").strip()
            default_filename = "unet_segmentation.keras"
        else:
            env_model_path = os.getenv("MODEL_PATH", "").strip()
            default_filename = model_name

        candidate_paths = []
        if env_model_path:
            candidate_paths.append(Path(env_model_path))
        candidate_paths.append(models_dir / default_filename)

        # Fallback: pakai .keras pertama di folder (hanya untuk classification)
        if not env_model_path and model_name not in ("segmentation",):
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
            searched = "\n".join([
                f"- {str((c if c.is_absolute() else (project_root / c)).resolve())}"
                for c in candidate_paths
            ])
            raise FileNotFoundError(
                f"Model file not found: '{model_name}'\n"
                f"Searched paths:\n{searched}\n"
                "Tips:\n"
                "  - Klasifikasi : set MODEL_PATH di .env atau taruh model di src/models/\n"
                "  - Segmentasi  : set SEGMENTATION_MODEL_PATH di .env\n"
                "    atau taruh sebagai 'unet_segmentation.keras' di src/models/"
            )

        # ── Load dengan custom_objects untuk model segmentasi ──
        if model_name == "segmentation":
            print(f"[ModelLoader] Loading segmentation model with custom objects...")
            loaded = tf.keras.models.load_model(
                str(resolved_model_path),
                custom_objects=SEGMENTATION_CUSTOM_OBJECTS,
                compile=False,   # skip re-compile, kita tidak butuh training
            )
        else:
            loaded = tf.keras.models.load_model(
                str(resolved_model_path),
                compile=False
            )

        _model_cache[model_name] = loaded
        print(f"[ModelLoader] '{model_name}' loaded from: {resolved_model_path}")

    return _model_cache[model_name]


def load_segmentation_model():
    """Shortcut untuk load model segmentasi dengan custom objects."""
    return load_model("segmentation")


def clear_model_cache(model_name=None):
    """Hapus cache model. model_name=None → hapus semua."""
    global _model_cache
    if model_name:
        _model_cache.pop(model_name, None)
    else:
        _model_cache = {}
    tf.keras.backend.clear_session()
    print("[ModelLoader] Model cache cleared")