from flask import Blueprint, request, jsonify
from .services import HistopathologyService

main_bp = Blueprint('main', __name__)

@main_bp.route('/', methods=['GET'])
def health_check():
    return jsonify({
        "status": "online",
        "project": "LUCIT Backend",
        "message": "Server siap!"
    })

@main_bp.route('/api/predict', methods=['POST'])
def predict():
    # 1. Cek apakah ada file gambar yang dikirim
    if 'image' not in request.files:
        return jsonify({"error": "Tidak ada file gambar"}), 400
    
    file = request.files['image']
    if file.filename == '':
        return jsonify({"error": "Nama file kosong"}), 400

    try:
        # 2. Upload Gambar ke Storage
        image_url = HistopathologyService.upload_image(file, file.filename)
        if not image_url:
            return jsonify({"error": "Gagal upload ke Supabase Storage"}), 500

        # 3. Jalankan Analisa AI
        ai_result = HistopathologyService.analyze_image(image_url)

        # 4. Simpan Hasil ke Database
        # (Opsional: Uncomment baris bawah jika tabel database sudah dibuat)
        # db_result = HistopathologyService.save_result(
        #     file.filename, image_url, ai_result['diagnosis'], ai_result['confidence']
        # )

        return jsonify({
            "message": "Analisa Berhasil",
            "data": ai_result,
            "image_url": image_url
        })

    except Exception as e:
        return jsonify({"error": str(e)}), 500