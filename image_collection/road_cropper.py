import cv2
import numpy as np
import os
import json


def extract_road_region(image_path, output_dir="output/road_images"):
    os.makedirs(output_dir, exist_ok=True)
    filename = os.path.basename(image_path)
    output_path = os.path.join(output_dir, filename)

    img = cv2.imread(image_path)
    if img is None:
        print(f"Could not read: {image_path}")
        return None

    height, width = img.shape[:2]

    # Step 1 — Keep bottom 75% of image (remove only sky at top)
    road_crop = img[int(height * 0.25):, :]

    # Step 2 — Create a wider trapezoid mask
    h, w = road_crop.shape[:2]
    mask = np.ones((h, w), dtype=np.uint8) * 255  # Start with all white

    # Block left side buildings
    left_block = np.array([[
        (0, 0),
        (int(w * 0.15), 0),
        (int(w * 0.15), int(h * 0.5)),
        (0, h)
    ]], dtype=np.int32)

    # Block right side buildings
    right_block = np.array([[
        (int(w * 0.85), 0),
        (w, 0),
        (w, h),
        (int(w * 0.85), int(h * 0.5))
    ]], dtype=np.int32)

    cv2.fillPoly(mask, left_block, 0)
    cv2.fillPoly(mask, right_block, 0)

    # Apply mask
    masked = cv2.bitwise_and(road_crop, road_crop, mask=mask)

    cv2.imwrite(output_path, masked)
    print(f"Road extracted: {filename}")
    return output_path


def process_all_images(images_index_path="output/images_index.json"):
    with open(images_index_path, "r") as f:
        images = json.load(f)

    road_images = []
    for item in images:
        path = extract_road_region(item["image"])
        if path:
            road_images.append({
                "lat": item["lat"],
                "lng": item["lng"],
                "image": path
            })

    with open("output/road_images_index.json", "w") as f:
        json.dump(road_images, f, indent=2)

    print(f"\nRoad extraction complete. {len(road_images)} images processed.")
    return road_images


if __name__ == "__main__":
    process_all_images()