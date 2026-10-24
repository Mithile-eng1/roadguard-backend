"""
Complete speed breaker pipeline. For every image in --source:

  1. Run the trained YOLO speed breaker model on it.
  2. If a speed breaker is found:
       - draw the box on the image
       - compute a severity score (based on how large the box is
         relative to the image -- a rough proxy for how close/big
         the bump is)
       - combine confidence + severity + vehicle ground clearance
         into a personalized risk score and Low/Medium/High class
       - save the annotated image into output/detected/
  3. If nothing is found:
       - save the original image into output/no_speedbreaker/
  4. Write one row per image into results.csv summarizing everything.

Usage (from project root, after training a speedbreaker model):
    python scripts/detect_speedbreakers_and_risk.py \
        --model models/speedbreaker_best.pt \
        --source path/to/images \
        --vehicle "Honda City" \
        --conf 0.3
"""

import argparse
import csv
import shutil
import sys
from pathlib import Path

import cv2
from ultralytics import YOLO

sys.path.append(str(Path(__file__).resolve().parent.parent))
from src import risk_engine  # noqa: E402
from src.vehicle import get_vehicle  # noqa: E402

# Roboflow's training export stretched every image to a square, distorting
# aspect ratio rather than padding it. YOLO's default inference behavior
# instead LETTERBOXES (preserves aspect ratio, adds gray padding) -- a real
# mismatch for wide/panoramic images, where the two methods produce very
# different-looking results. Matching the stretch behavior here keeps
# inference consistent with what the model actually learned from.
INFERENCE_SIZE = 640


def stretch_resize(image, size=INFERENCE_SIZE):
    """Matches Roboflow's training-time stretch resize instead of YOLO's default letterbox padding."""
    return cv2.resize(image, (size, size), interpolation=cv2.INTER_LINEAR)


def estimate_speedbreaker_severity(box_xyxy, img_w, img_h):
    """
    Heuristic severity for speed breakers: larger box relative to the
    frame roughly correlates with a bigger/closer bump. This is a
    placeholder, not a validated measurement -- unlike the pothole
    model's depth-based severity, there is no geometric ground-truth
    behind this number yet. Treat Low/Medium/High as relative ranking,
    not an exact physical measurement, until you validate it against
    real labeled examples.
    """
    x1, y1, x2, y2 = box_xyxy
    box_area = (x2 - x1) * (y2 - y1)
    frame_area = img_w * img_h
    area_ratio = box_area / frame_area

    # Normalize: a box covering ~40%+ of the frame is treated as "very severe" (1.0)
    severity = min(area_ratio / 0.4, 1.0)
    return severity


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--model", required=True, help="Path to trained speedbreaker_best.pt")
    parser.add_argument("--source", required=True, help="Folder of images to process")
    parser.add_argument("--vehicle", required=True,
                         help="Vehicle name from vehicles.csv, e.g. 'Honda City'. "
                              "Run 'python -m src.vehicle' to see the full list.")
    parser.add_argument("--conf", type=float, default=0.3, help="Detection confidence threshold")
    parser.add_argument("--output", default=None, help="Output folder (default: <source>/results)")
    args = parser.parse_args()

    vehicle = get_vehicle(args.vehicle)
    if vehicle is None:
        raise ValueError(
            f"Vehicle '{args.vehicle}' not found in vehicles.csv. "
            f"Run 'python -m src.vehicle' to see the available list."
        )
    clearance_cm = vehicle["ground_clearance_mm"] / 10
    print(f"Using vehicle: {vehicle['vehicle']} ({vehicle['ground_clearance_mm']}mm ground clearance)")

    source = Path(args.source)
    images = sorted(
        list(source.glob("*.jpg")) + list(source.glob("*.jpeg")) + list(source.glob("*.png"))
    )
    if not images:
        raise FileNotFoundError(f"No images found in {source}")

    output_root = Path(args.output) if args.output else source / "results"
    detected_dir = output_root / "detected"
    no_detection_dir = output_root / "no_speedbreaker"
    detected_dir.mkdir(parents=True, exist_ok=True)
    no_detection_dir.mkdir(parents=True, exist_ok=True)

    model = YOLO(args.model)

    rows = []
    detected_count = 0

    for img_path in images:
        image = cv2.imread(str(img_path))
        if image is None:
            continue

        # Resize BEFORE detection so the model sees images the same way it
        # did during training (stretched to square, not letterbox-padded).
        # All detection, severity, and drawing below happens on this
        # resized image so box coordinates stay consistent -- mixing
        # coordinates from the resized image with the original-size image
        # would place boxes in the wrong spot.
        image = stretch_resize(image)
        h, w = image.shape[:2]

        result = model.predict(source=image, conf=args.conf, verbose=False)[0]

        if len(result.boxes) == 0:
            shutil.copy(img_path, no_detection_dir / img_path.name)
            rows.append({
                "image": img_path.name,
                "speedbreaker_detected": False,
                "confidence": "",
                "severity": "",
                "risk_score": "",
                "risk_class": "",
            })
            continue

        # Keep the highest-confidence box if there are multiple detections
        best_idx = result.boxes.conf.argmax().item()
        confidence = float(result.boxes.conf[best_idx])
        box = result.boxes.xyxy[best_idx].tolist()

        severity = estimate_speedbreaker_severity(box, w, h)
        base_risk = risk_engine.combined_risk_score(confidence, severity)
        final_risk = risk_engine.personalized_risk(base_risk, clearance_cm)
        risk_class = risk_engine.risk_class(final_risk)

        # Draw the box + risk label on the image
        x1, y1, x2, y2 = map(int, box)
        color = {"Low": (0, 200, 0), "Medium": (0, 165, 255), "High": (0, 0, 255)}[risk_class]
        cv2.rectangle(image, (x1, y1), (x2, y2), color, 3)
        label = f"{risk_class} risk ({final_risk:.2f})"
        cv2.putText(image, label, (x1, max(y1 - 10, 20)),
                    cv2.FONT_HERSHEY_SIMPLEX, 0.9, color, 2)

        cv2.imwrite(str(detected_dir / img_path.name), image)
        detected_count += 1

        rows.append({
            "image": img_path.name,
            "speedbreaker_detected": True,
            "confidence": round(confidence, 3),
            "severity": round(severity, 3),
            "risk_score": round(final_risk, 3),
            "risk_class": risk_class,
        })

    csv_path = output_root / "results.csv"
    with open(csv_path, "w", newline="") as f:
        writer = csv.DictWriter(f, fieldnames=[
            "image", "speedbreaker_detected", "confidence", "severity", "risk_score", "risk_class"
        ])
        writer.writeheader()
        writer.writerows(rows)

    print(f"Total images: {len(images)}")
    print(f"Speed breaker detected: {detected_count} -> {detected_dir}")
    print(f"No speed breaker: {len(images) - detected_count} -> {no_detection_dir}")
    print(f"Full report: {csv_path}")


if __name__ == "__main__":
    main()
