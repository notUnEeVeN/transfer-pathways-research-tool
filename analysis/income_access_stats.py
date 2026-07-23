"""Statistics behind the "Transfer access and local income" figure.

Recomputes, on this machine, every number the figure reports: the correlations,
the standardized three-predictor fit, the income quartiles, and the districts
that sit furthest from what their income, size and location predict. The
figure computes the same quantities in the browser from the same inputs, so
this is the check that the two agree.

Inputs
------
  * district coverage from the local calculation layer (the Figure 4 measure)
  * `analysis/data/district_income.v1.json` (FTB catchment income)
  * `analysis/data/paper_articulation_map.json` (district centroids)

Usage
-----
  python income_access_stats.py
  python income_access_stats.py --requirements assist   # ASSIST-stated minimums
  python income_access_stats.py --county-income         # robustness: county roll-up
"""

import argparse
import json
import math
import re
from pathlib import Path

from visuals._data import compute

DATA = Path(__file__).resolve().parent / "data"
# Public campus locations; only used to measure remoteness.
UC_CAMPUSES = {
    "Berkeley": (-122.2585, 37.8719), "Davis": (-121.7617, 38.5382),
    "Irvine": (-117.8443, 33.6405), "Los Angeles": (-118.4452, 34.0689),
    "Merced": (-120.4237, 37.3661), "Riverside": (-117.3281, 33.9737),
    "San Diego": (-117.2340, 32.8801), "Santa Barbara": (-119.8489, 34.4140),
    "Santa Cruz": (-122.0609, 36.9914),
}


def normalize(value):
    return re.sub(r"[^a-z0-9]+", " ", str(value or "").lower()).strip()


def kilometres(a, b):
    mean_lat = math.radians((a[1] + b[1]) / 2)
    return math.hypot((a[0] - b[0]) * math.cos(mean_lat) * 111.32, (a[1] - b[1]) * 110.57)


def correlation(left, right):
    n = len(left)
    mean_left, mean_right = sum(left) / n, sum(right) / n
    numerator = sum((a - mean_left) * (b - mean_right) for a, b in zip(left, right))
    denominator = math.sqrt(
        sum((a - mean_left) ** 2 for a in left) * sum((b - mean_right) ** 2 for b in right)
    )
    return numerator / denominator if denominator else float("nan")


def ranks(values):
    order = sorted(range(len(values)), key=lambda i: values[i])
    out = [0.0] * len(values)
    index = 0
    while index < len(order):
        stop = index
        while stop + 1 < len(order) and values[order[stop + 1]] == values[order[index]]:
            stop += 1
        average = (index + stop) / 2 + 1
        for position in range(index, stop + 1):
            out[order[position]] = average
        index = stop + 1
    return out


def standardize(values):
    n = len(values)
    centre = sum(values) / n
    spread = math.sqrt(sum((value - centre) ** 2 for value in values) / (n - 1))
    return [(value - centre) / spread for value in values]


def regression(outcome, predictors):
    """Standardized OLS by Gauss-Jordan, returning betas, R² and residuals."""
    y = standardize(outcome)
    columns = [standardize(column) for column in predictors]
    width = len(columns)
    matrix = [
        [sum(a * b for a, b in zip(columns[row], columns[col])) for col in range(width)]
        + [sum(a * b for a, b in zip(columns[row], y))]
        for row in range(width)
    ]
    for pivot in range(width):
        best = max(range(pivot, width), key=lambda row: abs(matrix[row][pivot]))
        matrix[pivot], matrix[best] = matrix[best], matrix[pivot]
        for row in range(width):
            if row == pivot:
                continue
            factor = matrix[row][pivot] / matrix[pivot][pivot]
            for col in range(pivot, width + 1):
                matrix[row][col] -= factor * matrix[pivot][col]
    betas = [matrix[i][width] / matrix[i][i] for i in range(width)]
    fitted = [sum(betas[i] * columns[i][t] for i in range(width)) for t in range(len(y))]
    residuals = [y[t] - fitted[t] for t in range(len(y))]
    r_squared = 1 - sum(r ** 2 for r in residuals) / sum(value ** 2 for value in y)
    return betas, r_squared, residuals


def main(argv=None):
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    parser.add_argument("--county-income", action="store_true",
                        help="use the county roll-up instead of the catchment measure")
    parser.add_argument("--requirements", choices=["paper", "assist"], default="paper",
                        help="which transfer requirement set defines access")
    args = parser.parse_args(argv)

    # Both demand views use the same exact, code-configured CS campus/program
    # pins; only the requirement source changes.
    rows = compute(
        "coverage", majorSlug="cs", groupBy="district",
        requirements=args.requirements,
    )
    complete = {}
    for row in rows:
        district = row.get("row_group_label")
        complete.setdefault(district, set())
        if row.get("fully_articulated") is True:
            complete[district].add(row["school_id"])

    income_data = json.loads((DATA / "district_income.v1.json").read_text())["districts"]
    centroids = {
        normalize(name): (longitude, latitude)
        for name, longitude, latitude in
        json.loads((DATA / "paper_articulation_map.json").read_text())["district_centroids"]
    }

    districts = []
    for name, campuses in complete.items():
        entry = income_data.get(name)
        centroid = centroids.get(normalize(name))
        if not entry or not centroid:
            continue
        measure = entry["county_rollup"] if args.county_income else entry["catchment"]
        if not measure or not measure.get("mean_agi_per_return"):
            continue
        districts.append({
            "name": name,
            "campuses": len(campuses),
            "income": measure["mean_agi_per_return"],
            "returns": measure["returns"],
            "distance_km": max(1.0, min(kilometres(centroid, point)
                                        for point in UC_CAMPUSES.values())),
        })

    access = [d["campuses"] for d in districts]
    log_income = [math.log(d["income"]) for d in districts]
    log_returns = [math.log(d["returns"]) for d in districts]
    log_distance = [math.log(d["distance_km"]) for d in districts]

    label = "county roll-up" if args.county_income else "catchment"
    requirement_label = ("hand-curated minimums" if args.requirements == "paper"
                         else "ASSIST-stated minimums")
    print(f"n = {len(districts)} districts · access: {requirement_label}"
          f" · income measure: {label}\n")
    print("correlations with campuses reached")
    print(f"  income     pearson {correlation(access, log_income):+.3f}"
          f"   spearman {correlation(ranks(access), ranks(log_income)):+.3f}")
    print(f"  population pearson {correlation(access, log_returns):+.3f}")
    print(f"  distance   pearson {correlation(access, log_distance):+.3f}")

    betas, r_squared, residuals = regression(access, [log_income, log_returns, log_distance])
    print("\nstandardized fit: campuses ~ income + population + distance")
    for name, beta in zip(["income", "population", "distance"], betas):
        print(f"  {name:11s} beta {beta:+.3f}")
    print(f"  R2 {r_squared:.3f}")

    ordered = sorted(districts, key=lambda d: d["income"])
    size = len(ordered) // 4
    print("\nby income quartile")
    for index in range(4):
        group = ordered[index * size:] if index == 3 else ordered[index * size:(index + 1) * size]
        mean_income = sum(d["income"] for d in group) / len(group)
        mean_access = sum(d["campuses"] for d in group) / len(group)
        zero = sum(1 for d in group if d["campuses"] == 0)
        print(f"  Q{index + 1}  ${mean_income:>9,.0f}   mean campuses {mean_access:.1f}"
              f"   zero access {zero}")

    paired = sorted(zip(residuals, districts), key=lambda pair: pair[0])
    print("\nfurthest below the fit (less access than income, size and location predict)")
    for residual, district in paired[:5]:
        print(f"  {district['name'][:46]:48s} {district['campuses']} campuses  {residual:+.2f}")
    print("furthest above")
    for residual, district in paired[-5:]:
        print(f"  {district['name'][:46]:48s} {district['campuses']} campuses  {residual:+.2f}")


if __name__ == "__main__":
    main()
