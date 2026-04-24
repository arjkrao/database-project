import os
import pathlib
from flask import Flask, render_template, request, session, abort, redirect, url_for
from dotenv import load_dotenv
from flask_sqlalchemy import SQLAlchemy
from sqlalchemy import text, URL
from google_auth_oauthlib.flow import Flow
from google.oauth2 import id_token
from google.auth.transport import requests
from functools import wraps

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

app = Flask(__name__)

load_dotenv()

default_db_url_obj = URL.create(
    drivername="mysql+pymysql",
    username=os.environ['DEFAULT_USERNAME'],
    password=os.environ['DEFAULT_PASSWORD'],
    host=os.environ['HOSTNAME'],
    port=os.environ['PORTNUM'],
    database=os.environ['DBNAME'],
)
admin_db_url_obj = URL.create(
    drivername="mysql+pymysql",
    username=os.environ['ADMIN_USERNAME'],
    password=os.environ['ADMIN_PASSWORD'],
    host=os.environ['HOSTNAME'],
    port=os.environ['PORTNUM'],
    database=os.environ['DBNAME'],
)

app.config['SQLALCHEMY_DATABASE_URI'] = default_db_url_obj.render_as_string(hide_password=False)
app.config['SQLALCHEMY_BINDS'] = {
    "admin": admin_db_url_obj.render_as_string(hide_password=False)
}
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False

app.secret_key = os.environ['APP_SECRET_KEY']

client_secrets_file = os.path.join(pathlib.Path(__file__).parent, "client_secret.json")

db = SQLAlchemy(app)

# Login Functions
def login_is_required(function):
    @wraps(function)
    def wrapper(*args, **kwargs):
        if "google_id" not in session:
            return redirect(url_for('index')) # Authorization required
        return function(*args, **kwargs)
    return wrapper

def create_flow():
    return Flow.from_client_secrets_file(
        client_secrets_file=client_secrets_file,
        scopes=["https://www.googleapis.com/auth/userinfo.profile", "https://www.googleapis.com/auth/userinfo.email", "openid"],
        redirect_uri="http://127.0.0.1:5000/callback"
    )

# Database Functions

def create_user(username, display_name):
    with db.engine.begin() as conn:
        query = text('INSERT INTO users (username, display_name) VALUES (:uname, :dname) ON DUPLICATE KEY UPDATE username=username;') # creates new user if it does not exist, otherwise do nothing
        conn.execute(query, {"uname": username, "dname": display_name})

def get_user(username):
    with db.engine.begin() as conn:
        query = text('SELECT * FROM users WHERE username=:uname') 
        result = conn.execute(query, {"uname": username}).first() # since username is unique
    return result

# Gets role of currently logged in user, only used in callback to store user role in session.get('role')
def get_role():
    username = session.get('email') # Email of logged in user which corresponds to "username" in database
    display_name = session.get('name') # Name of logged in user corresponding to "display_name"
    create_user(username, display_name) # If user is already created then do nothing
    return get_user(username).role # Get role by indexing into SQLAlchemy Row and using column name "role" of users table

# Flask Paths
@app.route("/login")
def login():
    flow = create_flow()
    authorization_url, state = flow.authorization_url()
    session["state"] = state
    session['code_verifier'] = flow.code_verifier


    return redirect(authorization_url)

@app.route("/callback")
def callback():
    flow = create_flow()
    flow.code_verifier = session.get('code_verifier')
    flow.fetch_token(authorization_response=request.url)

    if not session.get('state') == request.args.get('state'):
        return abort(500) # state does not match

    credentials = flow.credentials
    
    id_info = id_token.verify_oauth2_token(
        id_token=credentials.id_token,
        request=requests.Request(),
        audience=os.environ['GOOGLE_CLIENT_ID']
    )

    session['google_id'] = id_info['sub']
    session['name'] = id_info.get('name')
    session['email'] = id_info.get('email')

    session['role'] = get_role()

    return redirect("/home")

@app.route("/logout")
def logout():
    session.clear()
    return redirect('/')

@app.route("/")
def index():
    return "<p>Hello world <a href='/login'><button>Login</button></a></p>" 


@app.route("/home")
@login_is_required
def home():

    spots = [
        {
            "name": "Bodo's Bagels",
            "image": "https://charlottesville29.com/wp-content/uploads/2012/06/food-0621.jpg",
            "price": "FREE",
            "rating": 3.5,
            "rating_count": 12,
            "description": "Bodos is a bagel shop with many bagels and drinks.",
            "icons": [
                ICON_OPTIONS["Food"],
                ICON_OPTIONS["Drink"],
                ICON_OPTIONS["Casual"],
            ],
            "reviews": [
                {
                    "id": 1,
                    "author": "Raheel Syed",
                    "rating": 4.0,
                    "body": "I'm loving it",
                    "date": "03/10/05",
                    "likes": 10,
                    "liked": False,
                },
                {
                    "id": 2,
                    "author": "Rayyan Alam",
                    "rating": 3.5,
                    "body": "Great outdoor seating and fast service.",
                    "date": "03/11/05",
                    "likes": 7,
                    "liked": True,
                },
            ],
        },
        {
            "name": "Blue Moon Diner",
            "image": "https://placehold.co/300x300",
            "price": "$$",
            "rating": 4.5,
            "rating_count": 24,
            "description": "Blue Moon Diner is a casual spot for comfort food and coffee.",
            "icons": [
                ICON_OPTIONS["Food"],
                ICON_OPTIONS["Drink"],
                ICON_OPTIONS["Casual"],
                ICON_OPTIONS["Tourist Attraction"],
            ],
            "reviews": [
                {
                    "id": 3,
                    "author": "Austin Kim",
                    "rating": 4.5,
                    "body": "Amazing pancakes and really nice vibe.",
                    "date": "04/02/05",
                    "likes": 14,
                    "liked": True,
                },
                {
                    "id": 4,
                    "author": "Maya Patel",
                    "rating": 4.0,
                    "body": "Great brunch spot but it gets busy fast.",
                    "date": "04/05/05",
                    "likes": 5,
                    "liked": False,
                },
                {
                    "id": 5,
                    "author": "Chris Lee",
                    "rating": 5.0,
                    "body": "One of my favorite diner spots in town.",
                    "date": "04/09/05",
                    "likes": 9,
                    "liked": False,
                },
            ],
        },
    ]

    requested_spots = [
        {
            "id": 1,
            "name": "Shannon Library",
            "image": "https://library.virginia.edu/sites/default/files/2025-03/shannon-tour-landing-page.jpg",
            "requested_by": "Rayyan Alam",
            "coordinates": "38.0364, -78.5053",
            "price": "FREE",
            "icons": [
                ICON_OPTIONS["Study"],
                ICON_OPTIONS["Historic"],
            ],
        },
        {
            "id": 2,
            "name": "The Lawn",
            "image": "https://placehold.co/376x282/f2f2f0/232d4a?text=The+Lawn",
            "requested_by": "Maya Patel",
            "coordinates": "38.0356, -78.5034",
            "price": "FREE",
            "icons": [
                ICON_OPTIONS["Historic"],
                ICON_OPTIONS["Sightseeing"],
                ICON_OPTIONS["Tourist Attraction"],
            ],
        },
        {
            "id": 3,
            "name": "Memorial Gym",
            "image": "https://placehold.co/376x282/c7cad1/232d4a?text=Memorial+Gym",
            "requested_by": "Austin Kim",
            "coordinates": "38.0392, -78.5061",
            "price": "$",
            "icons": [
                ICON_OPTIONS["Sports"],
                ICON_OPTIONS["Recreation"],
            ],
        },
    ]

    bookmark_collections = ["Hype", "Yummers", "Chill"]

    return render_template(
        "home.html",
        spots=spots,
        requested_spots=requested_spots,
        bookmark_collections=bookmark_collections,
        user_role=session.get('role')
    )

@app.route("/profile")
@login_is_required
def profile():
    profile_data = {
        "name": "Raheel Syed",
        "email": "email@gmail.com",
        "avatar_image": "https://placehold.co/384x384",
        "private_spots": [
            {
                "id": 1,
                "name": "Austin's Bagels",
                "image": "https://placehold.co/300x300",
            },
        ],
        "collection_names": [
            "Hype",
            "Yummers",
        ],
        "collection_spots": [
            {
                "id": 2,
                "name": "Hype Spot",
                "image": "https://placehold.co/300x300/f2f2f0/232d4a?text=Hype",
            },
        ],
        "reviews": [
            {
                "spot_name": "Austin's Bagels",
                "date": "03/10/05",
                "rating": 4.0,
                "body": "Its ight. Its ight. Its ight. Its ight. Its ight.",
                "likes": 10,
                "liked": False,
            },
        ],
        "shared_spots": [
            {
                "id": 3,
                "name": "Shared Spot",
                "image": "https://placehold.co/300x300/f5e7da/232d4a?text=Shared+List",
            },
        ],
        "available_collections": [
            "Hype",
            "Yummers",
            "Chill",
        ],
    }

    return render_template("profile.html", profile=profile_data)
@app.route("/test")
def test():
    return render_template("test.html")

if __name__ == "__main__":
    app.run(debug=True)