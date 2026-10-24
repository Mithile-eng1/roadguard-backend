"""
CORRECTED fix (replaces collapse_classes.py's mistake for this dataset).

This dataset's classes are NOT duplicates of the same thing -- they are
genuinely different categories:
    class 0 = roads/manholes (NOT potholes)
    class 1 = cracks (NOT potholes)
    class 2 = potholes (the only one we actually want)

This script keeps ONLY class 2 boxes, discards the others entirely
(rather than merging them in), and remaps the kept boxes to class 0
(since our final single-class dataset uses class 0 = pothole). Images
that only had class 0/1 boxes become clean negative examples (empty
label file) instead of being falsely taught as containing a pothole.

Usage (point this at the ORIGINAL, unmodified Roboflow export):
    python scripts/fix_pothole_classes.py \
        --source "data/raw/pothole_raw_v2/potholesdetection.v2i.yolov8" \
        --pothole-class-id 2
"""

import argparse
from pathlib import Path


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--source", required=True,
                         help="Path to the ORIGINAL Roboflow export (with the real 3-class labels)")
    parser.add_argument("--pothole-class-id", required=True,
                         help="Which original class ID actually means 'pothole' (e.g. 2)")
    args = parser.parse_args()

    source = Path(args.source)
    label_files = list(source.glob("*/labels/*.txt"))

    if not label_files:
        raise FileNotFoundError(f"No label files found under {source}/*/labels/")

    kept_boxes = 0
    discarded_boxes = 0
    images_now_negative = 0
    images_with_potholes = 0

    for label_path in label_files:
        lines = label_path.read_text().strip().splitlines()

        kept_lines = []
        for line in lines:
            parts = line.strip().split()
            if not parts:
                continue
            if parts[0] == args.pothole_class_id:
                parts[0] = "0"  # remap to the single final class
                kept_lines.append(" ".join(parts))
                kept_boxes += 1
            else:
                discarded_boxes += 1

        if kept_lines:
            images_with_potholes += 1
        else:
            images_now_negative += 1

        # Write back -- either the real pothole boxes only, or empty
        # (empty label file = valid YOLO negative example, not an error)
        label_path.write_text("\n".join(kept_lines) + ("\n" if kept_lines else ""))

    print(f"Label files processed: {len(label_files)}")
    print(f"Pothole boxes kept: {kept_boxes}")
    print(f"Non-pothole boxes discarded (roads/manholes/cracks): {discarded_boxes}")
    print(f"Images with at least one real pothole: {images_with_potholes}")
    print(f"Images now clean negatives (no pothole): {images_now_negative}")
    print("\nNext steps:")
    print("1. Delete your old corrupted data/pothole_yolo folder:")
    print("   Remove-Item data\\pothole_yolo -Recurse -Force")
    print("2. Re-run reorganize with this corrected source:")
    print(f'   python scripts/reorganize_roboflow_export.py --source "{source}" --hazard pothole')
    print("3. Delete any stale cache files, then retrain:")
    print("   Remove-Item data\\pothole_yolo\\labels\\train.cache -ErrorAction SilentlyContinue")
    print("   Remove-Item data\\pothole_yolo\\labels\\val.cache -ErrorAction SilentlyContinue")
    print("   python -m src.train_pothole")


if __name__ == "__main__":
    main()
