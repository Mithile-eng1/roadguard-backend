import os
import polyline
import requests
from dotenv import load_dotenv

load_dotenv()
API_KEY = os.getenv("GOOGLE_MAPS_API_KEY")


def _directions(origin, destination):
    """Raw Directions API response. Origin/destination may be place names or 'lat,lng'."""
    url = "https://maps.googleapis.com/maps/api/directions/json"
    params = {
        "origin": origin,
        "destination": destination,
        "key": API_KEY
    }
    data = requests.get(url, params=params).json()
    if data["status"] != "OK":
        raise Exception(f"Directions API error: {data['status']}")
    return data


def get_route(origin, destination):
    """
    Fetches route polyline from Google Directions API.
    Returns the encoded overview polyline string.
    """
    return _directions(origin, destination)["routes"][0]["overview_polyline"]["points"]


def get_route_points(origin, destination):
    """
    Full-detail route as [(lat, lng), ...] built from every step's polyline
    (the overview polyline is simplified and cuts corners at junctions).
    """
    points = []
    for step in _directions(origin, destination)["routes"][0]["legs"][0]["steps"]:
        points += polyline.decode(step["polyline"]["points"])
    return points


if __name__ == "__main__":
    origin = "Kurnool, Andhra Pradesh"
    destination = "Hyderabad, Telangana"
    polyline_str = get_route(origin, destination)
    print("Polyline received:")
    print(polyline_str[:80], "...")
