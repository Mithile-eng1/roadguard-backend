"""
Runs proper validation metrics (precision, recall, mAP50, mAP50-95) at a
SPECIFIC confidence threshold, for either hazard type, so you can directly
compare conf=0.2 vs conf=0.3 vs any other value on the same footing.

Usage (from project root):
    python scripts/eval_at_conf.py --model runs/detect/pothole_final/weights/best.pt --hazard pothole --conf 0.3
    python scripts/eval_at_conf.py --model runs/detect/speedbreaker_final-3/weights/best.pt --hazard speedbreaker --conf 0.2
"""

import argparse
import sys
from pathlib import Path

from ultralytics import YOLO

sys.path.append(str(Path(__file__).resolve().parent.parent))
from src import config  # noqa: E402


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--model", required=True, help="Path to trained weights (.pt)")
    parser.add_argument("--hazard", required=True, choices=["pothole", "speedbreaker"],
                         help="Which dataset's data.yaml to evaluate against")
    parser.add_argument("--conf", type=float, required=True, help="Confidence threshold to evaluate at")
    args = parser.parse_args()

    model = YOLO(args.model)

    data_dir = config.POTHOLE_DATA_DIR if args.hazard == "pothole" else config.SPEEDBREAKER_DATA_DIR

    metrics = model.val(
        data=str(data_dir / "data.yaml"),
        imgsz=640,
        conf=args.conf,
    )

    print(f"\n=== {args.hazard} metrics at conf={args.conf} ===")
    print("Precision:", metrics.box.mp)
    print("Recall:", metrics.box.mr)
    print("mAP50:", metrics.box.map50)
    print("mAP50-95:", metrics.box.map)


if __name__ == "__main__":
    main()
