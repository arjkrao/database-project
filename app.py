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

def get_env(primary_name, fallback_name=None, default=None):
    value = os.environ.get(primary_name)
    if value is None and fallback_name:
        value = os.environ.get(fallback_name)
    if value is None:
        value = default
    if value is None:
        fallback_message = f" or {fallback_name}" if fallback_name else ""
        raise RuntimeError(f"Missing environment variable: {primary_name}{fallback_message}")
    return value

default_username = get_env('DEFAULT_USERNAME', 'USERNAME')
default_password = get_env('DEFAULT_PASSWORD', 'PASSWORD')
admin_username = get_env('ADMIN_USERNAME', default=default_username)
admin_password = get_env('ADMIN_PASSWORD', default=default_password)
database_host = get_env('HOSTNAME')
database_port = get_env('PORTNUM', default=3306)
database_name = get_env('DBNAME')

default_db_url_obj = URL.create(
    drivername="mysql+pymysql",
    username=default_username,
    password=default_password,
    host=database_host,
    port=database_port,
    database=database_name,
)
admin_db_url_obj = URL.create(
    drivername="mysql+pymysql",
    username=admin_username,
    password=admin_password,
    host=database_host,
    port=database_port,
    database=database_name,
)

app.config['SQLALCHEMY_DATABASE_URI'] = default_db_url_obj.render_as_string(hide_password=False)
app.config['SQLALCHEMY_BINDS'] = {
    "admin": admin_db_url_obj.render_as_string(hide_password=False)
}
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False

app.secret_key = get_env('APP_SECRET_KEY', default='dev-secret-key')

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
    if not os.path.exists(client_secrets_file):
        raise FileNotFoundError(
            f"Missing Google OAuth client secrets file: {client_secrets_file}"
        )

    return Flow.from_client_secrets_file(
        client_secrets_file=client_secrets_file,
        scopes=["https://www.googleapis.com/auth/userinfo.profile", "https://www.googleapis.com/auth/userinfo.email", "openid"],
        redirect_uri="http://127.0.0.1:5000/callback"
    )

def dev_login_is_allowed():
    local_hosts = ("127.0.0.1", "localhost")
    host = request.host.split(":", 1)[0]
    return host in local_hosts and not os.path.exists(client_secrets_file)

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

def normalize_price(price):
    price_map = {
        "free": "FREE",
        "FREE": "FREE",
        "1": "$",
        "$": "$",
        "2": "$$",
        "$$": "$$",
        "3": "$$$",
        "$$$": "$$$",
        "4": "$$$$",
        "$$$$": "$$$$",
    }
    return price_map.get(str(price or "").strip(), "")

def parse_tags(tags_raw):
    try:
        tags = json.loads(tags_raw) if tags_raw else []
    except json.JSONDecodeError:
        return []

    if not isinstance(tags, list):
        return []

    valid_tags = set(ICON_OPTIONS)
    cleaned_tags = []
    for tag in tags:
        tag_name = str(tag).strip()
        if tag_name in valid_tags and tag_name not in cleaned_tags:
            cleaned_tags.append(tag_name)

    return cleaned_tags

def validate_spot_form(form):
    name = str(form.get('name') or "").strip()
    description = str(form.get('description') or "").strip()
    price = normalize_price(form.get('price'))
    tags = parse_tags(form.get('tags'))

    try:
        latitude = float(form.get('lat'))
        longitude = float(form.get('lon'))
    except (TypeError, ValueError):
        return None, "Coordinates must be valid numbers."

    if not name:
        return None, "Spot name is required."
    if not description:
        return None, "Spot description is required."
    if not price:
        return None, "Pricing tier is required."
    if not tags:
        return None, "At least one tag is required."
    if latitude < -90 or latitude > 90:
        return None, "Latitude must be between -90 and 90."
    if longitude < -180 or longitude > 180:
        return None, "Longitude must be between -180 and 180."

    return {
        "name": name,
        "description": description,
        "price": price,
        "tags": tags,
        "latitude": latitude,
        "longitude": longitude,
    }, None

def serialize_spot(row):
    spot = dict(row)
    tags = []
    if spot.get("tags"):
        tags = [tag for tag in spot["tags"].split(",") if tag]

    location_id = spot["location_id"]
    has_image = bool(spot.get("has_image"))

    return {
        "id": location_id,
        "name": spot["location_name"],
        "description": spot.get("description") or "",
        "price": spot.get("pricing_tier") or "",
        "status": spot.get("location_status") or "",
        "latitude": float(spot["latitude"]),
        "longitude": float(spot["longitude"]),
        "tags": tags,
        "image_url": url_for("spot_image", location_id=location_id) if has_image else None,
    }

def fetch_spot(location_id):
    with db.engine.connect() as conn:
        query = text('''
            SELECT
                l.location_id,
                l.location_name,
                l.pricing_tier,
                l.location_status,
                l.description,
                l.latitude,
                l.longitude,
                MAX(CASE WHEN l.location_photo_blob IS NULL THEN 0 ELSE 1 END) AS has_image,
                GROUP_CONCAT(DISTINCT lt.tag ORDER BY lt.tag SEPARATOR ',') AS tags
            FROM locations l
            LEFT JOIN location_tags lt ON lt.location_id = l.location_id
            WHERE l.location_id = :location_id
            GROUP BY
                l.location_id,
                l.location_name,
                l.pricing_tier,
                l.location_status,
                l.description,
                l.latitude,
                l.longitude
        ''')
        row = conn.execute(query, {"location_id": location_id}).mappings().first()

    return serialize_spot(row) if row else None

# Gets role of currently logged in user, only used in callback to store user role in session.get('role')
def get_role():
    username = session.get('email') # Email of logged in user which corresponds to "username" in database
    display_name = session.get('name') # Name of logged in user corresponding to "display_name"
    create_user(username, display_name) # If user is already created then do nothing
    return get_user(username).role # Get role by indexing into SQLAlchemy Row and using column name "role" of users table

# Flask Paths
@app.route("/login")
def login():
    if not os.path.exists(client_secrets_file):
        if dev_login_is_allowed():
            return redirect(url_for('dev_login'))

        return (
            "Missing client_secret.json. Add Google OAuth credentials to the project root.",
            500,
        )

    flow = create_flow()
    authorization_url, state = flow.authorization_url()
    session["state"] = state
    session['code_verifier'] = flow.code_verifier

    return redirect(authorization_url)

@app.route("/dev-login")
def dev_login():
    if not dev_login_is_allowed():
        return abort(404)

    session['google_id'] = 'local-dev-user'
    session['name'] = os.environ.get('DEV_DISPLAY_NAME', 'Local Developer')
    session['email'] = os.environ.get('DEV_EMAIL', 'dev@example.com')
    session['role'] = get_role()

    return redirect("/home")

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

@app.route("/api/spots")
@login_is_required
def list_spots():
    current_user = get_user(session.get('email'))
    if current_user is None:
        return jsonify({"error": "User not found."}), 404

    with db.engine.connect() as conn:
        query = text('''
            SELECT
                l.location_id,
                l.location_name,
                l.pricing_tier,
                l.location_status,
                l.description,
                l.latitude,
                l.longitude,
                MAX(CASE WHEN l.location_photo_blob IS NULL THEN 0 ELSE 1 END) AS has_image,
                GROUP_CONCAT(DISTINCT lt.tag ORDER BY lt.tag SEPARATOR ',') AS tags
            FROM locations l
            LEFT JOIN location_tags lt ON lt.location_id = l.location_id
            LEFT JOIN owns o
                ON o.location_id = l.location_id
                AND o.user_id = :current_user_id
            LEFT JOIN `access` a
                ON a.location_id = l.location_id
                AND a.user_id = :current_user_id
            WHERE
                LOWER(COALESCE(l.location_status, '')) = 'public'
                OR (
                    o.user_id IS NOT NULL
                    AND LOWER(COALESCE(l.location_status, '')) IN ('private', 'pending')
                )
                OR a.user_id IS NOT NULL
            GROUP BY
                l.location_id,
                l.location_name,
                l.pricing_tier,
                l.location_status,
                l.description,
                l.latitude,
                l.longitude
            ORDER BY l.location_name ASC
        ''')
        spots = [
            serialize_spot(row)
            for row in conn.execute(
                query,
                {"current_user_id": current_user.user_id},
            ).mappings().all()
        ]

    return jsonify({"spots": spots})

@app.route("/api/spots/<int:location_id>/image")
@login_is_required
def spot_image(location_id):
    with db.engine.connect() as conn:
        query = text('''
            SELECT location_photo_blob, location_photo_mimetype
            FROM locations
            WHERE location_id = :location_id
        ''')
        result = conn.execute(query, {"location_id": location_id}).first()

    if result is None or result.location_photo_blob is None:
        return jsonify({"error": "Spot image not found."}), 404

    return Response(
        result.location_photo_blob,
        mimetype=result.location_photo_mimetype or "application/octet-stream",
    )

@app.route("/home/create_spot", methods=['POST'])
@login_is_required
def create_spot():
    owner_id = get_user(session.get('email')).user_id

    spot_data, error = validate_spot_form(request.form)
    if error:
        return jsonify({"error": error}), 400

    image_file = request.files.get('image')
    image_bytes = None
    image_mimetype = None
    if image_file and image_file.filename:
        image_bytes = image_file.read()
        image_mimetype = image_file.mimetype

    # not going to be able to add spot anywhere else so just include SQL functionality here
    with db.engine.begin() as conn:
        query = text('INSERT INTO locations (location_name, pricing_tier, location_status, description, latitude, longitude, location_photo_blob, location_photo_mimetype) \
                     VALUES (:lname, :ptier, :status, :desc, :lati, :longi, :img_file, :mimetype)')
        result = conn.execute(query, {
            "lname": spot_data["name"],
            "ptier": spot_data["price"],
            "status": "private",
            "desc": spot_data["description"],
            "lati": spot_data["latitude"],
            "longi": spot_data["longitude"],
            "img_file": image_bytes,
            "mimetype": image_mimetype,
        })

        newid = result.lastrowid
        for tag in spot_data["tags"]:
            query = text('INSERT INTO location_tags (location_id, tag) VALUES (:lid, :t)')
            conn.execute(query, {"lid": newid, "t": tag})

        query = text('INSERT INTO owns (user_id, location_id) VALUES (:uid, :lid)')
        conn.execute(query, {"uid": owner_id, "lid": newid})

    return jsonify({
        "status": "success",
        "message": "Spot created successfully",
        "spot": fetch_spot(newid),
    }), 201

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
    
@app.route("/profile/<int:location_id>/location_img")
def location_image(location_id):
    with db.engine.connect() as conn:
        query = text('SELECT location_photo_blob, location_photo_mimetype FROM locations WHERE location_id = :id;')
        result = conn.execute(query, {"id": location_id}).first()

        if result is None or result[0] is None:
            return send_file("static/def_loc_img.jpg", mimetype="image/jpeg")
        
        image_bytes = result[0]
        image_mimetype = result[1] or "image/jpeg"

    return Response(image_bytes, mimetype=image_mimetype)
@app.route("/profile")
@login_is_required
def profile():
    user = get_user(session.get('email'))
    private_spots = []
    with db.engine.connect() as conn:
        query = text('SELECT location_id, location_name FROM owns NATURAL JOIN locations WHERE user_id = :id;')
        results = conn.execute(query, {"id": user.user_id}).all()

        for result in results:
            private_spots.append(
                {
                    "id": result.location_id,
                    "name": result.location_name,
                    "image": url_for("location_image", location_id=result.location_id)
                }
            )
    
    
    

    profile_data = {
        "name": user.display_name,
        "email": user.username,
        "avatar_image": url_for("user_profile_image", username=user.username),
        "private_spots": private_spots,
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
