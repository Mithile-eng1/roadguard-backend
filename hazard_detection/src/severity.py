"""
Visual severity estimation.

IMPORTANT — honest framing: you cannot accurately calculate a pothole's
real physical depth (in mm) from a single 2D photo. This module
estimates VISUAL severity — how large the hazard appears relative to
the image — as a practical proxy, not a physical measurement. Always
describe this as "visual severity based on image features," not
"calculated physical severity."

(Note: depth_severity.py provides a richer, depth-model-based estimate
specifically for potholes, using relative monocular depth. That's a
legitimate additional signal, but it's still a RELATIVE visual estimate,
not a calibrated physical measurement either — the same honesty caveat
applies there too.)

Usage:
    from src.severity import estimate_visual_severity

    result = estimate_visual_severity(bbox=[100,200,300,400], image_width=1280, image_height=720)
    # {"visual_severity": 0.8, "severity_level": "HIGH"}
"""


def estimate_visual_severity(bbox, image_width: int, image_height: int) -> dict:
    """
    bbox: [x1, y1, x2, y2] in pixel coordinates
    Returns a visual severity score (0-1) and a Low/Medium/High level,
    based on how much of the frame the hazard's bounding box occupies.
    """
    x1, y1, x2, y2 = bbox
    box_width = x2 - x1
    box_height = y2 - y1
    box_area = box_width * box_height

    image_area = image_width * image_height
    relative_area = box_area / image_area if image_area > 0 else 0

    # Initial prototype thresholds -- not scientifically validated,
    # tune these against real examples once you have enough data to do so.
    if relative_area < 0.05:
        severity_score = 0.3
        severity_level = "LOW"
    elif relative_area < 0.15:
        severity_score = 0.6
        severity_level = "MEDIUM"
    else:
        severity_score = 0.9
        severity_level = "HIGH"

    return {
        "relative_area": round(relative_area, 4),
        "visual_severity": severity_score,
        "severity_level": severity_level,
    }
