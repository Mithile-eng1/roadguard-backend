"""
Finds a handful of images for EACH class ID in a YOLO-format dataset,
copying them into per-class folders so you can visually check what
each class actually represents -- before assuming they're all the
same thing.

Usage:
    python scripts/inspect_classes.py --data-dir data/raw/pothole_raw_v2/potholesdetection.v2i.yolov8 --samples 5
"""

import argparse
import shutil
from collections import defaultdict
from pathlib import Path


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--data-dir", required=True, help="Path to the ORIGINAL (unmodified) Roboflow export")
    parser.add_argument("--samples", type=int, default=5, help="How many example images per class to pull out")
    args = parser.parse_args()

    data_dir = Path(args.data_dir)
    label_files = list(data_dir.glob("*/labels/*.txt"))

    if not label_files:
        raise FileNotFoundError(f"No label files found under {data_dir}/*/labels/")

    class_to_images = defaultdict(list)

    for label_path in label_files:
        lines = label_path.read_text().strip().splitlines()
        classes_in_file = set()
        for line in lines:
            parts = line.strip().split()
            if parts:
                classes_in_file.add(parts[0])

        # Find the matching image (same name, different folder/extension)
        images_dir = label_path.parent.parent / "images"
        possible_images = list(images_dir.glob(f"{label_path.stem}.*"))
        if not possible_images:
            continue
        image_path = possible_images[0]

        for class_id in classes_in_file:
            if len(class_to_images[class_id]) < args.samples:
                class_to_images[class_id].append(image_path)

    output_dir = data_dir.parent / "class_inspection"
    output_dir.mkdir(exist_ok=True)

    for class_id, images in class_to_images.items():
        class_dir = output_dir / f"class_{class_id}"
        class_dir.mkdir(exist_ok=True)
        for img in images:
            shutil.copy(img, class_dir / img.name)

    print(f"Found {len(class_to_images)} classes: {sorted(class_to_images.keys())}")
    for class_id, images in class_to_images.items():
        print(f"  Class '{class_id}': {len(images)} sample images copied")
    print(f"\nSaved to: {output_dir}")
    print("Open each class_X folder and LOOK at the images -- confirm whether")
    print("they actually show potholes, or something else entirely.")


if __name__ == "__main__":
    main()
