"""
Unified hazard detector: runs BOTH the pothole and speed breaker models
on one image and returns standardized results, so downstream code
(severity, risk engine) doesn't need to care which model found what.

Usage:
    from src.hazard_detector import detect_hazards

    hazards = detect_hazards("road_001.jpg", conf_threshold=0.5)
    # [{"hazard_type": "pothole", "confidence": 0.89, "bbox": [100,200,300,400]}, ...]
"""

import cv2
from ultralytics import YOLO

from src import config

_models = {}

# Same fix as detect_speedbreakers_and_risk.py: the speed breaker model was
# trained on images stretched to a square by Roboflow, not letterbox-padded
# (YOLO's default). Feeding it raw images without this same stretch caused
# it to systematically underperform in this file specifically -- this was
# NOT applied here before, unlike the standalone detection script, which is
# why results differed between the two.
SPEEDBREAKER_INFERENCE_SIZE = 640


def _get_model(hazard_type: str) -> YOLO:
    if hazard_type not in _models:
        weights = config.POTHOLE_WEIGHTS if hazard_type == "pothole" else config.SPEEDBREAKER_WEIGHTS
        _models[hazard_type] = YOLO(str(weights))
    return _models[hazard_type]


def confidence_category(confidence: float) -> str:
    """Categorizes a confidence score, matching the spec's filtering logic."""
    if confidence < 0.50:
        return "Low"
    elif confidence < 0.70:
        return "Moderate"
    return "High"


def detect_hazards(image_path: str, conf_threshold: float = 0.50) -> list[dict]:
    """
    Runs both models on the image and returns a standardized list of
    detections, already filtered to only include confidence >= conf_threshold.
    """
    results = []

    for hazard_type in ("pothole", "speedbreaker"):
        model = _get_model(hazard_type)

        # Speed breaker model needs the stretch-resize to match training;
        # pothole model does not (different preprocessing pipeline).
        if hazard_type == "speedbreaker":
            original = cv2.imread(image_path)
            orig_h, orig_w = original.shape[:2]
            source = cv2.resize(original, (SPEEDBREAKER_INFERENCE_SIZE, SPEEDBREAKER_INFERENCE_SIZE),
                                 interpolation=cv2.INTER_LINEAR)
            scale_x = orig_w / SPEEDBREAKER_INFERENCE_SIZE
            scale_y = orig_h / SPEEDBREAKER_INFERENCE_SIZE
        else:
            source = image_path
            scale_x = scale_y = 1.0

        prediction = model.predict(source=source, conf=0.01, verbose=False)[0]
        # NOTE: we run the model at a very low internal threshold (0.01) and
        # do the real filtering ourselves below, so we can report WHY
        # something was excluded, not just silently drop it.

        for box, conf in zip(prediction.boxes.xyxy.cpu().numpy(), prediction.boxes.conf.cpu().numpy()):
            confidence = float(conf)

            if confidence < conf_threshold:
                continue  # below threshold -> ignore, per the confidence filtering step

            # Scale box back to ORIGINAL image coordinates -- callers draw
            # on the original-size image, not the resized one used above.
            x1, y1, x2, y2 = box
            scaled_bbox = [x1 * scale_x, y1 * scale_y, x2 * scale_x, y2 * scale_y]

            results.append({
                "hazard_type": hazard_type,
                "confidence": round(confidence, 3),
                "confidence_category": confidence_category(confidence),
                "bbox": [round(float(v), 1) for v in scaled_bbox],
            })

    return results


if __name__ == "__main__":
    import sys
    import json

    if len(sys.argv) < 2:
        print("Usage: python -m src.hazard_detector path/to/image.jpg [conf_threshold]")
        sys.exit(1)

    image_path = sys.argv[1]
    conf_threshold = float(sys.argv[2]) if len(sys.argv) > 2 else 0.50

    hazards = detect_hazards(image_path, conf_threshold)
    print(json.dumps(hazards, indent=2))
