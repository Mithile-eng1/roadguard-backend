"""
Walks the ACTUAL Street View linked panorama graph (the same graph the
manual arrows in Google Maps use) via browser automation, since this
graph is only exposed through the JavaScript Maps API, not the simple
REST API used elsewhere in this project.

At each step, looks at all panoramas physically linked to the current
one, and moves to whichever link's heading points closest toward the
next point AHEAD ON THE DIRECTIONS ROUTE (not straight toward the
destination -- that beelines through side streets). Origin/destination
are geocoded by the Directions API, so place names work directly.
When the walk finishes, the images are downloaded too.

Setup:
    pip install selenium
    (Selenium 4.6+ auto-manages the Chrome driver, no separate download needed --
    just needs Google Chrome installed on this machine)

    Edit streetview_graph.html and replace YOUR_API_KEY_HERE with your
    real Google Maps API key (must have "Maps JavaScript API" enabled,
    not just Directions/Street View Static).

Usage:
    python streetview_graph_walker.py "Tanguturu, Andhra Pradesh" "Alukurapadu, Andhra Pradesh" [max_steps]
    python streetview_graph_walker.py "10.8983,76.8962" "10.8930,76.9119" [max_steps]
"""

import json
import math
import re
import shutil
import sys
import time
from pathlib import Path

from selenium import webdriver
from selenium.webdriver.chrome.options import Options

from route_extraction.maps_api import get_route_points
from download_linked_chain_images import main as download_images

LOOKAHEAD_M = 30   # aim at the route point this far ahead of us
OFF_ROUTE_M = 60   # stop if we drift this far from the route


def bearing(lat1, lng1, lat2, lng2):
    """Compass bearing (0-360) from point 1 to point 2."""
    phi1, phi2 = math.radians(lat1), math.radians(lat2)
    dlambda = math.radians(lng2 - lng1)
    x = math.sin(dlambda) * math.cos(phi2)
    y = math.cos(phi1) * math.sin(phi2) - math.sin(phi1) * math.cos(phi2) * math.cos(dlambda)
    return (math.degrees(math.atan2(x, y)) + 360) % 360


def heading_difference(a, b):
    diff = abs(a - b) % 360
    return min(diff, 360 - diff)


def haversine_meters(lat1, lng1, lat2, lng2):
    R = 6371000
    phi1, phi2 = math.radians(lat1), math.radians(lat2)
    dphi = math.radians(lat2 - lat1)
    dlambda = math.radians(lng2 - lng1)
    a = math.sin(dphi / 2) ** 2 + math.cos(phi1) * math.cos(phi2) * math.sin(dlambda / 2) ** 2
    return R * 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))


def densify(points, step_m=10):
    """Insert points so consecutive route vertices are at most ~step_m apart."""
    out = []
    for (lat1, lng1), (lat2, lng2) in zip(points, points[1:]):
        n = max(1, int(haversine_meters(lat1, lng1, lat2, lng2) // step_m))
        out += [(lat1 + (lat2 - lat1) * k / n, lng1 + (lng2 - lng1) * k / n) for k in range(n)]
    out.append(points[-1])
    return out


def nearest_route_index(route, lat, lng, start, window=30):
    """Index of the route point nearest (lat, lng), searching forward from `start` only."""
    seg = route[start:start + window]
    return start + min(range(len(seg)), key=lambda k: haversine_meters(lat, lng, *seg[k]))


def lookahead_target(route, idx, meters=LOOKAHEAD_M):
    """First route point at least `meters` further along the route from route[idx]."""
    travelled = 0
    for j in range(idx, len(route) - 1):
        travelled += haversine_meters(*route[j], *route[j + 1])
        if travelled >= meters:
            return route[j + 1]
    return route[-1]


def wait_for_result(driver, timeout=10):
    """Polls window.lastResult until the async JS callback fills it in."""
    start = time.time()
    while time.time() - start < timeout:
        in_progress = driver.execute_script("return window.lookupInProgress;")
        if not in_progress:
            result = driver.execute_script("return window.lastResult;")
            if result is not None:
                return result
        time.sleep(0.2)
    return None


def main():
    if len(sys.argv) < 3:
        print('Usage: python streetview_graph_walker.py ORIGIN DESTINATION [max_steps]')
        print('       (place names or "lat,lng" strings)')
        sys.exit(1)

    args = sys.argv[1:]
    if len(args) >= 4 and all(a.replace(".", "").replace("-", "").isdigit() for a in args[:4]):
        # old form: START_LAT START_LNG END_LAT END_LNG [max_steps]
        args = [f"{args[0]},{args[1]}", f"{args[2]},{args[3]}"] + args[4:]
    origin, destination = args[0], args[1]

    # A previous walk of this exact origin/destination is cached -- reuse it
    # before calling ANY Google API, so a re-run costs nothing.
    output_path = Path("output/linked_pano_chain.json")
    walk_cache = Path("output/route_cache") / (re.sub(r"[^\w.,-]+", "_", f"{origin}__{destination}") + ".json")
    if walk_cache.exists():
        print(f"Using cached walk: {walk_cache} (delete it to re-walk)\n")
        output_path.parent.mkdir(parents=True, exist_ok=True)
        shutil.copy(walk_cache, output_path)
        download_images()
        return

    print(f"Fetching Directions route: {origin} -> {destination}")
    route = densify(get_route_points(origin, destination))
    route_m = sum(haversine_meters(*a, *b) for a, b in zip(route, route[1:]))
    (start_lat, start_lng), (end_lat, end_lng) = route[0], route[-1]
    # panoramas are ~10m apart; allow slack for detours / dense city panos
    max_steps = int(args[2]) if len(args) > 2 else int(route_m / 5) + 50
    print(f"Route: {route_m / 1000:.2f} km, {len(route)} guide points, max {max_steps} steps\n")

    html_path = Path("streetview_graph.html").resolve()
    if not html_path.exists():
        raise FileNotFoundError("streetview_graph.html not found in current directory")

    options = Options()
    options.add_argument("--headless=new")
    options.set_capability("goog:loggingPrefs", {"browser": "ALL"})
    driver = webdriver.Chrome(options=options)

    print(f"Loading {html_path}...")
    driver.get(f"file:///{html_path}")

    # Wait for the Google Maps script to actually finish loading, instead
    # of a fixed sleep -- and surface any error if it never does.
    print("Waiting for Google Maps API to load...")
    loaded = False
    for _ in range(20):  # up to ~10 seconds
        is_ready = driver.execute_script(
            "return typeof google !== 'undefined' && typeof google.maps !== 'undefined';"
        )
        if is_ready:
            loaded = True
            break
        time.sleep(0.5)

    if not loaded:
        print("\nGoogle Maps API failed to load. Common causes:")
        print("  1. YOUR_API_KEY_HERE in streetview_graph.html was not replaced with a real key")
        print("  2. The API key doesn't have 'Maps JavaScript API' enabled")
        print("  3. Billing is not enabled on your Google Cloud project")
        print("\nBrowser console log (may show the actual error):")
        for entry in driver.get_log("browser"):
            print(f"  {entry['message']}")
        driver.quit()
        return

    print("Google Maps API loaded successfully.\n")

    print(f"Starting walk from ({start_lat}, {start_lng}) toward ({end_lat}, {end_lng})\n")

    visited = []
    visited_pano_ids = set()
    progress = 0  # index into `route` of the point we're currently nearest to
    reached = False

    driver.execute_script(f"lookupPano({start_lat}, {start_lng});")
    result = wait_for_result(driver)

    if not result or not result.get("success"):
        print(f"Failed to find a starting panorama: {result}")
        driver.quit()
        return

    step = 0
    while step < max_steps:
        pano_id = result["pano_id"]
        lat, lng = result["lat"], result["lng"]
        links = result["links"]

        if pano_id in visited_pano_ids:
            print(f"  Step {step}: revisited {pano_id[:12]}... -- stopping (loop detected)")
            break

        visited_pano_ids.add(pano_id)
        visited.append({"step": step, "pano_id": pano_id, "lat": lat, "lng": lng})

        progress = nearest_route_index(route, lat, lng, progress)
        off_route = haversine_meters(lat, lng, *route[progress])
        distance_to_goal = haversine_meters(lat, lng, end_lat, end_lng)
        print(f"  Step {step}: {pano_id[:12]}... at ({lat:.5f}, {lng:.5f}) "
              f"-- {distance_to_goal:.0f}m from destination, {off_route:.0f}m off route, "
              f"{len(links)} links available")

        if distance_to_goal < 20:
            print("\nReached destination (within 20m).")
            reached = True
            break

        if off_route > OFF_ROUTE_M:
            # ponytail: no backtracking; if this triggers often, try the other links instead of stopping
            print(f"  Drifted {off_route:.0f}m from the Directions route -- stopping.")
            break

        if not links:
            print("  No further links from this panorama -- dead end, stopping.")
            break

        # Aim at the route point ~30m ahead, not the final destination --
        # that's what keeps us on the real road instead of cutting through side streets.
        target_bearing = bearing(lat, lng, *lookahead_target(route, progress))
        # Sort ALL links by heading closeness to target, then try them
        # in order -- if the single best one would revisit an already-seen
        # panorama (a junction/bend the greedy choice can't escape), fall
        # back to the next-best option instead of giving up immediately.
        sorted_links = sorted(links, key=lambda link: heading_difference(link["heading"], target_bearing))

        next_link = None
        for candidate in sorted_links:
            if candidate["pano"] not in visited_pano_ids:
                next_link = candidate
                break

        if next_link is None:
            print(f"  Step {step}: all {len(links)} available links lead to "
                  f"already-visited panoramas -- true dead end, stopping.")
            break

        driver.execute_script(f"lookupPanoById('{next_link['pano']}');")
        result = wait_for_result(driver)

        if not result or not result.get("success"):
            print(f"  Failed to load next panorama: {result}")
            break

        step += 1

    driver.quit()

    output_path.parent.mkdir(parents=True, exist_ok=True)
    with open(output_path, "w") as f:
        json.dump(visited, f, indent=2)

    print(f"\nWalked {len(visited)} connected panoramas.")
    print(f"Saved to: {output_path}")
    # cached even if it stopped short -- the same walk would just stop at the
    # same place again; delete the cache file to force a re-walk
    walk_cache.parent.mkdir(parents=True, exist_ok=True)
    shutil.copy(output_path, walk_cache)
    print(f"Cached for next time: {walk_cache}" + ("" if reached else "  (walk did NOT reach destination)"))
    print()

    download_images()


if __name__ == "__main__":
    main()