"""
Downloads a pre-annotated speed breaker dataset from Roboflow Universe
in YOLOv8 format, so no manual annotation is needed.

1. Create a free account at https://roboflow.com
2. Get your API key from your account settings
3. Pick a dataset from Roboflow Universe (search "speed breaker" or
   "speed bump"), open it, click "Download this Dataset" -> "YOLOv8"
   -> "show download code" to get the exact workspace/project/version
   for the snippet below.

Usage:
    python scripts/download_speedbreaker_dataset.py --api-key YOUR_KEY \
        --workspace speedbreakerdatalabelling \
        --project speed-breaker-detection-ng8ne \
        --version 2
"""

import argparse
import sys
from pathlib import Path

# allow running this script directly (adds project root to path)
sys.path.append(str(Path(__file__).resolve().parent.parent))

from src import config  # noqa: E402


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--api-key", required=True, help="Your Roboflow API key")
    parser.add_argument("--workspace", required=True, help="Roboflow workspace name")
    parser.add_argument("--project", required=True, help="Roboflow project slug")
    parser.add_argument("--version", type=int, required=True, help="Dataset version number")
    args = parser.parse_args()

    from roboflow import Roboflow

    rf = Roboflow(api_key=args.api_key)
    project = rf.workspace(args.workspace).project(args.project)
    dataset = project.version(args.version).download(
        "yolov8", location=str(config.SPEEDBREAKER_DATA_DIR)
    )

    print("Downloaded to:", dataset.location)
    print("Now check that data.yaml paths inside that folder are correct, then run:")
    print("    python -m src.train_speedbreaker")


if __name__ == "__main__":
    main()
