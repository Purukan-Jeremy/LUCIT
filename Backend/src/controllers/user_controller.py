from src.config.supabase import supabase

def get_users():
    response = supabase.table("users").select("*").execute()
    return response.data

def create_user(user):
    response = supabase.table("users").insert({
        "name": user.name,
        "email": user.email
    }).execute()
    return response.data
