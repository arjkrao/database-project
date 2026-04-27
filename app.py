import datetime
import os
import pathlib
from flask import Flask, jsonify, render_template, request, session, abort, redirect, url_for, Response, send_file
from dotenv import load_dotenv
from flask_sqlalchemy import SQLAlchemy
from sqlalchemy import bindparam, text, URL
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
        "is_owner": bool(spot.get("is_owner")),
        "rating": float(spot.get("avg_star_rating") or 0),
        "rating_count": int(spot.get("rating_count") or 0),
        "latitude": float(spot["latitude"]),
        "longitude": float(spot["longitude"]),
        "tags": tags,
        "image_url": url_for("spot_image", location_id=location_id) if has_image else None,
    }

def fetch_spot(location_id, current_user_id=None):
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
                MAX(CASE WHEN o.user_id IS NULL THEN 0 ELSE 1 END) AS is_owner,
                GROUP_CONCAT(DISTINCT lt.tag ORDER BY lt.tag SEPARATOR ',') AS tags
            FROM locations l
            LEFT JOIN location_tags lt ON lt.location_id = l.location_id
            LEFT JOIN owns o
                ON o.location_id = l.location_id
                AND o.user_id = :current_user_id
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
        row = conn.execute(
            query,
            {
                "location_id": location_id,
                "current_user_id": current_user_id,
            },
        ).mappings().first()

    return serialize_spot(row) if row else None

def fetch_visible_spots_for_user(user_id):
    with db.engine.connect() as conn:
        query = text('''
            SELECT
                l.location_id,
                l.location_name,
                l.pricing_tier,
                l.location_status,
                l.avg_star_rating,
                l.description,
                l.latitude,
                l.longitude,
                MAX(CASE WHEN l.location_photo_blob IS NULL THEN 0 ELSE 1 END) AS has_image,
                MAX(CASE WHEN o.user_id IS NULL THEN 0 ELSE 1 END) AS is_owner,
                COALESCE(review_stats.rating_count, 0) AS rating_count,
                GROUP_CONCAT(DISTINCT lt.tag ORDER BY lt.tag SEPARATOR ',') AS tags
            FROM locations l
            LEFT JOIN location_tags lt ON lt.location_id = l.location_id
            LEFT JOIN (
                SELECT location_id, COUNT(*) AS rating_count
                FROM reviews
                GROUP BY location_id
            ) review_stats ON review_stats.location_id = l.location_id
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
                l.avg_star_rating,
                l.description,
                l.latitude,
                l.longitude,
                review_stats.rating_count
            ORDER BY l.location_name ASC
        ''')
        rows = conn.execute(query, {"current_user_id": user_id}).mappings().all()

    return [serialize_spot(row) for row in rows]

def fetch_reviews_for_locations(location_ids, current_user_id=None):
    reviews_by_location = {location_id: [] for location_id in location_ids}
    if not location_ids:
        return reviews_by_location

    query = text('''
        SELECT
            r.user_id,
            r.location_id,
            r.review_datetime,
            r.rating,
            r.review_text,
            u.display_name
        FROM reviews r
        LEFT JOIN users u ON u.user_id = r.user_id
        WHERE r.location_id IN :location_ids
        ORDER BY r.review_datetime DESC
    ''').bindparams(bindparam("location_ids", expanding=True))

    with db.engine.connect() as conn:
        rows = conn.execute(query, {"location_ids": location_ids}).mappings().all()

    for row in rows:
        reviews_by_location.setdefault(row["location_id"], []).append(
            build_review_payload(row, current_user_id)
        )

    return reviews_by_location

def format_review_timestamp(review_datetime):
    if hasattr(review_datetime, "strftime"):
        return review_datetime.strftime("%Y-%m-%d %H:%M:%S")

    return str(review_datetime or "")

def format_review_date(review_datetime):
    if hasattr(review_datetime, "strftime"):
        return review_datetime.strftime("%m/%d/%y")

    return str(review_datetime or "")

def validate_review_form(form):
    try:
        location_id = int(form.get("location_id", ""))
    except (TypeError, ValueError):
        return None, "Location is required."

    try:
        rating = float(form.get("rating", ""))
    except (TypeError, ValueError):
        return None, "Rating is required."

    review_text = (form.get("review_text") or "").strip()

    if rating < 0.5 or rating > 5 or not (rating * 2).is_integer():
        return None, "Rating must be between 0.5 and 5 in half-star increments."
    if not review_text:
        return None, "Review text is required."

    return {
        "location_id": location_id,
        "rating": rating,
        "review_text": review_text,
    }, None

def refresh_location_rating(conn, location_id):
    stats_query = text('''
        SELECT
            COUNT(*) AS rating_count,
            COALESCE(AVG(rating), 0) AS avg_rating
        FROM reviews
        WHERE location_id = :location_id
    ''')
    stats = conn.execute(
        stats_query,
        {"location_id": location_id},
    ).mappings().first()

    rating_count = int(stats.get("rating_count") or 0)
    avg_rating = float(stats.get("avg_rating") or 0)

    update_query = text('''
        UPDATE locations
        SET avg_star_rating = :avg_rating
        WHERE location_id = :location_id
    ''')
    conn.execute(
        update_query,
        {
            "avg_rating": avg_rating,
            "location_id": location_id,
        },
    )

    return {
        "rating": round(avg_rating, 1),
        "rating_count": rating_count,
    }

def build_review_payload(review, current_user_id=None):
    review_datetime = review.get("review_datetime")
    review_user_id = review.get("user_id")
    review_timestamp = format_review_timestamp(review_datetime)
    can_delete = (
        current_user_id is not None
        and review_user_id is not None
        and str(review_user_id) == str(current_user_id)
    )

    return {
        "id": review_timestamp,
        "location_id": review.get("location_id"),
        "review_timestamp": review_timestamp,
        "author": review.get("display_name") or "User",
        "rating": float(review.get("rating") or 0),
        "body": review.get("review_text") or "",
        "date": format_review_date(review_datetime),
        "likes": 0,
        "liked": False,
        "can_delete": can_delete,
    }

def build_home_spot_card(spot, reviews):
    icons = [
        ICON_OPTIONS[tag]
        for tag in spot["tags"]
        if tag in ICON_OPTIONS
    ]

    if not icons:
        icons = [ICON_OPTIONS["Other"]]

    return {
        "id": spot["id"],
        "name": spot["name"],
        "image": url_for("location_image", location_id=spot["id"]),
        "price": spot["price"],
        "status": spot["status"],
        "is_owner": spot["is_owner"],
        "rating": round(float(spot["rating"]), 1),
        "rating_count": spot["rating_count"],
        "description": spot["description"],
        "tags": spot["tags"],
        "latitude": spot["latitude"],
        "longitude": spot["longitude"],
        "icons": icons,
        "reviews": reviews,
    }

def fetch_home_spot_cards_for_user(user_id):
    visible_spots = fetch_visible_spots_for_user(user_id)
    reviews_by_location = fetch_reviews_for_locations(
        [spot["id"] for spot in visible_spots],
        user_id,
    )

    return [
        build_home_spot_card(
            spot,
            reviews_by_location.get(spot["id"], []),
        )
        for spot in visible_spots
    ]

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

    return jsonify({"spots": fetch_visible_spots_for_user(current_user.user_id)})

@app.route("/api/home/spots")
@login_is_required
def list_home_spots():
    current_user = get_user(session.get('email'))
    if current_user is None:
        return jsonify({"error": "User not found."}), 404

    return jsonify({"spots": fetch_home_spot_cards_for_user(current_user.user_id)})

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
        "spot": fetch_spot(newid, owner_id),
    }), 201

@app.route("/home/share_spot", methods=['POST'])
@login_is_required
def share_spot():
    email = request.form.get('email')
    location_id = request.form.get('location_id')
    curr_user = get_user(session.get('email'))

    with db.engine.connect() as conn:
        owner_check = conn.execute(text('SELECT * FROM owns WHERE user_id=:uid AND location_id=:lid'), {"uid": curr_user.user_id, "lid": location_id}).first()
        if not owner_check:
            return jsonify({"status": "error", "message": "You do not own this spot!"}), 403

        target_user = conn.execute(text('SELECT * FROM users WHERE username=:uname'), {"uname": email}).first()
        if not target_user:
            return jsonify({"status": "error", "message": "No user found!"}), 404

        access_check = conn.execute(text('SELECT * FROM `access` WHERE user_id=:uid AND location_id=:lid'), {"uid": target_user.user_id, "lid": location_id}).first()
        if access_check:
            return jsonify({"status": "error", "message": "User is already shared"}), 409

    with db.engine.begin() as conn:
        conn.execute(text('INSERT INTO `access` (user_id, location_id) VALUES (:uid, :lid)'), {"uid": target_user.user_id, "lid": location_id})

    return jsonify({"status": "success", "message": "User shared!"})

@app.route("/home/unshare_spot", methods=['POST'])
@login_is_required
def unshare_spot():
    email = request.form.get('email')
    location_id = request.form.get('location_id')
    curr_user = get_user(session.get('email'))

    with db.engine.connect() as conn:
        owner_check = conn.execute(text('SELECT * FROM owns WHERE user_id=:uid AND location_id=:lid'), {"uid": curr_user.user_id, "lid": location_id}).first()
        if not owner_check:
            return jsonify({"status": "error", "message": "You do not own this spot!"}), 403

        target_user = conn.execute(text('SELECT * FROM users WHERE username=:uname'), {"uname": email}).first()
        if not target_user:
            return jsonify({"status": "error", "message": "User not found!"}), 404

    with db.engine.begin() as conn:
        result = conn.execute(text('DELETE FROM `access` WHERE user_id=:uid AND location_id=:lid'), {"uid": target_user.user_id, "lid": location_id})
        if result.rowcount == 0:
            return jsonify({"status": "error", "message": "User not found or not shared!"}), 404

    return jsonify({"status": "success", "message": "User unshared!"})

@app.route("/home/request_public", methods=['POST'])
@login_is_required
def request_public():
    location_id = request.form.get('location_id')
    curr_user = get_user(session.get('email'))

    with db.engine.connect() as conn:
        owner_check = conn.execute(text('SELECT * FROM owns WHERE user_id=:uid AND location_id=:lid'), {"uid": curr_user.user_id, "lid": location_id}).first()
        if not owner_check:
            return jsonify({"status": "error", "message": "You do not own this spot!"}), 403

    with db.engine.begin() as conn:
        conn.execute(text('UPDATE locations SET location_status="pending" WHERE location_id=:lid'), {"lid": location_id})

    return jsonify({"status": "success", "message": "Request submitted!"})

@app.route("/home")
@login_is_required
def home():
    current_user = get_user(session.get('email'))
    if current_user is None:
        return redirect(url_for('index'))

    spots = fetch_home_spot_cards_for_user(current_user.user_id)

    requested_spots = []
    if get_role() != 'admin':
        requested_spots = []
    else:
        with db.get_engine(bind='admin').begin() as conn:
            query = text('SELECT location_id, location_name, display_name, longitude, latitude, pricing_tier, description FROM locations NATURAL JOIN owns JOIN users ON owns.user_id = users.user_id WHERE location_status="pending";')
            results = conn.execute(query).all()

            for result in results:
                tag_query = text('SELECT tag FROM location_tags WHERE location_id = :lid')
                tag_results = conn.execute(tag_query, {"lid": result.location_id}).all()
                tags = [tag_result.tag for tag_result in tag_results]
                requested_spots.append({
                    "id": result.location_id,
                    "name": result.location_name,
                    "image": url_for("location_image", location_id=result.location_id),
                    "requested_by": result.display_name,
                    "coordinates": f"{result.latitude}, {result.longitude}",
                    "price": result.pricing_tier,
                    "description": result.description,
                    "icons": [ICON_OPTIONS.get(tag, ICON_OPTIONS["Other"]) for tag in tags]
                })
    

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
@login_is_required
def location_image(location_id):
    with db.engine.connect() as conn:
        query = text('SELECT location_photo_blob, location_photo_mimetype FROM locations WHERE location_id = :id;')
        result = conn.execute(query, {"id": location_id}).first()

        if result is None or result[0] is None:
            return send_file("static/def_loc_img.jpg", mimetype="image/jpeg")
        
        image_bytes = result[0]
        image_mimetype = result[1] or "image/jpeg"

    return Response(image_bytes, mimetype=image_mimetype)

@app.route("/profile/create_collection", methods=['POST'])
@login_is_required
def create_collection():
    curr_user = get_user(session.get('email'))
    collection_name = request.form.get('collection_name')

    new_collection = {}
    with db.engine.begin() as conn:
        query = text('INSERT INTO collections (user_id, collection_name) VALUES (:id, :name);')
        result = conn.execute(query, {"id": curr_user.user_id, "name": collection_name})
        new_collection = {
            "id": result.lastrowid,
            "name": collection_name,
        }

    
    return jsonify(new_collection), 200

@app.route("/profile/delete_collection", methods=['POST'])
@login_is_required
def delete_collection():
    curr_user = get_user(session.get('email'))
    collection_id = request.form.get('collection_id')

    with db.engine.begin() as conn:
        query = text('DELETE FROM collections WHERE user_id = :uid AND collection_id = :cid')
        conn.execute(query, {"uid": curr_user.user_id, "cid": collection_id})
    
    return {
        "status": "success",
        "message": "Deleted successfully!"
    }, 200

@app.route("/profile/collection/<int:collection_id>")
@login_is_required
def get_collection_spots(collection_id):
    user = get_user(session.get('email'))

    spots = []
    with db.engine.begin() as conn:
        query = text("""
            SELECT l.location_id, l.location_name
            FROM collection_contains cl
            JOIN locations l ON cl.location_id = l.location_id
            JOIN collections c ON cl.collection_id = c.collection_id
            WHERE c.user_id = :uid AND c.collection_id = :cid
        """)

        results = conn.execute(query, {
            "uid": user.user_id,
            "cid": collection_id
        }).all()

        for r in results:
            spots.append({
                "id": r.location_id,
                "name": r.location_name,
                "image": url_for("location_image", location_id=r.location_id)
            })

    return jsonify(spots)

@app.route("/home/admin/approve_spot", methods=['POST'])
@login_is_required
@admin_required
def approve_spot():
    location_id = request.form.get('location_id')
    user = get_user(session.get('email'))

    with db.get_engine(bind='admin').begin() as conn:
        query = text('UPDATE locations SET location_status="public" WHERE location_id=:lid')
        conn.execute(query, {"lid": location_id})
        query = text('INSERT INTO approves VALUES (:uid, :lid)')
        conn.execute(query, {"uid": user.user_id, "lid": location_id})
    
    return jsonify({
        "status": "success",
        "message": "Spot approved successfully!"
    }), 200

@app.route("/home/admin/reject_spot", methods=['POST'])
@login_is_required
@admin_required
def reject_spot():
    location_id = request.form.get('location_id')

    with db.get_engine(bind='admin').begin() as conn:
        query = text('UPDATE locations SET location_status="private" WHERE location_id=:lid')
        conn.execute(query, {"lid": location_id})
    
    return jsonify({
        "status": "success",
        "message": "Spot rejected successfully!"
    }), 200


@app.route("/profile/collection/remove_spot", methods=['POST'])
@login_is_required
def remove_spot_from_collection():
    user = get_user(session.get('email'))
    collection_id = request.form.get('collection_id')
    location_id = request.form.get('location_id')

    with db.engine.begin() as conn:
        query = text('DELETE FROM collection_contains WHERE user_id = :uid AND collection_id = :cid AND location_id = :lid;')
        conn.execute(query, {"uid": user.user_id, "cid": collection_id, "lid": location_id})
    
    return {
        "status": "success",
        "message": "Spot removed from collection successfully!"
    }, 200

@app.route("/profile/collection/add_spot", methods=['POST'])
@login_is_required
def add_spot_to_collection():
    user = get_user(session.get('email'))
    collection_id = request.form.get('collection_id')
    location_id = request.form.get('location_id')

    with db.engine.begin() as conn:
        query = text('INSERT IGNORE INTO collection_contains (user_id, collection_id, location_id) VALUES (:uid, :cid, :lid);')
        conn.execute(query, {"uid": user.user_id, "cid": collection_id, "lid": location_id})
    
    return {
        "status": "success",
        "message": "Spot added to collection successfully!"
    }, 200

@app.route("/profile/review/add", methods=['POST'])
@login_is_required
def add_review():
    user = get_user(session.get('email'))
    review_data, error = validate_review_form(request.form)
    if error:
        return jsonify({"status": "error", "message": error}), 400

    review_timestamp = datetime.datetime.now().strftime("%Y-%m-%d %H:%M:%S")

    with db.engine.begin() as conn:
        location_query = text('SELECT location_id FROM locations WHERE location_id = :location_id;')
        location = conn.execute(
            location_query,
            {"location_id": review_data["location_id"]},
        ).first()

        if location is None:
            return jsonify({
                "status": "error",
                "message": "Spot not found.",
            }), 404

        insert_query = text('''
            INSERT INTO reviews (user_id, location_id, review_datetime, rating, review_text)
            VALUES (:user_id, :location_id, :review_datetime, :rating, :review_text);
        ''')
        conn.execute(
            insert_query,
            {
                "user_id": user.user_id,
                "location_id": review_data["location_id"],
                "review_datetime": review_timestamp,
                "rating": review_data["rating"],
                "review_text": review_data["review_text"],
            },
        )

        rating_stats = refresh_location_rating(conn, review_data["location_id"])

    return jsonify({
        "status": "success",
        "message": "Review added successfully!",
        "review": build_review_payload(
            {
                "user_id": user.user_id,
                "location_id": review_data["location_id"],
                "review_datetime": review_timestamp,
                "rating": review_data["rating"],
                "review_text": review_data["review_text"],
                "display_name": user.display_name,
            },
            user.user_id,
        ),
        "spot": rating_stats,
    }), 201

@app.route("/profile/review/edit", methods=['POST'])
@login_is_required
def edit_review():
    user = get_user(session.get('email'))
    review_data, error = validate_review_form(request.form)
    if error:
        return jsonify({"status": "error", "message": error}), 400

    old_timestamp = (request.form.get('review_timestamp') or "").strip()
    if not old_timestamp:
        return jsonify({
            "status": "error",
            "message": "Review timestamp is required.",
        }), 400

    new_timestamp = datetime.datetime.now().strftime("%Y-%m-%d %H:%M:%S")

    with db.engine.begin() as conn:
        query = text('UPDATE reviews SET rating=:rating, review_text=:text, review_datetime=:new_timestamp WHERE user_id=:uid AND location_id=:lid AND review_datetime=:old_timestamp;')
        result = conn.execute(query, {"uid": user.user_id, "lid": review_data["location_id"], "rating": review_data["rating"], "text": review_data["review_text"], "old_timestamp": old_timestamp, "new_timestamp": new_timestamp})

        if result.rowcount == 0:
            return {
                "status": "error",
                "message": "Review not found or no changes made."
            }, 404

        rating_stats = refresh_location_rating(conn, review_data["location_id"])

    return jsonify({
        "status": "success",
        "message": "Review edited successfully!",
        "review_timestamp": new_timestamp,
        "spot": rating_stats,
    }), 200

@app.route("/profile/review/delete", methods=['POST'])
@login_is_required
def delete_review():
    user = get_user(session.get('email'))
    try:
        location_id = int(request.form.get("location_id", ""))
    except (TypeError, ValueError):
        return jsonify({
            "status": "error",
            "message": "Location is required.",
        }), 400

    old_timestamp = (request.form.get('review_timestamp') or "").strip()
    if not old_timestamp:
        return jsonify({
            "status": "error",
            "message": "Review timestamp is required.",
        }), 400

    with db.engine.begin() as conn:
        query = text('DELETE FROM reviews WHERE user_id=:uid AND location_id=:lid AND review_datetime=:old_timestamp;')
        result = conn.execute(query, {"uid": user.user_id, "lid": location_id, "old_timestamp": old_timestamp})

        if result.rowcount == 0:
            return {
                "status": "error",
                "message": "No matching review found to delete."
            }, 404

        rating_stats = refresh_location_rating(conn, location_id)

    return jsonify({
        "status": "success",
        "message": "Review deleted successfully!",
        "spot": rating_stats,
    }), 200

@app.route("/profile")
@login_is_required
def profile():
    user = get_user(session.get('email'))
    private_spots = []
    with db.engine.begin() as conn:
        query = text('SELECT location_id, location_name FROM owns NATURAL JOIN locations WHERE user_id = :id AND location_status="private"')
        results = conn.execute(query, {"id": user.user_id}).all()

        for result in results:
            private_spots.append(
                {
                    "id": result.location_id,
                    "name": result.location_name,
                    "image": url_for("location_image", location_id=result.location_id)
                }
            )

    pending_spots = []
    with db.engine.begin() as conn:
        query = text('SELECT location_id, location_name FROM owns NATURAL JOIN locations WHERE user_id = :id AND location_status="pending";')
        results = conn.execute(query, {"id": user.user_id}).all()

        for result in results:
            pending_spots.append(
                {
                    "id": result.location_id,
                    "name": result.location_name,
                    "image": url_for("location_image", location_id=result.location_id)
                }
            )
    
    collections = []
    with db.engine.begin() as conn:
        query = text('SELECT collection_id, collection_name FROM collections WHERE user_id = :id;')
        results = conn.execute(query, {"id": user.user_id}).all()

        for result in results:
            collections.append({
                "id": result.collection_id,
                "name": result.collection_name
                })

    reviews = []
    with db.engine.begin() as conn:
        query = text('SELECT review_datetime, rating, review_text, location_name, location_id FROM reviews NATURAL JOIN locations WHERE user_id = :id;')
        results = conn.execute(query, {"id": user.user_id}).all()
        for result in results:
            reviews.append({
                "location_id": result.location_id,
                "spot_name": result.location_name,
                "timestamp": str(result.review_datetime),
                "date": result.review_datetime.strftime("%m/%d/%y"),
                "rating": float(result.rating),
                "body": result.review_text,
                "likes": 0, # placeholder since we haven't implemented review likes yet
                "liked": False, # placeholder since we haven't implemented review likes yet
            })
    
    shared_spots = []
    with db.engine.begin() as conn:
        query = text('SELECT location_id, location_name FROM locations NATURAL JOIN access WHERE user_id = :id;')
        results = conn.execute(query, {"id": user.user_id}).all()
        for result in results:
            shared_spots.append({
                "id": result.location_id,
                "name": result.location_name,
                "image": url_for("location_image", location_id=result.location_id)
            })

    profile_data = {
        "name": user.display_name,
        "email": user.username,
        "avatar_image": url_for("user_profile_image", username=user.username),
        "private_spots": private_spots,
        "pending_spots": pending_spots,
        "collections": collections,
        "reviews": reviews,
        "shared_spots": shared_spots,
        "available_collections": collections,
    }

    return render_template("profile.html", profile=profile_data)


@app.route("/test")
def test():
    return render_template("test.html")

if __name__ == "__main__":
    app.run(debug=True)
