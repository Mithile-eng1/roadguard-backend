"""
Fixes a dataset where images from different sources ended up with
mismatched/duplicate class labels (e.g. classes named '0', '1', and
'Pothole' all really meaning the same thing) instead of one unified class.

Rewrites every label .txt file so every detection uses class 0, and
rewrites data.yaml to declare a single class with the name you choose.

Usage (from project root):
    python scripts/collapse_classes.py --data-dir data/pothole_yolo --class-name pothole
"""

import argparse
from pathlib import Path


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--data-dir", required=True, help="e.g. data/pothole_yolo")
    parser.add_argument("--class-name", required=True, help="e.g. pothole")
    args = parser.parse_args()

    data_dir = Path(args.data_dir)
    label_files = list(data_dir.glob("labels/*/*.txt"))

    if not label_files:
        raise FileNotFoundError(f"No label files found under {data_dir}/labels/*/")

    fixed_lines = 0
    fixed_files = 0

    for label_path in label_files:
        lines = label_path.read_text().strip().splitlines()
        if not lines:
            continue

        new_lines = []
        changed = False
        for line in lines:
            parts = line.strip().split()
            if not parts:
                continue
            if parts[0] != "0":
                changed = True
                fixed_lines += 1
            parts[0] = "0"  # collapse every class into class 0
            new_lines.append(" ".join(parts))

        if changed:
            fixed_files += 1

        label_path.write_text("\n".join(new_lines) + "\n")

    # Rewrite data.yaml with a single, correctly-named class
    data_yaml = data_dir / "data.yaml"
    data_yaml.write_text(
        f"train: {data_dir.resolve() / 'images' / 'train'}\n"
        f"val: {data_dir.resolve() / 'images' / 'val'}\n"
        f"nc: 1\n"
        f"names: ['{args.class_name}']\n"
    )

    print(f"Label files checked: {len(label_files)}")
    print(f"Files with a class ID changed: {fixed_files}")
    print(f"Total individual boxes reassigned to class 0: {fixed_lines}")
    print(f"data.yaml rewritten with a single class: '{args.class_name}'")
    print("\nNext: retrain from scratch with this corrected dataset:")
    print("    python -m src.train_pothole")


if __name__ == "__main__":
    main()
