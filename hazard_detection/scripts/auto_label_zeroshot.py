"""
Zero-shot auto-labeling for speed breakers using Grounding DINO --
a pretrained vision-language model that detects objects from a plain
text description, with no training or manual annotation needed.

This is fundamentally different from the earlier classical-CV attempt
(threshold_speedbreaker_stripes.py): instead of reacting to brightness,
it was trained on real-world images paired with text descriptions, so
it actually has a learned notion of what a "speed breaker" looks like.

IMPORTANT: this has NOT been tested on your actual images (no internet
access in the environment used to build this). Run it on a small batch
first, check the preview folder, and only trust it at scale if the
boxes look right on a decent sample.

Setup:
    pip install transformers torch pillow

Usage (from project root):
    python scripts/auto_label_zeroshot.py --source path/to/969_images --conf 0.3
"""

import argparse
from pathlib import Path

import torch
from PIL import Image
from transformers import AutoProcessor, AutoModelForZeroShotObjectDetection

# Grounding DINO expects lowercase text prompts ending in a period,
# multiple concepts separated by periods. Adjust these if results
# are consistently off -- e.g. add "road hump." or "zebra crossing
# with raised bump." as alternate phrasings to try.
TEXT_PROMPT = "speed breaker. raised road hump."
MODEL_NAME = "IDEA-Research/grounding-dino-tiny"  # smaller/faster; use grounding-dino-base for better accuracy


def get_device():
    return "cuda" if torch.cuda.is_available() else "cpu"


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--source", required=True, help="Folder containing the downloaded jpgs")
    parser.add_argument("--conf", type=float, default=0.3, help="Detection confidence threshold")
    args = parser.parse_args()

    source = Path(args.source)
    images = sorted(list(source.glob("*.jpg")) + list(source.glob("*.jpeg")))
    if not images:
        raise FileNotFoundError(f"No .jpg/.jpeg files found in {source}")

    device = get_device()
    print(f"Loading {MODEL_NAME} on {device}... (first run downloads the model, may take a while)")

    processor = AutoProcessor.from_pretrained(MODEL_NAME)
    model = AutoModelForZeroShotObjectDetection.from_pretrained(MODEL_NAME).to(device)
    model.eval()

    out_dir = source / "zeroshot_labels"
    labels_dir = out_dir / "labels"
    preview_dir = out_dir / "preview"
    labels_dir.mkdir(parents=True, exist_ok=True)
    preview_dir.mkdir(parents=True, exist_ok=True)

    labeled_count = 0
    no_detection = []

    for img_path in images:
        image = Image.open(img_path).convert("RGB")
        w, h = image.size

        inputs = processor(images=image, text=TEXT_PROMPT, return_tensors="pt").to(device)

        with torch.no_grad():
            outputs = model(**inputs)

        results = processor.post_process_grounded_object_detection(
            outputs,
            inputs.input_ids,
            box_threshold=args.conf,
            text_threshold=args.conf,
            target_sizes=[(h, w)],
        )[0]

        if len(results["boxes"]) == 0:
            no_detection.append(img_path.name)
            continue

        # Keep the single highest-confidence box per image
        best_idx = results["scores"].argmax().item()
        x1, y1, x2, y2 = results["boxes"][best_idx].tolist()
        score = results["scores"][best_idx].item()

        x_center = ((x1 + x2) / 2) / w
        y_center = ((y1 + y2) / 2) / h
        box_w = (x2 - x1) / w
        box_h = (y2 - y1) / h

        label_path = labels_dir / (img_path.stem + ".txt")
        label_path.write_text(f"0 {x_center:.6f} {y_center:.6f} {box_w:.6f} {box_h:.6f}\n")

        # Save a preview with the box drawn for manual review
        from PIL import ImageDraw
        preview = image.copy()
        draw = ImageDraw.Draw(preview)
        draw.rectangle([x1, y1, x2, y2], outline=(0, 255, 0), width=4)
        draw.text((x1, max(y1 - 20, 0)), f"{score:.2f}", fill=(0, 255, 0))
        preview.save(preview_dir / img_path.name)

        labeled_count += 1

    (out_dir / "no_detection.txt").write_text("\n".join(no_detection))

    print(f"\nAuto-labeled: {labeled_count}/{len(images)}")
    print(f"No confident detection: {len(no_detection)} -- listed in {out_dir / 'no_detection.txt'}")
    print(f"Labels: {labels_dir}")
    print(f"Preview (REVIEW THESE before trusting them): {preview_dir}")
    print(
        "\nNext: open the preview folder and check a good sample (at least 30-50 "
        "images) before deciding whether to use these labels as-is, correct them "
        "in labelImg/Roboflow, or fall back to full manual annotation."
    )


if __name__ == "__main__":
    main()
