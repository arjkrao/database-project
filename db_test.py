from flask import Flask
from sqlalchemy import create_engine, text, URL
from dotenv import load_dotenv
import os

db_test_app = Flask(__name__)

load_dotenv()

db_url_obj = URL.create(
    drivername="mysql+pymysql",
    username=os.environ['USERNAME'],
    password=os.environ['PASSWORD'],
    host=os.environ['HOSTNAME'],
    port=os.environ['PORTNUM'],
    database=os.environ['DBNAME'],
)

db_test_app.config['SQLALCHEMY_DATABASE_URI'] = db_url_obj.render_as_string(hide_password=False)
db_test_app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False

engine = create_engine(db_url_obj)


@db_test_app.route("/")
def index():
    rows = []
    with engine.connect() as connection:
        query = text('SELECT * FROM users WHERE username="Arjun"')
        result = connection.execute(query)

        for row in result:
            rows.append(row)
            print(row)
    
    return "Hello World!"

   