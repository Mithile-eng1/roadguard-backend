import json
import math
import heapq

ALPHA = 0.7  # Weight for risk in cost function: C = d + alpha * r

def haversine(lat1, lng1, lat2, lng2):
    """
    Calculates distance in km between two lat/lng points.
    """
    R = 6371
    phi1, phi2 = math.radians(lat1), math.radians(lat2)
    dphi = math.radians(lat2 - lat1)
    dlambda = math.radians(lng2 - lng1)
    a = math.sin(dphi/2)**2 + math.cos(phi1)*math.cos(phi2)*math.sin(dlambda/2)**2
    return R * 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))


def build_graph(waypoints):
    """
    Builds a simple sequential graph from ordered waypoints.
    Each node connects to the next node only (sequential route).
    """
    graph = {}
    for i, wp in enumerate(waypoints):
        key = (wp["lat"], wp["lng"])
        neighbors = []
        if i + 1 < len(waypoints):
            nxt = waypoints[i + 1]
            dist = haversine(wp["lat"], wp["lng"], nxt["lat"], nxt["lng"])
            risk = wp["risk_score"]
            cost = dist + ALPHA * risk
            neighbors.append(((nxt["lat"], nxt["lng"]), cost))
        graph[key] = neighbors
    return graph


def astar(graph, start, goal, waypoints):
    """
    Modified A* that uses cost = distance + alpha * risk.
    Returns the safest path as list of (lat, lng) nodes.
    """
    wp_dict = {(w["lat"], w["lng"]): w for w in waypoints}

    def heuristic(node):
        return haversine(node[0], node[1], goal[0], goal[1])

    open_set = []
    heapq.heappush(open_set, (0 + heuristic(start), 0, start, [start]))

    visited = set()

    while open_set:
        f, g, current, path = heapq.heappop(open_set)

        if current in visited:
            continue
        visited.add(current)

        if current == goal:
            return path

        for neighbor, edge_cost in graph.get(current, []):
            if neighbor not in visited:
                new_g = g + edge_cost
                new_f = new_g + heuristic(neighbor)
                heapq.heappush(open_set, (new_f, new_g, neighbor, path + [neighbor]))

    return []  # No path found


def find_safe_route(risk_scores_path="output/risk_scores.json"):
    """
    Loads risk scores and finds the safest route using A*.
    Saves result to output/safe_route.json
    """
    with open(risk_scores_path, "r") as f:
        waypoints = json.load(f)

    graph = build_graph(waypoints)

    start = (waypoints[0]["lat"], waypoints[0]["lng"])
    goal = (waypoints[-1]["lat"], waypoints[-1]["lng"])

    path = astar(graph, start, goal, waypoints)

    result = [{"lat": p[0], "lng": p[1]} for p in path]

    with open("output/safe_route.json", "w") as f:
        json.dump(result, f, indent=2)

    print(f"Safe route found with {len(result)} waypoints.")
    return result


if __name__ == "__main__":
    find_safe_route()