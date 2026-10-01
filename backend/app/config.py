import os


class Config:
    SUPABASE_URL = os.environ.get("SUPABASE_URL", "")
    # Server-side only. Use a Supabase *secret* key (sb_secret_...). The legacy
    # service_role key also works if your project still has one. Never ship this
    # key to the iOS app or admin-web.
    SUPABASE_SECRET_KEY = os.environ.get("SUPABASE_SECRET_KEY") or os.environ.get(
        "SUPABASE_SERVICE_ROLE_KEY", ""
    )
    # Shared secret for POST /admin/therapists (provisioning staff accounts). Set a long random
    # value in your .env / Render env vars; never commit a real value.
    ADMIN_PROVISION_KEY = os.environ.get("ADMIN_PROVISION_KEY", "")
