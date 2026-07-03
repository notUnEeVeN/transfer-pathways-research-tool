"""
Import the old hand-curated UC CS transfer-minimum requirements.

The prior research repo encoded the university-website-derived "actual hard
requirements" in scraping/files/course_reqs.json. This imports that narrow
reference table into the research DB so visualizations can evaluate complete
transfer paths against those minimums instead of ASSIST's broader required-ish
surface.

Default source, relative to this repo layout:
  ../transfer-agreements-analysis/scraping/files/course_reqs.json

Env (scripts/.env or shell):
  TARGET_MONGO_URI (required)
  TARGET_DB_NAME   (default pmt_research)

Output collection:
  ref_uc_transfer_requirements:
    { _id, uc_code, school_id, school, group_id, set_id, source_order,
      receiving_code, normalized_code, parent_ids[], matched, source,
      updated_at }
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

DEFAULT_REQUIREMENTS = (
    HERE.parent.parent
    / "transfer-agreements-analysis"
    / "scraping"
    / "files"
    / "course_reqs.json"
)

UC_SCHOOLS = {
    "UCB": {"school_id": 79, "school": "UC Berkeley"},
    "UCD": {"school_id": 89, "school": "UC Davis"},
    "UCI": {"school_id": 120, "school": "UC Irvine"},
    "UCLA": {"school_id": 117, "school": "UC Los Angeles"},
    "UCM": {"school_id": 144, "school": "UC Merced"},
    "UCR": {"school_id": 46, "school": "UC Riverside"},
    "UCSD": {"school_id": 7, "school": "UC San Diego"},
    "UCSB": {"school_id": 128, "school": "UC Santa Barbara"},
    "UCSC": {"school_id": 132, "school": "UC Santa Cruz"},
}


def _env(name, default=None, required=False):
    val = os.environ.get(name, default)
    if required and not val:
        sys.exit(f"Missing required env var {name} (set it in scripts/.env or the shell).")
    return val


def normalize_code(value):
    s = str(value or "").upper().replace("&", " AND ")
    s = re.sub(r"[^A-Z0-9]+", " ", s)
    return re.sub(r"\s+", " ", s).strip()


def doc_id(uc_code, group_id, set_id, receiving_code):
    bits = [uc_code, group_id, str(set_id), normalize_code(receiving_code)]
    safe = [re.sub(r"[^A-Za-z0-9]+", "_", bit).strip("_") for bit in bits]
    return ":".join(safe)


def connect():
    uri = _env("TARGET_MONGO_URI", required=True)
    name = _env("TARGET_DB_NAME", "pmt_research")
    return MongoClient(uri)[name]


def used_parent_ids_by_school(db):
    out = {}
    cursor = db["uc_agreements"].find({}, {"uc_school_id": 1, "requirement_groups": 1})
    for agreement in cursor:
        school_id = int(agreement["uc_school_id"])
        used = out.setdefault(school_id, set())
        for group in agreement.get("requirement_groups") or []:
            for section in group.get("sections") or []:
                for receiver in section.get("receivers") or []:
                    receiving = receiver.get("receiving") or {}
                    if receiving.get("kind") == "course" and receiving.get("parent_id") is not None:
                        used.add(int(receiving["parent_id"]))
                    elif receiving.get("kind") == "series":
                        for parent_id in receiving.get("parent_ids") or []:
                            if parent_id is not None:
                                used.add(int(parent_id))
    return out


def university_course_lookup(db):
    rows = db["university_courses"].find(
        {},
        {"parent_id": 1, "prefix": 1, "number": 1, "title": 1, "_id": 0},
    )
    return {
        int(row["parent_id"]): {
            **row,
            "normalized_code": normalize_code(f"{row.get('prefix', '')} {row.get('number', '')}"),
        }
        for row in rows
    }


def load_requirements(path):
    data = json.loads(Path(path).read_text(encoding="utf-8"))["UC_REQUIREMENTS"]
    docs = []
    for uc_code, groups in data.items():
        school = UC_SCHOOLS.get(uc_code)
        if not school:
            raise ValueError(f"Unknown UC code in source file: {uc_code}")
        for group_id, entries in groups.items():
            for source_order, entry in enumerate(entries):
                receiving_code, set_id = entry[0], entry[1]
                docs.append({
                    "uc_code": uc_code,
                    "school_id": school["school_id"],
                    "school": school["school"],
                    "group_id": group_id,
                    "set_id": str(set_id),
                    "source_order": source_order,
                    "receiving_code": receiving_code,
                    "normalized_code": normalize_code(receiving_code),
                    "source_entry": entry,
                })
    return docs


def attach_parent_ids(db, docs):
    used_by_school = used_parent_ids_by_school(db)
    courses = university_course_lookup(db)
    for doc in docs:
        used = sorted(used_by_school.get(int(doc["school_id"]), set()))
        matches = [
            courses[parent_id]
            for parent_id in used
            if parent_id in courses and courses[parent_id]["normalized_code"] == doc["normalized_code"]
        ]
        doc["parent_ids"] = [int(match["parent_id"]) for match in matches]
        doc["matched"] = bool(matches)
        doc["matched_courses"] = [
            {
                "parent_id": int(match["parent_id"]),
                "prefix": match.get("prefix"),
                "number": match.get("number"),
                "title": match.get("title"),
            }
            for match in matches
        ]
    return docs


def build_ops(docs, source):
    now = dt.datetime.now(dt.timezone.utc)
    ops = []
    for doc in docs:
        payload = {
            **doc,
            "_id": doc_id(doc["uc_code"], doc["group_id"], doc["set_id"], doc["receiving_code"]),
            "source": source,
            "updated_at": now,
        }
        ops.append(UpdateOne({"_id": payload["_id"]}, {"$set": payload}, upsert=True))
    return ops


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--requirements-json", default=str(DEFAULT_REQUIREMENTS), help="path to course_reqs.json")
    ap.add_argument("--dry-run", action="store_true", help="validate matching without writing")
    args = ap.parse_args()

    if not Path(args.requirements_json).exists():
        sys.exit(f"course_reqs.json not found: {args.requirements_json}")

    db = connect()
    docs = attach_parent_ids(db, load_requirements(args.requirements_json))
    matched = sum(1 for doc in docs if doc["matched"])
    unmatched = [doc for doc in docs if not doc["matched"]]
    multi = [doc for doc in docs if len(doc["parent_ids"]) > 1]

    print(f"Loaded {len(docs)} curated UC transfer requirements.")
    print(f"Matched {matched}; unmatched {len(unmatched)}; multi-match {len(multi)}.")
    if unmatched:
        print("Unmatched requirements:")
        for doc in unmatched:
            print(f"  - {doc['uc_code']} {doc['group_id']} set {doc['set_id']}: {doc['receiving_code']}")

    if args.dry_run:
        print("Dry run only; no DB writes.")
        return

    ops = build_ops(docs, "transfer-agreements-analysis/scraping/files/course_reqs.json")
    if ops:
        db["ref_uc_transfer_requirements"].bulk_write(ops, ordered=False)
        db["ref_uc_transfer_requirements"].create_index("school_id")
        db["ref_uc_transfer_requirements"].create_index([("school_id", 1), ("group_id", 1), ("set_id", 1)])
        db["ref_uc_transfer_requirements"].create_index("parent_ids")
    print("ref_uc_transfer_requirements updated.")


if __name__ == "__main__":
    main()
