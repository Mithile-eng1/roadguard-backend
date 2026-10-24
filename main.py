from route_extraction.maps_api import get_route
from route_extraction.polyline_parser import decode_polyline, save_waypoints
from image_collection.streetview_fetcher import fetch_all_images
from preprocessing.road_preprocessor import preprocess_all_images  # ← ADD THIS
from road_analysis.analyzer import analyze_all_images
from risk_scoring.scorer import score_all_waypoints
from routing_engine.astar import find_safe_route

def run_pipeline(origin, destination):
    print("=" * 50)
    print("STEP 1: Fetching Route")
    print("=" * 50)
    polyline_str = get_route(origin, destination)
    waypoints = decode_polyline(polyline_str, interval=10)
    save_waypoints(waypoints)

    print("\n" + "=" * 50)
    print("STEP 2: Collecting Street View Images")
    print("=" * 50)
    fetch_all_images()

    print("\n" + "=" * 50)
    print("STEP 3: Preprocessing Road Images")       # ← ADD THIS
    print("=" * 50)
    preprocess_all_images()                           # ← ADD THIS

    print("\n" + "=" * 50)
    print("STEP 4: Analyzing Road Conditions")
    print("=" * 50)
    analyze_all_images()

    print("\n" + "=" * 50)
    print("STEP 5: Scoring Risk per Waypoint")
    print("=" * 50)
    score_all_waypoints()

    print("\n" + "=" * 50)
    print("STEP 6: Finding Safest Route")
    print("=" * 50)
    find_safe_route()

    print("\n✅ Pipeline complete! Check the output/ folder.")


if __name__ == "__main__":
    origin = "tanguturu, Andhra Pradesh"
    destination = "alukurapadu, Andhra Pradesh"
    run_pipeline(origin, destination)