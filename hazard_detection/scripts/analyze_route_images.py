"""
Replaces road_analysis/analyzer.py's role in the main pipeline with
REAL pothole/speed breaker detection, using the actually-trained
models from hazard_detection/, instead of a generic COCO model that
was never trained to recognize either hazard type.

Reads output/images_index.json (produced by streetview_fetcher.py),
runs both trained models on every image, and prints/returns a summary:
how many potholes, how many speed breakers, and which specific images
they were found in.

Usage (from repo root, after running Steps 1-2 of main.py's pipeline):
    python hazard_detection/scripts/analyze_route_images.py \
        --pothole-model hazard_detection/models/pothole_best_FINAL.pt \
        --speedbreaker-model hazard_detection/models/speedbreaker_best_FINAL.pt \
        --vehicle "Honda City"
"""

import argparse
import json
import shutil
import sys
from pathlib import Path

import cv2

sys.path.append(str(Path(__file__).resolve().parent.parent))
from src.hazard_detector import detect_hazards  # noqa: E402
from src.vehicle import get_vehicle  # noqa: E402


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--pothole-model", required=True)
    parser.add_argument("--speedbreaker-model", required=True)
    parser.add_argument("--vehicle", required=True)
    parser.add_argument("--images-index", default="output/images_index.json",
                         help="Path to the index produced by streetview_fetcher.py")
    parser.add_argument("--conf", type=float, default=0.3)
    args = parser.parse_args()

    vehicle = get_vehicle(args.vehicle)
    if vehicle is None:
        raise ValueError(f"Vehicle '{args.vehicle}' not found. Run 'python -m src.vehicle' to see options.")

    # hazard_detector.py's model loading is hardcoded to config.py's paths --
    # this overrides those specifically for this run
    from src import config
    config.POTHOLE_WEIGHTS = Path(args.pothole_model)
    config.SPEEDBREAKER_WEIGHTS = Path(args.speedbreaker_model)

    with open(args.images_index) as f:
        pano_chain = json.load(f)

    output_dir = Path("output/detected_hazards")
    pothole_dir = output_dir / "potholes"
    speedbreaker_dir = output_dir / "speedbreakers"
    pothole_dir.mkdir(parents=True, exist_ok=True)
    speedbreaker_dir.mkdir(parents=True, exist_ok=True)

    pothole_images = []
    speedbreaker_images = []

    print(f"Analyzing {len(pano_chain)} images from the route for vehicle: {vehicle['vehicle']}\n")

    for pano in pano_chain:
        image_path = pano.get("image")
        if not image_path:
            continue

        hazards = detect_hazards(image_path, conf_threshold=args.conf)

        for hazard in hazards:
            entry = {"image": image_path, "lat": pano["lat"], "lng": pano["lng"],
                     "confidence": hazard["confidence"]}

            # Draw the box on a copy of the image and save it where it's easy to find
            cv_image = cv2.imread(image_path)
            if cv_image is not None:
                x1, y1, x2, y2 = map(int, hazard["bbox"])
                color = (0, 0, 255) if hazard["hazard_type"] == "pothole" else (0, 165, 255)
                cv2.rectangle(cv_image, (x1, y1), (x2, y2), color, 3)
                label = f"{hazard['hazard_type']} {hazard['confidence']:.2f}"
                cv2.putText(cv_image, label, (x1, max(y1 - 10, 20)),
                            cv2.FONT_HERSHEY_SIMPLEX, 0.8, color, 2)

                dest_dir = pothole_dir if hazard["hazard_type"] == "pothole" else speedbreaker_dir
                out_name = Path(image_path).name
                cv2.imwrite(str(dest_dir / out_name), cv_image)
                entry["saved_image"] = str(dest_dir / out_name)

            if hazard["hazard_type"] == "pothole":
                pothole_images.append(entry)
            elif hazard["hazard_type"] == "speedbreaker":
                speedbreaker_images.append(entry)

    print("=" * 50)
    print("ROUTE HAZARD SUMMARY")
    print("=" * 50)
    print(f"Total images analyzed: {len(pano_chain)}")
    print(f"Potholes found: {len(pothole_images)}")
    print(f"Speed breakers found: {len(speedbreaker_images)}")

    if pothole_images:
        print("\nPothole images:")
        for p in pothole_images:
            print(f"  {p.get('saved_image', p['image'])}  (confidence {p['confidence']:.2f}, at {p['lat']:.5f}, {p['lng']:.5f})")

    if speedbreaker_images:
        print("\nSpeed breaker images:")
        for s in speedbreaker_images:
            print(f"  {s.get('saved_image', s['image'])}  (confidence {s['confidence']:.2f}, at {s['lat']:.5f}, {s['lng']:.5f})")

    print(f"\nAnnotated images with boxes drawn saved to: {output_dir}")
    print(f"  Potholes: {pothole_dir}")
    print(f"  Speed breakers: {speedbreaker_dir}")

    output = {
        "vehicle": vehicle["vehicle"],
        "total_images": len(pano_chain),
        "pothole_count": len(pothole_images),
        "speedbreaker_count": len(speedbreaker_images),
        "pothole_images": pothole_images,
        "speedbreaker_images": speedbreaker_images,
    }
    with open("output/route_hazard_summary.json", "w") as f:
        json.dump(output, f, indent=2)

    print("\nSaved to: output/route_hazard_summary.json")


if __name__ == "__main__":
    main()