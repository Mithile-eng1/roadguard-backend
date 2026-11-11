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

import base64
import csv
import hashlib
import io
import hmac
import json
import os
import re
import secrets
import smtplib
from email.message import EmailMessage
import sys
import threading
import time
import uuid
import zipfile
from pathlib import Path
from typing import Optional

import uvicorn
from fastapi import FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import Response
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
from src import config as hz_config, risk_engine

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
    refresh: bool = False  # True = ignore the stored result and re-run the detector


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


# ---- Accounts: email + password, scrypt hashes, HMAC-signed 30-day tokens (stdlib only) ----
# Accounts, reports and photos live here. In Docker point ROADGUARD_DATA at a mounted volume so
# they survive a container restart (the image itself is replaced on every deploy).
DATA_DIR = Path(os.getenv("ROADGUARD_DATA", BASE_DIR / "data"))
USERS_FILE = DATA_DIR / "users.json"
USERS_LOCK = threading.Lock()  # ponytail: JSON file + lock; move to sqlite/postgres for real traffic
FAILS: dict[str, list] = {}    # email -> [count, first_ts]; 5 bad logins per 5 min


def _secret() -> bytes:
    if os.getenv("ROADGUARD_SECRET"):
        return os.environ["ROADGUARD_SECRET"].encode()
    f = DATA_DIR / "auth_secret.key"
    f.parent.mkdir(parents=True, exist_ok=True)
    if not f.exists():
        f.write_text(secrets.token_hex(32))
    return f.read_text().strip().encode()


AUTH_SECRET = _secret()


def _hash(pw: str, salt: bytes) -> str:
    return hashlib.scrypt(pw.encode(), salt=salt, n=2 ** 14, r=8, p=1).hex()


def _atomic_write(path: Path, text: str) -> None:
    """Write to a temp file, then rename over the target, so a request that reads at the same
    moment sees the old file or the new one, never a half-written one."""
    tmp = path.with_name(path.name + ".tmp")
    tmp.write_text(text, encoding="utf-8")
    for _ in range(50):
        try:
            os.replace(tmp, path)
            return
        except PermissionError:  # Windows: a reader has the file open for a few ms
            time.sleep(0.01)
    os.replace(tmp, path)


def _read_json(path: Path, default):
    for _ in range(10):
        try:
            return json.loads(path.read_text(encoding="utf-8"))
        except FileNotFoundError:
            return default
        except (PermissionError, ValueError):  # being replaced right now: try again
            time.sleep(0.01)
    return default


def _users() -> dict:
    return _read_json(USERS_FILE, {})


def _sign(body: str) -> str:
    return hmac.new(AUTH_SECRET, body.encode(), hashlib.sha256).hexdigest()


def make_token(email: str) -> str:
    body = base64.urlsafe_b64encode(json.dumps({"e": email, "x": int(time.time()) + 30 * 86400}).encode()).decode()
    return f"{body}.{_sign(body)}"


def current_user(request: Request) -> str:
    """Email from a valid Bearer token, else 401."""
    try:
        body, sig = request.headers.get("authorization", "").removeprefix("Bearer ").split(".")
        data = json.loads(base64.urlsafe_b64decode(body))
        if hmac.compare_digest(sig, _sign(body)) and data["x"] > time.time() and data["e"] in _users():
            return data["e"]
    except (ValueError, KeyError):
        pass
    raise HTTPException(401, "Please log in")


class Signup(BaseModel):
    name: str
    email: str
    password: str


class Login(BaseModel):
    email: str
    password: str


@app.post("/api/signup")
def signup(b: Signup):
    email, name = b.email.strip().lower(), b.name.strip()[:50]
    if not re.fullmatch(r"[^@\s]+@[^@\s]+\.[^@\s]+", email) or not name:
        raise HTTPException(400, "Enter your name and a valid email")
    if len(b.password) < 8:
        raise HTTPException(400, "Password must be at least 8 characters")
    salt = secrets.token_bytes(16)
    with USERS_LOCK:
        users = _users()
        if email in users:
            raise HTTPException(409, "An account with this email already exists")
        users[email] = {"name": name, "salt": salt.hex(), "hash": _hash(b.password, salt), "verified": False}
        USERS_FILE.parent.mkdir(parents=True, exist_ok=True)
        _atomic_write(USERS_FILE, json.dumps(users))
    send_verification(email)
    return {"token": make_token(email), "name": name}


@app.post("/api/login")
def login(b: Login):
    email = b.email.strip().lower()
    n, t0 = FAILS.get(email, [0, time.time()])
    if time.time() - t0 > 300:
        n, t0 = 0, time.time()
    if n >= 5:
        raise HTTPException(429, "Too many attempts, try again in a few minutes")
    u = _users().get(email)
    ok = bool(u) and hmac.compare_digest(_hash(b.password, bytes.fromhex(u["salt"])), u["hash"])
    if not ok:
        FAILS[email] = [n + 1, t0]
        raise HTTPException(401, "Wrong email or password")
    FAILS.pop(email, None)
    return {"token": make_token(email), "name": u["name"]}


# ---- Password reset by email. Stateless 1 h token bound to the current password hash, so it
# dies as soon as it is used. Mail: set SMTP_HOST, SMTP_USER, SMTP_PASS (+ optional SMTP_PORT,
# SMTP_FROM) and APP_URL (where the React app lives). Unset = the link is printed to this console.
APP_URL = os.getenv("APP_URL", "http://localhost:5173").rstrip("/")
_LAST_FORGOT: dict[str, float] = {}


def make_reset_token(email: str, pw_hash: str) -> str:
    body = base64.urlsafe_b64encode(json.dumps({"e": email, "x": int(time.time()) + 3600, "f": pw_hash[:16]}).encode()).decode()
    return f"{body}.{_sign('reset.' + body)}"


def send_mail(email: str, subject: str, text: str, link: str) -> None:
    if not os.getenv("SMTP_HOST"):
        print(f"[mail] SMTP not configured. '{subject}' link for {email}: {link}", flush=True)
        return
    msg = EmailMessage()
    msg["Subject"] = subject
    msg["From"] = os.getenv("SMTP_FROM") or os.environ["SMTP_USER"]
    msg["To"] = email
    msg.set_content(f"{text}\n\n{link}\n\nIf you did not ask for this, ignore this email.")
    try:
        with smtplib.SMTP(os.environ["SMTP_HOST"], int(os.getenv("SMTP_PORT", "587")), timeout=15) as srv:
            srv.starttls()
            srv.login(os.environ["SMTP_USER"], os.environ["SMTP_PASS"])
            srv.send_message(msg)
    except Exception as e:  # runs in a thread: log, never crash the request
        print(f"[mail] sending failed: {e!r}", flush=True)


class Forgot(BaseModel):
    email: str


class Reset(BaseModel):
    token: str
    password: str


@app.post("/api/forgot")
def forgot(b: Forgot):
    """Same answer whether or not the email exists, so it can't be used to probe accounts."""
    email = b.email.strip().lower()
    u = _users().get(email)
    if u and time.time() - _LAST_FORGOT.get(email, 0) > 60:
        _LAST_FORGOT[email] = time.time()
        link = f"{APP_URL}/?reset={make_reset_token(email, u['hash'])}"
        threading.Thread(target=send_mail, args=(email, "Reset your RoadGuard password",
                         "Use this link to choose a new password (valid for 1 hour):", link), daemon=True).start()
    return {"ok": True, "message": "If that email has an account, a reset link is on its way."}


@app.post("/api/reset")
def reset(b: Reset):
    if len(b.password) < 8:
        raise HTTPException(400, "Password must be at least 8 characters")
    try:
        body, sig = b.token.split(".")
        data = json.loads(base64.urlsafe_b64decode(body))
        valid = hmac.compare_digest(sig, _sign("reset." + body)) and data["x"] > time.time()
    except (ValueError, KeyError):
        valid = False
    with USERS_LOCK:
        users = _users()
        u = users.get(data["e"]) if valid else None
        if not u or u["hash"][:16] != data["f"]:
            raise HTTPException(400, "This reset link is invalid or has expired")
        salt = secrets.token_bytes(16)
        u.update(salt=salt.hex(), hash=_hash(b.password, salt))
        _atomic_write(USERS_FILE, json.dumps(users))
    FAILS.pop(data["e"], None)
    return {"ok": True}


# ---- Email verification: a verified email is required to report or vote, which makes
# fake "3 different users" confirmations cost real mailboxes. Accounts made before this
# existed have no "verified" key and count as verified. ----
ADMINS = {e.strip().lower() for e in os.getenv("ADMIN_EMAILS", "").split(",") if e.strip()}
_LAST_VERIFY: dict[str, float] = {}


def send_verification(email: str) -> None:
    body = base64.urlsafe_b64encode(json.dumps({"e": email, "x": int(time.time()) + 3 * 86400}).encode()).decode()
    link = f"{APP_URL}/?verify={body}.{_sign('verify.' + body)}"
    threading.Thread(target=send_mail, args=(email, "Verify your RoadGuard email",
                     "Confirm your email so you can report road hazards (valid for 3 days):", link), daemon=True).start()


class Token(BaseModel):
    token: str


@app.post("/api/verify")
def verify(b: Token):
    try:
        body, sig = b.token.split(".")
        data = json.loads(base64.urlsafe_b64decode(body))
        valid = hmac.compare_digest(sig, _sign("verify." + body)) and data["x"] > time.time()
    except (ValueError, KeyError):
        valid = False
    with USERS_LOCK:
        users = _users()
        if not valid or data["e"] not in users:
            raise HTTPException(400, "This verification link is invalid or has expired")
        users[data["e"]]["verified"] = True
        _atomic_write(USERS_FILE, json.dumps(users))
    return {"ok": True}


@app.post("/api/resend-verification")
def resend_verification(request: Request):
    email = current_user(request)
    if _users()[email].get("verified", True):
        return {"ok": True, "message": "Your email is already verified"}
    if time.time() - _LAST_VERIFY.get(email, 0) < 60:
        raise HTTPException(429, "Please wait a minute before asking again")
    _LAST_VERIFY[email] = time.time()
    send_verification(email)
    return {"ok": True, "message": "Verification email sent"}


@app.get("/api/me")
def me(request: Request):
    email = current_user(request)
    u = _users()[email]
    return {"name": u["name"], "email": email, "verified": u.get("verified", True), "isAdmin": email in ADMINS}


def require_verified(request: Request) -> str:
    email = current_user(request)
    u = _users()[email]
    if u.get("banned"):
        raise HTTPException(403, "Your account has been blocked")
    if not u.get("verified", True):
        raise HTTPException(403, "Verify your email first (check your inbox)")
    return email


def require_admin(request: Request) -> str:
    email = current_user(request)
    if email not in ADMINS:
        raise HTTPException(403, "Admins only")
    return email


def uid_of(email: str) -> str:
    return _sign(email)[:10]


# ---- Crowdsourced hazard reports: verified users, stored in one JSON file. status "present"
# = I see this hazard, "gone" = it has been fixed. Reports expire after REPORT_TTL_DAYS. ----
REPORTS_FILE = DATA_DIR / "crowd_reports.json"
REPORTS_LOCK = threading.Lock()  # ponytail: JSON file + lock; move to sqlite if reports pass ~10k
_LAST_REPORT: dict[str, float] = {}  # email -> time, crude spam brake
REPORT_TTL_DAYS = int(os.getenv("REPORT_TTL_DAYS", "60"))
PHOTO_DIR = DATA_DIR / "report_photos"
PHOTO_DIR.mkdir(parents=True, exist_ok=True)
app.mount("/report-photos", StaticFiles(directory=str(PHOTO_DIR)), name="report-photos")


class HazardReport(BaseModel):
    lat: float
    lng: float
    category: str  # pothole | speedbreaker
    note: str = ""
    status: str = "present"  # present | gone
    photo: str = ""  # optional JPEG as base64 (the app shrinks it first)


def _load_reports() -> list:
    return _read_json(REPORTS_FILE, [])


def _save_reports(reports: list) -> None:
    REPORTS_FILE.parent.mkdir(parents=True, exist_ok=True)
    _atomic_write(REPORTS_FILE, json.dumps(reports))


def _save_photo(rid: str, data: str) -> str:
    try:
        raw = base64.b64decode(data.split(",", 1)[-1], validate=True)
    except ValueError:
        raise HTTPException(400, "Bad photo")
    if len(raw) > 500_000 or not raw.startswith(b"\xff\xd8\xff"):  # JPEG only, 500 KB max
        raise HTTPException(400, "Photo must be a JPEG under 500 KB")
    (PHOTO_DIR / f"{rid}.jpg").write_bytes(raw)
    return f"/report-photos/{rid}.jpg"


@app.get("/api/reports")
def list_reports():
    """Public list: fresh reports from accounts that are not blocked."""
    banned = {uid_of(e) for e, u in _users().items() if u.get("banned")}
    cutoff = time.time() - REPORT_TTL_DAYS * 86400
    return [r for r in _load_reports() if r["ts"] >= cutoff and r.get("uid") not in banned]


@app.post("/api/reports")
def add_report(r: HazardReport, request: Request):
    if not (-90 <= r.lat <= 90 and -180 <= r.lng <= 180) or r.category not in ("pothole", "speedbreaker") \
            or r.status not in ("present", "gone"):
        raise HTTPException(400, "Invalid report")
    email = require_verified(request)
    if time.time() - _LAST_REPORT.get(email, 0) < 10:
        raise HTTPException(429, "Please wait a few seconds between reports")
    _LAST_REPORT[email] = time.time()
    rid = uuid.uuid4().hex[:10]
    rep = {"id": rid, "uid": uid_of(email), "lat": r.lat, "lng": r.lng, "category": r.category,
           "status": r.status, "note": r.note.strip()[:200], "ts": int(time.time()),
           "photo": _save_photo(rid, r.photo) if r.photo else ""}
    with REPORTS_LOCK:
        reports = _load_reports()
        reports.append(rep)
        _save_reports(reports)
    return rep


@app.get("/api/my-reports")
def my_reports(request: Request):
    uid = uid_of(current_user(request))
    return [r for r in _load_reports() if r.get("uid") == uid]


@app.delete("/api/reports/{rid}")
def delete_report(rid: str, request: Request):
    email = current_user(request)
    with REPORTS_LOCK:
        reports = _load_reports()
        rep = next((r for r in reports if r["id"] == rid), None)
        if not rep:
            raise HTTPException(404, "Report not found")
        if rep.get("uid") != uid_of(email) and email not in ADMINS:
            raise HTTPException(403, "You can only delete your own reports")
        _save_reports([r for r in reports if r["id"] != rid])
    if rep.get("photo"):
        (PHOTO_DIR / f"{rid}.jpg").unlink(missing_ok=True)
    return {"ok": True}


# ---- Admin (accounts listed in ADMIN_EMAILS) ----
@app.get("/api/admin/reports")
def admin_reports(request: Request):
    require_admin(request)
    who = {uid_of(e): e for e in _users()}
    return [{**r, "email": who.get(r.get("uid"), "(deleted user)")} for r in _load_reports()]


# ---- Held-out test set built from drivers' confirmed reports. A person must approve each photo's
# label before it can leave in the export; unreviewed photos are never exported. ----
EVAL_FILE = DATA_DIR / "eval_review.json"
EVAL_LOCK = threading.Lock()


class EvalReview(BaseModel):
    id: str
    status: str  # approved | rejected | pending
    category: str
    lat: float
    lng: float
    photo: str = ""
    count: int = 0


@app.get("/api/admin/eval")
def admin_eval(request: Request):
    require_admin(request)
    return _read_json(EVAL_FILE, {})


@app.post("/api/admin/eval")
def admin_eval_set(b: EvalReview, request: Request):
    email = require_admin(request)
    if b.status not in ("approved", "rejected", "pending") or b.category not in ("pothole", "speedbreaker") \
            or not (-90 <= b.lat <= 90 and -180 <= b.lng <= 180) or not re.fullmatch(r"[0-9a-f]{1,32}", b.id):
        raise HTTPException(400, "Invalid review")
    if not re.fullmatch(r"/report-photos/[0-9a-f]{10}\.jpg", b.photo) or not (PHOTO_DIR / b.photo.rsplit("/", 1)[1]).exists():
        raise HTTPException(400, "A review needs the photo of an existing report")
    with EVAL_LOCK:
        reviews = _read_json(EVAL_FILE, {})
        reviews[b.id] = {"status": b.status, "category": b.category, "lat": b.lat, "lng": b.lng, "photo": b.photo,
                         "count": b.count, "reviewer": uid_of(email), "ts": int(time.time())}
        _atomic_write(EVAL_FILE, json.dumps(reviews))
    return {"ok": True}


@app.get("/api/admin/eval/export")
def admin_eval_export(request: Request):
    """Zip of the APPROVED photos plus labels.csv, ready to use as a held-out real-world test set."""
    require_admin(request)
    approved = {k: v for k, v in _read_json(EVAL_FILE, {}).items() if v.get("status") == "approved"}
    buf = io.BytesIO()
    with zipfile.ZipFile(buf, "w", zipfile.ZIP_DEFLATED) as z:
        out = io.StringIO()
        w = csv.writer(out)
        w.writerow(["image", "label", "lat", "lng", "confirmed_by_users"])
        for k, v in approved.items():
            f = PHOTO_DIR / v["photo"].rsplit("/", 1)[1]
            if not f.exists():
                continue
            z.write(f, f"images/{k}.jpg")
            w.writerow([f"images/{k}.jpg", v["category"], v["lat"], v["lng"], v["count"]])
        z.writestr("labels.csv", out.getvalue())
    return Response(buf.getvalue(), media_type="application/zip",
                    headers={"Content-Disposition": 'attachment; filename="roadguard_eval_set.zip"'})


@app.get("/api/admin/users")
def admin_users(request: Request):
    require_admin(request)
    counts: dict[str, int] = {}
    for r in _load_reports():
        counts[r.get("uid")] = counts.get(r.get("uid"), 0) + 1
    return [{"email": e, "name": u["name"], "verified": u.get("verified", True), "banned": bool(u.get("banned")),
             "isAdmin": e in ADMINS, "reports": counts.get(uid_of(e), 0)} for e, u in _users().items()]


class Ban(BaseModel):
    email: str
    banned: bool


@app.post("/api/admin/ban")
def admin_ban(b: Ban, request: Request):
    require_admin(request)
    email = b.email.strip().lower()
    if email in ADMINS:
        raise HTTPException(400, "Admins cannot be blocked")
    with USERS_LOCK:
        users = _users()
        if email not in users:
            raise HTTPException(404, "No such user")
        users[email]["banned"] = b.banned
        _atomic_write(USERS_FILE, json.dumps(users))
    return {"ok": True}


def cache_key(req: RouteRequest) -> str:
    """Same places + sampling + conf + model weights = same result. Vehicle is not part of it:
    the frontend rescales risk per vehicle from baseRisk."""
    w = [hz_config.POTHOLE_WEIGHTS, hz_config.SPEEDBREAKER_WEIGHTS]
    parts = [req.origin.strip().lower(), req.destination.strip().lower(), req.meters, req.conf,
             *(int(Path(x).stat().st_mtime) if Path(x).exists() else 0 for x in w)]
    return hashlib.sha1(json.dumps(parts).encode()).hexdigest()[:16]


def analyze_routes(req: RouteRequest, report, key: str) -> dict:
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
        gaps: list[int] = []
        pano_chain = build_pano_chain(waypoints_as_dicts, radius=30, gaps=gaps)
        unscanned = unscanned_stretches(gaps, waypoints, req.meters)
        scanned_pct = round(100 * (1 - len(gaps) / max(len(waypoints), 1)))

        images_dir = f"output/{key}/route_{i}_images"
        images = download_pano_chain_with_retries(
            pano_chain, output_dir=images_dir,
            on_progress=lambda k, n: report(
                1, f"{route_tag} · downloading frame {k}/{n}",
                slice_start + slice_len * 0.45 * (k / max(n, 1))),
        )

        hazard_output_dir = Path(f"output/{key}/route_{i}_hazards")
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
            # real position: waypoints are `meters` apart from the start (old formula spread frames evenly,
            # which drifts when some stretches have no coverage)
            if img.get("waypoint_index"):
                offset_km = round(min(r["distance_km"], (img["waypoint_index"] - 1) * req.meters / 1000), 2)
            else:
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
                    "capturedAt": img.get("date"),
                    "bbox": det["bbox"],
                    "imageUrl": f"/output/{key}/route_{i}_hazards/{sub_dir}/{out_name}",
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
            "scanned_pct": scanned_pct,
            "unscanned": unscanned,
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
            "steps": r.get("steps", []),
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


def unscanned_stretches(gaps: list[int], waypoints: list, meters: int, min_run: int = 3) -> list[dict]:
    """Runs of at least min_run consecutive waypoints (one every `meters` m) that have no Street View
    panorama. Short single misses are ignored. Each stretch carries its own path for drawing."""
    runs: list[list[int]] = []
    for i in sorted(gaps):
        if runs and i == runs[-1][-1] + 1:
            runs[-1].append(i)
        else:
            runs.append([i])
    out = []
    for run in runs:
        if len(run) < min_run:
            continue
        a, b = max(run[0] - 1, 0), min(run[-1] + 1, len(waypoints) - 1)
        out.append({"from_km": round(a * meters / 1000, 2), "to_km": round(b * meters / 1000, 2),
                    "path": [[round(lat, 5), round(lng, 5)] for lat, lng in waypoints[a:b + 1]]})
    return out


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

    key = cache_key(req)
    saved = output_dir_path / key / "result.json"
    try:
        if saved.exists() and not req.refresh:
            cached = json.loads(saved.read_text(encoding="utf-8"))
            if any("steps" not in r for r in cached["routes"]):  # saved before directions existed: one cheap Directions call
                try:
                    fresh = get_alternative_routes(req.origin, req.destination)
                    for r in cached["routes"]:
                        r["steps"] = fresh[r["route_index"]]["steps"] if r["route_index"] < len(fresh) else []
                    saved.write_text(json.dumps(cached), encoding="utf-8")
                except Exception:
                    pass  # directions are optional; the saved analysis still loads
            job["result"] = {**cached, "cached": True}
            job.update(status="done", progress=100, message="Loaded saved result")
            return
        result = analyze_routes(req, report, key)
        saved.parent.mkdir(parents=True, exist_ok=True)
        saved.write_text(json.dumps(result), encoding="utf-8")  # ponytail: local disk (mount a volume); Azure Blob if you need multi-VM
        job["result"] = result
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
frontend_dist = BASE_DIR / "web" if (BASE_DIR / "web").exists() else BASE_DIR / "frontend" / "dist"
if frontend_dist.exists():
    app.mount("/", StaticFiles(directory=str(frontend_dist), html=True), name="frontend")


if __name__ == "__main__":
    print("Starting RoadGuard API server on http://localhost:8000...")
    uvicorn.run(app, host="0.0.0.0", port=int(os.getenv("PORT", "8000")))
