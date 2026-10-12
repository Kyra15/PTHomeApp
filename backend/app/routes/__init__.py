from .health import bp as health_bp
from .admin import bp as admin_bp
from .linking import bp as linking_bp


def register_blueprints(app):
    app.register_blueprint(health_bp)
    app.register_blueprint(admin_bp)
    app.register_blueprint(linking_bp)
