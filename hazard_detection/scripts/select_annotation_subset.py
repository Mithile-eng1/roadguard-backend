"""
Randomly selects a subset of images to annotate first (Step 1 of the
pre-labeling workflow). Random sampling gives more variety in
lighting/angle/background than just taking the first N files.

Usage (from project root):
    python scripts/select_annotation_subset.py --source path/to/969_images --count 275
"""

import argparse
import random
import shutil
from pathlib import Path


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--source", required=True, help="Folder with all downloaded images")
    parser.add_argument("--count", type=int, default=275, help="How many images to select")
    parser.add_argument("--seed", type=int, default=42)
    args = parser.parse_args()

    source = Path(args.source)
    images = sorted(list(source.glob("*.jpg")) + list(source.glob("*.jpeg")))

    if not images:
        raise FileNotFoundError(f"No .jpg/.jpeg files found in {source}")
    if args.count > len(images):
        raise ValueError(f"Requested {args.count} but only {len(images)} images exist")

    random.seed(args.seed)
    subset = random.sample(images, args.count)

    subset_dir = source.parent / "subset_to_annotate"
    remaining_dir = source.parent / "remaining_unannotated"
    subset_dir.mkdir(exist_ok=True)
    remaining_dir.mkdir(exist_ok=True)

    subset_names = {p.name for p in subset}

    for img_path in images:
        dest = subset_dir if img_path.name in subset_names else remaining_dir
        shutil.copy(img_path, dest / img_path.name)

    print(f"Subset to annotate first: {len(subset)} images -> {subset_dir}")
    print(f"Remaining for pre-labeling later: {len(images) - len(subset)} images -> {remaining_dir}")
    print("\nNext: upload the subset_to_annotate folder to Roboflow and annotate it manually.")


if __name__ == "__main__":
    main()
