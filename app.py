import os
from flask import Flask, render_template
from dotenv import load_dotenv
from flask_sqlalchemy import SQLAlchemy
from sqlalchemy import text

app = Flask(__name__)

load_dotenv()
db_user = os.environ['USERNAME']
db_password = os.environ['PASSWORD']
db_name = os.environ['DBNAME']
db_hostname = os.environ['HOSTNAME']

app.config["SQLALCHEMY_DATABASE_URI"] = "mysql+pymysql://{db_user}:{db_password}@{db_hostname}/{db_name}".format(db_user=db_user, db_password=db_password, db_hostname=db_hostname, db_name=db_name)
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False

db = SQLAlchemy(app)

@app.route("/")
def hello_world():
    print("hi")
    return "<p>Hello, World!</p>"
