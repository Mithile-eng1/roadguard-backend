import polyline
import json
import os

def decode_polyline(polyline_str, interval=10):
    """
    Decodes encoded polyline string into list of (lat, lng) waypoints.
    interval: sample every Nth point to reduce API calls
    """
    all_points = polyline.decode(polyline_str)
    # Sample every `interval` points to avoid too many Street View calls
    sampled = all_points[::interval]
    return sampled

def save_waypoints(waypoints, output_path="output/waypoints.json"):
    """
    Saves waypoints to a JSON file.
    """
    os.makedirs(os.path.dirname(output_path), exist_ok=True)
    data = [{"lat": lat, "lng": lng} for lat, lng in waypoints]
    with open(output_path, "w") as f:
        json.dump(data, f, indent=2)
    print(f"Saved {len(data)} waypoints to {output_path}")
    return data

if __name__ == "__main__":
    from maps_api import get_route
    polyline_str = get_route("Kurnool, Andhra Pradesh", "Hyderabad, Telangana")
    waypoints = decode_polyline(polyline_str, interval=10)
    save_waypoints(waypoints)