import os
from flask import Flask
from flask_cors import CORS
from supabase import create_client, Client
from dotenv import load_dotenv

# Load data dari file .env
load_dotenv()

# Setup Supabase Client secara Global
url: str = os.environ.get("SUPABASE_URL")
key: str = os.environ.get("SUPABASE_KEY")

supabase: Client = None

if not url or not key:
    print("WARNING: SUPABASE_URL atau SUPABASE_KEY belum ada di .env")
else:
    try:
        supabase = create_client(url, key)
        print("Koneksi Supabase Berhasil")
    except Exception as e:
        print(f" Gagal koneksi Supabase: {e}")

def create_app():
    app = Flask(__name__)
    
    # Enable CORS (agar Frontend React bisa akses)
    CORS(app)
    
    # Import dan Daftarkan Routes
    from .routes import main_bp
    app.register_blueprint(main_bp)
    
    return app