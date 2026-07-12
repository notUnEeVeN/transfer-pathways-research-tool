"""
Import California community-college district geography into assist_institutions.

This is a narrow bridge from the prior research repo: we reuse only its
district -> colleges / counties / region reference mapping, then compute all
statistics from this tool's own parsed PMT data.

Default source, relative to this repo layout:
  ../transfer-agreements-analysis/creating_districts/districts.json

Env (scripts/.env or shell):
  TARGET_MONGO_URI (required)
  TARGET_DB_NAME   (default pmt_research)

Updates the district, region, counties_served, and provenance fields on each
canonical community-college institution row.
"""
import argparse
import datetime as dt
import json
import os
import re
import sys
from pathlib import Path

from dotenv import load_dotenv
from pymongo import MongoClient, UpdateOne

HERE = Path(__file__).resolve().parent
load_dotenv(HERE / ".env")

DEFAULT_DISTRICTS = HERE.parent.parent / "transfer-agreements-analysis" / "creating_districts" / "districts.json"

ALIASES = {
    "coalinga college": "west hills college coalinga",
    "lemoore college": "west hills college lemoore",
}


def _env(name, default=None, required=False):
    val = os.environ.get(name, default)
    if required and not val:
        sys.exit(f"Missing required env var {name} (set it in scripts/.env or the shell).")
    return val


def normalize(name):
    s = str(name or "").lower()
    s = re.sub(r"\bmt\.?\b", "mount", s)
    s = s.replace("&", " and ")
    s = s.replace("cañada", "canada")
    s = re.sub(r"[^a-z0-9]+", " ", s)
    return re.sub(r"\s+", " ", s).strip()


def load_mapping(path):
    data = json.loads(Path(path).read_text(encoding="utf-8"))["districts"]
    out = {}
    for district, info in data.items():
        for college in info.get("colleges") or []:
            out[normalize(college)] = {
                "district": district,
                "region": info.get("region"),
                "counties_served": list(info.get("counties_served") or []),
                "source_college_name": college,
            }
    return out


def connect():
    uri = _env("TARGET_MONGO_URI", required=True)
    name = _env("TARGET_DB_NAME", "pmt_research")
    return MongoClient(uri)[name]


def build_ops(db, mapping):
    now = dt.datetime.now(dt.timezone.utc)
    ops = []
    unmatched = []
    collection = db["assist_institutions"]
    for raw in collection.find(
        {"kind": "community_college"}, {"source_id": 1, "name": 1}
    ).sort("name", 1):
        cc = {"id": raw["source_id"], "name": raw["name"]}
        key = normalize(cc["name"])
        hit = mapping.get(key) or mapping.get(ALIASES.get(key, ""))
        if not hit:
            unmatched.append(cc["name"])
            continue
        ops.append(UpdateOne(
            {"_id": f"cc:{int(cc['id'])}"},
            {"$set": {
                "district": hit["district"],
                "region": hit["region"],
                "counties_served": hit["counties_served"],
                "district_source_college_name": hit["source_college_name"],
                "district_source": "transfer-agreements-analysis/creating_districts/districts.json",
                "updated_at": now,
            }},
            upsert=False,
        ))
    return ops, unmatched


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--districts-json", default=str(DEFAULT_DISTRICTS), help="path to districts.json")
    ap.add_argument("--dry-run", action="store_true", help="validate matching without writing")
    args = ap.parse_args()

    if not Path(args.districts_json).exists():
        sys.exit(f"districts.json not found: {args.districts_json}")

    db = connect()
    mapping = load_mapping(args.districts_json)
    ops, unmatched = build_ops(db, mapping)

    print(f"Matched {len(ops)} community colleges to district geography.")
    if unmatched:
        print("Unmatched colleges:")
        for name in unmatched:
            print(f"  - {name}")
        sys.exit(1)

    if args.dry_run:
        print("Dry run only; no DB writes.")
        return

    if ops:
        db["assist_institutions"].bulk_write(ops, ordered=False)
    print("assist_institutions district profiles updated.")


if __name__ == "__main__":
    main()
