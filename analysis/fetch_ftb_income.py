"""Build the county income reference from California Franchise Tax Board data.

Source
------
FTB table **B-7, Adjusted Gross Income by County** — the Franchise Tax Board's
own county-level publication, on the state open data portal under CC-BY. Each
row is one county, one taxable year, one AGI class, with the number of resident
returns and the adjusted gross income on them; summing the classes gives the
county total.

    https://data.ca.gov/dataset/b-7-adjusted-gross-income-by-county

A second FTB table, **Personal Income Tax Statistics by ZIP Code**, covers the
same universe one year later and one geography finer. It is used here only as a
cross-check, because at least one county-year in it is corrupt: 2023 Calaveras
sums to a NEGATIVE mean AGI (two ZIPs carry roughly -$2.5B between them),
against +$77k in B-7. Any county whose two sources disagree by more than the
tolerance is reported, so an anomaly surfaces rather than quietly becoming a
figure.

What this writes
----------------
`analysis/data/ftb_county_income.v1.json` — per county: returns, total AGI, and
mean AGI per return for the newest taxable year in B-7.

Caveats worth carrying into any figure that uses this:
  * MEAN adjusted gross income per RETURN — not median household income. It is
    pulled up by high earners, and a joint return covers two people while a
    single return covers one.
  * Tax filers, not residents: households below the filing threshold are
    absent, which biases the poorest areas upward.
  * AGI is income as reported to the state and excludes non-taxable income.
  * A county is not a community college district. Any district-level use is a
    join through the district's service-area counties, and is only as local as
    those counties are.

Usage
-----
  python fetch_ftb_income.py                     # newest year, with cross-check
  python fetch_ftb_income.py --year 2021
  python fetch_ftb_income.py --county-csv b7.csv --zip-csv zips.csv
  python fetch_ftb_income.py --no-cross-check
"""

import argparse
import csv
import datetime as dt
import io
import json
import urllib.request
from collections import defaultdict
from pathlib import Path

COUNTY_SOURCE = {
    "name": "California Franchise Tax Board — B-7, Adjusted Gross Income by County",
    "publisher": "California Franchise Tax Board",
    "page": "https://data.ca.gov/dataset/b-7-adjusted-gross-income-by-county",
    "file": (
        "https://data.ca.gov/dataset/2a273ac1-39c6-4e3b-a1e6-e0fb1bf495b5/resource/"
        "ef37e456-32f5-40b2-a70b-777032f1592b/download/"
        "2023-b-7__adjusted_gross_income_by_county.csv"
    ),
    "license": "Creative Commons Attribution",
}
ZIP_SOURCE = {
    "name": "California Franchise Tax Board — Personal Income Tax Statistics by ZIP Code",
    "page": "https://data.ca.gov/dataset/personal-income-tax-statistics-by-zip-code",
    "file": (
        "https://data.ca.gov/dataset/71b7f174-eee9-45fa-ac87-5dd533640878/resource/"
        "7091fcca-e695-49ab-aa44-6e0c6f49c9c1/download/"
        "2024_personal_income_tax_statistics_by_zip_code.csv"
    ),
}
# Rows that are not California counties.
NON_COUNTY = {
    "nonresident", "unallocated", "county unmatched", "unknown", "out of state", "none",
    "resident out-of-state", "state totals", "statewide", "total", "california",
}
OUTPUT = Path(__file__).resolve().parent / "data" / "ftb_county_income.v1.json"


def read_csv(url, local_path=None):
    if local_path:
        text = Path(local_path).read_text(encoding="utf-8-sig")
    else:
        with urllib.request.urlopen(url) as response:
            text = response.read().decode("utf-8-sig")
    return list(csv.DictReader(io.StringIO(text)))


def totals(rows, year_field, county_field, returns_field, agi_field, year):
    out = defaultdict(lambda: {"returns": 0, "adjusted_gross_income": 0})
    for row in rows:
        if int(row[year_field]) != year:
            continue
        county = (row.get(county_field) or "").strip()
        if not county or county.lower() in NON_COUNTY:
            continue
        bucket = out[county]
        bucket["returns"] += int(row[returns_field] or 0)
        bucket["adjusted_gross_income"] += int(row[agi_field] or 0)
    for bucket in out.values():
        bucket["mean_agi_per_return"] = (
            round(bucket["adjusted_gross_income"] / bucket["returns"])
            if bucket["returns"] else None
        )
    return dict(out)


def cross_check(counties, zip_rows, tolerance=0.15):
    """Counties where the ZIP-level table disagrees materially with B-7."""
    years = sorted({int(row["TaxYear"]) for row in zip_rows if row.get("TaxYear")})
    zip_totals = totals(zip_rows, "TaxYear", "County", "Returns", "CAAGI", years[-1])
    flagged = []
    for county, bucket in sorted(counties.items()):
        other = zip_totals.get(county)
        if not other or not other["mean_agi_per_return"] or not bucket["mean_agi_per_return"]:
            continue
        drift = abs(other["mean_agi_per_return"] - bucket["mean_agi_per_return"]) / abs(bucket["mean_agi_per_return"])
        if drift > tolerance:
            flagged.append({
                "county": county,
                "b7_mean_agi_per_return": bucket["mean_agi_per_return"],
                "zip_mean_agi_per_return": other["mean_agi_per_return"],
                "zip_taxable_year": years[-1],
            })
    return flagged


def main(argv=None):
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    parser.add_argument("--year", type=int, help="taxable year (default: newest in B-7)")
    parser.add_argument("--county-csv", help="local copy of the B-7 CSV")
    parser.add_argument("--zip-csv", help="local copy of the ZIP-code CSV")
    parser.add_argument("--no-cross-check", action="store_true")
    parser.add_argument("--output", type=Path, default=OUTPUT)
    args = parser.parse_args(argv)

    county_rows = read_csv(COUNTY_SOURCE["file"], args.county_csv)
    years = sorted({int(row["Taxable Year"]) for row in county_rows if row.get("Taxable Year")})
    taxable_year = args.year or years[-1]
    counties = totals(
        county_rows, "Taxable Year", "County", "All Returns", "Adjusted Gross Income", taxable_year
    )

    flagged = []
    if not args.no_cross_check:
        flagged = cross_check(counties, read_csv(ZIP_SOURCE["file"], args.zip_csv))

    payload = {
        "dataset_version": f"ftb-county-income.{taxable_year}.v1",
        "measure": "mean_agi_per_return",
        "measure_label": "Mean adjusted gross income per return",
        "taxable_year": taxable_year,
        "available_years": years,
        "source": COUNTY_SOURCE,
        "cross_check": {
            "source": ZIP_SOURCE,
            "tolerance": 0.15,
            "disagreeing_counties": flagged,
        },
        "caveats": [
            "Mean per return, not median household income; high earners pull it up.",
            "Tax filers only — households below the filing threshold are absent.",
            "A joint return covers two people, a single return one.",
            "A county is not a community college district; district figures are a service-area join.",
        ],
        "retrieved_at": dt.date.today().isoformat(),
        "counties": dict(sorted(counties.items())),
    }
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(json.dumps(payload, indent=1) + "\n", encoding="utf-8")

    ranked = sorted(counties.items(), key=lambda item: item[1]["mean_agi_per_return"] or 0)
    print(f"{args.output} — taxable year {taxable_year}, {len(counties)} counties")
    print(f"  lowest  {ranked[0][0]}: ${ranked[0][1]['mean_agi_per_return']:,}")
    print(f"  highest {ranked[-1][0]}: ${ranked[-1][1]['mean_agi_per_return']:,}")
    if flagged:
        print(f"  cross-check disagreements (>15%): {len(flagged)}")
        for item in flagged:
            print(f"    {item['county']}: B-7 ${item['b7_mean_agi_per_return']:,} "
                  f"vs ZIP ${item['zip_mean_agi_per_return']:,}")


if __name__ == "__main__":
    main()
