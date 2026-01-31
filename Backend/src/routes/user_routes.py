from fastapi import APIRouter
from src.controllers.user_controller import get_users, create_user
from src.models.user_schema import UserCreate

router = APIRouter(prefix="/users", tags=["Users"])

@router.get("/")
def read_users():
    return get_users()

@router.post("/")
def add_user(user: UserCreate):
    return create_user(user)
