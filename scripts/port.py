"""
Incrementally port PMT data into the research cluster (UC agreements only —
the research project studies UC transfer pathways exclusively).

The research Atlas only ever stores what the project needs: you (the admin)
add or remove majors as the team's interests change, and this tool copies just
those majors' agreements plus the catalog docs they reference. It runs on YOUR
machine — the hosted research server never holds source-cluster credentials.
Which of the ported majors PARTNERS can see is controlled separately, in the
console's Admin tab (partner major access).

Agreement `_id`s and receiver `hash_id`s are preserved verbatim so audit
verdicts recorded against the research data can be merged back into the
production audit store later (scripts/merge_verdicts.py).

Commands (run from scripts/):
    python port.py init                     # colleges + schools + indexes (once)
    python port.py list "computer science"  # preview source majors matching a filter
    python port.py add  "computer science"  # port matching majors (contains, case-insens.)
    python port.py add  --exact "CSE: Computer Science B.S."
    python port.py remove --exact "CSE: Computer Science B.S."
    python port.py status                   # what the research cluster holds now

Every add/remove bumps `dataset_meta.dataset_version` (YYYY-MM-DD-vN) and
appends to `dataset_changelog`, so analyses/exports/verdicts are attributable
to an exact dataset state. Audit verdicts, groupings, and curations are never
touched — removing a major orphans its verdicts harmlessly; re-adding the
major reconnects them (same `_id`s).

Env (scripts/.env or shell):
    SOURCE_MONGO_URI (default mongodb://localhost:27017)
    SOURCE_DB_NAME   (default pmt_data)
    TARGET_MONGO_URI (required — the research cluster)
    TARGET_DB_NAME   (default pmt_research)
"""
import argparse
import datetime
import os
import re
import sys
from pathlib import Path

from dotenv import load_dotenv
from pymongo import MongoClient, UpdateOne

HERE = Path(__file__).resolve().parent
load_dotenv(HERE / ".env")

# UC-only: the research project studies UC transfer pathways exclusively.
AGREEMENT_COLLECTIONS = ("uc_agreements",)
FULL_COPY_COLLECTIONS = ("community_colleges", "uc_schools")


def _env(name, default=None, required=False):
    val = os.environ.get(name, default)
    if required and not val:
        sys.exit(f"Missing required env var {name} (set it in scripts/.env or the shell).")
    return val


def connect():
    source = MongoClient(_env("SOURCE_MONGO_URI", "mongodb://localhost:27017"))
    source_db = source[_env("SOURCE_DB_NAME", "pmt_data")]
    target_uri = _env("TARGET_MONGO_URI", required=True)
    target_db_name = _env("TARGET_DB_NAME", "pmt_research")
    if (
        target_uri == _env("SOURCE_MONGO_URI", "mongodb://localhost:27017")
        and target_db_name == _env("SOURCE_DB_NAME", "pmt_data")
    ):
        sys.exit("Refusing to run: target is the same database as the source.")
    target_db = MongoClient(target_uri)[target_db_name]
    return source_db, target_db


def major_filter(term, exact):
    if exact:
        return {"major": term}
    return {"major": {"$regex": re.escape(term), "$options": "i"}}


def matched_majors(db, mfilter):
    return {coll: sorted(db[coll].distinct("major", mfilter)) for coll in AGREEMENT_COLLECTIONS}


def referenced_ids(db, mfilter):
    """course_ids + university parent_ids referenced by the matched agreements."""
    course_ids, parent_ids = set(), set()
    for coll in AGREEMENT_COLLECTIONS:
        for doc in db[coll].find(mfilter, {"requirement_groups": 1}):
            for group in doc.get("requirement_groups") or []:
                for section in group.get("sections") or []:
                    for recv in section.get("receivers") or []:
                        receiving = recv.get("receiving") or {}
                        if receiving.get("kind") == "course":
                            parent_ids.add(receiving.get("parent_id"))
                        elif receiving.get("kind") == "series":
                            parent_ids.update(receiving.get("parent_ids") or [])
                        for opt in recv.get("options") or []:
                            course_ids.update(opt.get("course_ids") or [])
    course_ids.discard(None)
    parent_ids.discard(None)
    return course_ids, parent_ids


def upsert_by_id(target_coll, docs):
    """Idempotent copy preserving _ids (replace-or-insert)."""
    ops = [UpdateOne({"_id": d["_id"]}, {"$set": d}, upsert=True) for d in docs]
    n = 0
    for i in range(0, len(ops), 1000):
        res = target_coll.bulk_write(ops[i : i + 1000], ordered=False)
        n += res.upserted_count + res.modified_count + res.matched_count
    return len(ops)


def bump_version(target_db, action, detail, counts):
    today = datetime.date.today().isoformat()
    prefix = f"{today}-v"
    seen = [
        v for v in target_db["dataset_changelog"].distinct("dataset_version") if v.startswith(prefix)
    ]
    ns = [int(v[len(prefix):]) for v in seen if v[len(prefix):].isdigit()]
    version = f"{prefix}{max(ns) + 1 if ns else 1}"
    now = datetime.datetime.now(datetime.timezone.utc)

    majors = {
        coll: sorted(target_db[coll].distinct("major")) for coll in AGREEMENT_COLLECTIONS
    }
    meta = {
        "dataset_version": version,
        "updated_at": now,
        "majors": majors,
        "counts": {c: target_db[c].estimated_document_count() for c in (
            *AGREEMENT_COLLECTIONS, "courses", "university_courses", "uc_major_admissions",
        )},
    }
    target_db["dataset_meta"].replace_one({"_id": "current"}, {"_id": "current", **meta}, upsert=True)
    target_db["dataset_changelog"].insert_one(
        {"dataset_version": version, "at": now, "action": action, "detail": detail, "counts": counts}
    )
    return version


def ensure_indexes(target_db):
    target_db["community_colleges"].create_index("id", unique=True)
    target_db["uc_schools"].create_index("id", unique=True)
    target_db["courses"].create_index("course_id")
    target_db["courses"].create_index("community_college_id")
    target_db["university_courses"].create_index("parent_id", unique=True)
    target_db["university_courses"].create_index(
        [("university_id", 1), ("prefix", 1), ("number", 1)]
    )
    target_db["uc_agreements"].create_index(
        [("uc_school", 1), ("community_college", 1), ("major", 1)], unique=True
    )
    target_db["uc_major_admissions"].create_index([("uc_school", 1), ("major", 1)], unique=True)


def cmd_init(args):
    source_db, target_db = connect()
    counts = {}
    for coll in FULL_COPY_COLLECTIONS:
        counts[coll] = upsert_by_id(target_db[coll], list(source_db[coll].find()))
    ensure_indexes(target_db)
    version = bump_version(target_db, "init", "colleges + schools", counts)
    print(f"Initialized research cluster @ dataset_version {version}:")
    for coll, n in counts.items():
        print(f"  {coll}: {n} docs")


def cmd_list(args):
    # Source-only: no research-cluster credentials needed to preview.
    source_db = MongoClient(_env("SOURCE_MONGO_URI", "mongodb://localhost:27017"))[
        _env("SOURCE_DB_NAME", "pmt_data")
    ]
    mfilter = major_filter(args.term, args.exact)
    for coll, majors in matched_majors(source_db, mfilter).items():
        print(f"\n{coll} — {len(majors)} major name(s):")
        for m in majors:
            print(f"  {m}")


def cmd_add(args):
    source_db, target_db = connect()
    mfilter = major_filter(args.term, args.exact)
    matched = matched_majors(source_db, mfilter)
    if not any(matched.values()):
        sys.exit("No source majors match — try `python port.py list` first.")

    print(f"Porting majors matching {'exactly' if args.exact else 'contains'} '{args.term}':")
    for coll, majors in matched.items():
        for m in majors:
            print(f"  [{coll.split('_')[0]}] {m}")
    if not args.yes and input("\nType 'yes' to port: ").strip().lower() != "yes":
        sys.exit("Aborted.")

    counts = {}
    for coll in AGREEMENT_COLLECTIONS:
        counts[coll] = upsert_by_id(target_db[coll], list(source_db[coll].find(mfilter)))
    counts["uc_major_admissions"] = upsert_by_id(
        target_db["uc_major_admissions"], list(source_db["uc_major_admissions"].find(mfilter))
    )
    course_ids, parent_ids = referenced_ids(source_db, mfilter)
    counts["courses"] = upsert_by_id(
        target_db["courses"],
        list(source_db["courses"].find({"course_id": {"$in": sorted(course_ids)}})),
    )
    counts["university_courses"] = upsert_by_id(
        target_db["university_courses"],
        list(source_db["university_courses"].find({"parent_id": {"$in": sorted(parent_ids)}})),
    )
    ensure_indexes(target_db)
    all_names = sorted({m for majors in matched.values() for m in majors})
    version = bump_version(target_db, "add", all_names, counts)
    print(f"\nPorted @ dataset_version {version}:")
    for coll, n in counts.items():
        print(f"  {coll}: {n} docs")


def cmd_remove(args):
    _, target_db = connect()
    mfilter = major_filter(args.term, args.exact)
    matched = matched_majors(target_db, mfilter)
    if not any(matched.values()):
        sys.exit("No majors in the research cluster match that term.")

    print("Removing from the research cluster:")
    for coll, majors in matched.items():
        for m in majors:
            print(f"  [{coll.split('_')[0]}] {m}")
    print("(Audit verdicts/groupings/curations are kept; re-adding the major reconnects them.)")
    if not args.yes and input("\nType 'yes' to remove: ").strip().lower() != "yes":
        sys.exit("Aborted.")

    counts = {}
    for coll in AGREEMENT_COLLECTIONS:
        counts[coll] = -target_db[coll].delete_many(mfilter).deleted_count
    counts["uc_major_admissions"] = -target_db["uc_major_admissions"].delete_many(mfilter).deleted_count

    # Prune catalog docs no longer referenced by any remaining agreement.
    still_course_ids, still_parent_ids = referenced_ids(target_db, {})
    counts["courses"] = -target_db["courses"].delete_many(
        {"course_id": {"$nin": sorted(still_course_ids)}}
    ).deleted_count
    counts["university_courses"] = -target_db["university_courses"].delete_many(
        {"parent_id": {"$nin": sorted(still_parent_ids)}}
    ).deleted_count

    all_names = sorted({m for majors in matched.values() for m in majors})
    version = bump_version(target_db, "remove", all_names, counts)
    print(f"\nRemoved @ dataset_version {version}:")
    for coll, n in counts.items():
        print(f"  {coll}: {n} docs")


def cmd_status(args):
    _, target_db = connect()
    meta = target_db["dataset_meta"].find_one({"_id": "current"})
    if not meta:
        sys.exit("Research cluster not initialized — run `python port.py init` first.")
    print(f"dataset_version: {meta['dataset_version']}  (updated {meta['updated_at']})")
    for coll, majors in (meta.get("majors") or {}).items():
        print(f"\n{coll} — {len(majors)} major(s):")
        for m in majors:
            print(f"  {m}")
    print("\ncounts:")
    for coll, n in (meta.get("counts") or {}).items():
        print(f"  {coll}: {n}")
    print("\nrecent changes:")
    for entry in target_db["dataset_changelog"].find().sort("at", -1).limit(10):
        print(f"  {entry['dataset_version']}  {entry['action']}: {entry['detail']}")


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    sub = ap.add_subparsers(dest="command", required=True)

    sub.add_parser("init", help="copy colleges + schools, create indexes")
    p_list = sub.add_parser("list", help="preview source majors matching a term")
    p_add = sub.add_parser("add", help="port majors matching a term")
    p_remove = sub.add_parser("remove", help="remove majors from the research cluster")
    sub.add_parser("status", help="show what the research cluster holds")

    for p in (p_list, p_add, p_remove):
        p.add_argument("term", help="major name (or substring) to match")
        p.add_argument("--exact", action="store_true", help="match the major name exactly")
    for p in (p_add, p_remove):
        p.add_argument("--yes", action="store_true", help="skip the interactive confirm")

    args = ap.parse_args()
    {"init": cmd_init, "list": cmd_list, "add": cmd_add, "remove": cmd_remove, "status": cmd_status}[
        args.command
    ](args)


if __name__ == "__main__":
    main()
