from flask import Flask
from config import Config
from flask_cors import CORS
from extensions import db, migrate, jwt
from models import User
from routes.auth import auth_bp

app = Flask(__name__)
app.config.from_object(Config)

# Initialize extensions with more permissive CORS
CORS(app)

db.init_app(app)
migrate.init_app(app, db)
jwt.init_app(app)

# Register blueprints
app.register_blueprint(auth_bp)

# Test route
@app.route('/api/test')
def test():
    return {'message': 'Backend is working!'}

if __name__ == "__main__":
    app.run(debug=True, port=5000, host='0.0.0.0')