"""
Import the hand-curated general-education requirement structure into two
editable reference tables:

  ref_ge_patterns  — Cal-GETC (from PlanMyTransfer's transferPatterns.js, the
                     current standard) + UC-7 (from the prior research
                     ge_reqs.json "7CoursePattern"). One row per (pattern, area,
                     subgroup) with the number of courses required.
  ref_igetc        — the IGETC area structure, from the prior research
                     igetc.json (areas + sub-areas, required courses/units).

These are the "stats a person gathered" (not algorithmic), so they belong in an
editable table the References tab can adjust in place.

Env (scripts/.env or shell):
  TARGET_MONGO_URI (required, unless --dry-run)
  TARGET_DB_NAME   (default pmt_research)
"""
import argparse
import datetime as dt
import json
import os
import sys
from pathlib import Path

from dotenv import load_dotenv

HERE = Path(__file__).resolve().parent
load_dotenv(HERE / ".env")

RESEARCH = HERE.parent.parent / "transfer-agreements-analysis" / "prerequisites"
DEFAULT_GE = RESEARCH / "ge_reqs.json"
DEFAULT_IGETC = RESEARCH / "igetc.json"

# Cal-GETC structure, transcribed from PlanMyTransfer
# (server/shared/patterns/transferPatterns.js evaluateCalGetc). Tuple:
# (area_code, area_name, subgroup_code, subgroup_name, required, note).
CALGETC = [
    ("1", "English Communication", "1A", "English composition", 1, ""),
    ("1", "English Communication", "1B", "Critical thinking & composition", 1, ""),
    ("2", "Mathematical Concepts and Quantitative Reasoning", "2", "Math", 1, ""),
    ("3", "Arts and Humanities", "3A", "Arts", 1, ""),
    ("3", "Arts and Humanities", "3B", "Humanities", 1, ""),
    ("3", "Arts and Humanities", "3+", "Additional arts or humanities", 1, ""),
    ("4", "Social and Behavioral Sciences", "4", "2 courses, 2+ disciplines", 2, ""),
    ("5", "Physical and Biological Sciences", "5A", "Physical science", 1, ""),
    ("5", "Physical and Biological Sciences", "5B", "Biological science", 1, ""),
    ("5", "Physical and Biological Sciences", "5C", "Lab requirement", 1, "Satisfied within 5A or 5B"),
    ("6", "Ethnic Studies", "6", "Ethnic studies", 1, ""),
]


def _env(name, default=None, required=False):
    val = os.environ.get(name, default)
    if required and not val:
        sys.exit(f"Missing required env var {name} (set it in scripts/.env or the shell).")
    return val


def _units_note(node):
    bits = []
    if node.get("minUnits") is not None:
        bits.append(f"{node['minUnits']} units")
    if node.get("maxCourses") is not None:
        bits.append(f"max {node['maxCourses']} courses")
    return " · ".join(bits)


def build_ge_patterns(now, ge_path):
    rows = [{
        "_id": f"calgetc:{a}:{sg}",
        "pattern": "calgetc", "area_code": a, "area_name": an,
        "subgroup_code": sg, "subgroup_name": sn, "required": req, "note": note,
        "source": "PlanMyTransfer/transferPatterns.js", "updated_at": now,
    } for (a, an, sg, sn, req, note) in CALGETC]

    ge = json.loads(Path(ge_path).read_text(encoding="utf-8"))
    pattern = next((p for p in ge["requirementPatterns"] if p.get("patternId") == "7CoursePattern"), None)
    if pattern:
        for req in pattern["requirements"]:
            subs = req.get("subRequirements")
            if subs:
                for s in subs:
                    rows.append({
                        "_id": f"uc7:{req['reqId']}:{s['reqId']}",
                        "pattern": "uc7", "area_code": req["reqId"], "area_name": req["name"],
                        "subgroup_code": s["reqId"], "subgroup_name": s["name"],
                        "required": s.get("minCourses", 0), "note": _units_note(s),
                        "source": "transfer-agreements-analysis/prerequisites/ge_reqs.json",
                        "updated_at": now,
                    })
            else:
                rows.append({
                    "_id": f"uc7:{req['reqId']}:{req['reqId']}",
                    "pattern": "uc7", "area_code": req["reqId"], "area_name": req["name"],
                    "subgroup_code": req["reqId"], "subgroup_name": req["name"],
                    "required": req.get("minCourses", 0), "note": _units_note(req),
                    "source": "transfer-agreements-analysis/prerequisites/ge_reqs.json",
                    "updated_at": now,
                })
    return rows


def build_igetc(now, igetc_path):
    data = json.loads(Path(igetc_path).read_text(encoding="utf-8"))["IGETC_REQUIREMENTS"]
    rows = []
    for area_code, area in data.items():
        area_name = area.get("name")
        note = area.get("note") or ""
        subs = area.get("sub_areas")
        if subs:
            for sub_code, sub in subs.items():
                rows.append({
                    "_id": f"{area_code}:{sub_code}",
                    "area_code": area_code, "area_name": area_name,
                    "sub_area": sub_code, "sub_name": sub.get("name"),
                    "required_courses": sub.get("required_courses"),
                    "required_units": sub.get("required_units"),
                    "note": note, "source": "transfer-agreements-analysis/prerequisites/igetc.json",
                    "updated_at": now,
                })
        else:
            rows.append({
                "_id": f"{area_code}:-",
                "area_code": area_code, "area_name": area_name,
                "sub_area": "", "sub_name": area_name,
                "required_courses": area.get("required_courses"),
                "required_units": area.get("required_units"),
                "note": note, "source": "transfer-agreements-analysis/prerequisites/igetc.json",
                "updated_at": now,
            })
    return rows


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--ge-json", default=str(DEFAULT_GE))
    ap.add_argument("--igetc-json", default=str(DEFAULT_IGETC))
    ap.add_argument("--dry-run", action="store_true", help="parse and report without writing")
    args = ap.parse_args()

    for p in (args.ge_json, args.igetc_json):
        if not Path(p).exists():
            sys.exit(f"source not found: {p}")

    now = dt.datetime.now(dt.timezone.utc)
    ge_rows = build_ge_patterns(now, args.ge_json)
    igetc_rows = build_igetc(now, args.igetc_json)
    print(f"ref_ge_patterns: {len(ge_rows)} rows "
          f"({sum(r['pattern'] == 'calgetc' for r in ge_rows)} Cal-GETC, "
          f"{sum(r['pattern'] == 'uc7' for r in ge_rows)} UC-7)")
    print(f"ref_igetc: {len(igetc_rows)} rows")
    if ge_rows:
        print("GE sample:", json.dumps({k: v for k, v in ge_rows[0].items() if k != "updated_at"}, ensure_ascii=False))
    if igetc_rows:
        print("IGETC sample:", json.dumps({k: v for k, v in igetc_rows[0].items() if k != "updated_at"}, ensure_ascii=False))

    if args.dry_run:
        print("Dry run only; no DB writes.")
        return

    from pymongo import MongoClient, UpdateOne
    uri = _env("TARGET_MONGO_URI", required=True)
    db = MongoClient(uri)[_env("TARGET_DB_NAME", "pmt_research")]
    db["ref_ge_patterns"].bulk_write([UpdateOne({"_id": r["_id"]}, {"$set": r}, upsert=True) for r in ge_rows], ordered=False)
    db["ref_ge_patterns"].create_index("pattern")
    db["ref_igetc"].bulk_write([UpdateOne({"_id": r["_id"]}, {"$set": r}, upsert=True) for r in igetc_rows], ordered=False)
    print(f"ref_ge_patterns ({len(ge_rows)}) and ref_igetc ({len(igetc_rows)}) updated.")


if __name__ == "__main__":
    main()
