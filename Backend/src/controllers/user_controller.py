from flask import session

from src.repositories.user_repository import SessionRepository, UserRepository


class UserController:
    @staticmethod
    def get_users():
        return UserRepository.get_all_users()

    @staticmethod
    def create_user(user_data):
        """
        Menyimpan user baru ke tabel tbl_users di Supabase.
        user_data: dict berisi fullname, email, dan password.
        """
        return UserRepository.create_user(user_data)


class SignUpController:
    @staticmethod
    def sign_up(user_data):
        email = (user_data.get("email") or "").strip()
        password = user_data.get("password")
        confirm_password = user_data.get("confirm_password")

        existing_users = UserRepository.find_user_by_email(email)
        if existing_users:
            return {"status": "error", "message": "Email is already in use"}

        if confirm_password is not None and password != confirm_password:
            return {"status": "error", "message": "Confirm password is incorrect"}

        created_user = UserRepository.create_user(user_data)
        return {"status": "success", "message": "User created successfully", "data": created_user}


class SignInController:
    @staticmethod
    def sign_in(credentials):
        email = credentials.get("email")
        password = credentials.get("password")

        users = UserRepository.find_user_by_credentials(email, password)

        if not users:
            return {"status": "error", "message": "Email or password is incorrect"}

        user = users[0]
        session["user"] = {
            "id": user.get("id"),
            "fullname": user.get("fullname"),
            "email": user.get("email"),
        }
        return {"status": "success", "message": "Email and password correct", "user": user}


class SignOutController:
    @staticmethod
    def sign_out():
        SessionRepository.delete_session()
        return {"status": "success", "message": "Sign out success"}


class SessionCheckController:
    @staticmethod
    def check_session():
        session_status = SessionRepository.check_active_session()
        if session_status.get("active"):
            return {
                "status": "success",
                "message": "Session found",
                "user": session_status.get("user"),
            }
        return {
            "status": "error",
            "message": "Session not found",
        }


def get_users():
    return UserController.get_users()


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
    result = SignUpController.sign_up(user_data)
    if result.get("status") == "success":
        return result.get("data")
    return result


def login_user(credentials):
    """
    Memverifikasi email dan password untuk login.
    """
    return SignInController.sign_in(credentials)


def logout_user():
    return SignOutController.sign_out()


def check_user_session():
    return SessionCheckController.check_session()
