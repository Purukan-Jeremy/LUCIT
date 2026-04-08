"""
segmentation_service.py
-----------------------
Pipeline binary segmentation untuk model U-Net dengan deep supervision.

Model output (saat training):
  - main_output  : (1, 256, 256, 1)  ← output utama, yang dipakai saat inferensi
  - ds3_output   : (1, 256, 256, 1)  ← auxiliary output, diabaikan saat inferensi
  - ds4_output   : (1, 256, 256, 1)  ← auxiliary output, diabaikan saat inferensi

Mask output:
  - 0 = normal (hitam)
  - 1 = kanker (putih)
"""

import numpy as np
import cv2
import base64
from PIL import Image
from io import BytesIO


# ──────────────────────────────────────────────
# Konfigurasi
# ──────────────────────────────────────────────

THRESHOLD     = 0.35         # Sigmoid threshold: >= THRESHOLD → kanker
OVERLAY_ALPHA = 0.4         # Transparansi overlay (0.3 - 0.5 ideal untuk melihat tekstur)
COLOR_CANCER  = (0, 0, 255) # Merah (BGR) → area kanker
SHOW_NORMAL_OVERLAY = False  # True = overlay hijau di area normal


# ──────────────────────────────────────────────
# Preprocessing
# ──────────────────────────────────────────────

def preprocess_for_segmentation(image: Image.Image, target_size: tuple) -> np.ndarray:
    """
    Resize + normalize gambar PIL → array inferensi.
    target_size : (H, W)
    Returns     : np.ndarray (1, H, W, 3), nilai 0..1
    """
    resample = Image.Resampling.LANCZOS if hasattr(Image, "Resampling") else Image.LANCZOS
    image_resized = image.resize((target_size[1], target_size[0]), resample)  # PIL: (W, H)
    arr = np.array(image_resized).astype(np.float32) / 255.0
    return np.expand_dims(arr, axis=0)


# ──────────────────────────────────────────────
# Resolve output utama (handle multi-output)
# ──────────────────────────────────────────────

def _resolve_main_output(raw_output) -> np.ndarray:
    """
    Model dengan deep supervision mengembalikan list output.
    Kita selalu ambil output pertama (main_output) untuk inferensi.

    Mendukung:
    - list/tuple → ambil elemen pertama
    - single array (1, H, W, 1) → langsung dipakai
    """
    if isinstance(raw_output, (list, tuple)):
        print(f"[Segmentation] Multi-output model detected ({len(raw_output)} outputs). Using main_output (index 0).")
        output = raw_output[0]
    else:
        output = raw_output

    if hasattr(output, "numpy"):
        output = output.numpy()

    # Pastikan shape (1, H, W, 1)
    if output.ndim == 3:
        output = np.expand_dims(output, axis=0)

    print(f"[Segmentation] main_output shape: {output.shape}")
    print(f"[Segmentation] min={output.min():.4f}, max={output.max():.4f}, mean={output.mean():.4f}")
    return output


# ──────────────────────────────────────────────
# Postprocessing mask
# ──────────────────────────────────────────────

def postprocess_mask(main_output: np.ndarray, threshold: float = THRESHOLD) -> np.ndarray:
    """
    Konversi output sigmoid (1, H, W, 1) → mask biner (H, W) uint8.
    0 = normal, 1 = kanker.
    """
    pred = main_output[0, :, :, 0]  # (H, W)
    mask = (pred >= threshold).astype(np.uint8)
    return mask


# ──────────────────────────────────────────────
# Overlay & visualisasi
# ──────────────────────────────────────────────

def create_mask_overlay(original_image: np.ndarray, mask: np.ndarray, alpha: float = OVERLAY_ALPHA) -> np.ndarray:
    """
    Overlay merah di area kanker pada gambar asli.
    Area normal tetap seperti gambar asli tanpa penggelapan.
    
    original_image : (H, W, 3) RGB
    mask           : (H, W) uint8
    Returns        : (H, W, 3) BGR
    """
    h, w = original_image.shape[:2]
    if mask.shape[:2] != (h, w):
        mask = cv2.resize(mask, (w, h), interpolation=cv2.INTER_NEAREST)

    # Konversi ke BGR (OpenCV standard)
    original_bgr = cv2.cvtColor(original_image, cv2.COLOR_RGB2BGR)
    
    # Buat copy untuk hasil final
    res = original_bgr.copy()
    
    # Buat mask warna merah
    color_mask = np.zeros_like(original_bgr, dtype=np.uint8)
    color_mask[mask == 1] = COLOR_CANCER
    
    # Hanya lakukan blending pada area ROI (mask == 1)
    mask_indices = (mask == 1)
    
    if np.any(mask_indices):
        # Blend original dengan warna merah hanya di area kanker
        roi_blended = cv2.addWeighted(original_bgr, 1 - alpha, color_mask, alpha, 0)
        res[mask_indices] = roi_blended[mask_indices]

    if SHOW_NORMAL_OVERLAY:
        # Contoh jika ingin area normal diberi warna hijau transparan
        normal_mask = np.zeros_like(original_bgr, dtype=np.uint8)
        normal_mask[mask == 0] = (0, 255, 0) # Green
        normal_indices = (mask == 0)
        normal_blended = cv2.addWeighted(original_bgr, 0.8, normal_mask, 0.2, 0)
        res[normal_indices] = normal_blended[normal_indices]

    return res
    

def create_binary_mask_image(mask: np.ndarray) -> np.ndarray:
    """Grayscale: kanker=putih (255), normal=hitam (0)."""
    return np.where(mask == 1, 255, 0).astype(np.uint8)


# ──────────────────────────────────────────────
# Statistik area
# ──────────────────────────────────────────────

def compute_area_stats(mask: np.ndarray) -> dict:
    total = mask.size
    cancer_pixels = int(np.sum(mask == 1))
    return {
        "cancer_percent": round(cancer_pixels / total * 100, 2),
        "normal_percent": round((total - cancer_pixels) / total * 100, 2),
        "cancer_pixels": cancer_pixels,
        "total_pixels": total,
    }


# ──────────────────────────────────────────────
# Fungsi utama
# ──────────────────────────────────────────────

def run_segmentation(image_bytes: bytes, seg_model) -> dict:
    """
    Pipeline lengkap binary segmentation.

    Returns:
        mask_base64    : grayscale mask (putih=kanker) base64 JPEG
        overlay_base64 : gambar + overlay merah area kanker, base64 JPEG
        area_stats     : { cancer_percent, normal_percent, cancer_pixels, total_pixels }
        mask_shape     : [H, W]
        threshold      : threshold yang digunakan
    """

    # ── 1. Buka gambar ──────────────────────────────────
    image_pil = Image.open(BytesIO(image_bytes)).convert("RGB")
    original_np = np.array(image_pil)

    # ── 2. Resolve input size dari model ────────────────
    input_shape = getattr(seg_model, "input_shape", None)
    if isinstance(input_shape, list):
        input_shape = input_shape[0]

    if input_shape and len(input_shape) >= 4 and input_shape[1] and input_shape[2]:
        target_h, target_w = int(input_shape[1]), int(input_shape[2])
    else:
        target_h, target_w = 256, 256
        print("[Segmentation] Warning: Cannot resolve input shape, defaulting to 256x256")

    print(f"[Segmentation] Input target size: ({target_h}, {target_w})")

    # ── 3. Preprocess ───────────────────────────────────
    img_array = preprocess_for_segmentation(image_pil, (target_h, target_w))

    # ── 4. Inferensi ────────────────────────────────────
    raw_output = seg_model.predict(img_array)

    # ── 5. Ambil main_output (handle deep supervision) ──
    main_output = _resolve_main_output(raw_output)

    # ── 6. Postprocess → mask biner ─────────────────────
    mask = postprocess_mask(main_output, threshold=THRESHOLD)
    print(f"[Segmentation] Mask → cancer: {np.sum(mask==1)} px / {mask.size} px total")

    # ── 7. Statistik ────────────────────────────────────
    area_stats = compute_area_stats(mask)
    print(f"[Segmentation] {area_stats}")

    # ── 8. Buat gambar output ───────────────────────────
    overlay_bgr     = create_mask_overlay(original_np, mask)
    binary_mask_img = create_binary_mask_image(mask)

    # ── 9. Encode base64 ────────────────────────────────
    _, overlay_buf = cv2.imencode(".jpg", overlay_bgr, [cv2.IMWRITE_JPEG_QUALITY, 90])
    _, mask_buf    = cv2.imencode(".jpg", binary_mask_img)

    return {
        "mask_base64"   : base64.b64encode(mask_buf).decode("utf-8"),
        "overlay_base64": base64.b64encode(overlay_buf).decode("utf-8"),
        "area_stats"    : area_stats,
        "mask_shape"    : list(mask.shape),
        "threshold"     : THRESHOLD,
    }
