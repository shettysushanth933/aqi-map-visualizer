import os
import json
from typing import List
from fastapi import FastAPI, HTTPException, Depends
from fastapi.middleware.cors import CORSMiddleware
import httpx
from sqlmodel import Session, select
from dotenv import load_dotenv

from database import engine, create_db_and_tables, seed_data_if_empty, get_session
from models import WeatherAnomaly

load_dotenv()
ARCGIS_API_KEY = os.environ.get("ARCGIS_API_KEY")

app = FastAPI(title="Smart City Traffic API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.on_event("startup")
def on_startup():
    create_db_and_tables()
    seed_data_if_empty()


# ─── Region Bbox Lookup ────────────────────────────────────────────────────────

# Each zone is ~1 km x 1 km (0.009° lat ≈ 1 km, 0.010° lon ≈ 1 km at Mumbai latitude)
REGION_BBOXES = {
    "Colaba":   {"min_lon": 72.815, "min_lat": 18.905, "max_lon": 72.825, "max_lat": 18.915},
    "Dadar":    {"min_lon": 72.838, "min_lat": 19.016, "max_lon": 72.850, "max_lat": 19.026},
    "BKC":      {"min_lon": 72.860, "min_lat": 19.060, "max_lon": 72.872, "max_lat": 19.070},
    "Andheri":  {"min_lon": 72.835, "min_lat": 19.112, "max_lon": 72.847, "max_lat": 19.122},
    "Borivali": {"min_lon": 72.848, "min_lat": 19.225, "max_lon": 72.860, "max_lat": 19.235},
}


# ─── Weather Anomaly Endpoints ─────────────────────────────────────────────────

@app.get("/api/v1/traffic/weather-anomalies", response_model=List[WeatherAnomaly])
def get_anomalies(session: Session = Depends(get_session)):
    return session.exec(select(WeatherAnomaly)).all()


@app.post("/api/v1/traffic/simulate-weather")
def simulate_weather(request: dict, session: Session = Depends(get_session)):
    region    = request.get("region", "")
    condition = request.get("condition", "Heavy Rain")
    zone_key  = region.lower().replace(" ", "_") or "generic"

    bbox = REGION_BBOXES.get(region, {
        "min_lon": 72.850, "min_lat": 19.080,
        "max_lon": 72.880, "max_lat": 19.100,
    })

    # ── UPSERT: delete existing hazard for this zone first ──────────────────
    existing = session.exec(
        select(WeatherAnomaly).where(WeatherAnomaly.zone_id == zone_key)
    ).all()
    for old in existing:
        session.delete(old)

    session.add(WeatherAnomaly(
        zone_id      = zone_key,
        condition    = condition,
        bbox_min_lon = bbox["min_lon"],
        bbox_min_lat = bbox["min_lat"],
        bbox_max_lon = bbox["max_lon"],
        bbox_max_lat = bbox["max_lat"],
    ))
    session.commit()
    return {"status": "success", "message": f"{condition} launched over {region}."}


@app.delete("/api/v1/traffic/clear-weather")
def clear_weather(session: Session = Depends(get_session)):
    for a in session.exec(select(WeatherAnomaly)).all():
        session.delete(a)
    session.commit()
    return {"status": "success", "message": "All weather anomalies cleared."}


# ─── Helpers ───────────────────────────────────────────────────────────────────

def speed_to_color(speed_kmh: float) -> str:
    """Google-Maps-style traffic colour thresholds."""
    if speed_kmh >= 50:
        return "#10b981"   # emerald  – free flow
    elif speed_kmh >= 30:
        return "#f59e0b"   # amber    – moderate
    elif speed_kmh >= 15:
        return "#f97316"   # orange   – slow
    else:
        return "#ef4444"   # red      – congested / hazard

def speed_to_status(speed_kmh: float) -> str:
    if speed_kmh >= 50:  return "Clear"
    elif speed_kmh >= 30: return "Moderate"
    elif speed_kmh >= 15: return "Slow"
    else:                  return "Severe"

async def call_arcgis_routing(origin_lon: float, origin_lat: float, dest_lon: float, dest_lat: float, anomalies: List[WeatherAnomaly], client: httpx.AsyncClient) -> dict:
    if not ARCGIS_API_KEY:
        raise HTTPException(status_code=500, detail="ARCGIS_API_KEY is not configured on the server.")

    url = "https://route-api.arcgis.com/arcgis/rest/services/World/Route/NAServer/Route_World/solve"
    
    stops_data = {
        "type": "features",
        "features": [
            {"geometry": {"x": origin_lon, "y": origin_lat}},
            {"geometry": {"x": dest_lon, "y": dest_lat}}
        ]
    }
    
    params = {
        "f": "json",
        "token": ARCGIS_API_KEY,
        "stops": json.dumps(stops_data),
        "startTime": "now",  # Enable real-time traffic
    }
    
    if anomalies:
        features = []
        for a in anomalies:
            features.append({
                "geometry": {
                    "rings": [[
                        [a.bbox_min_lon, a.bbox_min_lat],
                        [a.bbox_min_lon, a.bbox_max_lat],
                        [a.bbox_max_lon, a.bbox_max_lat],
                        [a.bbox_max_lon, a.bbox_min_lat],
                        [a.bbox_min_lon, a.bbox_min_lat]
                    ]],
                    "spatialReference": {"wkid": 4326}
                },
                "attributes": {
                    "Name": a.zone_id,
                    "Attr_Minutes": -1  # -1 means full restriction for polygonBarriers, though it's typically just applied by having it in polygonBarriers
                }
            })
        params["polygonBarriers"] = json.dumps({
            "type": "features",
            "features": features
        })

    r = await client.post(url, data=params)
    r.raise_for_status()
    data = r.json()
    
    if "error" in data:
        print(f"ArcGIS Error Data: {json.dumps(data, indent=2)}")
        raise HTTPException(status_code=400, detail=data["error"].get("message", "ArcGIS Routing Error"))
        
    return data

def build_geojson_from_arcgis(data: dict, anomalies: List[WeatherAnomaly]) -> tuple[dict, float, float, str]:
    routes = data.get("routes", {}).get("features", [])
    if not routes:
        raise HTTPException(status_code=404, detail="No route found.")
        
    route = routes[0]
    attributes = route.get("attributes", {})
    distance_km = attributes.get("Total_Kilometers", 0.0)
    duration_min = attributes.get("Total_TravelTime", 0.0)
    
    paths = route.get("geometry", {}).get("paths", [])
    if not paths:
        raise HTTPException(status_code=404, detail="Route geometry missing.")
        
    speed_kmh = (distance_km / (duration_min / 60.0)) if duration_min > 0 else 60.0
    color = speed_to_color(speed_kmh)
    status = speed_to_status(speed_kmh)
    
    impact = "Route Impacted by Weather (Diverted)" if anomalies else ("Moderate Traffic" if speed_kmh < 40 and speed_kmh >= 15 else ("Optimal Traffic" if speed_kmh >= 40 else "Severe Traffic"))
    
    features = [{
        "type": "Feature",
        "geometry": {
            "type": "LineString",
            "coordinates": paths[0]
        },
        "properties": {
            "color": color,
            "status": status,
            "speed_kmh": round(speed_kmh),
        }
    }]
    
    return (
        {"type": "FeatureCollection", "features": features},
        round(duration_min),
        round(distance_km, 2),
        impact,
    )


# ─── Route Calculation ─────────────────────────────────────────────────────────

@app.post("/api/v1/traffic/calculate-smart-route")
async def calculate_smart_route(data: dict, session: Session = Depends(get_session)):
    origin      = data.get("origin")       # [lon, lat]
    destination = data.get("destination")  # [lon, lat]

    if not origin or not destination:
        raise HTTPException(status_code=400, detail="Origin and Destination required.")

    origin_lon, origin_lat     = float(origin[0]), float(origin[1])
    dest_lon,   dest_lat       = float(destination[0]), float(destination[1])

    active_hazards = session.exec(select(WeatherAnomaly)).all()

    try:
        async with httpx.AsyncClient(timeout=30.0) as client:
            arcgis_data = await call_arcgis_routing(
                origin_lon, origin_lat, dest_lon, dest_lat, active_hazards, client
            )
            
            geojson, duration_min, distance_km, impact = build_geojson_from_arcgis(arcgis_data, active_hazards)
            
            route_summary = (
                f"Active hazards detected. ArcGIS successfully recalculated the route utilizing real-time traffic and avoiding {len(active_hazards)} hazard zones."
                if active_hazards else 
                f"ArcGIS calculated optimal route using live traffic. {impact}."
            )

            return {
                "geojson":       geojson,
                "route_summary": route_summary,
                "impact_state":  impact,
                "duration_min":  duration_min,
                "distance_km":   distance_km,
            }

    except httpx.TimeoutException:
        raise HTTPException(status_code=504, detail="Routing service timed out. Please try again.")
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Routing error: {str(e)}")

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8001, reload=False)
