import cv2
import numpy as np
from pathlib import Path
from ultralytics import YOLO

INPUT_FOLDER  = "output/images"
OUTPUT_FOLDER = "output/preprocessed_images"

# Expanded class list — includes auto-rickshaw (motorcycle class)
REMOVE_CLASSES = {
    0: "person",        1: "bicycle",       2: "car",
    3: "motorcycle",    5: "bus",           7: "truck",
    9: "traffic light", 11: "stop sign",    12: "parking meter"
}

# ── A: REMOVE OBJECTS WITH LOWER CONFIDENCE ──────────────────────────────
def remove_objects(image, yolo):
    """Remove vehicles and people with aggressive detection."""
    # Run YOLO twice — different confidence levels to catch more objects
    results1 = yolo(image, conf=0.25, verbose=False)[0]  # low conf = catch more
    results2 = yolo(image, conf=0.15, iou=0.3, verbose=False)[0]  # very aggressive

    mask = np.zeros(image.shape[:2], dtype=np.uint8)

    for results in [results1, results2]:
        if results.masks is not None:
            for i, cls_id in enumerate(results.boxes.cls.cpu().numpy()):
                if int(cls_id) in REMOVE_CLASSES:
                    seg = results.masks.data[i].cpu().numpy()
                    seg = cv2.resize(seg, (image.shape[1], image.shape[0]))
                    mask = cv2.bitwise_or(mask, (seg > 0.5).astype(np.uint8))

        # Also use bounding boxes as fallback (when segmentation misses)
        if results.boxes is not None:
            for i, cls_id in enumerate(results.boxes.cls.cpu().numpy()):
                if int(cls_id) in REMOVE_CLASSES:
                    box = results.boxes.xyxy[i].cpu().numpy().astype(int)
                    x1, y1, x2, y2 = box
                    mask[y1:y2, x1:x2] = 1

    if mask.max() == 0:
        return image

    mask_uint8 = mask * 255
    kernel = np.ones((25, 25), np.uint8)
    mask_dilated = cv2.dilate(mask_uint8, kernel, iterations=3)
    inpainted = cv2.inpaint(image, mask_dilated, inpaintRadius=15,
                            flags=cv2.INPAINT_TELEA)
    return inpainted

# ── B: REMOVE GOOGLE BLUR PATCH (center blur) ────────────────────────────
def remove_blur_patch(image):
    """Detect and inpaint Google's blur patches (face/plate blur)."""
    gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)
    h, w = image.shape[:2]

    # Detect unusually uniform/blurred regions using Laplacian variance
    blur_map = cv2.Laplacian(gray, cv2.CV_64F)
    blur_mask = np.zeros((h, w), dtype=np.uint8)

    # Slide window to find blurry patches
    step, win = 20, 40
    for y in range(0, h - win, step):
        for x in range(0, w - win, step):
            region = blur_map[y:y+win, x:x+win]
            variance = region.var()
            if variance < 15:  # very low variance = blurred patch
                blur_mask[y:y+win, x:x+win] = 255

    # Only fix if blur patch exists
    if blur_mask.max() == 0:
        return image

    kernel = np.ones((30, 30), np.uint8)
    blur_mask = cv2.dilate(blur_mask, kernel, iterations=1)
    return cv2.inpaint(image, blur_mask, inpaintRadius=20, flags=cv2.INPAINT_TELEA)

# ── C: CROP SKY AND SIDES ────────────────────────────────────────────────
def crop_road_region(image):
    """Remove top 35% (sky) and sides 10% (shops/buildings)."""
    h, w = image.shape[:2]
    # Remove top 35%, keep center 80% width
    cropped = image[int(h * 0.35):, int(w * 0.10):int(w * 0.90)]
    return cropped

# ── D: CONTRAST ENHANCEMENT (CLAHE) ─────────────────────────────────────
def enhance_contrast(image):
    lab = cv2.cvtColor(image, cv2.COLOR_BGR2LAB)
    l, a, b = cv2.split(lab)
    clahe = cv2.createCLAHE(clipLimit=2.0, tileGridSize=(8, 8))
    l = clahe.apply(l)
    enhanced = cv2.merge((l, a, b))
    return cv2.cvtColor(enhanced, cv2.COLOR_LAB2BGR)

# ── E: NOISE REDUCTION ───────────────────────────────────────────────────
def reduce_noise(image):
    return cv2.GaussianBlur(image, (3, 3), 0)

# ── F: RESIZE WITH PADDING ───────────────────────────────────────────────
def resize_with_padding(image, target_size=256):
    h, w = image.shape[:2]
    scale = target_size / max(h, w)
    new_w, new_h = int(w * scale), int(h * scale)
    resized = cv2.resize(image, (new_w, new_h))
    pad_top    = (target_size - new_h) // 2
    pad_bottom = target_size - new_h - pad_top
    pad_left   = (target_size - new_w) // 2
    pad_right  = target_size - new_w - pad_left
    return cv2.copyMakeBorder(resized, pad_top, pad_bottom,
                               pad_left, pad_right,
                               cv2.BORDER_CONSTANT, value=[0, 0, 0])

# ── G: EDGE DETECTION ────────────────────────────────────────────────────
def detect_edges(image):
    gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)
    return cv2.Canny(gray, 50, 150)

# ── MAIN PIPELINE ─────────────────────────────────────────────────────────
def preprocess_all_images():
    Path(OUTPUT_FOLDER).mkdir(parents=True, exist_ok=True)

    print("Loading YOLO model...")
    yolo = YOLO("yolov8m-seg.pt")  # medium model = better detection

    image_paths = list(Path(INPUT_FOLDER).glob("*.jpg")) + \
                  list(Path(INPUT_FOLDER).glob("*.png"))

    print(f"Found {len(image_paths)} images...\n")

    for img_path in image_paths:
        print(f"  Processing: {img_path.name}")
        image = cv2.imread(str(img_path))
        if image is None:
            continue

        base = img_path.stem

        # Step 1: Remove vehicles/people aggressively
        clean = remove_objects(image, yolo)
        cv2.imwrite(f"{OUTPUT_FOLDER}/{base}_1_clean.jpg", clean)

        # Step 2: Remove Google blur patches
        deblurred = remove_blur_patch(clean)
        cv2.imwrite(f"{OUTPUT_FOLDER}/{base}_2_deblurred.jpg", deblurred)

        # Step 3: Crop sky + sides
        cropped = crop_road_region(deblurred)
        cv2.imwrite(f"{OUTPUT_FOLDER}/{base}_3_cropped.jpg", cropped)

        # Step 4: Enhance contrast (highlight cracks/defects)
        contrasted = enhance_contrast(cropped)
        cv2.imwrite(f"{OUTPUT_FOLDER}/{base}_4_contrast.jpg", contrasted)

        # Step 5: Mild noise reduction
        denoised = reduce_noise(contrasted)
        cv2.imwrite(f"{OUTPUT_FOLDER}/{base}_5_denoised.jpg", denoised)

        # Step 6: Resize 256x256 with padding
        resized = resize_with_padding(denoised, target_size=256)
        cv2.imwrite(f"{OUTPUT_FOLDER}/{base}_6_resized.jpg", resized)

        # Step 7: Edge detection (road defects)
        edges = detect_edges(resized)
        cv2.imwrite(f"{OUTPUT_FOLDER}/{base}_7_edges.jpg", edges)

        # Step 8: Final normalized (for ML input)
        final = (resized / 255.0 * 255).astype(np.uint8)
        cv2.imwrite(f"{OUTPUT_FOLDER}/{base}_8_final.jpg", final)

        print(f"  ✅ Done: {img_path.name}")

    print(f"\n🎉 Done! Check '{OUTPUT_FOLDER}'")

if __name__ == "__main__":
    preprocess_all_images()