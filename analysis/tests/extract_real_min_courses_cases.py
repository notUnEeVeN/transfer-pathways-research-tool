"""Extract real ASSIST CS agreements as DB-free golden cases for the optimizer port.

Pulls a deterministic, varied sample of agreements for the 9 code-pinned
canonical CS majors, slims each requirement_groups tree to the fields the
eligibility engine + optimizer read, resolves the referenced CC courses
(units + same_as), and writes analysis/tests/fixtures/min_courses_real_cases.json.
Committed → the JS golden generator and the Python golden test both run without a DB.

Run once (and whenever the canonical majors change):
  .venv/bin/python tests/extract_real_min_courses_cases.py
"""
import json
import os
import sys
from collections import defaultdict
from pathlib import Path

from dotenv import load_dotenv
from pymongo import MongoClient

HERE = Path(__file__).resolve().parent
OUT = HERE / "fixtures" / "min_courses_real_cases.json"
sys.path.insert(0, str(HERE.parent))

from major_pins import canonical_cs_query  # noqa: E402

# Fields the eligibility predicates + optimizer actually read.
GROUP_KEYS = ("is_required", "group_advisement", "group_conjunction", "group_unit_advisement",
              "group_min_distinct_sections", "group_max_distinct_sections", "group_section_min_courses")
SECTION_KEYS = ("section_advisement", "unit_advisement")
RECEIVING_KEYS = ("kind", "parent_id", "parent_ids", "units", "code", "name")


def slim_option(o):
    return {"course_ids": [str(i) for i in (o.get("course_ids") or [])],
            "course_conjunction": o.get("course_conjunction") or "and"}


def slim_receiver(r):
    receiving = {k: r["receiving"][k] for k in RECEIVING_KEYS if k in (r.get("receiving") or {})}
    return {
        "hash_id": r.get("hash_id"),
        "articulation_status": r.get("articulation_status"),
        "options_conjunction": r.get("options_conjunction") or "and",
        "receiving": receiving,
        "options": [slim_option(o) for o in (r.get("options") or [])],
    }


def slim_group(g):
    out = {k: g[k] for k in GROUP_KEYS if k in g}
    out["sections"] = [
        {**{k: s[k] for k in SECTION_KEYS if k in s},
         "receivers": [slim_receiver(r) for r in (s.get("receivers") or [])]}
        for s in (g.get("sections") or [])
    ]
    return out


def referenced_ids(groups):
    ids = set()
    for g in groups:
        for s in g.get("sections") or []:
            for r in s.get("receivers") or []:
                for o in r.get("options") or []:
                    ids.update(str(i) for i in (o.get("course_ids") or []))
    return ids


def main():
    load_dotenv(HERE.parent.parent / "scripts" / ".env")
    db = MongoClient(os.environ["TARGET_MONGO_URI"], serverSelectionTimeoutMS=8000)[
        os.environ.get("TARGET_DB_NAME", "pmt_research")]

    q = canonical_cs_query()

    courses = {int(c["course_id"]): {"units": c.get("units"),
                                     "same_as": [{"course_id": str(p.get("course_id"))}
                                                 for p in (c.get("same_as") or [])]}
               for c in db.assist_courses.find(
                   {"side": "sending"}, {"course_id": 1, "units": 1, "same_as": 1})}

    # Deterministic: sort agreements, take up to 3 per campus, preferring variety
    # (a series receiver, a course-or option, a plain choose-N) when present.
    docs = list(db.assist_agreements.find(q, {"uc_school_id": 1, "community_college_id": 1,
                                          "community_college": 1, "major": 1, "requirement_groups": 1})
                .sort([("uc_school_id", 1), ("community_college_id", 1), ("major", 1), ("_id", 1)]))

    per_campus = defaultdict(list)
    for doc in docs:
        per_campus[int(doc["uc_school_id"])].append(doc)

    cases = []
    for sid in sorted(per_campus):
        for doc in per_campus[sid][:3]:
            groups = [slim_group(g) for g in (doc.get("requirement_groups") or [])]
            ids = referenced_ids(groups)
            cb = {}
            for cid in sorted(ids, key=lambda x: int(x) if str(x).isdigit() else x):
                info = courses.get(int(cid)) if str(cid).isdigit() else None
                base = info or {"units": None, "same_as": []}
                # course_id MUST be present — the oracle's toSyntheticUserCourse reads it,
                # and an absent id silently breaks completion (see genMinCoursesGoldens guard).
                cb[str(cid)] = {"course_id": str(cid), **base}
            cases.append({
                "case_id": f"real_{sid}_{doc['community_college_id']}_{str(doc['_id'])[-6:]}",
                "campus_school_id": sid,
                "college": doc.get("community_college"),
                "major": doc.get("major"),
                "majors": [{"requirement_groups": groups}],
                "coursesById": cb,
            })

    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_text(json.dumps(cases, indent=2) + "\n")
    print(f"wrote {len(cases)} real cases to {OUT.relative_to(HERE.parent)}")


if __name__ == "__main__":
    main()
