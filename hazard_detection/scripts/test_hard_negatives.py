"""
Systematically tests your pothole model against images that SHOULD NOT
trigger a detection -- shadows, cracks, manhole covers, wet patches,
worn asphalt patches. This directly targets the known weakness (high
false-positive rate) instead of hoping random testing happens to catch it.

Organize your test images into subfolders by category BEFORE running
this, e.g.:

    hard_negatives/
        shadows/          <- images with strong shadows, no real pothole
        cracks/           <- cracked but not potholed road
        manholes/         <- manhole covers, drain covers
        wet_patches/      <- water stains, oil stains, discoloration
        normal_road/      <- clean, unremarkable road

Every detection here is, by definition, a false positive -- the model
should find NOTHING in these images. This reports the false-positive
rate PER CATEGORY, so you know exactly which confusion pattern is
still a problem after retraining, instead of one aggregate number.

Usage:
    python scripts/test_hard_negatives.py --model models/pothole_best.pt --source hard_negatives --conf 0.3
"""

import argparse
from pathlib import Path

from ultralytics import YOLO


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--model", required=True, help="Path to trained pothole model")
    parser.add_argument("--source", required=True,
                         help="Folder containing category subfolders (shadows/, cracks/, etc.)")
    parser.add_argument("--conf", type=float, default=0.3, help="Confidence threshold")
    args = parser.parse_args()

    source = Path(args.source)
    categories = [d for d in source.iterdir() if d.is_dir()]

    if not categories:
        raise FileNotFoundError(
            f"No category subfolders found in {source}. "
            "Organize test images into subfolders first (see docstring)."
        )

    model = YOLO(args.model)

    print(f"{'Category':<20} {'Images':<10} {'False Positives':<18} {'FP Rate':<10}")
    print("-" * 60)

    overall_images = 0
    overall_fp = 0

    for category_dir in sorted(categories):
        images = (
            list(category_dir.glob("*.jpg"))
            + list(category_dir.glob("*.jpeg"))
            + list(category_dir.glob("*.png"))
        )
        if not images:
            continue

        false_positives = 0
        for img_path in images:
            result = model.predict(source=str(img_path), conf=args.conf, verbose=False)[0]
            if len(result.boxes) > 0:
                false_positives += 1

        fp_rate = false_positives / len(images)
        print(f"{category_dir.name:<20} {len(images):<10} {false_positives:<18} {fp_rate:.1%}")

        overall_images += len(images)
        overall_fp += false_positives

    print("-" * 60)
    overall_rate = overall_fp / overall_images if overall_images else 0
    print(f"{'OVERALL':<20} {overall_images:<10} {overall_fp:<18} {overall_rate:.1%}")
    print(
        "\nAny category above ~10-15% false-positive rate is worth targeting "
        "with more correctly-labeled negative examples of that specific "
        "confusion pattern in your next training round."
    )


if __name__ == "__main__":
    main()
