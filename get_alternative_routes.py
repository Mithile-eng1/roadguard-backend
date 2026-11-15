"""
Fetches ALL alternative routes between two points from Google Directions
API, not just the single default route the existing get_route() function
returns. Google's API supports this via the 'alternatives=true' parameter
-- it's just never been requested by the existing code.

Usage:
    from get_alternative_routes import get_alternative_routes
    routes = get_alternative_routes("Coimbatore", "Tirupur")
    # Returns a list of dicts: [{"polyline": "...", "distance_km": ..., "duration_min": ...}, ...]
"""

import os

import polyline
import re
import requests
from dotenv import load_dotenv

load_dotenv()
API_KEY = os.getenv("GOOGLE_SERVER_KEY") or os.getenv("GOOGLE_MAPS_API_KEY")  # server key has no website restriction


def _waypoint(text: str) -> dict:
    """'lat,lng' -> location, anything else -> address (Routes API wants one or the other)."""
    m = re.fullmatch(r"\s*(-?\d+(?:\.\d+)?)\s*,\s*(-?\d+(?:\.\d+)?)\s*", text)
    if m:
        return {"location": {"latLng": {"latitude": float(m[1]), "longitude": float(m[2])}}}
    return {"address": text}


def _secs(d: str) -> float:
    return float(str(d).rstrip("s") or 0)  # Routes API durations look like "123s"


def get_alternative_routes(origin: str, destination: str) -> list[dict]:
    # Google's newer Routes API (new Cloud projects can no longer enable the old Directions API)
    r = requests.post(
        "https://routes.googleapis.com/directions/v2:computeRoutes",
        headers={
            "X-Goog-Api-Key": API_KEY or "",
            "X-Goog-FieldMask": ("routes.distanceMeters,routes.duration,routes.description,"
                                 "routes.polyline.encodedPolyline,routes.legs.steps"),
        },
        json={"origin": _waypoint(origin), "destination": _waypoint(destination), "travelMode": "DRIVE",
              "computeAlternativeRoutes": True, "languageCode": "en", "units": "METRIC"},
        timeout=30,
    )
    data = r.json()
    if r.status_code != 200 or not data.get("routes"):
        msg = data.get("error", {}).get("message") or "no route found"
        raise Exception(f"Routes API error: {msg}")

    routes = []
    for route in data["routes"]:
        leg = route["legs"][0]
        points = []
        steps = []
        for step in leg["steps"]:
            points += polyline.decode(step["polyline"]["encodedPolyline"])
            nav = step.get("navigationInstruction", {})
            man = nav.get("maneuver", "").lower().replace("_", "-")
            ll = step["startLocation"]["latLng"]
            steps.append({
                "instruction": re.sub(r"\s+", " ", nav.get("instructions", "")).strip(),
                "maneuver": man if man not in ("", "maneuver-unspecified", "depart", "name-change") else "straight",
                "distance_m": step.get("distanceMeters", 0),
                "duration_s": _secs(step.get("staticDuration", "0s")),
                "location": [ll["latitude"], ll["longitude"]],
            })
        routes.append({
            "polyline": route["polyline"]["encodedPolyline"],
            "points": points,
            "distance_km": route["distanceMeters"] / 1000,
            # the Routes API returns no address text, so show what the user typed (blank for lat,lng)
            "start_address": "" if _waypoint(origin).get("location") else origin,
            "end_address": "" if _waypoint(destination).get("location") else destination,
            "duration_min": _secs(route["duration"]) / 60,
            "summary": route.get("description", ""),
            "steps": steps,
        })

    return routes


if __name__ == "__main__":
    import sys
    if len(sys.argv) != 3:
        print('Usage: python get_alternative_routes.py "origin" "destination"')
        sys.exit(1)

    routes = get_alternative_routes(sys.argv[1], sys.argv[2])
    print(f"Found {len(routes)} alternative route(s):\n")
    for i, r in enumerate(routes):
        print(f"Route {i+1}: {r['summary']} -- {r['distance_km']:.1f}km, {r['duration_min']:.0f}min")
