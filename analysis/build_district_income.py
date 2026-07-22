"""District-scale income for California's 72 community college districts.

Why this exists
---------------
California publishes income by county and by ZIP code, never by community
college district. The county roll-up in `ftb_county_income.v1.json` is honest
but coarse: Allan Hancock's service area is three whole counties, most of which
its students never live in.

This builds a district-scale measure instead. Every ZIP code in the Franchise
Tax Board's ZIP table is assigned to the district whose centroid is nearest,
and a district's income is the returns-weighted mean adjusted gross income of
the ZIPs assigned to it. That is a Voronoi catchment: parameter-free (no radius
to choose), exhaustive (every ZIP counted exactly once, so district populations
sum to the state), and at the scale of the thing being measured.

What it is not: district boundaries. Real district service areas are drawn by
statute and are not Voronoi cells around a centroid, so a ZIP near a district
line can land on the wrong side. The county roll-up travels with each district
as a robustness check — the two agree on the ordering of districts
(Spearman ≈ 0.9), and any figure should say which one it stands on.

Inputs
------
  * FTB "Personal Income Tax Statistics by ZIP Code" (CC-BY), which carries a
    centroid for every ZIP: https://data.ca.gov/dataset/personal-income-tax-statistics-by-zip-code
  * District centroids from `analysis/data/paper_articulation_map.json`, which
    the California paper computed by averaging its colleges' locations.
  * `analysis/data/ftb_county_income.v1.json` for the county comparison.

Usage
-----
  python build_district_income.py                 # downloads the ZIP table
  python build_district_income.py --zip-csv f.csv
"""

import argparse
import csv
import datetime as dt
import io
import json
import math
import re
import unicodedata
import urllib.request
from collections import defaultdict
from pathlib import Path

DATA = Path(__file__).resolve().parent / "data"
GEOMETRY = DATA / "paper_articulation_map.json"
COUNTY_INCOME = DATA / "ftb_county_income.v1.json"
OUTPUT = DATA / "district_income.v1.json"

ZIP_SOURCE = {
    "name": "California Franchise Tax Board — Personal Income Tax Statistics by ZIP Code",
    "publisher": "California Franchise Tax Board",
    "page": "https://data.ca.gov/dataset/personal-income-tax-statistics-by-zip-code",
    "file": (
        "https://data.ca.gov/dataset/71b7f174-eee9-45fa-ac87-5dd533640878/resource/"
        "7091fcca-e695-49ab-aa44-6e0c6f49c9c1/download/"
        "2024_personal_income_tax_statistics_by_zip_code.csv"
    ),
    "license": "Creative Commons Attribution",
}
POINT = re.compile(r"POINT \((-?[\d.]+) (-?[\d.]+)\)")

# A ZIP whose mean AGI per return falls outside this range is a data fault, not
# a neighbourhood: every year of the FTB file contains a handful of ZIPs where
# one filer's enormous loss (or gain) swamps the total — 2023 Coalinga reports
# -$687M across 5,443 returns, which alone would drag West Hills' district mean
# to $20,740. Excluded ZIPs are listed in the output rather than dropped
# silently, and a returns-weighted median is published beside the mean so a
# reader can see whether any single ZIP is driving a district.
SANE_MEAN_AGI = (5_000, 2_000_000)


def normalize(value):
    text = "".join(
        char for char in unicodedata.normalize("NFKD", str(value or ""))
        if not unicodedata.combining(char)
    ).replace("&", " and ")
    return re.sub(r"\s+", " ", re.sub(r"[^a-z0-9]+", " ", text.lower())).strip()


def read_zip_rows(local_path=None):
    if local_path:
        text = Path(local_path).read_text(encoding="utf-8-sig")
    else:
        with urllib.request.urlopen(ZIP_SOURCE["file"]) as response:
            text = response.read().decode("utf-8-sig")
    return list(csv.DictReader(io.StringIO(text)))


def kilometres(a, b):
    """Equirectangular distance — exact enough to rank centroids within a state."""
    mean_lat = math.radians((a[1] + b[1]) / 2)
    return math.hypot((a[0] - b[0]) * math.cos(mean_lat) * 111.32, (a[1] - b[1]) * 110.57)


def weighted_median(pairs):
    """Median of ZIP means, each ZIP weighted by the returns filed in it."""
    ordered = sorted(pairs)
    total = sum(weight for _, weight in ordered)
    if not total:
        return None
    seen = 0
    for value, weight in ordered:
        seen += weight
        if seen >= total / 2:
            return round(value)
    return round(ordered[-1][0])


def build(zip_rows, centroids, county_income, year=None):
    years = sorted({int(row["TaxYear"]) for row in zip_rows if row.get("TaxYear")})
    taxable_year = int(year) if year else years[-1]

    catchments = defaultdict(lambda: {"returns": 0, "adjusted_gross_income": 0,
                                      "zip_codes": 0, "zip_means": []})
    unplaced = 0
    excluded = []
    for row in zip_rows:
        if int(row["TaxYear"]) != taxable_year:
            continue
        point = POINT.match(row.get("GeoZipCode") or "")
        returns = int(row["Returns"] or 0)
        if not point or returns <= 0:
            unplaced += 1
            continue
        location = (float(point.group(1)), float(point.group(2)))
        district = min(centroids, key=lambda name: kilometres(location, centroids[name]))
        income = int(row["CAAGI"] or 0)
        mean = income / returns
        if not SANE_MEAN_AGI[0] <= mean <= SANE_MEAN_AGI[1]:
            excluded.append({
                "zip_code": row["ZipCode"], "city": row.get("City"),
                "county": row.get("County"), "district": district,
                "returns": returns, "adjusted_gross_income": income,
                "mean_agi_per_return": round(mean),
            })
            continue
        bucket = catchments[district]
        bucket["returns"] += returns
        bucket["adjusted_gross_income"] += income
        bucket["zip_codes"] += 1
        bucket["zip_means"].append((mean, returns))

    districts = {}
    for name in sorted(centroids):
        catchment = catchments.get(name)
        county = county_income.get(name)
        districts[name] = {
            "catchment": {
                "mean_agi_per_return": (
                    round(catchment["adjusted_gross_income"] / catchment["returns"])
                    if catchment and catchment["returns"] else None
                ),
                "median_zip_agi_per_return": (
                    weighted_median(catchment["zip_means"]) if catchment else None
                ),
                "returns": catchment["returns"] if catchment else 0,
                "zip_codes": catchment["zip_codes"] if catchment else 0,
                "excluded_zip_codes": sorted(
                    item["zip_code"] for item in excluded if item["district"] == name
                ),
            },
            "county_rollup": county,
        }
    return {
        "dataset_version": f"district-income.{taxable_year}.v1",
        "taxable_year": taxable_year,
        "measure": "mean_agi_per_return",
        "measure_label": "Mean adjusted gross income per return",
        "method": (
            "Every ZIP code in the FTB table is assigned to the community college "
            "district whose centroid is nearest; a district's income is the "
            "returns-weighted mean over the ZIPs assigned to it."
        ),
        "source": ZIP_SOURCE,
        "caveats": [
            "Voronoi catchment, not statutory district boundaries.",
            "A few ZIP rows per year are data faults and are excluded; see excluded_zip_rows.",
            "Mean per return, not median household income; high earners pull it up.",
            "Tax filers only — households below the filing threshold are absent.",
            "Ecological measure: it describes an area, never an individual student.",
        ],
        "unplaced_zip_rows": unplaced,
        "excluded_zip_rows": excluded,
        "exclusion_rule": (
            f"ZIP rows whose mean AGI per return falls outside "
            f"${SANE_MEAN_AGI[0]:,}–${SANE_MEAN_AGI[1]:,} are treated as data faults."
        ),
        "retrieved_at": dt.date.today().isoformat(),
        "districts": districts,
    }


def county_rollup_by_district(county_income, district_counties):
    """The already-committed county measure, keyed by district, for comparison."""
    out = {}
    counties = {normalize(name): stats for name, stats in county_income["counties"].items()}
    for district, names in district_counties.items():
        returns = income = 0
        matched = []
        for name in names:
            stats = counties.get(normalize(name))
            if not stats or not stats["returns"]:
                continue
            matched.append(name)
            returns += stats["returns"]
            income += stats["adjusted_gross_income"]
        out[district] = {
            "mean_agi_per_return": round(income / returns) if returns else None,
            "returns": returns,
            "counties": matched,
        } if returns else None
    return out


def spearman(pairs):
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

    left = ranks([pair[0] for pair in pairs])
    right = ranks([pair[1] for pair in pairs])
    n = len(pairs)
    mean_left, mean_right = sum(left) / n, sum(right) / n
    numerator = sum((a - mean_left) * (b - mean_right) for a, b in zip(left, right))
    denominator = math.sqrt(
        sum((a - mean_left) ** 2 for a in left) * sum((b - mean_right) ** 2 for b in right)
    )
    return numerator / denominator if denominator else float("nan")


def main(argv=None):
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    parser.add_argument("--zip-csv", help="local copy of the FTB ZIP-code CSV")
    parser.add_argument("--year", type=int)
    parser.add_argument("--district-counties", type=Path,
                        help="JSON of {district: [counties]} for the robustness roll-up")
    parser.add_argument("--output", type=Path, default=OUTPUT)
    args = parser.parse_args(argv)

    geometry = json.loads(GEOMETRY.read_text(encoding="utf-8"))
    centroids = {name: (longitude, latitude)
                 for name, longitude, latitude in geometry["district_centroids"]}
    county_income = json.loads(COUNTY_INCOME.read_text(encoding="utf-8"))
    district_counties = (
        json.loads(args.district_counties.read_text(encoding="utf-8"))
        if args.district_counties else {}
    )

    # Default to the county extract's year so every income number in the console
    # — hover, Districts tab, figures — describes the same taxable year.
    payload = build(
        read_zip_rows(args.zip_csv),
        centroids,
        county_rollup_by_district(county_income, district_counties),
        args.year or county_income["taxable_year"],
    )
    payload["county_rollup_source"] = county_income["source"]
    payload["county_rollup_taxable_year"] = county_income["taxable_year"]

    compared = [
        (entry["catchment"]["mean_agi_per_return"], entry["county_rollup"]["mean_agi_per_return"])
        for entry in payload["districts"].values()
        if entry["catchment"]["mean_agi_per_return"] and entry.get("county_rollup")
    ]
    payload["catchment_vs_county_spearman"] = round(spearman(compared), 3) if compared else None

    args.output.write_text(json.dumps(payload, indent=1) + "\n", encoding="utf-8")

    values = [(name, entry["catchment"]["mean_agi_per_return"])
              for name, entry in payload["districts"].items()
              if entry["catchment"]["mean_agi_per_return"]]
    values.sort(key=lambda item: item[1])
    print(f"{args.output} — taxable year {payload['taxable_year']}, {len(values)} districts")
    print(f"  lowest  {values[0][0]}: ${values[0][1]:,}")
    print(f"  highest {values[-1][0]}: ${values[-1][1]:,}")
    if payload["excluded_zip_rows"]:
        print(f"  excluded {len(payload['excluded_zip_rows'])} ZIP rows as data faults:")
        for item in payload["excluded_zip_rows"]:
            print(f"    {item['zip_code']} {item['city']} ({item['county']}): "
                  f"${item['mean_agi_per_return']:,} per return")
    if payload["catchment_vs_county_spearman"] is not None:
        print(f"  catchment vs county roll-up: Spearman {payload['catchment_vs_county_spearman']}"
              f" over {len(compared)} districts")


if __name__ == "__main__":
    main()
