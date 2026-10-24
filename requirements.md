# Requirements Specification
## Ground-Clearance-Aware Navigation System

**Project:** ground-clearance-nav  
**Version:** 1.0  
**Date:** 2026-03-25  

---

## 1. Problem Statement

Existing navigation systems (e.g., Google Maps) optimize routes for distance or time but ignore road surface conditions such as potholes, speed breakers, and elevation changes. This causes underbody damage and suspension wear for low ground-clearance vehicles. This system addresses **routing optimization under vehicle clearance constraints using road condition intelligence**.

---

## 2. Stakeholders

| Stakeholder | Role |
|---|---|
| End User | Driver of a low ground-clearance vehicle |
| Vehicle Owner | Provides vehicle specifications |

---

## 3. Functional Requirements

### FR-01 — Route Extraction
- The system shall accept a source and destination as input.
- The system shall retrieve candidate routes using the Google Maps Directions API.
- The system shall decode the route polyline and divide it into segments of approximately 10 metres each (one per Street View panorama).
- Each segment shall be stored with a unique ID and its start/end coordinates.

### FR-02 — Road Image Collection
- The system shall fetch a Google Street View image for each route segment using its midpoint coordinates.
- The system shall preprocess each image (resize to 640×480, normalize pixel values, apply noise reduction and contrast enhancement).

### FR-03 — Obstacle Detection
- The system shall detect potholes and speed breakers in road images using a YOLOv8-based object detector.
- For each detected obstacle, the system shall crop the bounding-box region and estimate its relative depth using the MiDaS depth estimation model.
- The system shall combine detection confidence and relative depth into an obstacle severity score (Low / Medium / High).

### FR-04 — Risk Scoring
- The system shall accept vehicle ground clearance (in mm) as input, either from a preset vehicle list or manual user entry.
- The system shall compute a risk score for each segment based on obstacle severity relative to vehicle clearance.
- Risk levels shall be defined as:
  - **Low:** No significant obstacles detected, or obstacle height well within clearance.
  - **Medium:** Obstacle detected; relative depth suggests moderate risk.
  - **High:** Obstacle depth exceeds estimated safe threshold for given clearance.

### FR-05 — Route Optimization
- The system shall construct a weighted graph where nodes are segment endpoints and edge weights combine distance and risk score.
- The cost function shall be: `Cost = Distance + α × Risk_Score` where α is a configurable weight parameter.
- The system shall apply a modified A* algorithm to find the path with minimum total cost.
- The system shall output the safest route and at least one alternative route.

### FR-06 — Output & Visualization
- The system shall display the recommended route on an interactive map with colour-coded risk overlays (green / yellow / red).
- The system shall show total route distance, estimated travel time, and overall risk score.
- The system shall be accessible via a web interface.

---

## 4. Non-Functional Requirements

| ID | Category | Requirement |
|---|---|---|
| NFR-01 | Performance | Route computation shall complete within 60 seconds for routes up to 10 km. |
| NFR-02 | Accuracy | Obstacle detection shall achieve a minimum precision of 70% on the test dataset. |
| NFR-03 | Scalability | The risk map structure shall support routes with up to 500 segments. |
| NFR-04 | Usability | A first-time user shall be able to obtain a route recommendation within 3 interactions. |
| NFR-05 | Reliability | The system shall handle missing or low-quality Street View images gracefully (fallback to neutral risk score). |
| NFR-06 | Maintainability | Each module shall be independently testable with its own test suite. |
| NFR-07 | Portability | The system shall run on any machine with Python 3.9+ and internet access. |

---

## 5. User Stories

| ID | As a… | I want to… | So that… |
|---|---|---|---|
| US-01 | Vehicle owner | Enter my source, destination, and car model | I get a route safe for my ground clearance |
| US-02 | User with a custom vehicle | Manually enter my ground clearance in mm | The system works for any vehicle, not just presets |
| US-03 | Driver | See a colour-coded risk map on the route | I understand which road segments are risky |
| US-04 | Driver | Get an alternative route if the primary is high-risk | I have a fallback option |
| US-05 | Developer | Run each module independently | I can test and debug without running the full pipeline |

---

## 6. System Constraints & Assumptions

- Road images are sourced from Google Street View; image quality and recency depend on Google's data.
- MiDaS provides **relative depth**, not absolute metric values. Risk scoring uses a normalised depth index, not precise millimetre measurements.
- The system is **not real-time**; it pre-computes risk along a queried route. Real-time updates are listed as future scope.
- API usage is subject to Google Maps Platform rate limits and billing.

---

## 7. Future Scope

- Integration of crowdsourced dashcam data for real-time road condition updates.
- Mobile application (Android/iOS).
- Support for multi-modal routes (road + highway switching).
- Expansion of vehicle database with more manufacturer specs.

---

## 8. Module-to-Requirement Traceability

| Module (Branch) | Covers FRs |
|---|---|
| feature/route-extraction | FR-01 |
| feature/image-collection | FR-02 |
| feature/road-analysis | FR-03 |
| feature/risk-scoring | FR-04 |
| feature/routing-engine | FR-05 |
| feature/frontend | FR-06 |
