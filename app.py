<<<<<<< HEAD
import json
import os
import uuid
from pathlib import Path

from flask import Flask, jsonify, render_template, request
from sqlalchemy import Float, String, Text, create_engine, select
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column, sessionmaker


BASE_DIR = Path(__file__).resolve().parent
DATA_DIR = BASE_DIR / "data"
SEED_FILE = DATA_DIR / "locations.json"
DB_FILE = DATA_DIR / "locations.db"


class Base(DeclarativeBase):
    pass


class Location(Base):
    __tablename__ = "locations"

    id: Mapped[str] = mapped_column(String(64), primary_key=True)
    name: Mapped[str] = mapped_column(String(120), nullable=False)
    latitude: Mapped[float] = mapped_column(Float, nullable=False)
    longitude: Mapped[float] = mapped_column(Float, nullable=False)
    category: Mapped[str] = mapped_column(String(80), nullable=False, default="Custom")
    description: Mapped[str] = mapped_column(Text, nullable=False, default="")

    def to_dict(self) -> dict:
        return {
            "id": self.id,
            "name": self.name,
            "latitude": self.latitude,
            "longitude": self.longitude,
            "category": self.category,
            "description": self.description,
        }


engine = create_engine(f"sqlite:///{DB_FILE}", future=True)
SessionLocal = sessionmaker(bind=engine, future=True, expire_on_commit=False)

app = Flask(__name__)


def ensure_database() -> None:
    DATA_DIR.mkdir(parents=True, exist_ok=True)
    Base.metadata.create_all(engine)

    with SessionLocal() as session:
        existing_count = session.query(Location).count()
        if existing_count:
            return

        seed_locations = load_seed_locations()
        for item in seed_locations:
            session.add(
                Location(
                    id=item.get("id") or str(uuid.uuid4()),
                    name=item["name"].strip(),
                    latitude=float(item["latitude"]),
                    longitude=float(item["longitude"]),
                    category=(item.get("category") or "Custom").strip() or "Custom",
                    description=(item.get("description") or "").strip(),
                )
            )
        session.commit()


def load_seed_locations() -> list[dict]:
    if not SEED_FILE.exists():
        return []

    with SEED_FILE.open("r", encoding="utf-8") as file:
        data = json.load(file)

    return data if isinstance(data, list) else []


def validate_location(payload: dict) -> tuple[dict | None, str | None]:
    name = str(payload.get("name", "")).strip()
    category = str(payload.get("category", "")).strip() or "Custom"
    description = str(payload.get("description", "")).strip()

    try:
        latitude = float(payload.get("latitude"))
    except (TypeError, ValueError):
        return None, "Latitude must be a number between -90 and 90."

    try:
        longitude = float(payload.get("longitude"))
    except (TypeError, ValueError):
        return None, "Longitude must be a number between -180 and 180."

    if not name:
        return None, "Name is required."
    if latitude < -90 or latitude > 90:
        return None, "Latitude must be a number between -90 and 90."
    if longitude < -180 or longitude > 180:
        return None, "Longitude must be a number between -180 and 180."

    return {
        "id": str(payload.get("id") or uuid.uuid4()),
        "name": name,
        "latitude": latitude,
        "longitude": longitude,
        "category": category,
        "description": description,
    }, None


@app.get("/")
def index():
    return render_template("index.html")


@app.get("/api/locations")
def list_locations():
    with SessionLocal() as session:
        locations = session.scalars(select(Location).order_by(Location.name.asc())).all()
        return jsonify({"locations": [location.to_dict() for location in locations]})


@app.post("/api/locations")
def create_location():
    payload = request.get_json(silent=True) or {}
    location_data, error = validate_location(payload)

    if error:
        return jsonify({"error": error}), 400

    with SessionLocal() as session:
        location = Location(**location_data)
        session.add(location)
        session.commit()
        return jsonify({"location": location.to_dict()}), 201


@app.delete("/api/locations/<location_id>")
def delete_location(location_id: str):
    with SessionLocal() as session:
        location = session.get(Location, location_id)
        if location is None:
            return jsonify({"error": "Location not found."}), 404

        session.delete(location)
        session.commit()
        return ("", 204)


ensure_database()


if __name__ == "__main__":
    app.run(debug=True, host="127.0.0.1", port=int(os.environ.get("PORT", 5000)))
=======
import os
import pathlib
from flask import Flask, jsonify, render_template, request, session, abort, redirect, url_for, Response, send_file
from dotenv import load_dotenv
from flask_sqlalchemy import SQLAlchemy
from sqlalchemy import text, URL
from google_auth_oauthlib.flow import Flow
from google.oauth2 import id_token
from google.auth.transport import requests
from functools import wraps
import json

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

# protect webpages with content required for login
def login_is_required(function):
    @wraps(function)
    def wrapper(*args, **kwargs):
        if "google_id" not in session:
            return redirect(url_for('index')) # Authorization required
        return function(*args, **kwargs)
    return wrapper

# protect admin endpoints
def admin_required(function):
    @wraps(function)
    def wrapper(*args, **kwargs):
        user = get_user(session.get('email'))
        if not user or user.role != 'admin':
            return abort(403)
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
    return render_template("index.html", show_header_buttons=False)

@app.context_processor
def inject_user():
    email = session.get('email')
    if(email == None): return {}

    curr_user = get_user(email)
    print(curr_user)
    if(curr_user is None): return
    return {
        "curr_uid": curr_user.user_id,
        "curr_username": curr_user.username,
        "curr_displayname": curr_user.display_name,
        "curr_role": curr_user.role,
    }

@app.route("/home/create_spot", methods=['POST'])
@login_is_required
def create_spot():
    owner_id = get_user(session.get('email')).user_id

    name = request.form.get('name')
    description = request.form.get('description')
    price = request.form.get('price')
    tags_raw = request.form.get('tags')  # "Food,Study,Nature"
    try:
        tags = json.loads(tags_raw) if tags_raw else []
    except:
        tags = []
        
    lat = request.form.get('lat')
    lon = request.form.get('lon')

    image_file = request.files.get('image')
    image_bytes = None
    if image_file:
        image_bytes = image_file.read()

    # not going to be able to add spot anywhere else so just include SQL functionality here
    with db.engine.begin() as conn:
        query = text('INSERT INTO locations (location_name, pricing_tier, description, latitude, longitude, location_photo_blob, location_photo_mimetype) \
                     VALUES (:lname, :ptier, :desc, :lati, :longi, :img_file, :mimetype)')
        result = conn.execute(query, {
            "lname": name,
            "ptier": price, 
            "desc": description,
            "lati": float(lat),
            "longi": float(lon),
            "img_file": image_bytes,
            "mimetype": image_file.mimetype 
        })

        newid = result.lastrowid
        print(newid)
        for tag in tags:
            query = text('INSERT INTO location_tags (location_id, tag) VALUES (:lid, :t)')
            conn.execute(query, {"lid": newid, "t": tag})

        query = text('INSERT INTO owns (user_id, location_id) VALUES (:uid, :lid)')
        conn.execute(query, {"uid": owner_id, "lid": newid})
        

    return jsonify({
        "status": "success",
        "message": "Spot created successfully"
    })

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
    )

@app.route("/user/<string:username>/pfp")
@login_is_required
def user_profile_image(username):
    with db.engine.connect() as conn:
        query = text('SELECT pfp_file, pfp_file_mimetype FROM users WHERE username = :uname;')
        result = conn.execute(query, {"uname": username}).first()

        if result is None or result[0] is None:
            return send_file("static/default_pfp.jpg", mimetype="image/jpeg")
        
        image_bytes = result[0]
        image_mimetype = result[1] or "image/jpeg"

    return Response(image_bytes, mimetype=image_mimetype)
            

@app.route("/profile/upload_avatar", methods=['POST'])
@login_is_required
def update_profile_image():
    curr_user = get_user(session.get('email'))
    image_file = request.files.get('avatar')

    if not image_file:
        return jsonify({"message": "No file specified"}), 400
    
    ALLOWED_TYPES = {'image/jpeg', 'image/png', 'image/webp'}
    if image_file.mimetype not in ALLOWED_TYPES:
        return jsonify({"message": "Unsupported filetype, please use JPEG, PNG, or WEBP"}), 400
    
    image_bytes = image_file.read()
    image_mimetype = image_file.mimetype

    with db.engine.begin() as conn:
        query = text('UPDATE users SET pfp_file=:img, pfp_file_mimetype=:mimetype WHERE user_id=:id')
        conn.execute(query, {'img': image_bytes, 'mimetype': image_mimetype, 'id': curr_user.user_id})
    
    return jsonify({
        "status": "success", 
        "message": "pfp updated successfully",
        "username": curr_user.username
    }), 200
    



@app.route("/profile")
@login_is_required
def profile():
    user = get_user(session.get('email'))

    profile_data = {
        "name": user.display_name,
        "email": user.username,
        "avatar_image": url_for("user_profile_image", username=user.username),
        "private_spots": [
            {
                "id": 1,
                "name": "Austin's Bagels",
                "image": "https://placehold.co/300x300",
            },
        ],
        "pending_spots": [
            {
                "id": 3,
                "name": "Pending Spot",
                "image": "https://placehold.co/300x300/f5e7da/232d4a?text=Pending+Spot",
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
                "image": "https://placehold.co/300x300/f2f2f0/232d4a?text=Hype_Spot",
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
                "image": "https://placehold.co/300x300/f5e7da/232d4a?text=Shared+Spot",
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
>>>>>>> api-endpoint
