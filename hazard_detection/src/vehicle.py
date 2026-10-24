"""
Vehicle ground clearance database — the personalization input.

Usage:
    from src.vehicle import get_vehicle, list_vehicles

    vehicle = get_vehicle("Honda City")
    print(vehicle["ground_clearance_mm"])
"""

import csv
from pathlib import Path

VEHICLES_CSV = Path("data/vehicles.csv")


def _ensure_default_csv():
    """Creates a starter vehicles.csv if one doesn't exist yet."""
    if VEHICLES_CSV.exists():
        return

    VEHICLES_CSV.parent.mkdir(parents=True, exist_ok=True)
    default_vehicles = [
        ("Honda City", "Sedan", 165),
        ("Hyundai i20", "Hatchback", 170),
        ("Maruti Swift", "Hatchback", 163),
        ("Honda Amaze", "Sedan", 168),
        ("Toyota Innova", "MPV", 178),
        ("Hyundai Creta", "SUV", 190),
        ("Mahindra Thar", "SUV", 226),
        ("Tata Nexon", "SUV", 209),
        ("Kia Seltos", "SUV", 190),
        ("Mahindra Scorpio", "SUV", 180),
        ("Maruti Baleno", "Hatchback", 170),
        ("Skoda Slavia", "Sedan", 179),
        ("Toyota Fortuner", "SUV", 224),
        ("Renault Kwid", "Hatchback", 184),
        ("Hyundai Venue", "SUV", 195),
    ]

    with open(VEHICLES_CSV, "w", newline="") as f:
        writer = csv.writer(f)
        writer.writerow(["vehicle", "type", "ground_clearance_mm"])
        writer.writerows(default_vehicles)


def list_vehicles():
    """Returns all vehicles as a list of dicts."""
    _ensure_default_csv()
    with open(VEHICLES_CSV) as f:
        reader = csv.DictReader(f)
        return [
            {
                "vehicle": row["vehicle"],
                "type": row["type"],
                "ground_clearance_mm": float(row["ground_clearance_mm"]),
            }
            for row in reader
        ]


def get_vehicle(name: str):
    """Looks up a vehicle by name (case-insensitive). Returns None if not found."""
    for v in list_vehicles():
        if v["vehicle"].lower() == name.lower():
            return v
    return None


def interactive_select():
    """Simple CLI vehicle picker, matching the prototype flow from the spec."""
    vehicles = list_vehicles()
    print("Select Vehicle:")
    for i, v in enumerate(vehicles, start=1):
        print(f"{i}. {v['vehicle']} ({v['type']}, {v['ground_clearance_mm']}mm)")

    choice = int(input("\nEnter Choice: "))
    selected = vehicles[choice - 1]

    print(f"\nVehicle: {selected['vehicle']}")
    print(f"Ground Clearance: {selected['ground_clearance_mm']} mm")
    return selected


if __name__ == "__main__":
    interactive_select()
