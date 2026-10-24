import json
import os

# Weight for depth risk vs obstacle count
DEPTH_WEIGHT = 0.6
COUNT_WEIGHT = 0.4
MAX_OBSTACLES = 10  # Normalize obstacle count against this

def compute_risk_score(obstacles):
    """
    Computes a risk score (0.0 to 1.0) for a single waypoint.
    Based on number of obstacles and their average depth risk.
    """
    if not obstacles:
        return 0.0

    avg_depth_risk = sum(o["depth_risk"] for o in obstacles) / len(obstacles)
    obstacle_count_score = min(len(obstacles) / MAX_OBSTACLES, 1.0)

    risk = (DEPTH_WEIGHT * avg_depth_risk) + (COUNT_WEIGHT * obstacle_count_score)
    return round(risk, 4)


def classify_risk(score):
    """
    Converts numeric score to Low / Medium / High label.
    """
    if score < 0.3:
        return "Low"
    elif score < 0.6:
        return "Medium"
    else:
        return "High"


def score_all_waypoints(analysis_path="output/analysis.json"):
    """
    Reads analysis.json and produces risk_scores.json
    """
    with open(analysis_path, "r") as f:
        analysis = json.load(f)

    scored = []
    for item in analysis:
        score = compute_risk_score(item["obstacles"])
        label = classify_risk(score)
        scored.append({
            "lat": item["lat"],
            "lng": item["lng"],
            "risk_score": score,
            "risk_label": label,
            "obstacle_count": len(item["obstacles"])
        })
        print(f"({item['lat']}, {item['lng']}) → Score: {score} [{label}]")

    with open("output/risk_scores.json", "w") as f:
        json.dump(scored, f, indent=2)

    print(f"\nRisk scoring complete. {len(scored)} waypoints scored.")
    return scored


if __name__ == "__main__":
    score_all_waypoints()