from flask import session

from src.config.supabase import supabase
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
        fullname = user_data.get("fullname", "")

        if confirm_password is not None and password != confirm_password:
            return {"status": "error", "message": "Confirm password is incorrect"}

        try:
            # 1. Register into Supabase Auth (auth.users)
            auth_res = supabase.auth.sign_up({
                "email": email,
                "password": password
            })
            
            # Check if user already exists in auth or signup failed without throwing exception
            if not auth_res or not auth_res.user:
                return {"status": "error", "message": "Failed to create user in Auth"}

            # 2. Insert into tbl_users (synchronization)
            try:
                # We check first if email in tbl_users to avoid duplicate
                existing_users = UserRepository.find_user_by_email(email)
                if not existing_users:
                    UserRepository.create_user(user_data)
            except Exception as insert_err:
                # If insertion fails due to RLS or unique constraint, we just log/pass
                pass

            return {"status": "success", "message": "User created successfully", "data": {"email": email}}
        except Exception as e:
            # Handle user existing in Auth
            msg = str(e).lower()
            if "already registered" in msg or "already exists" in msg:
                return {"status": "error", "message": "Email is already in use"}
            return {"status": "error", "message": str(e)}


class SignInController:
    @staticmethod
    def sign_in(credentials):
        email = credentials.get("email")
        password = credentials.get("password")

        # 1. Fallback / Legacy Strategy: Check tbl_users directly FIRST
        # This allows users created via the old method (only in tbl_users) to login safely
        try:
            users = UserRepository.find_user_by_credentials(email, password)
            if users:
                user = users[0]
                session_user = {
                    "id": str(user.get("id")),
                    "fullname": user.get("fullname", email),
                    "email": user.get("email"),
                }
                session["user"] = session_user
                return {"status": "success", "message": "Email and password correct", "user": session_user}
        except Exception as e:
            pass # fallback to Supabase Auth if table query errors out

        # 2. Supabase Auth Strategy
        try:
            auth_res = supabase.auth.sign_in_with_password({
                "email": email,
                "password": password
            })
            
            user_auth = auth_res.user
            if not user_auth:
                return {"status": "error", "message": "Email or password is incorrect"}
            
            fullname_var = email
            users = UserRepository.find_user_by_email(email)
            if users:
                fullname_var = users[0].get("fullname", email)

            session_user = {
                "id": str(user_auth.id),
                "fullname": fullname_var,
                "email": user_auth.email,
            }
            
            session["user"] = session_user
            return {"status": "success", "message": "Email and password correct", "user": session_user}

        except Exception as e:
            msg = str(e).lower()
            if "invalid login credentials" in msg:
                return {"status": "error", "message": "Email or password is incorrect"}
            return {"status": "error", "message": str(e)}



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


class PasswordResetController:
    @staticmethod
    def request_otp(payload):
        email = (payload.get("email") or "").strip().lower()
        if not email:
            return {"status": "error", "message": "Email is required"}

        user = UserRepository.find_user_by_email(email)
        if not user:
            return {"status": "error", "message": "Email is not registered"}

        return {
            "status": "success",
            "message": f"Email {email} is registered and ready for OTP verification",
        }

    @staticmethod
    def _extract_user_email(user_response):
        user = getattr(user_response, "user", None)
        if user is None and isinstance(user_response, dict):
            user = user_response.get("user")

        if user is None:
            return None

        email = getattr(user, "email", None)
        if email is None and isinstance(user, dict):
            email = user.get("email")
        return (email or "").strip().lower() or None

    @staticmethod
    def confirm_reset(payload):
        email = (payload.get("email") or "").strip().lower()
        access_token = (payload.get("access_token") or "").strip()
        new_password = payload.get("new_password")
        confirm_password = payload.get("confirm_password")

        if not email or not access_token or not new_password or not confirm_password:
            return {"status": "error", "message": "Email, access token, and new password are required"}

        if new_password != confirm_password:
            return {"status": "error", "message": "Confirm password does not match"}

        verified_user = supabase.auth.get_user(access_token)
        verified_email = PasswordResetController._extract_user_email(verified_user)
        if verified_email != email:
            return {"status": "error", "message": "Supabase OTP verification does not match this email"}

        user = UserRepository.find_user_by_email(email)
        if not user:
            return {"status": "error", "message": "Email is not registered"}

        updated_user = UserRepository.update_password_by_email(email, new_password)

        return {
            "status": "success",
            "message": "Password updated successfully",
            "data": updated_user,
        }


def get_users():
    return UserController.get_users()


def create_user(user_data):
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


def request_password_reset_otp(payload):
    return PasswordResetController.request_otp(payload)


def confirm_password_reset(payload):
    return PasswordResetController.confirm_reset(payload)