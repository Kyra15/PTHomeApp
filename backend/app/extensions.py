from supabase import Client, create_client


class SupabaseExtension:
    """Lazily creates one Supabase client per app so tests can swap it out."""

    def __init__(self):
        self._client = None

    def init_app(self, app):
        app.extensions["supabase"] = self

    def configured(self, app) -> bool:
        return bool(app.config["SUPABASE_URL"] and app.config["SUPABASE_SECRET_KEY"])

    def client(self, app) -> Client:
        if self._client is None:
            self._client = create_client(
                app.config["SUPABASE_URL"], app.config["SUPABASE_SECRET_KEY"]
            )
        return self._client

    def check(self, app):
        """Return (ok, detail). Runs a trivial query against the `exercises` table."""
        if not self.configured(app):
            return False, "not_configured"
        try:
            self.client(app).table("exercises").select("id").limit(1).execute()
            return True, "connected"
        except Exception as exc:  # network, auth, or missing-table errors
            return False, f"error: {type(exc).__name__}"


supabase_ext = SupabaseExtension()
