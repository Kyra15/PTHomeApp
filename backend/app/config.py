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

    # Transactional email (https://resend.com). HTTPS API on purpose: Render's free tier blocks outbound
    # SMTP. If RESEND_API_KEY is unset the invite is still created and the portal shows the code so the
    # therapist can share it manually.
    RESEND_API_KEY = os.environ.get("RESEND_API_KEY", "")
    EMAIL_FROM = os.environ.get("EMAIL_FROM", "Kinetic <onboarding@resend.dev>")

    # Public URL of the admin-web portal. Invite emails link to {PORTAL_URL}/invite/<code>, a page that
    # opens the app (kinetic://invite/<code>) or shows the code to type in.
    PORTAL_URL = os.environ.get("PORTAL_URL", "http://localhost:5173").rstrip("/")

    # Expo push service (existing app users get a push for a new doctor invite).
    EXPO_PUSH_URL = os.environ.get("EXPO_PUSH_URL", "https://exp.host/--/api/v2/push/send")

    INVITE_TTL_DAYS = int(os.environ.get("INVITE_TTL_DAYS", "14"))

    # Comma-separated list of origins allowed to call /admin/* from a browser (admin-web's
    # dev server and deployed URL). "*" works for local development but not for a browser
    # request that sends credentials, which this app doesn't use, so "*" is fine here too.
    CORS_ORIGINS = [
        o.strip()
        for o in os.environ.get("CORS_ORIGINS", "http://localhost:5173").split(",")
        if o.strip()
    ]
