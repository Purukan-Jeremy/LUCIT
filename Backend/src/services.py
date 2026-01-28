from . import supabase
import datetime

class HistopathologyService:
    @staticmethod
    def upload_image(file, filename):
        """
        Mengupload file gambar ke Supabase Storage (Bucket: 'images')
        """
        try:
            # Baca file sebagai bytes
            file_bytes = file.read()
            
            # Buat nama file unik (tambah timestamp)
            # timestamp = datetime.datetime.now().strftime("%Y%m%d%H%M%S")
            # save_path = f"uploads/{timestamp}_{filename}"
            save_path = f"uploads/{filename}"

            # Upload ke Supabase Storage
            # Pastikan Anda sudah buat bucket bernama 'images' di dashboard Supabase
            response = supabase.storage.from_("images").upload(
                path=save_path,
                file=file_bytes,
                file_options={"content-type": file.content_type}
            )
            
            # Ambil URL Publik agar bisa ditampilkan di frontend
            public_url = supabase.storage.from_("images").get_public_url(save_path)
            
            return public_url
        except Exception as e:
            print(f"Error Upload: {e}")
            return None

    @staticmethod
    def analyze_image(image_url):
        """
        Placeholder untuk Logika AI (ResNet/VGG) Anda nanti.
        Sekarang kita return data dummy dulu.
        """
        # TODO: Load model AI dari folder src/models/ dan lakukan prediksi
        return {
            "diagnosis": "Malignant", # Contoh hasil
            "confidence": 0.98,
            "heatmap_url": image_url # Nanti diganti gambar heatmap
        }

    @staticmethod
    def save_result(filename, image_url, diagnosis, confidence):
        """
        Simpan hasil analisa ke Database Supabase (Table: 'analyses')
        """
        try:
            data = {
                "filename": filename,
                "image_url": image_url,
                "diagnosis": diagnosis,
                "confidence_score": confidence,
                "created_at": datetime.datetime.now().isoformat()
            }
            # Insert ke database
            response = supabase.table("analyses").insert(data).execute()
            return response.data
        except Exception as e:
            print(f"Error Database: {e}")
            return None