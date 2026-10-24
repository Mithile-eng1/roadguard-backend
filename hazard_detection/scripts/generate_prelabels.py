"""
Runs a trained first-pass YOLO model on the remaining unannotated
images and writes out YOLO-format prediction labels, plus preview
images with boxes drawn, so you can review before importing into
Roboflow for correction (Step 4 of the pre-labeling workflow).

Only writes a label file for images where the model found something
above --conf. Images with no confident detection are left unlabeled
(you'll need to check those manually -- they show up as "no box"
after upload).

Usage (from project root):
    python scripts/generate_prelabels.py \
        --model runs/detect/speedbreaker_final/weights/best.pt \
        --source path/to/remaining_unannotated \
        --conf 0.35
"""

import argparse
from pathlib import Path

import cv2
from ultralytics import YOLO


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--model", required=True, help="Path to first-pass model weights (.pt)")
    parser.add_argument("--source", required=True, help="Folder of remaining unannotated images")
    parser.add_argument("--conf", type=float, default=0.35,
                         help="Confidence threshold -- lower catches more but with more false positives")
    args = parser.parse_args()

    source = Path(args.source)
    images = sorted(list(source.glob("*.jpg")) + list(source.glob("*.jpeg")))
    if not images:
        raise FileNotFoundError(f"No .jpg/.jpeg files found in {source}")

    model = YOLO(args.model)

    out_dir = source.parent / "prelabels"
    labels_dir = out_dir / "labels"
    preview_dir = out_dir / "preview"
    labels_dir.mkdir(parents=True, exist_ok=True)
    preview_dir.mkdir(parents=True, exist_ok=True)

    labeled_count = 0
    no_detection = []

    for img_path in images:
        result = model.predict(source=str(img_path), conf=args.conf, verbose=False)[0]

        if len(result.boxes) == 0:
            no_detection.append(img_path.name)
            continue

        # Keep only the single highest-confidence box per image --
        # simpler to review one candidate box than several overlapping ones
        best_idx = result.boxes.conf.argmax().item()
        box_norm = result.boxes.xywhn[best_idx].tolist()  # already normalized [x_c, y_c, w, h]
        confidence = result.boxes.conf[best_idx].item()

        label_path = labels_dir / (img_path.stem + ".txt")
        label_path.write_text(f"0 {box_norm[0]:.6f} {box_norm[1]:.6f} {box_norm[2]:.6f} {box_norm[3]:.6f}\n")

        image = cv2.imread(str(img_path))
        h, w = image.shape[:2]
        x1, y1, x2, y2 = result.boxes.xyxy[best_idx].tolist()
        cv2.rectangle(image, (int(x1), int(y1)), (int(x2), int(y2)), (0, 255, 0), 3)
        cv2.putText(image, f"{confidence:.2f}", (int(x1), max(int(y1) - 10, 15)),
                    cv2.FONT_HERSHEY_SIMPLEX, 0.8, (0, 255, 0), 2)
        cv2.imwrite(str(preview_dir / img_path.name), image)

        labeled_count += 1

    (out_dir / "no_detection.txt").write_text("\n".join(no_detection))

    print(f"Pre-labeled: {labeled_count}/{len(images)}")
    print(f"No confident detection: {len(no_detection)} -- listed in {out_dir / 'no_detection.txt'}")
    print(f"Labels: {labels_dir}")
    print(f"Preview (for review before uploading): {preview_dir}")
    print(
        "\nNext: browse the preview folder. For images with a reasonable box, "
        "upload the image + matching .txt to Roboflow together for quick correction. "
        "For images in no_detection.txt, annotate those from scratch."
    )


if __name__ == "__main__":
    main()
