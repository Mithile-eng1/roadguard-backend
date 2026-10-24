"""
Train the pothole-only YOLOv8 model.

Usage (from project root, in VS Code terminal):
    python -m src.train_pothole
"""

from ultralytics import YOLO

from src import config
from src.utils import get_device


def main():
    device = get_device()

    data_yaml = config.POTHOLE_DATA_DIR / "data.yaml"
    if not data_yaml.exists():
        raise FileNotFoundError(
            f"data.yaml not found at {data_yaml}. "
            f"Place your pothole dataset under {config.POTHOLE_DATA_DIR} first."
        )

    model = YOLO(config.BASE_MODEL)

    model.train(
        data=str(data_yaml),
        epochs=config.EPOCHS,
        imgsz=config.IMG_SIZE,
        batch=config.BATCH_SIZE,
        device=0 if device == "cuda" else "cpu",
        patience=config.PATIENCE,
        name="pothole_final",
    )

    # Evaluate right after training
    metrics = model.val(data=str(data_yaml), imgsz=config.IMG_SIZE)
    print("Precision:", metrics.box.mp)
    print("Recall:", metrics.box.mr)
    print("mAP50:", metrics.box.map50)
    print("mAP50-95:", metrics.box.map)

    print(
        "\nTrained weights saved under runs/detect/pothole_final/weights/best.pt\n"
        f"Copy that file to {config.POTHOLE_WEIGHTS} to use it with detect_hazards.py"
    )


if __name__ == "__main__":
    main()
