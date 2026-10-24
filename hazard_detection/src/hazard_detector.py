"""
Unified hazard detector: runs BOTH the pothole and speed breaker models
on one image and returns standardized results, so downstream code
(severity, risk engine) doesn't need to care which model found what.

Usage:
    from src.hazard_detector import detect_hazards

    hazards = detect_hazards("road_001.jpg", conf_threshold=0.5)
    # [{"hazard_type": "pothole", "confidence": 0.89, "bbox": [100,200,300,400]}, ...]
"""

from ultralytics import YOLO

from src import config

_models = {}


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
        prediction = model.predict(source=image_path, conf=0.01, verbose=False)[0]
        # NOTE: we run the model at a very low internal threshold (0.01) and
        # do the real filtering ourselves below, so we can report WHY
        # something was excluded, not just silently drop it.

        for box, conf in zip(prediction.boxes.xyxy.cpu().numpy(), prediction.boxes.conf.cpu().numpy()):
            confidence = float(conf)

            if confidence < conf_threshold:
                continue  # below threshold -> ignore, per the confidence filtering step

            results.append({
                "hazard_type": hazard_type,
                "confidence": round(confidence, 3),
                "confidence_category": confidence_category(confidence),
                "bbox": [round(float(v), 1) for v in box],
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
