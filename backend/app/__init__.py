from flask import Flask
from flask_cors import CORS

from .config import Config
from .extensions import supabase_ext
from .routes import register_blueprints


def create_app(config_object=Config):
    """Application factory. Routes live in blueprints under app/routes/."""
    app = Flask(__name__)
    app.config.from_object(config_object)

    # The admin-web SPA runs on its own origin (e.g. localhost:5173, or wherever it's
    # deployed) and calls this API directly from the browser, so it needs CORS. Only
    # /admin/* and /therapist/* are opened up; the /patient/* endpoints are only called by the native
    # app (no CORS involved).
    origins = app.config["CORS_ORIGINS"]
    CORS(app, resources={r"/admin/*": {"origins": origins}, r"/therapist/*": {"origins": origins}})

    supabase_ext.init_app(app)
    register_blueprints(app)
    return app
