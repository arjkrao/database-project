import os

from dotenv import load_dotenv
from flask import Flask, render_template
from flask_sqlalchemy import SQLAlchemy
from sqlalchemy import text
from sqlalchemy.exc import SQLAlchemyError


load_dotenv()

app = Flask(__name__)
db = SQLAlchemy()

ICON_OPTIONS = {
    "Food": {
        "tooltip": "Food",
        "icon_class": "fa-solid fa-utensils",
    },
    "Drink": {
        "tooltip": "Drink",
        "icon_class": "fa-solid fa-mug-hot",
    },
    "Casual": {
        "tooltip": "Casual",
        "icon_class": "fa-solid fa-shirt",
    },
    "Formal": {
        "tooltip": "Formal",
        "icon_class": "fa-brands fa-black-tie",
    },
    "Nature": {
        "tooltip": "Nature",
        "icon_class": "fa-solid fa-tree",
    },
    "Sports": {
        "tooltip": "Sports",
        "icon_class": "fa-solid fa-football",
    },
    "Recreation": {
        "tooltip": "Recreation",
        "icon_class": "fa-solid fa-person-running",
    },
    "Study": {
        "tooltip": "Study",
        "icon_class": "fa-solid fa-book",
    },
    "Historic": {
        "tooltip": "Historic",
        "icon_class": "fa-solid fa-landmark",
    },
    "Religious": {
        "tooltip": "Religious",
        "icon_class": "fa-solid fa-person-praying",
    },
    "Sightseeing": {
        "tooltip": "Sightseeing",
        "icon_class": "fa-solid fa-binoculars",
    },
    "Tourist Attraction": {
        "tooltip": "Tourist Attraction",
        "icon_class": "fa-solid fa-camera",
    },
    "Other": {
        "tooltip": "Other",
        "icon_class": "fa-solid fa-ellipsis",
    },
}


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


@app.route("/home")
def home():
    spots = [
        {
            "name": "Bodo's Bagels",
            "image": "https://charlottesville29.com/wp-content/uploads/2012/06/food-0621.jpg",
            "price": "FREE",
            "rating": 3.5,
            "rating_count": 12,
            "icons": [
                ICON_OPTIONS["Food"],
            ],
        },
        {
            "name": "Blue Moon Diner",
            "image": "https://cdn.corner.inc/place-photo/AfLeUgNw9h-VKpsyeTo0jouaumEZoS8u36CTseUsrOZtjYFUv1sfPLg19tx8DMT-SAc5jPsGUNDrm96OHzNb_T4XIuySyHk1MzgFotcGM4DJtIjpsTBikOgKGaEMLG8_RRpkT6x1JO5YvwSLcVVfZAVUCeoJxiO3y6oiUTvtNmBJ91y5W0RB.jpeg",
            "price": "$$",
            "rating": 4.5,
            "rating_count": 24,
            "icons": [
                ICON_OPTIONS["Food"],
                ICON_OPTIONS["Drink"],
                ICON_OPTIONS["Casual"],
            ],
        },
    ]

    return render_template("home.html", spots=spots)


@app.route("/profile")
def profile():
    return render_template("profile.html")


@app.route("/test")
def test():
    return render_template("test.html")


if __name__ == "__main__":
    app.run(debug=True)