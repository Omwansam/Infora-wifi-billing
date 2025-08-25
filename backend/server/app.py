from flask import Flask
from config import Config
from flask_cors import CORS
from extensions import db, migrate, jwt
from models import User
from routes.auth import auth_bp
from routes.customers import customers_bp
from routes.invoices import invoices_bp

app = Flask(__name__)
app.config.from_object(Config)
app.url_map.strict_slashes = False

# Initialize extensions with more permissive CORS
CORS(app,
     origins=['http://localhost:5173', 'http://127.0.0.1:5173'],
     supports_credentials=True,
     methods=['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
     allow_headers=['Content-Type', 'Authorization'])

db.init_app(app)
migrate.init_app(app, db)
jwt.init_app(app)

# Register blueprints
app.register_blueprint(auth_bp)
app.register_blueprint(customers_bp)
app.register_blueprint(invoices_bp)

# Test route
@app.route('/api/test')
def test():
    return {'message': 'Backend is working!'}

# Test customer count route
@app.route('/api/test/customers')
def test_customers():
    from models import Customer
    count = Customer.query.count()
    return {'message': f'Database has {count} customers'}

# Global CORS handler
@app.after_request
def after_request(response):
    response.headers.add('Access-Control-Allow-Origin', 'http://localhost:5173')
    response.headers.add('Access-Control-Allow-Headers', 'Content-Type,Authorization')
    response.headers.add('Access-Control-Allow-Methods', 'GET,PUT,POST,DELETE,OPTIONS')
    response.headers.add('Access-Control-Allow-Credentials', 'true')
    return response

if __name__ == "__main__":
    app.run(debug=True, port=5000, host='0.0.0.0')