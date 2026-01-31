from fastapi import FastAPI
from src.routes.user_routes import router as user_router
from src.config.supabase import supabase

app = FastAPI()

app.include_router(user_router)

@app.get("/")
def root():
    return {"status": "Backend Supabase connected"}

@app.get("/testing")
def test_supabase():
    res = supabase.table("users").select("*").limit(1).execute()
    return {
        "success": True,
        "data": res.data
    }