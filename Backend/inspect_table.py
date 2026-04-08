from src.config.supabase import supabase
import json

try:
    # Cek data pertama untuk melihat nama kolom yang ada
    res = supabase.table("tbl_users").select("*").limit(1).execute()
    if res.data:
        print(f"COLUMNS_FOUND: {list(res.data[0].keys())}")
    else:
        print("TABLE_EMPTY: No data to inspect columns.")
except Exception as e:
    print(f"ERROR: {str(e)}")