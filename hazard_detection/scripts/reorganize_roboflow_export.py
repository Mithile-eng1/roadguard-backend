"""
Takes an unzipped Roboflow YOLOv8 export (train/, valid/, test/ folders)
and copies it into this project's expected structure for either hazard type:

    data/pothole_yolo/images/train, images/val, labels/train, labels/val
    OR
    data/speedbreaker_yolo/images/train, images/val, labels/train, labels/val

Also rewrites data.yaml to point at these paths (Roboflow's own
data.yaml uses relative paths that won't match once moved).

Usage (from project root):
    python scripts/reorganize_roboflow_export.py --source path/to/unzipped_roboflow_export --hazard pothole
    python scripts/reorganize_roboflow_export.py --source path/to/unzipped_roboflow_export --hazard speedbreaker
"""

import argparse
import shutil
import sys
from pathlib import Path

sys.path.append(str(Path(__file__).resolve().parent.parent))
from src import config  # noqa: E402


def copy_split(source_root: Path, roboflow_split: str, project_split: str, dest_root: Path):
    src_images = source_root / roboflow_split / "images"
    src_labels = source_root / roboflow_split / "labels"

    if not src_images.exists():
        print(f"Skipping '{roboflow_split}' -- not found at {src_images} (did you generate a test split?)")
        return 0

    dest_images = dest_root / "images" / project_split
    dest_labels = dest_root / "labels" / project_split
    dest_images.mkdir(parents=True, exist_ok=True)
    dest_labels.mkdir(parents=True, exist_ok=True)

    count = 0
    for img_path in src_images.glob("*"):
        shutil.copy(img_path, dest_images / img_path.name)
        count += 1

    for label_path in src_labels.glob("*.txt"):
        shutil.copy(label_path, dest_labels / label_path.name)

    return count


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--source", required=True, help="Path to the unzipped Roboflow export folder")
    parser.add_argument("--hazard", required=True, choices=["pothole", "speedbreaker"],
                         help="Which dataset this export is for")
    args = parser.parse_args()

    source_root = Path(args.source)
    dest_root = config.POTHOLE_DATA_DIR if args.hazard == "pothole" else config.SPEEDBREAKER_DATA_DIR

    train_count = copy_split(source_root, "train", "train", dest_root)
    val_count = copy_split(source_root, "valid", "val", dest_root)  # Roboflow calls it "valid", we call it "val"
    test_count = copy_split(source_root, "test", "test", dest_root)  # optional, only if you set a test split

    # Read class names from Roboflow's own data.yaml so we don't have to hardcode them
    roboflow_yaml = source_root / "data.yaml"
    names_line = "names: ['speedbreaker']"
    nc_line = "nc: 1"
    if roboflow_yaml.exists():
        content = roboflow_yaml.read_text()
        for line in content.splitlines():
            if line.strip().startswith("names:"):
                names_line = line.strip()
            if line.strip().startswith("nc:"):
                nc_line = line.strip()

    data_yaml = dest_root / "data.yaml"
    data_yaml.write_text(
        f"train: {dest_root / 'images' / 'train'}\n"
        f"val: {dest_root / 'images' / 'val'}\n"
        f"{nc_line}\n"
        f"{names_line}\n"
    )

    print(f"Train: {train_count} images -> {dest_root / 'images' / 'train'}")
    print(f"Val: {val_count} images -> {dest_root / 'images' / 'val'}")
    if test_count:
        print(f"Test: {test_count} images -> {dest_root / 'images' / 'test'}")
    print(f"\ndata.yaml written to: {data_yaml}")
    next_command = "train_pothole" if args.hazard == "pothole" else "train_speedbreaker"
    print(f"\nNext: python -m src.{next_command}")


if __name__ == "__main__":
    main()
