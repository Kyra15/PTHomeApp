from flask import Flask

from .config import Config
from .extensions import supabase_ext
from .routes import register_blueprints


def create_app(config_object=Config):
    """Application factory. Routes live in blueprints under app/routes/."""
    app = Flask(__name__)
    app.config.from_object(config_object)

    supabase_ext.init_app(app)
    register_blueprints(app)
    return app
