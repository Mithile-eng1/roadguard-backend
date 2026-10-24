"""
Shared utilities: device detection, common helpers.
"""

import torch


def get_device() -> str:
    """Returns 'cuda' if a GPU is available locally, else 'cpu'."""
    if torch.cuda.is_available():
        print(f"Using GPU: {torch.cuda.get_device_name(0)}")
        return "cuda"
    print("No GPU found, using CPU (training/inference will be slower).")
    return "cpu"
