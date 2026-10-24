"""
Validates that the risk engine formula behaves correctly -- proves it
BEFORE adding more features on top of it. Three tests, matching the
doc's sensitivity analysis:

  Test 1: same hazard, vary ground clearance -> risk should DECREASE
          as clearance increases
  Test 2: same vehicle, vary severity -> risk should INCREASE as
          severity increases
  Test 3: same vehicle, vary confidence -> risk should INCREASE as
          confidence increases

This needs no model, no GPU, no training -- pure math on risk_engine.py,
safe to run while a training job is using your CPU.

Usage:
    python scripts/validate_risk_engine.py
"""

import sys
from pathlib import Path

sys.path.append(str(Path(__file__).resolve().parent.parent))
from src import risk_engine  # noqa: E402


def check_monotonic(values, increasing: bool) -> bool:
    """Checks a list of numbers is strictly increasing or decreasing."""
    for i in range(len(values) - 1):
        if increasing and values[i + 1] < values[i]:
            return False
        if not increasing and values[i + 1] > values[i]:
            return False
    return True


def test_1_ground_clearance():
    print("=" * 60)
    print("TEST 1 — Same hazard, different ground clearance")
    print("Fixed: confidence=0.90, severity=0.80")
    print("Expected: risk DECREASES as clearance increases")
    print("-" * 60)

    confidence, severity = 0.90, 0.80
    base_risk = risk_engine.combined_risk_score(confidence, severity)

    clearances_mm = [150, 165, 180, 200, 220, 240]
    risks = []

    for clearance_mm in clearances_mm:
        clearance_cm = clearance_mm / 10
        risk = risk_engine.personalized_risk(base_risk, clearance_cm)
        risks.append(risk)
        print(f"  Ground clearance {clearance_mm:>4}mm -> risk = {risk:.4f} ({risk_engine.risk_class(risk)})")

    passed = check_monotonic(risks, increasing=False)
    print(f"\n  Result: {'PASS' if passed else 'FAIL'} — risk is "
          f"{'correctly decreasing' if passed else 'NOT consistently decreasing'} with clearance")
    return passed


def test_2_severity():
    print("\n" + "=" * 60)
    print("TEST 2 — Same vehicle, different severity")
    print("Fixed: ground_clearance=165mm, confidence=0.90")
    print("Expected: risk INCREASES as severity increases")
    print("-" * 60)

    clearance_cm = 16.5
    confidence = 0.90
    severities = [0.2, 0.4, 0.6, 0.8, 1.0]
    risks = []

    for severity in severities:
        base_risk = risk_engine.combined_risk_score(confidence, severity)
        risk = risk_engine.personalized_risk(base_risk, clearance_cm)
        risks.append(risk)
        print(f"  Severity {severity:.1f} -> risk = {risk:.4f} ({risk_engine.risk_class(risk)})")

    passed = check_monotonic(risks, increasing=True)
    print(f"\n  Result: {'PASS' if passed else 'FAIL'} — risk is "
          f"{'correctly increasing' if passed else 'NOT consistently increasing'} with severity")
    return passed


def test_3_confidence():
    print("\n" + "=" * 60)
    print("TEST 3 — Same vehicle, different confidence")
    print("Fixed: severity=0.80, ground_clearance=165mm")
    print("Expected: risk INCREASES as confidence increases")
    print("-" * 60)

    clearance_cm = 16.5
    severity = 0.80
    confidences = [0.4, 0.6, 0.8, 0.9, 1.0]
    risks = []

    for confidence in confidences:
        base_risk = risk_engine.combined_risk_score(confidence, severity)
        risk = risk_engine.personalized_risk(base_risk, clearance_cm)
        risks.append(risk)
        print(f"  Confidence {confidence:.1f} -> risk = {risk:.4f} ({risk_engine.risk_class(risk)})")

    passed = check_monotonic(risks, increasing=True)
    print(f"\n  Result: {'PASS' if passed else 'FAIL'} — risk is "
          f"{'correctly increasing' if passed else 'NOT consistently increasing'} with confidence")
    return passed


def main():
    result1 = test_1_ground_clearance()
    result2 = test_2_severity()
    result3 = test_3_confidence()

    print("\n" + "=" * 60)
    print("SUMMARY")
    print("=" * 60)
    print(f"Test 1 (clearance):  {'PASS' if result1 else 'FAIL'}")
    print(f"Test 2 (severity):   {'PASS' if result2 else 'FAIL'}")
    print(f"Test 3 (confidence): {'PASS' if result3 else 'FAIL'}")

    if all([result1, result2, result3]):
        print("\nAll tests passed — your risk formula behaves correctly and")
        print("consistently. This is real evidence for your report's validation section.")
    else:
        print("\nAt least one test failed — investigate risk_engine.py before")
        print("building more features on top of it.")


if __name__ == "__main__":
    main()
