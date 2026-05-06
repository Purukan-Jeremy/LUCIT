from src.services.vertex_rest_client import VertexRestClient, VertexApiError
import base64
import json
import hashlib
import re
from io import BytesIO
import numpy as np
from PIL import Image
from src.config.settings import GEMINI_DESCRIPTION_MODEL

# Variables that were for GenAI are removed
validation_cache = {}
description_cache = {}
segmentation_description_cache = {}  
SEGMENTATION_DESCRIPTION_VERSION = "2026-05-05-v1"


def _candidate_models():
    preferred = (GEMINI_DESCRIPTION_MODEL or "").strip()
    models = [
        preferred,
        "gemini-2.5-flash"
    ]
    return [m for i, m in enumerate(models) if m and m not in models[:i]]


# Removed get_description_model since we use REST Client directly


def _encode_image_for_gemini(image_bytes: bytes, max_side: int = 768, quality: int = 82) -> str:
    image = Image.open(BytesIO(image_bytes)).convert("RGB")
    width, height = image.size
    longest_side = max(width, height)

    if longest_side > max_side:
        scale = max_side / float(longest_side)
        resized = (
            max(1, int(round(width * scale))),
            max(1, int(round(height * scale))),
        )
        resample_method = (
            Image.Resampling.LANCZOS if hasattr(Image, "Resampling") else Image.LANCZOS
        )
        image = image.resize(resized, resample_method)

    buffer = BytesIO()
    image.save(buffer, format="JPEG", quality=quality, optimize=True)
    return base64.b64encode(buffer.getvalue()).decode("utf-8")


def _generate_with_fallback(prompt: str, image_base64: str):
    last_error = None
    for model_name in _candidate_models():
        try:
            # We skip passing the raw text response as an object wrapper,
            # and just return the extracted text string directly for compatibility with callers 
            # if we adapt the callers to expect plain strings.
            # Wait, current callers expect `response.text`.
            # Let's wrap the text in a mock object so we don't have to refactor callers.
            text = VertexRestClient.generate_content(model_id=model_name, prompt=prompt, image_base64=image_base64)
            
            class MockResponse:
                def __init__(self, text):
                    self.text = text
            return MockResponse(text), model_name
        except Exception as e:
            last_error = e
            print(f"Vertex API model '{model_name}' failed: {e}")

    raise RuntimeError(f"All Gemini model candidates failed. Last error: {last_error}")


def _build_local_description(prediction: str, confidence: float) -> str:
    confidence_pct = max(0.0, min(1.0, float(confidence))) * 100
    label = (prediction or "Unknown").strip()
    label_lower = label.lower()

    if "benign" in label_lower:
        risk_text = "cenderung lebih rendah"
        recommendation = (
            "Hasil ini tetap perlu dikonfirmasi dengan evaluasi klinis dan "
            "pemeriksaan patologi oleh dokter spesialis."
        )
    elif any(word in label_lower for word in ["aca", "scc", "malignant"]):
        risk_text = "cenderung lebih tinggi"
        recommendation = (
            "Temuan ini perlu ditindaklanjuti dengan korelasi klinis, "
            "pemeriksaan patologi lanjutan, dan keputusan medis oleh dokter spesialis."
        )
    else:
        risk_text = "belum spesifik"
        recommendation = (
            "Interpretasi akhir harus mempertimbangkan data klinis, "
            "pemeriksaan histopatologi lengkap, dan penilaian dokter."
        )

    organ_text = (
        "jaringan paru"
        if "lung" in label_lower
        else "jaringan kolon"
        if "colon" in label_lower
        else "jaringan yang dianalisis"
    )

    return f"""## Ringkasan

Model klasifikasi AI telah mengidentifikasi sampel histopatologi ini sebagai **{label}** dengan skor kepercayaan **{confidence_pct:.2f}%**. Ini menunjukkan bahwa model AI telah menganalisis pola jaringan dan menentukan klasifikasi yang paling mungkin berdasarkan data latihnya. Prediksi model ini mengarah pada karakteristik jaringan yang konsisten dengan {label}.

## Arsitektur Jaringan

Pola visual dominan pada {organ_text} lebih sesuai dengan karakteristik {label} dibandingkan kelas lain di dalam model. Pola morfologi yang dikenali model menunjukkan kecenderungan risiko yang {risk_text}. Susunan jaringan secara keseluruhan mendukung klasifikasi ini sebagai indikator awal untuk tinjauan klinis.

## Karakteristik Seluler

Fitur seluler yang terlihat pada sampel ini menunjukkan pola yang umum ditemukan pada {label}. Model AI telah mengenali susunan sel, pola kepadatan, dan karakteristik morfologi yang selaras dengan klasifikasi yang diprediksi. Karakteristik seluler ini berkontribusi terhadap skor kepercayaan keseluruhan sebesar {confidence_pct:.2f}%.

## Interpretasi Model

Skor kepercayaan sebesar **{confidence_pct:.2f}%** menunjukkan tingkat keyakinan model terhadap prediksi ini berdasarkan pola yang dipelajari dari data latih. Namun, tingkat kepercayaan ini bukan ukuran pasti dari kepastian diagnosis karena dipengaruhi oleh beberapa faktor, termasuk:

- Kualitas dan preparasi spesimen
- Variasi serta konsistensi pewarnaan
- Artefak citra atau masalah teknis
- Distribusi data latih

## Konteks Klinis

Dalam praktik klinis, hasil AI sebaiknya diinterpretasikan bersama temuan mikroskopis lain, konteks klinis pasien, dan informasi laboratorium atau pendukung yang relevan agar keputusan medis lebih komprehensif. Hasil ini bersifat suportif dan tidak menggantikan diagnosis akhir oleh patolog atau dokter yang kompeten.

{recommendation}

**Tindakan yang Disarankan:**
- Evaluasi komparatif pada area jaringan lain
- Tinjauan slide oleh patolog
- Korelasi dengan riwayat klinis pasien
- Pemantauan berkala sesuai kebutuhan kondisi klinis"""


def _build_local_segmentation_description(area_stats: dict) -> str:
    cancer_pct = float(area_stats.get("cancer_percent", 0.0))
    normal_pct = float(area_stats.get("normal_percent", 100.0))

    if cancer_pct > 50:
        severity_text  = "keterlibatan sel kanker yang luas"
        risk_text      = "tinggi"
        recommendation = (
            "Temuan ini sangat disarankan untuk segera ditindaklanjuti dengan "
            "pemeriksaan patologi lengkap dan konsultasi dokter spesialis."
        )
    elif cancer_pct > 20:
        severity_text  = "keterlibatan sel kanker tingkat sedang"
        risk_text      = "sedang hingga tinggi"
        recommendation = (
            "Hasil ini perlu dikonfirmasi dengan pemeriksaan histopatologi "
            "lanjutan oleh dokter spesialis."
        )
    elif cancer_pct > 5:
        severity_text  = "area sel kanker kecil namun terdeteksi"
        risk_text      = "rendah hingga sedang"
        recommendation = (
            "Pemantauan berkala dan evaluasi klinis lanjutan disarankan "
            "untuk mengonfirmasi temuan ini."
        )
    else:
        severity_text  = "area sel kanker minimal atau tidak bermakna"
        risk_text      = "rendah"
        recommendation = (
            "Hasil ini tetap perlu dikonfirmasi melalui evaluasi klinis dan "
            "pemeriksaan patologi oleh dokter spesialis."
        )

    return f"""## Ringkasan Segmentasi

Model segmentasi U-Net telah menganalisis citra histopatologi ini dan mengidentifikasi **{cancer_pct:.2f}%** area jaringan sebagai bagian yang berpotensi mengandung sel kanker, sedangkan **{normal_pct:.2f}%** merepresentasikan jaringan normal. Analisis otomatis ini memberikan penilaian kuantitatif terhadap keterlibatan jaringan.

## Analisis Distribusi Spasial

Berdasarkan hasil segmentasi model, ditemukan **{severity_text}** pada citra histopatologi yang dianalisis. Pola distribusi spasial area kanker pada citra ini menunjukkan kecenderungan risiko yang **{risk_text}** berdasarkan proporsi area yang terdeteksi. Visualisasi overlay merah pada citra menunjukkan area spesifik yang diidentifikasi model sebagai region of interest, sehingga dapat membantu patolog meninjau area prioritas.

## Metodologi Model

Segmentasi dilakukan menggunakan model deep learning berbasis U-Net yang secara otomatis mengidentifikasi batas morfologi antara jaringan normal dan abnormal. Perlu dipahami bahwa hasil segmentasi dipengaruhi oleh:

- Kualitas spesimen
- Variasi pewarnaan H&E
- Artefak citra
- Ambang yang digunakan dalam proses binarisasi mask

## Interpretasi Klinis

Hasil segmentasi ini bersifat mendukung pengambilan keputusan klinis dan tidak menggantikan diagnosis medis akhir. {recommendation}

## Tindakan yang Disarankan

Sebagai langkah lanjutan, disarankan untuk:
- Melakukan tinjauan slide oleh patolog
- Mengkorelasikan dengan data klinis pasien
- Meninjau pemeriksaan pendukung lain yang relevan"""


def _normalize_segmentation_description(text: str) -> str:
    if not text:
        return text

    normalized = re.sub(r"\btumor(s)?\b", "kanker", text, flags=re.IGNORECASE)
    normalized = re.sub(r"\bcancer(s)?\b", "kanker", normalized, flags=re.IGNORECASE)
    return normalized


def generate_ai_description_segmentation(
    image_bytes: bytes,
    area_stats: dict,
    overlay_base64: str = None,
) -> str:
    # Using the local fallback immediately if REST config errors out implicitly,
    # but we will just pass it to the generator and let it handle the error.

    image_hash = hashlib.md5(image_bytes).hexdigest()
    stats_hash = hashlib.md5(json.dumps(area_stats, sort_keys=True).encode()).hexdigest()
    cache_key  = f"seg:{SEGMENTATION_DESCRIPTION_VERSION}:{image_hash}:{stats_hash}"

    if cache_key in segmentation_description_cache:
        print("Using cached AI segmentation description.")
        return segmentation_description_cache[cache_key]

    cancer_pct  = float(area_stats.get("cancer_percent", 0.0))
    normal_pct  = float(area_stats.get("normal_percent", 100.0))

    try:
        if overlay_base64:
            image_base64 = overlay_base64
        else:
            image_base64 = _encode_image_for_gemini(image_bytes, max_side=768, quality=82)

        prompt = f"""Anda adalah asisten AI medis yang ahli dalam analisis histopatologi dan segmentasi kanker.

Saya telah melakukan segmentasi otomatis pada citra histopatologi menggunakan model U-Net dengan hasil berikut:
- Area yang terdeteksi sebagai kanker: {cancer_pct:.2f}%
- Area yang terdeteksi sebagai normal: {normal_pct:.2f}%
- Pada gambar overlay, area merah menunjukkan region yang diidentifikasi sebagai kanker oleh model, sedangkan area yang tidak diberi warna merah merepresentasikan jaringan normal.

Silakan analisis citra histopatologi ini (dengan overlay segmentasi) dan berikan deskripsi medis yang detail dalam bahasa Indonesia. \
Sertakan interpretasi distribusi spasial area kanker, karakteristik morfologi yang terlihat, dan tingkat keterlibatan jaringan. \
Jangan menyebutkan jumlah piksel, neoplastik, biopsi, reseksi, prognosis, stadium kanker, metastasis, kekambuhan pascaterapi, \
atau rencana strategi pengobatan.

PERSYARATAN PENTING:
- Jawab HANYA dalam bahasa Indonesia
- Gunakan format Markdown dengan pemisahan paragraf yang jelas
- Mulai dengan bagian "Ringkasan Segmentasi" yang menyebutkan persentase kanker dan normal
- Lalu berikan 3-4 bagian tambahan dengan analisis detail
- Setiap bagian utama harus memiliki heading deskriptif (gunakan ## untuk heading)
- Gunakan bullet point atau numbered list bila sesuai
- Panjang total sekitar 12-15 kalimat
- Buat mudah dibaca dan terstruktur secara visual

Struktur yang wajib:
## Ringkasan Segmentasi
[Ringkasan singkat yang menyatakan hasil segmentasi: {cancer_pct:.2f}% area kanker dan {normal_pct:.2f}% area normal]

## Analisis Distribusi Spasial
[Paragraf pertama tentang pola distribusi kanker]

## Karakteristik Morfologi
[Paragraf kedua tentang fitur jaringan dan pola seluler]

## Interpretasi Klinis
[Paragraf ketiga tentang makna klinis dan rekomendasi]"""

        response, used_model = _generate_with_fallback(prompt, image_base64)

        description = _normalize_segmentation_description((response.text or "").strip())

        if not description:
            return _normalize_segmentation_description(_build_local_segmentation_description(area_stats))

        print(f"AI Segmentation Description generated successfully using model: {used_model}")
        segmentation_description_cache[cache_key] = description
        return description

    except Exception as e:
        print(f"Error generating AI segmentation description: {str(e)}")
        return _normalize_segmentation_description(_build_local_segmentation_description(area_stats))


def _heuristic_histopathology_check(image_bytes: bytes) -> dict:
    try:
        image = Image.open(BytesIO(image_bytes)).convert("RGB")
        image = image.resize((256, 256))
        hsv = np.array(image.convert("HSV"), dtype=np.uint8)
        h = hsv[..., 0]
        s = hsv[..., 1]
        v = hsv[..., 2]

        pink_magenta = (h >= 200) | (h <= 15)
        purple = (h >= 165) & (h < 200)
        stain_mask = (pink_magenta | purple) & (s > 35) & (v > 35)
        tissue_mask = (s > 22) & (v > 25)

        stain_ratio  = float(np.mean(stain_mask))
        tissue_ratio = float(np.mean(tissue_mask))

        is_histopathology = bool(stain_ratio >= 0.16 and tissue_ratio >= 0.22)

        return {
            "is_histopathology": is_histopathology,
            "organ": "unknown",
            "validation_status": "heuristic",
            "stain_ratio": round(stain_ratio, 4),
            "tissue_ratio": round(tissue_ratio, 4),
        }
    except Exception as e:
        return {
            "is_histopathology": False,
            "organ": "unknown",
            "validation_status": "heuristic_failed",
        }


def validate_histopathology(image_bytes):
    image_hash = hashlib.md5(image_bytes).hexdigest()

    if image_hash in validation_cache:
        return validation_cache[image_hash]

    try:
        image_base64 = _encode_image_for_gemini(image_bytes, max_side=640, quality=74)

        prompt = """
        Analyze this medical image.

        Answer ONLY in JSON format:
        {
            "is_histopathology": true/false,
            "organ": "lung" or "colon" or "unknown"
        }
        """

        response, used_model = _generate_with_fallback(prompt, image_base64)

        text = response.text.strip()
        import re
        match = re.search(r"\{.*\}", text, re.DOTALL)
        if match:
            text = match.group(0)
        else:
            text = text.replace("```json", "").replace("```", "").strip()

        result = json.loads(text)
        result["is_histopathology"] = bool(result.get("is_histopathology", False))
        result["organ"]             = str(result.get("organ", "unknown")).lower()
        result["validation_status"] = "ok"

        validation_cache[image_hash] = result
        return result

    except Exception as e:
        return _heuristic_histopathology_check(image_bytes)


def generate_ai_description(image_bytes, prediction: str, confidence: float, gradcam_base64: str = None) -> str:
    # Removed GEMINI_API_KEY validation here as it's handled by VertexRestClient

    image_hash = hashlib.md5(image_bytes).hexdigest()
    cache_key  = f"{image_hash}:{prediction}:{confidence:.6f}"
    if cache_key in description_cache:
        return description_cache[cache_key]

    try:
        if gradcam_base64:
            image_base64 = gradcam_base64
        else:
            image_base64 = _encode_image_for_gemini(image_bytes, max_side=768, quality=82)

        confidence_pct = confidence * 100
        prompt = f"""Anda adalah asisten AI medis yang ahli dalam analisis histopatologi.

Hasil Klasifikasi:
- Prediksi: {prediction}
- Skor Kepercayaan: {confidence_pct:.2f}%

RESPON ANDA HARUS DIMULAI DENGAN TEKS PERSIS INI (salin apa adanya):

## Ringkasan

Model klasifikasi AI telah mengidentifikasi sampel histopatologi ini sebagai **{prediction}** dengan skor kepercayaan **{confidence_pct:.2f}%**.

[Lanjutkan dengan 1-2 kalimat lagi tentang maknanya]

---

Lalu lanjutkan dengan bagian-bagian berikut:

## Arsitektur Jaringan
[3-4 kalimat yang menjelaskan struktur dan pola jaringan]

## Karakteristik Seluler  
[3-4 kalimat tentang fitur sel dan morfologi]

## Interpretasi Model
[3-4 kalimat yang menjelaskan skor kepercayaan {confidence_pct:.2f}% dan keterbatasan AI]

## Konteks Klinis
[3-4 kalimat tentang makna klinis dan rekomendasi]

PERSYARATAN PENTING:
1. Baris pertama harus: ## Ringkasan
2. Baris kedua harus menyebut {prediction} dan {confidence_pct:.2f}%
3. Gunakan hanya bahasa Indonesia
4. Gunakan format Markdown
5. Total 15-18 kalimat
6. Nada profesional medis

LARANGAN: jumlah piksel, neoplastik, biopsi, reseksi, prognosis, stadium kanker, metastasis, kekambuhan pascaterapi, rencana pengobatan.

MULAI JAWABAN ANDA SEKARANG dengan "## Ringkasan":"""

        response, used_model = _generate_with_fallback(prompt, image_base64)
        
        description = (response.text or "").strip()

        if not description:
            print("AI returned empty description, using local fallback")
            return _build_local_description(prediction=prediction, confidence=confidence)

        # Check if Summary section exists (case-insensitive, handle various formats)
        has_summary = (
            description.lower().startswith("## ringkasan") or
            description.lower().startswith("## summary") or
            description.lower().startswith("#summary") or
            "## ringkasan" in description.lower()[:100] or
            "## summary" in description.lower()[:100]  # Check first 100 chars
        )

        if not has_summary:
            print(f"AI response missing Summary section. First 200 chars: {description[:200]}")
            confidence_pct = confidence * 100
            summary_section = (
                "## Ringkasan\n\n"
                f"Model klasifikasi AI telah mengidentifikasi sampel histopatologi ini sebagai **{prediction}** "
                f"dengan skor kepercayaan **{confidence_pct:.2f}%**. "
                f"Ini menunjukkan bahwa model telah mendeteksi pola jaringan dan karakteristik seluler yang konsisten dengan {prediction}. "
                f"Tingkat kepercayaan {confidence_pct:.2f}% mencerminkan keyakinan model berdasarkan pola yang dipelajari dari data latihnya.\n\n"
                "---\n\n"
            )
            description = summary_section + description
            print("Summary section prepended to AI response")
        else:
            print("Summary section found in AI response")

        print(f"AI Description generated successfully using model: {used_model}")
        description_cache[cache_key] = description
        return description
    
    except Exception as e:
        return _build_local_description(prediction=prediction, confidence=confidence)
