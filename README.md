# LUCIT - Histopathology Detection System
=========================================

Proyek ini adalah aplikasi web untuk deteksi citra histopatologi menggunakan Deep Learning.
- Frontend: React + Vite
- Backend: Flask (Python) + Supabase

---------------------------------------------------------
🚀 PANDUAN INSTALASI (SETELAH CLONE/PULL DARI GITHUB)
---------------------------------------------------------

Karena folder "node_modules" dan "venv" tidak di-upload ke GitHub, teman-teman WAJIB mengikuti langkah ini agar aplikasi bisa jalan.

### 1. PERSIAPAN AWAL
Pastikan di komputer sudah terinstall:
- Python (v3.8 ke atas)
- Node.js
- Git

---

### 2. SETUP BACKEND (FLASK)

a. Buka terminal dan masuk ke folder Backend:
   cd Backend

b. Buat Virtual Environment (Ruang isolasi Python):
   python -m venv venv

c. Aktifkan Virtual Environment:
   - Windows (Command Prompt):  venv\Scripts\activate
   - Windows (PowerShell):      .\venv\Scripts\activate
   - Mac/Linux:                 source venv/bin/activate

   (Pastikan muncul tulisan "(venv)" di sebelah kiri terminal)

d. Install Library (Flask, Supabase, CORS, dll):
   pip install -r requirements.txt

   PENTING:
   Jika perintah di atas gagal atau muncul error "ModuleNotFoundError: flask_cors", 
   jalankan perintah manual ini:
   
   pip install flask-cors

   (Jika pip tidak dikenali di Windows, gunakan "python -m pip install ...")

e. Setup File .env
   Buat file baru bernama ".env" di dalam folder Backend.
   Minta isi konfigurasi (SUPABASE_URL dan SUPABASE_KEY) ke pemilik repository.
   Format isi file .env:
   
   SUPABASE_URL=link_supabase_anda
   SUPABASE_KEY=kode_panjang_anda
   FLASK_ENV=development

---

### 3. SETUP FRONTEND (REACT)

a. Buka terminal BARU (jangan matikan terminal backend).
b. Masuk ke folder Frontend:
   cd Frontend

c. Install Library JavaScript:
   npm install

---------------------------------------------------------
▶️ CARA MENJALANKAN APLIKASI (RUN)
---------------------------------------------------------

Anda harus menjalankan DUA TERMINAL sekaligus.

TERMINAL 1 (BACKEND):
---------------------
Pastikan posisi di folder Backend dan venv aktif.
Ketik:
python app.py

(Tunggu sampai muncul: "Running on http://127.0.0.1:5000")


TERMINAL 2 (FRONTEND):
----------------------
Pastikan posisi di folder Frontend.
Ketik:
npm run dev

(Buka link yang muncul di browser, biasanya http://localhost:5173)

---------------------------------------------------------
🛠 TROUBLESHOOTING (SOLUSI MASALAH UMUM)
---------------------------------------------------------

1. Error: "'pip' is not recognized..."
   Solusi: Gunakan perintah "python -m pip" sebagai pengganti "pip".
   Contoh: python -m pip install -r requirements.txt

2. Error: "ModuleNotFoundError: No module named 'flask_cors'"
   Solusi: Library CORS belum terinstall. Jalankan perintah:
   pip install flask-cors

3. Error: "Unauthorized" atau Masalah Database
   Solusi: Cek file ".env" Anda. Pastikan file itu ada di dalam folder Backend dan kodenya benar.
