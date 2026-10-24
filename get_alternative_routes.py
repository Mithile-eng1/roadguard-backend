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
import requests
from dotenv import load_dotenv

load_dotenv()
API_KEY = os.getenv("GOOGLE_MAPS_API_KEY")


def get_alternative_routes(origin: str, destination: str) -> list[dict]:
    url = "https://maps.googleapis.com/maps/api/directions/json"
    params = {
        "origin": origin,
        "destination": destination,
        "alternatives": "true",  # <-- the key difference from the existing get_route()
        "key": API_KEY,
    }

    response = requests.get(url, params=params)
    data = response.json()

    if data["status"] != "OK":
        raise Exception(f"Directions API error: {data['status']}")

    routes = []
    for route in data["routes"]:
        leg = route["legs"][0]
        # overview_polyline is simplified and cuts corners; step polylines follow the real road
        points = []
        for step in leg["steps"]:
            points += polyline.decode(step["polyline"]["points"])
        routes.append({
            "polyline": route["overview_polyline"]["points"],
            "points": points,
            "distance_km": leg["distance"]["value"] / 1000,
            # resolved by Google -- gives "lat,lng" inputs a human-readable name
            "start_address": leg.get("start_address", ""),
            "end_address": leg.get("end_address", ""),
            "duration_min": leg["duration"]["value"] / 60,
            "summary": route.get("summary", ""),
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
