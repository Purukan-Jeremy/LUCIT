from src.config.supabase import supabase

def get_users():
    response = supabase.table("tbl_users").select("*").execute()
    return response.data

def create_user(user_data):
    """
    Menyimpan user baru ke tabel tbl_users di Supabase.
    user_data: dict berisi name, email, dan password.
    """
    response = supabase.table("tbl_users").insert({
        "fullname": user_data.get("fullname"),
        "email": user_data.get("email"),
        "password": user_data.get("password") # Catatan: Dalam produksi, password harus di-hash.
    }).execute()
    return response.data

def login_user(credentials):
    """
    Memverifikasi email dan password untuk login.
    """
    email = credentials.get("email")
    password = credentials.get("password")
    
    response = supabase.table("tbl_users").select("*").eq("email", email).eq("password", password).execute()
    
    if response.data and len(response.data) > 0:
        return {"status": "success", "user": response.data[0]}
    else:
        return {"status": "error", "message": "Invalid email or password"}
