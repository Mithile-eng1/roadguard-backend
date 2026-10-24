"""
Runs ONLY the route-fetching and Street View image collection steps
(Steps 1-2 from main.py's run_pipeline), skipping the generic
analyzer/scorer steps entirely -- since those don't actually detect
real potholes/speed breakers (see analyze_route_images.py instead).

Usage (from repo root):
    python run_route_collection.py "origin address" "destination address"
"""

import json
import sys

from route_extraction.maps_api import get_route
from route_extraction.polyline_parser import save_waypoints
from route_extraction_distance_sampling import decode_polyline_by_distance
from image_collection.streetview_fetcher import build_pano_chain
from image_collection_retry import download_pano_chain_with_retries


def main():
    if len(sys.argv) < 3:
        print('Usage: python run_route_collection.py "origin address" "destination address" [meters]')
        sys.exit(1)

    origin, destination = sys.argv[1], sys.argv[2]
    meters = int(sys.argv[3]) if len(sys.argv) > 3 else 30

    print("=" * 50)
    print("STEP 1: Fetching Route")
    print("=" * 50)
    polyline_str = get_route(origin, destination)
    waypoints = decode_polyline_by_distance(polyline_str, meters=meters)
    save_waypoints(waypoints)
    print(f"Route found with {len(waypoints)} waypoints (~{meters}m apart).")

    print("\n" + "=" * 50)
    print("STEP 2: Collecting Street View Images (with heading retries)")
    print("=" * 50)
    with open("output/waypoints.json") as f:
        wp_data = json.load(f)
    pano_chain = build_pano_chain(wp_data)
    image_paths = download_pano_chain_with_retries(pano_chain)

    with open("output/images_index.json", "w") as f:
        json.dump(image_paths, f, indent=2)

    print("\nDone. Now run analyze_route_images.py to detect real hazards in these images.")


if __name__ == "__main__":
    main()