"""
Runs both hazard models (pothole + speed breaker) on a street-view
image and produces a personalized risk report.

Usage (from project root, in VS Code terminal):
    python -m src.detect_hazards --image path/to/street_view.jpg --clearance 16.5
"""

import argparse

import numpy as np
import pandas as pd
from PIL import Image
from ultralytics import YOLO

from src import config, risk_engine
from src.depth_severity import DepthEstimator, calculate_depth_score
from src.utils import get_device


def load_models(device: str):
    pothole_model = YOLO(str(config.POTHOLE_WEIGHTS))
    speedbreaker_model = YOLO(str(config.SPEEDBREAKER_WEIGHTS))
    depth_estimator = DepthEstimator(device)
    return pothole_model, speedbreaker_model, depth_estimator


def detect_potholes_with_severity(model: YOLO, depth_estimator: DepthEstimator,
                                   image: Image.Image, conf: float):
    """Pothole detections enriched with depth-based severity."""
    result = model.predict(source=image, conf=conf, verbose=False)[0]
    depth = depth_estimator.estimate(image)

    rows = []
    for box, confidence in zip(result.boxes.xyxy.cpu().numpy(),
                                result.boxes.conf.cpu().numpy()):
        depth_result = calculate_depth_score(depth, box)
        if depth_result is None:
            continue

        pothole_depth, road_depth, difference = depth_result
        relative_depth = abs(difference) / (abs(road_depth) + 1e-6)
        depth_score = np.clip(relative_depth / 0.2, 0, 1)  # rough fixed cap for single-image use

        base_risk = risk_engine.combined_risk_score(float(confidence), float(depth_score))

        rows.append({
            "type": "pothole",
            "box": box.tolist(),
            "confidence": float(confidence),
            "relative_depth": float(relative_depth),
            "base_risk": base_risk,
        })

    return rows


def detect_speedbreakers(model: YOLO, image: Image.Image, conf: float):
    """
    Speed breaker detections. Severity here is a placeholder based on
    confidence only -- replace with a real heuristic (e.g. bounding-box
    height/width ratio relative to road width) once you've validated one.
    """
    result = model.predict(source=image, conf=conf, verbose=False)[0]

    rows = []
    for box, confidence in zip(result.boxes.xyxy.cpu().numpy(),
                                result.boxes.conf.cpu().numpy()):
        base_risk = risk_engine.combined_risk_score(float(confidence), float(confidence))
        rows.append({
            "type": "speedbreaker",
            "box": box.tolist(),
            "confidence": float(confidence),
            "relative_depth": None,
            "base_risk": base_risk,
        })

    return rows


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--image", required=True, help="Path to street-view image")
    parser.add_argument("--conf", type=float, default=0.25, help="Detection confidence threshold")
    parser.add_argument("--clearance", type=float, required=True,
                         help="Vehicle ground clearance in cm, e.g. 16.5")
    args = parser.parse_args()

    device = get_device()
    pothole_model, speedbreaker_model, depth_estimator = load_models(device)

    image = Image.open(args.image).convert("RGB")

    rows = []
    rows += detect_potholes_with_severity(pothole_model, depth_estimator, image, args.conf)
    rows += detect_speedbreakers(speedbreaker_model, image, args.conf)

    if not rows:
        print("No hazards detected.")
        return

    df = pd.DataFrame(rows)
    df["personalized_risk"] = df["base_risk"].apply(
        lambda r: risk_engine.personalized_risk(r, args.clearance)
    )
    df["risk_class"] = df["personalized_risk"].apply(risk_engine.risk_class)

    print(df[["type", "confidence", "relative_depth", "personalized_risk", "risk_class"]]
          .to_string(index=False))


if __name__ == "__main__":
    main()
