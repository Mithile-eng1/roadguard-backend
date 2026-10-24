"""
For a given origin/destination, fetches EVERY alternative route Google
offers, collects Street View images along each one, runs hazard
detection + personalized risk scoring, and recommends the route with
the lowest overall risk for the specified vehicle.

IMPORTANT -- cost/time warning: this multiplies your API usage by the
number of routes found (often 2-3). Uses a wider sampling interval by
default to keep this manageable; increase for more thorough (but
slower/costlier) coverage.

Usage:
    python analyze_all_routes.py "origin" "destination" "Honda City" [meters]
"""

import cv2
import sys
from pathlib import Path

sys.path.append(str(Path(__file__).resolve().parent))
from get_alternative_routes import get_alternative_routes  # noqa: E402
from route_extraction_distance_sampling import decode_polyline_by_distance  # noqa: E402
from image_collection.streetview_fetcher import build_pano_chain  # noqa: E402
from image_collection_retry import download_pano_chain_with_retries  # noqa: E402

sys.path.append(str(Path(__file__).resolve().parent / "hazard_detection"))
from src.hazard_detector import detect_hazards  # noqa: E402
from src.vehicle import get_vehicle  # noqa: E402
from src import risk_engine  # noqa: E402


def evaluate_route(route_index: int, polyline_str: str, vehicle: dict, meters: int, conf: float):
    """Runs the full pipeline for ONE route and returns its risk summary."""
    print(f"\n{'='*50}")
    print(f"Evaluating Route {route_index + 1}")
    print(f"{'='*50}")

    waypoints = decode_polyline_by_distance(polyline_str, meters=meters)
    print(f"  {len(waypoints)} waypoints sampled")

    # build_pano_chain expects a list of dicts ({"lat":..., "lng":...}),
    # but decode_polyline_by_distance returns plain (lat, lng) tuples --
    # convert here instead of relying on a save-to-JSON-and-reload round trip.
    waypoints_as_dicts = [{"lat": lat, "lng": lng} for lat, lng in waypoints]

    pano_chain = build_pano_chain(waypoints_as_dicts)
    output_dir = f"output/route_{route_index}_images"
    images = download_pano_chain_with_retries(pano_chain, output_dir=output_dir)
    print(f"  {len(images)} images collected")

    clearance_cm = vehicle["ground_clearance_mm"] / 10
    hazard_count = 0
    risk_scores = []

    # Save annotated images per route, same as analyze_route_images.py does
    hazard_output_dir = Path(f"output/route_{route_index}_hazards")
    pothole_dir = hazard_output_dir / "potholes"
    speedbreaker_dir = hazard_output_dir / "speedbreakers"
    pothole_dir.mkdir(parents=True, exist_ok=True)
    speedbreaker_dir.mkdir(parents=True, exist_ok=True)

    for img in images:
        image_path = img.get("image")
        if not image_path:
            continue

        hazards = detect_hazards(image_path, conf_threshold=conf)

        for hazard in hazards:
            hazard_count += 1
            base_risk = risk_engine.combined_risk_score(hazard["confidence"], hazard["confidence"])
            final_risk = risk_engine.personalized_risk(base_risk, clearance_cm)
            risk_scores.append(final_risk)

            # Draw the box on a copy of the image and save it
            cv_image = cv2.imread(image_path)
            if cv_image is not None:
                x1, y1, x2, y2 = map(int, hazard["bbox"])
                color = (0, 0, 255) if hazard["hazard_type"] == "pothole" else (0, 165, 255)
                cv2.rectangle(cv_image, (x1, y1), (x2, y2), color, 3)
                risk_class = risk_engine.risk_class(final_risk)
                label = f"{hazard['hazard_type']} - {risk_class} ({final_risk:.2f})"
                cv2.putText(cv_image, label, (x1, max(y1 - 10, 20)),
                            cv2.FONT_HERSHEY_SIMPLEX, 0.7, color, 2)

                dest_dir = pothole_dir if hazard["hazard_type"] == "pothole" else speedbreaker_dir
                out_name = Path(image_path).name
                cv2.imwrite(str(dest_dir / out_name), cv_image)

    avg_risk = sum(risk_scores) / len(risk_scores) if risk_scores else 0.0
    max_risk = max(risk_scores) if risk_scores else 0.0

    print(f"  Hazards detected: {hazard_count}")
    print(f"  Average risk: {avg_risk:.3f}, Max risk: {max_risk:.3f}")
    print(f"  Annotated images saved to: {hazard_output_dir}")

    return {
        "route_index": route_index,
        "waypoint_count": len(waypoints),
        "image_count": len(images),
        "hazard_count": hazard_count,
        "avg_risk": avg_risk,
        "max_risk": max_risk,
    }


def main():
    if len(sys.argv) < 4:
        print('Usage: python analyze_all_routes.py "origin" "destination" "Vehicle Name" [meters]')
        sys.exit(1)

    origin, destination, vehicle_name = sys.argv[1], sys.argv[2], sys.argv[3]
    meters = int(sys.argv[4]) if len(sys.argv) > 4 else 50

    vehicle = get_vehicle(vehicle_name)
    if vehicle is None:
        raise ValueError(f"Vehicle '{vehicle_name}' not found. Run 'python -m src.vehicle' to see options.")

    print(f"Fetching alternative routes from '{origin}' to '{destination}'...")
    routes = get_alternative_routes(origin, destination)
    print(f"Found {len(routes)} route(s).")

    if len(routes) == 1:
        print("\nNote: Google only returned ONE route for this origin/destination pair.")
        print("This can happen for simple, direct trips with no meaningfully different alternative.")

    results = []
    for i, route in enumerate(routes):
        print(f"\nRoute {i+1} summary: {route['summary']} -- "
              f"{route['distance_km']:.1f}km, {route['duration_min']:.0f}min")
        result = evaluate_route(i, route["polyline"], vehicle, meters, conf=0.3)
        result["distance_km"] = route["distance_km"]
        result["duration_min"] = route["duration_min"]
        result["summary"] = route["summary"]
        results.append(result)

    print(f"\n{'='*50}")
    print("FINAL COMPARISON")
    print(f"{'='*50}")
    for r in results:
        print(f"Route {r['route_index']+1} ({r['summary']}): "
              f"{r['distance_km']:.1f}km, {r['hazard_count']} hazards, "
              f"avg risk {r['avg_risk']:.3f}, max risk {r['max_risk']:.3f}")

    best = min(results, key=lambda r: r["avg_risk"])
    print(f"\nRECOMMENDED (lowest average risk for {vehicle['vehicle']}): "
          f"Route {best['route_index']+1} ({best['summary']})")


if __name__ == "__main__":
    main()