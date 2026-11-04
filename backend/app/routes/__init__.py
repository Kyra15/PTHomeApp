from .health import bp as health_bp
from .admin import bp as admin_bp
from .linking import bp as linking_bp
from .program import bp as program_bp
from .care import bp as care_bp


def register_blueprints(app):
    app.register_blueprint(health_bp)
    app.register_blueprint(admin_bp)
    app.register_blueprint(linking_bp)
    app.register_blueprint(program_bp)
    app.register_blueprint(care_bp)
