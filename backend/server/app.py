from flask import Flask
from config import Config
from flask_cors import CORS
from extensions import db, migrate, jwt
from models import User

app = Flask(__name__)
app.config.from_object(Config)


CORS(app)
db.init_app(app)
migrate.init_app(app, db)
jwt.init_app(app)



if __name__ == "__main__":
    app.run(debug=True, port=5555)