"""
Bridge between the personalized hazard detection pipeline (this module)
and the existing routing_engine/astar.py (built by a teammate).

WHY THIS EXISTS: routing_engine/astar.py expects a risk_scores.json file
shaped like risk_scoring/scorer.py produces -- but that generic scorer
has no vehicle personalization (no confidence/severity split, no ground
clearance). This script produces a risk_scores.json in the SAME format,
so astar.py needs zero changes, but the risk numbers actually come from
your trained pothole/speedbreaker models + vehicle-specific ground
clearance, not a generic obstacle count.

Expected input: output/images_index.json, in the same format
road_analysis/analyzer.py already expects:
    [{"lat": 17.385, "lng": 78.4867, "image": "path/to/image.jpg"}, ...]
(This file is normally produced by image_collection/streetview_fetcher.py)

Usage (from hazard_detection/ folder):
    python scripts/personalized_risk_scorer.py --vehicle "Honda City" --images-index ../output/images_index.json
"""

import argparse
import json
import sys
from pathlib import Path

sys.path.append(str(Path(__file__).resolve().parent.parent))
from src.hazard_detector import detect_hazards  # noqa: E402
from src.severity import estimate_visual_severity  # noqa: E402
from src.vehicle import get_vehicle  # noqa: E402
from src import risk_engine  # noqa: E402
from PIL import Image  # noqa: E402


def score_waypoint(image_path: str, ground_clearance_cm: float, conf_threshold: float = 0.5):
    """
    Runs hazard detection + personalized risk scoring for ONE waypoint's
    image. Returns the highest risk score found (worst hazard at this
    location), or 0.0 if nothing was detected -- matching the "no
    obstacles = 0 risk" behavior of the original generic scorer.
    """
    hazards = detect_hazards(image_path, conf_threshold=conf_threshold)

    if not hazards:
        return 0.0, 0

    image = Image.open(image_path)
    img_width, img_height = image.size

    risks = []
    for hazard in hazards:
        severity_result = estimate_visual_severity(hazard["bbox"], img_width, img_height)
        base_risk = risk_engine.combined_risk_score(hazard["confidence"], severity_result["visual_severity"])
        personalized = risk_engine.personalized_risk(base_risk, ground_clearance_cm)
        risks.append(personalized)

    return max(risks), len(hazards)


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--vehicle", required=True, help="Vehicle name, e.g. 'Honda City'")
    parser.add_argument("--images-index", required=True,
                         help="Path to images_index.json (lat/lng/image per waypoint)")
    parser.add_argument("--conf", type=float, default=0.5, help="Detection confidence threshold")
    parser.add_argument("--output", default="../output/risk_scores.json",
                         help="Where to write the risk_scores.json that astar.py reads")
    args = parser.parse_args()

    vehicle = get_vehicle(args.vehicle)
    if vehicle is None:
        raise ValueError(f"Vehicle '{args.vehicle}' not found. Check src/vehicle.py's vehicles.csv.")

    ground_clearance_cm = vehicle["ground_clearance_mm"] / 10

    with open(args.images_index) as f:
        waypoints = json.load(f)

    scored = []
    for item in waypoints:
        risk_score, obstacle_count = score_waypoint(item["image"], ground_clearance_cm, args.conf)
        risk_label = risk_engine.risk_class(risk_score) if risk_score > 0 else "Low"

        scored.append({
            "lat": item["lat"],
            "lng": item["lng"],
            "risk_score": round(risk_score, 4),
            "risk_label": risk_label,
            "obstacle_count": obstacle_count,
        })
        print(f"({item['lat']}, {item['lng']}) -> Score: {round(risk_score, 4)} [{risk_label}] "
              f"for {vehicle['vehicle']} ({vehicle['ground_clearance_mm']}mm)")

    output_path = Path(args.output)
    output_path.parent.mkdir(parents=True, exist_ok=True)
    with open(output_path, "w") as f:
        json.dump(scored, f, indent=2)

    print(f"\nPersonalized risk scoring complete for {vehicle['vehicle']}. "
          f"{len(scored)} waypoints scored.")
    print(f"Written to: {output_path}")
    print("\nNext: routing_engine's astar.py can now read this file directly --")
    print("no changes needed to astar.py itself, since the output format matches exactly.")


if __name__ == "__main__":
    main()
