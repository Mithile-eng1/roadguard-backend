import os
import json
import math
from concurrent.futures import ThreadPoolExecutor
import requests
import cv2
import numpy as np
from dotenv import load_dotenv

load_dotenv()
API_KEY = os.getenv("GOOGLE_MAPS_API_KEY")

# ── HEADING CALCULATION ───────────────────────────────────────────────────
def calculate_heading(lat1, lng1, lat2, lng2):
    dLng = math.radians(lng2 - lng1)
    lat1_r = math.radians(lat1)
    lat2_r = math.radians(lat2)
    x = math.sin(dLng) * math.cos(lat2_r)
    y = math.cos(lat1_r) * math.sin(lat2_r) - math.sin(lat1_r) * math.cos(lat2_r) * math.cos(dLng)
    return (math.degrees(math.atan2(x, y)) + 360) % 360

def angle_difference(a, b):
    diff = abs(a - b) % 360
    return diff if diff <= 180 else 360 - diff

# ── METADATA ──────────────────────────────────────────────────────────────
def get_pano_metadata(lat, lng, radius=50):
    url = "https://maps.googleapis.com/maps/api/streetview/metadata"
    params = {
        "location": f"{lat},{lng}",
        "radius": radius,
        "source": "outdoor",
        "key": API_KEY
    }
    return requests.get(url, params=params).json()

def get_pano_by_id(pano_id):
    url = "https://maps.googleapis.com/maps/api/streetview/metadata"
    params = {
        "pano": pano_id,
        "key": API_KEY
    }
    return requests.get(url, params=params).json()

# ── ROAD VISIBILITY CHECK ─────────────────────────────────────────────────
def has_road_visible(filepath):
    """Strict road visibility check — rejects shops, vegetation, garbage."""
    image = cv2.imread(filepath)
    if image is None:
        return False

    h, w = image.shape[:2]

    # Check bottom 40% only (strict road area)
    bottom = image[int(h * 0.60):, :]
    hsv    = cv2.cvtColor(bottom, cv2.COLOR_BGR2HSV)

    # Road colors — asphalt gray only (strict range)
    asphalt = cv2.inRange(hsv,
                          np.array([0,  0,  40]),
                          np.array([180, 35, 160]))

    # Exclude non-road colors
    green  = cv2.inRange(hsv, np.array([35, 40,  40]),  np.array([85,  255, 255]))  # grass/trees
    brown  = cv2.inRange(hsv, np.array([10, 40,  40]),  np.array([20,  255, 180]))  # dirt
    bright = cv2.inRange(hsv, np.array([0,  60,  150]), np.array([180, 255, 255]))  # shops/tiles
    dark   = cv2.inRange(hsv, np.array([0,  0,   0]),   np.array([180, 255,  40]))  # darkness/vegetation

    exclude   = cv2.bitwise_or(green,  brown)
    exclude   = cv2.bitwise_or(exclude, bright)
    exclude   = cv2.bitwise_or(exclude, dark)

    # Clean road mask
    road_mask = cv2.bitwise_and(asphalt, cv2.bitwise_not(exclude))

    # Remove tiny noise
    kernel    = np.ones((5, 5), np.uint8)
    road_mask = cv2.morphologyEx(road_mask, cv2.MORPH_OPEN, kernel)

    road_percent = (np.sum(road_mask > 0) / road_mask.size) * 100

    # Road must appear across multiple rows (horizontal strip)
    row_coverage   = np.sum(road_mask > 0, axis=1)
    rows_with_road = np.sum(row_coverage > (w * 0.20))
    row_percent    = (rows_with_road / road_mask.shape[0]) * 100

    print(f"     🛣 Road visibility : {round(road_percent, 1)}%")
    print(f"     📏 Row coverage    : {round(row_percent,  1)}%")

    # Need BOTH: 20%+ road pixels AND road across multiple rows
    return road_percent >= 20 and row_percent >= 30

# ── DOWNLOAD IMAGE ────────────────────────────────────────────────────────
def download_image(pano_id=None, lat=None, lng=None,
                   heading=0, output_dir="output/images",
                   filename="image.jpg", size="640x480"):
    os.makedirs(output_dir, exist_ok=True)
    filepath = os.path.join(output_dir, filename)

    url    = "https://maps.googleapis.com/maps/api/streetview"
    params = {
        "size":    size,
        "heading": round(heading, 2),
        "pitch":   -10,
        "fov":     75,
        "key":     API_KEY
    }

    if pano_id:
        params["pano"] = pano_id
    else:
        params["location"] = f"{lat},{lng}"
        params["source"]   = "outdoor"
        params["radius"]   = 50

    response = requests.get(url, params=params)
    if response.status_code == 200 and \
       response.headers["Content-Type"].startswith("image"):
        with open(filepath, "wb") as f:
            f.write(response.content)
        return filepath
    return None

# ── BUILD PANO CHAIN ──────────────────────────────────────────────────────
def build_pano_chain(waypoints, radius=100, workers=8):
    """
    Build chain of connected panoramas from origin to destination.
    Like clicking forward in Google Street View.
    Metadata lookups are free and independent, so they run in parallel.
    """
    print("Building panorama chain...\n")
    pano_chain    = []
    visited_panos = set()

    with ThreadPoolExecutor(max_workers=workers) as pool:
        metas = list(pool.map(lambda wp: get_pano_metadata(wp["lat"], wp["lng"], radius=radius), waypoints))

    for i, wp in enumerate(waypoints):
        lat = wp["lat"]
        lng = wp["lng"]

        # Calculate forward heading toward next waypoint
        if i < len(waypoints) - 1:
            heading = calculate_heading(
                lat, lng,
                waypoints[i+1]["lat"],
                waypoints[i+1]["lng"]
            )
        else:
            heading = pano_chain[-1]["heading"] if pano_chain else 0

        meta = metas[i]
        if meta.get("status") != "OK":
            print(f"  ⚠ No pano at waypoint {i+1} — skipping")
            continue

        pano_id  = meta.get("pano_id")
        pano_lat = meta["location"]["lat"]
        pano_lng = meta["location"]["lng"]

        # Skip duplicate panoramas
        if pano_id in visited_panos:
            print(f"  ↩ Waypoint {i+1} — duplicate pano, skipping")
            continue

        visited_panos.add(pano_id)

        pano_chain.append({
            "step":           len(pano_chain) + 1,
            "waypoint_index": i + 1,
            "pano_id":        pano_id,
            "lat":            pano_lat,
            "lng":            pano_lng,
            "heading":        round(heading, 2),
            "origin_lat":     lat,
            "origin_lng":     lng
        })

        print(f"  ✅ Waypoint {i+1}/{len(waypoints)} → "
              f"pano: {pano_id[:10]}... | heading: {round(heading)}°")

    print(f"\n📍 Total unique panoramas: {len(pano_chain)}")
    return pano_chain

# ── DOWNLOAD ALL PANO IMAGES ──────────────────────────────────────────────
def download_pano_chain(pano_chain, output_dir="output/images"):
    """Download all images — skip if no road visible."""
    os.makedirs(output_dir, exist_ok=True)

    # Clear old images
    for f in os.listdir(output_dir):
        if f.endswith(".jpg") or f.endswith(".png"):
            os.remove(os.path.join(output_dir, f))

    print(f"\nDownloading {len(pano_chain)} images...\n")
    image_paths = []
    skipped     = 0

    for pano in pano_chain:
        filename = f"step_{pano['step']:04d}_wp{pano['waypoint_index']:04d}.jpg"
        print(f"  📸 Step {pano['step']}/{len(pano_chain)}: {filename}")

        # Try pano_id first
        filepath = download_image(
            pano_id    = pano["pano_id"],
            heading    = pano["heading"],
            output_dir = output_dir,
            filename   = filename
        )

        # Fallback to lat/lng
        if not filepath:
            print(f"     ⚠ pano_id failed — trying lat/lng fallback...")
            filepath = download_image(
                lat        = pano["lat"],
                lng        = pano["lng"],
                heading    = pano["heading"],
                output_dir = output_dir,
                filename   = filename
            )

        # Download failed
        if not filepath:
            print(f"     ❌ Download failed — skipping")
            skipped += 1
            continue

        # Check road visibility
        if not has_road_visible(filepath):
            print(f"     ❌ No road visible — skipping")
            os.remove(filepath)
            skipped += 1
            continue

        print(f"     ✅ Saved: {filename}")
        pano["image"] = filepath
        image_paths.append(pano)

    print(f"\n✅ Images with road  : {len(image_paths)}")
    print(f"❌ Skipped (no road) : {skipped}")
    return image_paths

# ── MAIN FUNCTION ─────────────────────────────────────────────────────────
def fetch_all_images(waypoints_path="output/waypoints.json"):
    """
    Main — builds pano chain and downloads all forward-facing road images.
    Simulates walking/driving from origin to destination in Street View.
    """
    with open(waypoints_path, "r") as f:
        waypoints = json.load(f)

    print(f"Total waypoints      : {len(waypoints)}")
    print(f"Navigating from origin to destination...\n")
    print("=" * 50)

    # Step 1: Build panorama chain
    pano_chain = build_pano_chain(waypoints)

    # Step 2: Download road images only
    image_paths = download_pano_chain(pano_chain)

    # Step 3: Save index
    with open("output/images_index.json", "w") as f:
        json.dump(image_paths, f, indent=2)

    print(f"\n🎉 Done!")
    print(f"📁 Images saved in : output/images/")
    print(f"📄 Index saved in  : output/images_index.json")

    return image_paths

if __name__ == "__main__":
    fetch_all_images()