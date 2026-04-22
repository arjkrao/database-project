import os

from dotenv import load_dotenv
from flask import Flask, render_template, send_from_directory
from flask_sqlalchemy import SQLAlchemy
from sqlalchemy import text
from sqlalchemy.exc import SQLAlchemyError


load_dotenv()

app = Flask(__name__)
db = SQLAlchemy()


def build_database_uri():
    username = os.getenv("USERNAME")
    password = os.getenv("PASSWORD")
    host = os.getenv("HOSTNAME", "localhost")
    dbname = os.getenv("DBNAME")

    missing = [
        key
        for key, value in {
            "USERNAME": username,
            "PASSWORD": password,
            "HOSTNAME": host,
            "DBNAME": dbname,
        }.items()
        if not value
    ]

    if missing:
        return None, f"Missing environment variables: {', '.join(missing)}"

    uri = f"mysql+pymysql://{username}:{password}@{host}/{dbname}"
    return uri, None


def test_db_connection():
    try:
        db.session.execute(text("SELECT 1"))
        host = os.getenv("HOSTNAME", "localhost")
        return True, f"Connected to the database successfully on {host}."
    except SQLAlchemyError as exc:
        return False, str(exc)


database_uri, config_error = build_database_uri()
if database_uri:
    app.config["SQLALCHEMY_DATABASE_URI"] = database_uri
else:
    app.config["SQLALCHEMY_DATABASE_URI"] = "sqlite:///:memory:"

app.config["SQLALCHEMY_TRACK_MODIFICATIONS"] = False
db.init_app(app)


@app.route("/")
def index():
    if config_error:
        connected, message = False, config_error
    else:
        connected, message = test_db_connection()
    return render_template("index.html", connected=connected, message=message)


@app.route("/profile")
def profile():
    return render_template("profile.html")


@app.route("/style.css")
def stylesheet():
    return send_from_directory("templates", "style.css")


if __name__ == "__main__":
    app.run(debug=True)
