"""
Converts YOLO polygon/segmentation label files (many x,y pairs per line,
from Roboflow's Smart Polygon tool) into plain bounding box format
(class x_center y_center width height -- exactly 5 numbers per line),
which is what train_speedbreaker.py and the rest of this project expect.

For each polygon, this takes the min/max x and min/max y of all its
points and turns that into the tightest enclosing rectangle. This is a
reasonable, standard conversion -- the resulting box may be very
slightly looser than a hand-drawn box would be, but it's not a
meaningful accuracy loss for training a detector.

Usage (from project root, run BEFORE reorganize_roboflow_export.py,
pointing at your raw extracted Roboflow export folder):
    python scripts/convert_polygon_to_bbox.py --source path/to/unzipped_roboflow_export
"""

import argparse
from pathlib import Path


def polygon_to_bbox(values):
    """values: [class_id, x1, y1, x2, y2, ..., xn, yn] -> (class_id, x_center, y_center, w, h)"""
    class_id = int(values[0])
    coords = values[1:]
    xs = coords[0::2]
    ys = coords[1::2]

    x_min, x_max = min(xs), max(xs)
    y_min, y_max = min(ys), max(ys)

    x_center = (x_min + x_max) / 2
    y_center = (y_min + y_max) / 2
    width = x_max - x_min
    height = y_max - y_min

    return class_id, x_center, y_center, width, height


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--source", required=True,
                         help="Path to the unzipped Roboflow export (containing train/valid/test folders)")
    args = parser.parse_args()

    source = Path(args.source)
    label_files = list(source.glob("*/labels/*.txt"))

    if not label_files:
        raise FileNotFoundError(f"No label .txt files found under {source}/*/labels/")

    converted_count = 0
    already_bbox_count = 0
    empty_count = 0

    for label_path in label_files:
        lines = label_path.read_text().strip().splitlines()
        if not lines:
            empty_count += 1
            continue

        new_lines = []
        for line in lines:
            values = [float(v) for v in line.strip().split()]
            if len(values) == 5:
                # Already a plain bounding box -- leave it alone
                new_lines.append(line.strip())
                already_bbox_count += 1
            elif len(values) > 5 and len(values) % 2 == 1:
                # Polygon: class_id + even number of x,y coordinate pairs
                class_id, x, y, w, h = polygon_to_bbox(values)
                new_lines.append(f"{class_id} {x:.6f} {y:.6f} {w:.6f} {h:.6f}")
                converted_count += 1
            else:
                print(f"Warning: unexpected format in {label_path.name}, skipping this line")

        label_path.write_text("\n".join(new_lines) + "\n")

    print(f"Converted polygon labels to bounding boxes: {converted_count}")
    print(f"Already plain bounding boxes (left unchanged): {already_bbox_count}")
    print(f"Empty label files: {empty_count}")
    print("\nNext: python scripts/reorganize_roboflow_export.py --source ...")


if __name__ == "__main__":
    main()
