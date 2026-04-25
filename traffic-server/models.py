# backend/weather/models.py
from typing import List, Optional, Tuple
from sqlmodel import SQLModel, Field, Relationship

# --- Database Models (Tables) ---

class Zone(SQLModel, table=True):
    id: str = Field(primary_key=True)
    name: str
    color: str
    heat_threshold: int = Field(default=40)        # Moved config into the DB
    congestion_threshold: float = Field(default=0.8) # Moved config into the DB
    height: float = Field(default=50.0)
    # Relationship
    poles: List["LightPole"] = Relationship(back_populates="zone")

class LightPole(SQLModel, table=True):
    id: str = Field(primary_key=True)
    zone_id: str = Field(foreign_key="zone.id")
    
    # We split location for better database handling
    latitude: float
    longitude: float
    altitude: float = Field(default=0.0)
    
    brightness: int = Field(default=0)
    status: str = Field(default="ONLINE") # ONLINE, OFFLINE, MAINTENANCE
    priority: str = Field(default="Medium")
    manual_override: bool = Field(default=False)
    group: str # Redundant with zone_id, but keeping for frontend compatibility checks
    
    zone: Optional[Zone] = Relationship(back_populates="poles")

    # Compatibility Helper: The frontend expects 'location' as a tuple
    @property
    def location(self) -> Tuple[float, float]:
        return (self.latitude, self.longitude)

class WeatherAnomaly(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    zone_id: str
    condition: str
    bbox_min_lon: float
    bbox_min_lat: float
    bbox_max_lon: float
    bbox_max_lat: float

# --- API Data Transfer Objects (DTOs) ---
# These are used for Request/Response to ensure we don't break the Frontend

class SimulationRequest(SQLModel):
    scenario: str

class OverrideRequest(SQLModel):
    manual_override: bool
    brightness: int

class ZoneCreate(SQLModel):
    id: str
    name: str
    color: str
    heat_threshold: int = 38
    congestion_threshold: float = 0.8
    height: float = 50.0