# database-project

Custom location map demo built with Flask, SQLAlchemy, SQLite, and Leaflet.

## Project structure

- `app.py` serves the web UI and JSON API.
- `data/locations.json` seeds the database on first run.
- `templates/` contains the HTML template.
- `static/` contains the CSS and client-side JavaScript.
- `legacy/` keeps the original PHP database connector for reference.

## Run locally

1. Create and activate a virtual environment.
2. Install dependencies with `pip install -r requirements.txt`.
3. Start the app with `python app.py`.
4. Open `http://127.0.0.1:5000`.

The SQLite database is created automatically at `data/locations.db` the first time the app starts.
