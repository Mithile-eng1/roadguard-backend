"""
Depth-based severity estimation for detected potholes.
Uses Depth-Anything-V2 to compare the depth inside a pothole box
against the surrounding road surface.

This is pothole-specific: a pothole is a depression, so a larger
positive depth difference (pothole vs. road) means a deeper, more
severe pothole. Speed breakers are raised, not depressed, so this
same logic should NOT be reused as-is for speed breaker severity
(see the note in risk_engine.py).
"""

import numpy as np
import torch
import torch.nn.functional as F
from PIL import Image
from transformers import AutoImageProcessor, AutoModelForDepthEstimation

from src import config


class DepthEstimator:
    def __init__(self, device: str):
        self.device = device
        self.processor = AutoImageProcessor.from_pretrained(config.DEPTH_MODEL_NAME)
        self.model = AutoModelForDepthEstimation.from_pretrained(
            config.DEPTH_MODEL_NAME
        ).to(device)
        self.model.eval()

    def estimate(self, image: Image.Image) -> np.ndarray:
        """Returns a depth map (H, W) resized to match the input image."""
        inputs = self.processor(images=image, return_tensors="pt").to(self.device)

        with torch.no_grad():
            outputs = self.model(**inputs)

        depth = F.interpolate(
            outputs.predicted_depth.unsqueeze(1),
            size=image.size[::-1],
            mode="bicubic",
            align_corners=False,
        ).squeeze()

        return depth.cpu().numpy()


def calculate_depth_score(depth: np.ndarray, box):
    """
    Compares depth inside a detection box (inner 60%, to avoid edge
    bleed) against a surrounding ring of road surface.

    Returns (pothole_depth, road_depth, difference) or None if the
    box/ROI is degenerate.
    """
    x1, y1, x2, y2 = map(int, box)
    h, w = depth.shape

    x1, y1 = max(0, x1), max(0, y1)
    x2, y2 = min(w, x2), min(h, y2)

    if x2 <= x1 or y2 <= y1:
        return None

    dx = int((x2 - x1) * 0.20)
    dy = int((y2 - y1) * 0.20)
    inner = depth[y1 + dy : y2 - dy, x1 + dx : x2 - dx]

    pad = 20
    sx1, sy1 = max(0, x1 - pad), max(0, y1 - pad)
    sx2, sy2 = min(w, x2 + pad), min(h, y2 + pad)

    surrounding = depth[sy1:sy2, sx1:sx2].copy()
    surrounding[y1 - sy1 : y2 - sy1, x1 - sx1 : x2 - sx1] = np.nan
    surrounding = surrounding[~np.isnan(surrounding)]

    if inner.size == 0 or surrounding.size == 0:
        return None

    pothole_depth = float(np.median(inner))
    road_depth = float(np.median(surrounding))
    difference = pothole_depth - road_depth

    return pothole_depth, road_depth, difference


def classify_severity(relative_depth: float) -> str:
    """Buckets a relative depth ratio into Low / Medium / High severity."""
    if relative_depth < 0.05:
        return "Low"
    elif relative_depth < 0.15:
        return "Medium"
    return "High"
