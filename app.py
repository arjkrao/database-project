import os
import pathlib
from flask import Flask, render_template, request, session, abort, redirect
from dotenv import load_dotenv
from flask_sqlalchemy import SQLAlchemy
from sqlalchemy import text
from google_auth_oauthlib.flow import Flow
from google.oauth2 import id_token
from google.auth.transport import requests


app = Flask(__name__)

load_dotenv()
db_user = os.environ['USERNAME']
db_password = os.environ['PASSWORD']
db_name = os.environ['DBNAME']
db_hostname = os.environ['HOSTNAME']

app.config["SQLALCHEMY_DATABASE_URI"] = "mysql+pymysql://{db_user}:{db_password}@{db_hostname}/{db_name}".format(db_user=db_user, db_password=db_password, db_hostname=db_hostname, db_name=db_name)
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False
app.secret_key = "heheheha"

client_secrets_file = os.path.join(pathlib.Path(__file__).parent, "client_secret.json")
flow = Flow.from_client_secrets_file(client_secrets_file=client_secrets_file,
                                     scopes=["https://www.googleapis.com/auth/userinfo.profile", "https://www.googleapis.com/auth/userinfo.email", "openid"],
                                     redirect_uri="http://127.0.0.1:5000/callback")

db = SQLAlchemy(app)


def login_is_required(function):
    def wrapper(*args, **kwargs):
        if "google_id" not in session:
            return abort(401) # Authorization required
        else:
            return function()
    return wrapper

@app.route("/login")
def login():
    authorization_url, state = flow.authorization_url()
    session["state"] = state
    session["google_id"] = "test"
    return redirect(authorization_url)

@app.route("/callback")
def callback():
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

    return redirect("/protected_area")

@app.route("/logout")
def logout():
    session.clear()
    return redirect('/')

@app.route("/")
def index():
    return "<p>Hello world <a href='/login'><button>Login</button></a></p>" 

@app.route("/protected_area")
@login_is_required
def protected_area():
    return "<p> Protected! Welcome {name} <a href='/logout'><button>Logout</button></a></p>".format(name=session.get("name"))