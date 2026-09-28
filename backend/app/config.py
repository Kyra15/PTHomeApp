import os


class Config:
    # Server-side only. Never ship the service-role key to the iOS app or admin-web.
    SUPABASE_URL = os.environ.get("SUPABASE_URL", "")
    SUPABASE_SERVICE_ROLE_KEY = os.environ.get("SUPABASE_SERVICE_ROLE_KEY", "")
