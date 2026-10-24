import cv2
import numpy as np
import torch
from ultralytics import YOLO
from pathlib import Path

# ── CONFIG ──────────────────────────────────────────────────────────────
INPUT_FOLDER  = "output"   # folder with your JPG/PNG images
OUTPUT_FOLDER = "output_images"  # cleaned road images saved here
Path(OUTPUT_FOLDER).mkdir(exist_ok=True)

# Classes to REMOVE from road (COCO dataset class IDs)
REMOVE_CLASSES = {
    0: "person", 1: "bicycle", 2: "car", 3: "motorcycle",
    5: "bus", 7: "truck", 9: "traffic light", 11: "stop sign"
}

# ── LOAD MODELS ─────────────────────────────────────────────────────────
print("Loading YOLO model...")
yolo = YOLO("yolov8n-seg.pt")  # downloads automatically on first run

# ── HELPER: INPAINT MASKED REGION ───────────────────────────────────────
def inpaint_objects(image, mask):
    """Fill detected objects with surrounding road texture."""
    mask_uint8 = (mask * 255).astype(np.uint8)
    # Dilate mask slightly to cover edges cleanly
    kernel = np.ones((15, 15), np.uint8)
    mask_dilated = cv2.dilate(mask_uint8, kernel, iterations=2)
    inpainted = cv2.inpaint(image, mask_dilated, inpaintRadius=7,
                            flags=cv2.INPAINT_TELEA)
    return inpainted

# ── HELPER: EXTRACT ROAD ONLY ────────────────────────────────────────────
def extract_road_region(image):
    """
    Simple road extraction using color + position heuristics.
    Assumes road is in lower 2/3 of image and is gray/asphalt colored.
    """
    h, w = image.shape[:2]
    hsv = cv2.cvtColor(image, cv2.COLOR_BGR2HSV)

    # Road color range (gray/asphalt tones)
    lower_road = np.array([0,   0,  40])
    upper_road = np.array([180, 50, 200])
    road_color_mask = cv2.inRange(hsv, lower_road, upper_road)

    # Focus on bottom 70% of image (road area)
    region_mask = np.zeros((h, w), dtype=np.uint8)
    region_mask[int(h * 0.30):, :] = 255

    combined = cv2.bitwise_and(road_color_mask, region_mask)

    # Morphological cleanup
    kernel = np.ones((20, 20), np.uint8)
    combined = cv2.morphologyEx(combined, cv2.MORPH_CLOSE, kernel)
    combined = cv2.morphologyEx(combined, cv2.MORPH_OPEN,  kernel)

    return combined  # binary mask of road area

# ── MAIN PROCESSING LOOP ─────────────────────────────────────────────────
image_paths = list(Path(INPUT_FOLDER).glob("*.jpg")) + \
              list(Path(INPUT_FOLDER).glob("*.png"))

print(f"Found {len(image_paths)} images to process...\n")

for img_path in image_paths:
    print(f"Processing: {img_path.name}")
    image = cv2.imread(str(img_path))
    if image is None:
        print(f"  ⚠ Could not read {img_path.name}, skipping.")
        continue

    # ── STEP A: Detect & remove objects on road ──────────────────────
    results = yolo(image, conf=0.4, verbose=False)[0]
    object_mask = np.zeros(image.shape[:2], dtype=np.uint8)

    if results.masks is not None:
        for i, cls_id in enumerate(results.boxes.cls.cpu().numpy()):
            if int(cls_id) in REMOVE_CLASSES:
                seg_mask = results.masks.data[i].cpu().numpy()
                seg_mask = cv2.resize(seg_mask, (image.shape[1], image.shape[0]))
                object_mask = cv2.bitwise_or(object_mask, (seg_mask > 0.5).astype(np.uint8))

    # Inpaint removed objects
    clean_image = inpaint_objects(image, object_mask)

    # ── STEP B: Extract road region, remove surroundings ─────────────
    road_mask = extract_road_region(clean_image)

    # Apply road mask — surroundings become black
    road_only = cv2.bitwise_and(clean_image, clean_image, mask=road_mask)

    # ── STEP C: Save outputs ──────────────────────────────────────────
    base_name = img_path.stem
    cv2.imwrite(f"{OUTPUT_FOLDER}/{base_name}_clean.png",     clean_image)
    cv2.imwrite(f"{OUTPUT_FOLDER}/{base_name}_road_only.png", road_only)
    cv2.imwrite(f"{OUTPUT_FOLDER}/{base_name}_road_mask.png", road_mask)

    print(f"  ✅ Saved 3 outputs for {img_path.name}")

print("\n🎉 All images processed!")