from flask import Flask
from config import Config
from extensions import db, jwt, migrate
from flask_cors import CORS


app = Flask(__name__)
app.config.from_object(Config)

CORS(app)
db.init_app(app)
migrate.init_app(app, db)
jwt.init_app(app)

@app.route('/')
def home():
    return 'Hello, World!'

if __name__ == '__main__':
    app.run(debug=True, port=5000)