# backend/weather/database.py
from sqlmodel import SQLModel, create_engine, Session, select
from sqlalchemy.orm import sessionmaker
from models import Zone, LightPole

import os
# Creates a file named 'smartcity.db' in the backend/weather folder
sqlite_file_name = os.path.join(os.path.dirname(__file__), "smartcity.db")
sqlite_url = f"sqlite:///{sqlite_file_name}"

engine = create_engine(sqlite_url, echo=False)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine, class_=Session)

def get_session():
    with Session(engine) as session:
        yield session

def create_db_and_tables():
    SQLModel.metadata.create_all(engine)

# --- Seeding Script to Restore Your Mock Data ---
def seed_data_if_empty():
    with Session(engine) as session:
        # Check if we already have zones
        existing_zone = session.exec(select(Zone)).first()
        if existing_zone:
            return # DB is already populated

        print("🌱 Seeding database with initial data...")
        
        # 1. CSM Airport
        airport = Zone(id="airport_zone", name="CSM International Airport", color="#f97316", heat_threshold=38, congestion_threshold=0.8)
        session.add(airport)
        session.add(LightPole(id="AIR-01", zone_id="airport_zone", latitude=19.0896, longitude=72.8656, brightness=80, group="CSM International Airport"))
        session.add(LightPole(id="AIR-02", zone_id="airport_zone", latitude=19.0912, longitude=72.8648, brightness=80, group="CSM International Airport"))
        session.add(LightPole(id="AIR-03", zone_id="airport_zone", latitude=19.0881, longitude=72.8665, brightness=0, status="OFFLINE", group="CSM International Airport"))
        
        # 2. KEM Hospital
        hospital = Zone(id="hospital_zone", name="KEM Hospital", color="#ef4444", heat_threshold=40, congestion_threshold=0.7)
        session.add(hospital)
        session.add(LightPole(id="HOS-01", zone_id="hospital_zone", latitude=19.0150, longitude=72.8400, brightness=90, priority="High", group="KEM Hospital"))
        session.add(LightPole(id="HOS-04", zone_id="hospital_zone", latitude=19.0158, longitude=72.8415, brightness=0, status="MAINTENANCE", priority="High", group="KEM Hospital"))

        # 3. Dadar Residential
        dadar = Zone(id="residential_zone", name="Dadar Residential Area", color="#3b82f6", heat_threshold=36, congestion_threshold=0.85)
        session.add(dadar)
        session.add(LightPole(id="RES-01", zone_id="residential_zone", latitude=19.0220, longitude=72.8440, brightness=60, priority="Low", group="Dadar Residential Area"))
        session.add(LightPole(id="RES-02", zone_id="residential_zone", latitude=19.0235, longitude=72.8430, brightness=65, priority="Low", group="Dadar Residential Area"))

        session.commit()
        print("✅ Database seeded successfully!")