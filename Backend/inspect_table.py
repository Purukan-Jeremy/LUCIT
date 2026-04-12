from src.config.supabase import supabase
import json

try:
    print("Inspecting tbl_history...")
    res = supabase.table("tbl_history").select("*").limit(1).execute()
    if res.data:
        print(f"COLUMNS_FOUND in tbl_history: {list(res.data[0].keys())}")
    else:
        print("TABLE_EMPTY: No data in tbl_history.")
        
    print("\nInspecting tbl_users...")
    res_users = supabase.table("tbl_users").select("*").limit(1).execute()
    if res_users.data:
        print(f"COLUMNS_FOUND in tbl_users: {list(res_users.data[0].keys())}")
    else:
        print("TABLE_EMPTY: No data in tbl_users.")
except Exception as e:
    print(f"ERROR during inspection: {str(e)}")
