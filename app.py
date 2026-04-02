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
