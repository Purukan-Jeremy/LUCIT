from flask import session

from src.config.supabase import supabase


class UserRepository:
    @staticmethod
    def get_all_users():
        response = supabase.table("tbl_users").select("*").execute()
        return response.data

    @staticmethod
    def create_user(user_data):
        response = supabase.table("tbl_users").insert({
            "fullname": user_data.get("fullname"),
            "email": (user_data.get("email") or "").strip().lower(),
            "password": user_data.get("password"),
        }).execute()
        return response.data

    @staticmethod
    def find_user_by_email(email):
        response = (
            supabase.table("tbl_users")
            .select("*")
            .eq("email", (email or "").strip().lower())
            .execute()
        )
        return response.data

    @staticmethod
    def find_user_by_credentials(email, password):
        response = (
            supabase.table("tbl_users")
            .select("*")
            .eq("email", (email or "").strip().lower())
            .eq("password", password)
            .execute()
        )
        return response.data

    @staticmethod
    def update_password_by_email(email, password):
        response = (
            supabase.table("tbl_users")
            .update({"password": password})
            .eq("email", (email or "").strip().lower())
            .execute()
        )
        return response.data


class SessionRepository:
    @staticmethod
    def delete_session():
        removed_user = session.pop("user", None)
        return {
            "deleted": removed_user is not None,
            "session_key": "user",
        }

    @staticmethod
    def check_active_session():
        current_user = session.get("user")
        return {
            "active": current_user is not None,
            "session_key": "user",
            "user": current_user,
        }
