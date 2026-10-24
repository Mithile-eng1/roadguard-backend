"""
Train the speed-breaker-only YOLOv8 model.
Completely independent from the pothole model: separate weights,
separate dataset, separate training run.

Usage (from project root, in VS Code terminal):
    python -m src.train_speedbreaker
"""

from ultralytics import YOLO

from src import config
from src.utils import get_device


def main():
    device = get_device()

    data_yaml = config.SPEEDBREAKER_DATA_DIR / "data.yaml"
    if not data_yaml.exists():
        raise FileNotFoundError(
            f"data.yaml not found at {data_yaml}. "
            f"Run scripts/download_speedbreaker_dataset.py first, "
            f"or place your own dataset under {config.SPEEDBREAKER_DATA_DIR}."
        )

    model = YOLO(config.BASE_MODEL)  # fresh weights, independent of pothole model

    model.train(
        data=str(data_yaml),
        epochs=config.EPOCHS,
        imgsz=config.IMG_SIZE,
        batch=config.BATCH_SIZE,
        device=0 if device == "cuda" else "cpu",
        patience=config.PATIENCE,
        name="speedbreaker_final",
    )

    metrics = model.val(data=str(data_yaml), imgsz=config.IMG_SIZE)
    print("Precision:", metrics.box.mp)
    print("Recall:", metrics.box.mr)
    print("mAP50:", metrics.box.map50)
    print("mAP50-95:", metrics.box.map)

    print(
        "\nTrained weights saved under runs/detect/speedbreaker_final/weights/best.pt\n"
        f"Copy that file to {config.SPEEDBREAKER_WEIGHTS} to use it with detect_hazards.py"
    )


if __name__ == "__main__":
    main()
