"""
Combines detection confidence + severity + vehicle ground clearance
into a single personalized risk score, matching the formula developed
in the notebook prototype.

NOTE: the depth-difference severity logic in depth_severity.py assumes
a depression (pothole). For speed breakers -- which are raised, not
depressed -- the sign of the depth difference should be flipped before
calling severity functions here, or a separate severity heuristic
(e.g. bounding-box height relative to road width in frame) should be
used instead. This module treats severity as a pre-computed [0, 1]
input so it works for either hazard type once you've handled that.
"""

import numpy as np

from src.config import REFERENCE_MAX_CLEARANCE_CM


def normalize_depth_score(relative_depth: float, depth_limit_95th: float) -> float:
    """Scales a relative depth value into [0, 1] using a 95th-percentile cap."""
    return float(np.clip(relative_depth / (depth_limit_95th + 1e-6), 0, 1))


def combined_risk_score(confidence: float, depth_score: float,
                         confidence_weight: float = 0.4,
                         depth_weight: float = 0.6) -> float:
    """Prototype risk score before vehicle personalization: weighted blend
    of detection confidence and severity (depth_score)."""
    score = confidence_weight * confidence + depth_weight * depth_score
    return float(np.clip(score, 0, 1))


def clearance_factor(ground_clearance_cm: float,
                      reference_max_cm: float = REFERENCE_MAX_CLEARANCE_CM) -> float:
    """
    Lower ground clearance -> higher clearance factor -> higher personalized risk.
    """
    return float(np.clip(1 - ground_clearance_cm / reference_max_cm, 0, 1))


def personalized_risk(risk_score: float, ground_clearance_cm: float) -> float:
    """
    Final vehicle-specific risk. The 0.5 baseline + 0.5 * clearance_factor
    keeps risk from ever dropping to zero for very high clearance vehicles --
    a hazard is never fully "safe", just less risky.
    """
    factor = clearance_factor(ground_clearance_cm)
    return float(risk_score * (0.5 + 0.5 * factor))


def risk_class(score: float) -> str:
    if score < 0.33:
        return "Low"
    elif score < 0.66:
        return "Medium"
    return "High"
