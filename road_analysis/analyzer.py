import os
import json
import cv2
import torch
import numpy as np
from ultralytics import YOLO

# Load YOLOv8 model (downloads automatically on first run)
yolo_model = YOLO("yolov8n.pt")

# Load MiDaS depth model
midas = torch.hub.load("intel-isl/MiDaS", "MiDaS_small")
midas.eval()

midas_transforms = torch.hub.load("intel-isl/MiDaS", "transforms")
transform = midas_transforms.small_transform

DEVICE = torch.device("cuda" if torch.cuda.is_available() else "cpu")
midas.to(DEVICE)

# Obstacle classes from COCO dataset that are road-relevant
OBSTACLE_CLASSES = [
    "car", "truck", "bus", "motorcycle", "bicycle",
    "person", "traffic light", "stop sign", "pothole"
]

def estimate_depth(image_bgr):
    """
    Runs MiDaS on image and returns relative depth map.
    Higher value = closer to camera (higher risk).
    """
    img_rgb = cv2.cvtColor(image_bgr, cv2.COLOR_BGR2RGB)
    input_batch = transform(img_rgb).to(DEVICE)

    with torch.no_grad():
        prediction = midas(input_batch)
        prediction = torch.nn.functional.interpolate(
            prediction.unsqueeze(1),
            size=image_bgr.shape[:2],
            mode="bicubic",
            align_corners=False,
        ).squeeze()

    depth_map = prediction.cpu().numpy()
    return depth_map


def analyze_image(image_path):
    """
    Runs YOLO detection + MiDaS depth on a single image.
    Returns list of detected obstacles with relative depth risk scores.
    """
    image = cv2.imread(image_path)
    if image is None:
        return []

    # Run YOLO
    results = yolo_model(image, verbose=False)
    detections = results[0].boxes

    # Run MiDaS
    depth_map = estimate_depth(image)
    depth_normalized = (depth_map - depth_map.min()) / (depth_map.max() - depth_map.min() + 1e-6)

    obstacles = []
    for box in detections:
        cls_id = int(box.cls[0])
        cls_name = yolo_model.names[cls_id]
        confidence = float(box.conf[0])

        if confidence < 0.4:
            continue

        # Bounding box
        x1, y1, x2, y2 = map(int, box.xyxy[0])
        x1, y1 = max(0, x1), max(0, y1)
        x2, y2 = min(image.shape[1], x2), min(image.shape[0], y2)

        # Average depth in the bounding box region
        region_depth = depth_normalized[y1:y2, x1:x2]
        avg_depth_score = float(np.mean(region_depth)) if region_depth.size > 0 else 0.0

        obstacles.append({
            "class": cls_name,
            "confidence": round(confidence, 3),
            "depth_risk": round(avg_depth_score, 3),
            "bbox": [x1, y1, x2, y2]
        })

    return obstacles


def analyze_all_images(images_index_path="output/images_index.json"):
    """
    Analyzes all images and saves results to output/analysis.json
    """
    with open(images_index_path, "r") as f:
        images = json.load(f)

    results = []
    for item in images:
        print(f"Analyzing: {item['image']}")
        obstacles = analyze_image(item["image"])
        results.append({
            "lat": item["lat"],
            "lng": item["lng"],
            "image": item["image"],
            "obstacles": obstacles
        })

    with open("output/analysis.json", "w") as f:
        json.dump(results, f, indent=2)

    print(f"\nAnalysis complete. {len(results)} images processed.")
    return results


if __name__ == "__main__":
    analyze_all_images()