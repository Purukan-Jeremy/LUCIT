from src.repositories.user_repository import UserRepository


class SignUpController:
    @staticmethod
    def create_user(user_data):
        """
        Menyimpan user baru ke tabel tbl_users di Supabase.
        user_data: dict berisi name, email, dan password.
        """
        return UserRepository.create_user(user_data)


class SignInController:
    @staticmethod
    def login_user(credentials):
        """
        Memverifikasi email dan password untuk login.
        """
        email = credentials.get("email")
        password = credentials.get("password")

        users = UserRepository.find_user_by_credentials(email, password)

        if users and len(users) > 0:
            return {"status": "success", "user": users[0]}
        return {"status": "error", "message": "Invalid email or password"}


def get_users():
<<<<<<< Updated upstream
    response = supabase.table("users").select("*").execute()
    return response.data

def create_user(user):
    response = supabase.table("users").insert({
        "name": user.name,
        "email": user.email
    }).execute()
    return response.data
=======
    return UserRepository.get_all_users()


def create_user(user_data):
    return SignUpController.create_user(user_data)


def login_user(credentials):
    return SignInController.login_user(credentials)
>>>>>>> Stashed changes
