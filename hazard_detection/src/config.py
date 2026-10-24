"""
Central configuration: paths, model names, and constants.
Edit these to match your local folder layout.
"""

from pathlib import Path

# --- Project root (auto-detected: parent of src/) ---
PROJECT_ROOT = Path(__file__).resolve().parent.parent

# --- Dataset locations ---
POTHOLE_DATA_DIR = PROJECT_ROOT / "data" / "pothole_yolo"
SPEEDBREAKER_DATA_DIR = PROJECT_ROOT / "data" / "speedbreaker_yolo"

# --- Trained model weights ---
MODELS_DIR = PROJECT_ROOT / "models"
POTHOLE_WEIGHTS = MODELS_DIR / "pothole_best.pt"
SPEEDBREAKER_WEIGHTS = MODELS_DIR / "speedbreaker_best.pt"

# --- Training defaults ---
BASE_MODEL = "yolov8n.pt"
EPOCHS = 30
IMG_SIZE = 640
BATCH_SIZE = 16
PATIENCE = 10

# --- Depth model (for pothole severity) ---
DEPTH_MODEL_NAME = "depth-anything/Depth-Anything-V2-Small-hf"

# --- Risk engine constants ---
REFERENCE_MAX_CLEARANCE_CM = 25.0  # normalize clearance factor against this
