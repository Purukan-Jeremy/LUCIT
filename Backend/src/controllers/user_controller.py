from src.config.supabase import supabase

def get_users():
    response = supabase.table("tbl_users").select("*").execute()
    return response.data

def create_user(user_data):
    """
    Menyimpan user baru ke tabel tbl_users di Supabase.
    user_data: dict berisi name, email, dan password.
    """
    email = user_data.get("email", "").lower().strip()
    fullname = user_data.get("fullname")
    password = user_data.get("password")

    if not email or not password:
        return {"status": "error", "message": "Email and password are required."}
    
    # Check if email already exists
    # We use .eq() with the lowercased email for maximum reliability
    existing_user = supabase.table("tbl_users").select("email").eq("email", email).execute()
    
    if existing_user.data and len(existing_user.data) > 0:
        return {"status": "error", "message": "Email is already been registered!"}

    response = supabase.table("tbl_users").insert({
        "fullname": fullname,
        "email": email,
        "password": password # Catatan: Dalam produksi, password harus di-hash.
    }).execute()
    
    return {"status": "success", "data": response.data}

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
