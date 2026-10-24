"""
RoadGuard Backend API Server
Provides real-time alternative routes evaluation, YOLOv8 hazard detection,
personalized vehicle risk scoring, and static annotated image serving.

Run:
    python api_server.py

Flow:
    POST /api/analyze-routes  -> {"job_id": ...}   (work runs in a thread)
    GET  /api/jobs/{job_id}   -> {"status", "stage", "progress", "message", "result"|"error"}
"""

import os
import sys
import threading
import time
import uuid
from pathlib import Path
from typing import Optional

import uvicorn
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel
import cv2
import polyline

sys.path.append(str(Path(__file__).resolve().parent))
from get_alternative_routes import get_alternative_routes
from route_extraction_distance_sampling import sample_points_by_distance, haversine_meters
from image_collection.streetview_fetcher import build_pano_chain
from image_collection_retry import download_pano_chain_with_retries

sys.path.append(str(Path(__file__).resolve().parent / "hazard_detection"))
from src.hazard_detector import detect_hazards
from src.vehicle import get_vehicle, list_vehicles
from src import risk_engine

app = FastAPI(title="RoadGuard Backend API", version="2.1")

# Enable CORS for React frontend (Vite dev server)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Serve output directory with annotated images
BASE_DIR = Path(__file__).resolve().parent
output_dir_path = BASE_DIR / "output"
output_dir_path.mkdir(exist_ok=True)
app.mount("/output", StaticFiles(directory=str(output_dir_path)), name="output")

# ponytail: in-memory job table, lost on restart; move to redis if you run >1 worker
JOBS: dict[str, dict] = {}


class RouteRequest(BaseModel):
    origin: str
    destination: str
    vehicle: str = "Honda City"
    clearance_mm: Optional[float] = None  # frontend sends exact value; overrides CSV lookup
    meters: int = 10      # Street View panos sit ~10 m apart; this sees every one of them
    conf: float = 0.25
    merge_m: int = 25     # same-type detections closer than this (consecutive frames) are one hazard


@app.get("/api/status")
def status():
    return {"status": "online", "system": "RoadGuard AI Hazard Detection"}


@app.get("/api/vehicles")
def get_vehicles_endpoint():
    return list_vehicles()


@app.get("/api/config")
def config():
    """Browser needs the Maps key for the Google Maps JS map. Restrict this key by
    HTTP referrer in Google Cloud Console and enable 'Maps JavaScript API' on it."""
    return {"google_maps_key": os.getenv("GOOGLE_MAPS_API_KEY", "")}


def analyze_routes(req: RouteRequest, report) -> dict:
    """report(stage, message, progress_pct) is called as work advances.
    stage: 0 directions, 1 street view, 2 yolo, 3 scoring."""
    t_start = time.time()

    vehicle_dict = get_vehicle(req.vehicle) or {"vehicle": req.vehicle, "ground_clearance_mm": 165}
    if req.clearance_mm:
        vehicle_dict = {**vehicle_dict, "vehicle": req.vehicle, "ground_clearance_mm": req.clearance_mm}
    clearance_cm = vehicle_dict["ground_clearance_mm"] / 10

    report(0, "Fetching driving routes from Google Directions...", 2)
    try:
        raw_routes = get_alternative_routes(req.origin, req.destination)
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Failed to fetch routes: {str(e)}")

    if not raw_routes:
        raise HTTPException(status_code=404, detail="No driving routes found between these locations.")

    n_routes = len(raw_routes)
    evaluated_routes = []

    for i, r in enumerate(raw_routes):
        route_tag = f"Route {i + 1}/{n_routes}"
        # each route owns an equal slice of 5..95 %
        slice_start = 5 + (90 * i) / n_routes
        slice_len = 90 / n_routes

        # full-detail step geometry (not the simplified overview) so 10 m samples stay on the road
        route_points = r.get("points") or polyline.decode(r["polyline"])
        route_polyline = [[round(lat, 5), round(lng, 5)] for lat, lng in route_points]

        waypoints = sample_points_by_distance(route_points, meters=req.meters)
        waypoints_as_dicts = [{"lat": lat, "lng": lng} for lat, lng in waypoints]

        report(1, f"{route_tag} · locating panoramas at {len(waypoints)} points...", slice_start)
        # radius 30: with 10 m sampling a pano is always within reach if the road has coverage,
        # and a small radius stops snapping onto a parallel street
        pano_chain = build_pano_chain(waypoints_as_dicts, radius=30)

        images_dir = f"output/route_{i}_images"
        images = download_pano_chain_with_retries(
            pano_chain, output_dir=images_dir,
            on_progress=lambda k, n: report(
                1, f"{route_tag} · downloading frame {k}/{n}",
                slice_start + slice_len * 0.45 * (k / max(n, 1))),
        )

        hazard_output_dir = Path(f"output/route_{i}_hazards")
        (hazard_output_dir / "potholes").mkdir(parents=True, exist_ok=True)
        (hazard_output_dir / "speedbreakers").mkdir(parents=True, exist_ok=True)

        hazards_list = []
        risk_scores = []
        pothole_count = 0
        speedbreaker_count = 0

        for img_idx, img in enumerate(images):
            report(2, f"{route_tag} · YOLOv8 scanning frame {img_idx + 1}/{len(images)}",
                   slice_start + slice_len * (0.45 + 0.5 * (img_idx + 1) / max(len(images), 1)))

            image_path = img.get("image")
            if not image_path or not os.path.exists(image_path):
                continue

            wp_lat = img.get("lat")
            wp_lng = img.get("lng")
            offset_km = round(r["distance_km"] * (img_idx + 1) / (len(images) + 1), 2)

            cv_img = cv2.imread(image_path)
            if cv_img is None:
                continue

            detections = detect_hazards(image_path, conf_threshold=req.conf)
            # Camera pitch is -10°, so the horizon sits ~32% down the frame; a box whose
            # centre is in the top 40% is a roof, tree or sky, not road surface.
            road_y = 0.40 * cv_img.shape[0]
            detections = [d for d in detections if (d["bbox"][1] + d["bbox"][3]) / 2 >= road_y]
            if not detections:
                continue

            # One annotated frame per image with EVERY box drawn, saved under each
            # hazard-type folder it belongs to (a frame can hold a pothole and a hump).
            out_name = Path(image_path).name
            frame_dirs = set()

            for det in detections:
                h_type = det["hazard_type"]
                conf = det["confidence"]

                base_risk = risk_engine.combined_risk_score(conf, conf)
                final_risk = risk_engine.personalized_risk(base_risk, clearance_cm)
                risk_scores.append(final_risk)

                if h_type == "pothole":
                    pothole_count += 1
                else:
                    speedbreaker_count += 1

                sub_dir = "potholes" if h_type == "pothole" else "speedbreakers"
                frame_dirs.add(sub_dir)

                x1, y1, x2, y2 = map(int, det["bbox"])
                color = (0, 0, 255) if h_type == "pothole" else (0, 165, 255)
                cv2.rectangle(cv_img, (x1, y1), (x2, y2), color, 3)
                r_class = risk_engine.risk_class(final_risk)
                label = f"{h_type.upper()} - {r_class} ({final_risk:.2f})"
                (tw, _), _ = cv2.getTextSize(label, cv2.FONT_HERSHEY_SIMPLEX, 0.7, 2)
                tx = max(0, min(x1, cv_img.shape[1] - tw - 4))  # keep label inside frame
                cv2.putText(cv_img, label, (tx, max(y1 - 10, 20)),
                            cv2.FONT_HERSHEY_SIMPLEX, 0.7, color, 2)

                sev = "Low"
                if final_risk >= 0.27:
                    sev = "High"
                elif final_risk >= 0.24:
                    sev = "Medium"

                hazards_list.append({
                    "id": f"haz_r{i}_{len(hazards_list)+1}",
                    "type": "Pothole" if h_type == "pothole" else "Speed Breaker",
                    "category": h_type,
                    "severity": sev,
                    "confidence": int(conf * 100),
                    "baseRisk": int(base_risk * 100),
                    "adjustedRisk": int(final_risk * 280),  # Scaled to 0-100 gauge
                    "locationOffsetKm": offset_km,
                    "coords": [wp_lat, wp_lng],
                    "bbox": det["bbox"],
                    "imageUrl": f"/output/route_{i}_hazards/{sub_dir}/{out_name}",
                    "description": f"{h_type.capitalize()} detected at {int(conf*100)}% confidence."
                })

            for sub_dir in frame_dirs:
                cv2.imwrite(str(hazard_output_dir / sub_dir / out_name), cv_img)

        hazards_list = merge_sightings(hazards_list, req.merge_m)
        risk_scores = [h["adjustedRisk"] / 280 for h in hazards_list]
        pothole_count = sum(h["category"] == "pothole" for h in hazards_list)
        speedbreaker_count = len(hazards_list) - pothole_count

        avg_risk = sum(risk_scores) / len(risk_scores) if risk_scores else 0.0
        max_risk = max(risk_scores) if risk_scores else 0.0
        overall_score = min(98, max(15, int(avg_risk * 280 + len(hazards_list) * 2)))
        risk_level = "High Risk" if overall_score >= 70 else ("Medium Risk" if overall_score >= 45 else "Low Risk")

        evaluated_routes.append({
            "route_index": i,
            "summary": r.get("summary") or f"Route {i+1}",
            "distance_km": round(r["distance_km"], 2),
            "duration_min": round(r["duration_min"]),
            "frames_scanned": len(images),
            "hazard_count": len(hazards_list),
            "pothole_count": pothole_count,
            "speed_breaker_count": speedbreaker_count,
            "avg_risk": round(avg_risk, 3),
            "max_risk": round(max_risk, 3),
            "overall_score": overall_score,
            "risk_level": risk_level,
            "start_coord": route_polyline[0],
            "end_coord": route_polyline[-1],
            "polyline": route_polyline,
            "hazards": hazards_list
        })

    report(3, "Scoring routes for your vehicle...", 96)
    best_route = min(evaluated_routes, key=lambda x: (x["avg_risk"], x["hazard_count"]))
    for r in evaluated_routes:
        r["is_recommended"] = (r["route_index"] == best_route["route_index"])

    return {
        "origin": req.origin,
        "destination": req.destination,
        "origin_address": raw_routes[0].get("start_address", ""),
        "destination_address": raw_routes[0].get("end_address", ""),
        "vehicle": vehicle_dict,
        "recommended_route_index": best_route["route_index"],
        "analysis_time_sec": round(time.time() - t_start, 1),
        "routes": evaluated_routes
    }


def merge_sightings(hazards: list[dict], merge_m: float) -> list[dict]:
    """With 10 m frame spacing the same pothole is seen in 2-3 consecutive frames,
    each tagged with its own camera position. Collapse same-type detections within
    merge_m of each other into one hazard (best-confidence sighting wins, and the
    sighting count is kept -- a hazard seen 3 times is more credible than one seen once).
    ponytail: coords are the camera, not the hazard; project from bbox if precision matters."""
    merged: list[dict] = []
    for h in hazards:  # already in route order
        for m in merged:
            if m["category"] == h["category"] and                haversine_meters(m["coords"][0], m["coords"][1], h["coords"][0], h["coords"][1]) <= merge_m:
                if h["confidence"] > m["confidence"]:
                    h["sightings"] = m["sightings"] + 1
                    merged[merged.index(m)] = h
                else:
                    m["sightings"] += 1
                break
        else:
            h["sightings"] = 1
            merged.append(h)
    for n, h in enumerate(merged, 1):
        h["id"] = h["id"].rsplit("_", 1)[0] + f"_{n}"
        if h["sightings"] > 1:
            h["description"] += f" Seen in {h['sightings']} consecutive frames."
    return merged


def _run_job(job_id: str, req: RouteRequest):
    job = JOBS[job_id]

    def report(stage, message, progress):
        job.update(stage=stage, message=message, progress=round(progress))
        print(f"[{job_id}] {progress:5.1f}% {message}")

    try:
        job["result"] = analyze_routes(req, report)
        job.update(status="done", progress=100, message="Analysis complete")
    except HTTPException as e:
        job.update(status="error", error=e.detail)
    except Exception as e:
        job.update(status="error", error=str(e))


@app.post("/api/analyze-routes")
def analyze_routes_endpoint(req: RouteRequest):
    job_id = uuid.uuid4().hex[:12]
    JOBS[job_id] = {"status": "running", "stage": 0, "progress": 0,
                    "message": "Queued", "started": time.time()}
    threading.Thread(target=_run_job, args=(job_id, req), daemon=True).start()
    return {"job_id": job_id}


@app.get("/api/jobs/{job_id}")
def job_status(job_id: str):
    job = JOBS.get(job_id)
    if not job:
        raise HTTPException(status_code=404, detail="Unknown job id")
    return job


# Production: serve the built React app from the same server (npm run build in frontend/)
frontend_dist = BASE_DIR / "frontend" / "dist"
if frontend_dist.exists():
    app.mount("/", StaticFiles(directory=str(frontend_dist), html=True), name="frontend")


if __name__ == "__main__":
    print("Starting RoadGuard API server on http://localhost:8000...")
    uvicorn.run(app, host="0.0.0.0", port=int(os.getenv("PORT", "8000")))
