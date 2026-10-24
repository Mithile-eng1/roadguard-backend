# RoadGuard Frontend

React + Vite + Leaflet UI for the RoadGuard hazard pipeline (`../api_server.py`).

## Run (development)

```bash
# terminal 1 — backend (needs GOOGLE_MAPS_API_KEY in ../.env)
cd .. && python api_server.py            # http://localhost:8000

# terminal 2 — frontend
npm install
npm run dev                              # http://localhost:5173  (proxies /api and /output to :8000)
```

## Run (single server, production build)

```bash
npm run build                            # writes dist/
cd .. && python api_server.py            # serves dist/ at http://localhost:8000
```

## Google Maps

The map is the real Google Maps JS API (`@vis.gl/react-google-maps`): Map/Satellite, Street View pegman, native dark mode.
The browser gets the key from the backend's `GET /api/config` (same `GOOGLE_MAPS_API_KEY` as `../.env`), or from
`VITE_GOOGLE_MAPS_API_KEY` in `frontend/.env` if you prefer a separate browser key. In Google Cloud Console the key
needs **Maps JavaScript API** enabled, and should be restricted by HTTP referrer (e.g. `localhost:5173/*`, your domain)
since it is visible in the browser.

## How it connects

- `POST /api/analyze-routes` starts a job; the UI polls `GET /api/jobs/{id}` every 1.5 s and shows the backend's live stage/progress.
- **Select origin & destination on map** (under the Analyze button) opens a picker: click once for start, once for destination, drag pins to adjust, or use browser geolocation for the start. It fills the fields with `lat,lng`, which Directions accepts directly; the results show Google's resolved address for those points.
- Vehicle ground clearance is sent to the backend (`clearance_mm`) and also applied client-side, so switching vehicle re-scores instantly without re-analysing.
- **Settings** (gear / status chip): backend URL and a Live ↔ Demo toggle. Demo mode uses OSRM routing with dataset sample frames and needs no backend.
- History and settings persist in `localStorage`. **Share** copies a link with `?from=&to=&vehicle=` that prefills the planner.
- Hazard images come from the backend's `/output/route_N_hazards/...` (annotated by the detector). Sample images for the first-load example live in `public/samples/`.
