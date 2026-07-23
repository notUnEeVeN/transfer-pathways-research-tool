"""
Incrementally port PMT data into the research cluster (UC agreements only —
the research project studies UC transfer pathways exclusively).

The research Atlas only ever stores what the project needs: you (the admin)
add or remove majors as the team's interests change, and this tool copies just
those majors' agreements plus complete CC/UC catalog docs for the included
schools. It runs on YOUR machine — the hosted research server never holds
source-cluster credentials.
Which of the ported majors PARTNERS can see is controlled separately, in the
console's Admin tab (partner major access).

Agreement `_id`s and receiver `hash_id`s are preserved verbatim so audit
verdicts recorded against the research data can be merged back into the
production audit store later (scripts/merge_verdicts.py).

Commands (run from scripts/):
    python port.py init                     # colleges + schools + full catalogs + indexes (once)
    python port.py list "computer science"  # preview source majors matching a filter
    python port.py add  "computer science"  # port matching majors (contains, case-insens.)
    python port.py add  --exact "CSE: Computer Science B.S."
    python port.py remove --exact "CSE: Computer Science B.S."
    python port.py remove-pairs --pair "7=CSE: Computer Science B.S." --dry-run
    python port.py remove-pairs --pair "7=CSE: Computer Science B.S." --yes
    python port.py refresh-catalogs         # backfill/update all CC + UC catalog docs
    python port.py status                   # what the research cluster holds now

Every mutating operation records `settings.last_data_refresh_at`. Audit
verdicts and curated data are never touched — removing a major orphans its
reviews harmlessly; re-adding the major reconnects them (same `_id`s).
Exact pair removal first snapshots the affected agreements, admissions, and
all settings into `port_removal_backups` / `port_removal_backup_documents`.
Source-shaped staging collections exist only for the duration of a port and
are removed after the canonical rebuild succeeds.

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
import subprocess
import sys
import uuid
from pathlib import Path

from dotenv import load_dotenv
from pymongo import MongoClient, UpdateOne

HERE = Path(__file__).resolve().parent
load_dotenv(HERE / ".env")

# UC-only: the research project studies UC transfer pathways exclusively.
AGREEMENT_COLLECTIONS = ("uc_agreements",)
FULL_COPY_COLLECTIONS = ("community_colleges", "uc_schools")
CANONICAL_AGREEMENTS = "assist_agreements"
CANONICAL_ADMISSIONS = "admissions"
REMOVAL_BACKUPS = "port_removal_backups"
REMOVAL_BACKUP_DOCUMENTS = "port_removal_backup_documents"


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


def matched_majors(db, mfilter, collections=AGREEMENT_COLLECTIONS):
    return {coll: sorted(db[coll].distinct("major", mfilter)) for coll in collections}


def parse_school_major_pair(value):
    """Parse SCHOOL_ID=EXACT_MAJOR without normalizing the major string."""
    school_id, separator, major = value.partition("=")
    if not separator or not school_id.strip() or not major:
        raise argparse.ArgumentTypeError(
            "pair must use SCHOOL_ID=EXACT_MAJOR (for example, "
            "79=Computer Science, B.A.)"
        )
    try:
        numeric_school_id = int(school_id.strip())
    except ValueError as exc:
        raise argparse.ArgumentTypeError("pair school id must be an integer") from exc
    if numeric_school_id <= 0:
        raise argparse.ArgumentTypeError("pair school id must be positive")
    return numeric_school_id, major


def exact_pair_filter(pairs):
    """Return an exact campus+program filter for one or more parsed pairs."""
    clauses = [
        {"uc_school_id": school_id, "major": major}
        for school_id, major in dict.fromkeys(pairs)
    ]
    if not clauses:
        raise ValueError("at least one campus-program pair is required")
    return clauses[0] if len(clauses) == 1 else {"$or": clauses}


def preferred_collection(target_db, canonical, legacy):
    """Read the canonical collection when installed, otherwise its port stage."""
    if target_db[canonical].estimated_document_count() > 0:
        return canonical
    return legacy


def pair_removal_preview(target_db, pairs):
    """Count exact pair matches without creating a legacy stage or writing."""
    agreement_collection = preferred_collection(
        target_db, CANONICAL_AGREEMENTS, AGREEMENT_COLLECTIONS[0]
    )
    admissions_collection = preferred_collection(
        target_db, CANONICAL_ADMISSIONS, "uc_major_admissions"
    )
    names = {
        int(row["source_id"]): row.get("name")
        for row in target_db["assist_institutions"].find(
            {
                "kind": "university",
                "source_id": {"$in": sorted({school_id for school_id, _ in pairs})},
            },
            {"source_id": 1, "name": 1},
        )
        if row.get("source_id") is not None
    }
    preview = []
    for school_id, major in dict.fromkeys(pairs):
        query = exact_pair_filter([(school_id, major)])
        preview.append({
            "school_id": school_id,
            "school": names.get(school_id, f"UC school {school_id}"),
            "major": major,
            "agreements": target_db[agreement_collection].count_documents(query),
            "admissions": target_db[admissions_collection].count_documents(query),
        })
    return preview


def create_removal_backup(target_db, pairs, preview, now=None, token=None):
    """Persist exact pre-removal rows before any staging or canonical writes.

    The canonical migration intentionally replaces collections with
    ``dropTarget`` and subsequently drops its legacy inputs.  These two backup
    collections are not migration destinations or legacy collections, so the
    snapshot survives a successful cleanup as well as an interrupted rebuild.
    """
    now = now or datetime.datetime.now(datetime.timezone.utc)
    token = token or uuid.uuid4().hex[:8]
    timestamp = now.astimezone(datetime.timezone.utc).strftime("%Y%m%dT%H%M%S%fZ")
    backup_id = f"major-pair-removal-{timestamp}-{token}"
    pairs = list(dict.fromkeys(pairs))
    removal_filter = exact_pair_filter(pairs)
    agreement_docs = list(target_db[CANONICAL_AGREEMENTS].find(removal_filter))
    admission_docs = list(target_db[CANONICAL_ADMISSIONS].find(removal_filter))
    settings_docs = list(target_db["settings"].find({}))
    expected_agreements = sum(row["agreements"] for row in preview)
    expected_admissions = sum(row["admissions"] for row in preview)

    if len(agreement_docs) != expected_agreements or len(admission_docs) != expected_admissions:
        sys.exit(
            "Canonical rows changed after preview; refusing removal before backup "
            f"(agreements {len(agreement_docs)}/{expected_agreements}, "
            f"admissions {len(admission_docs)}/{expected_admissions})."
        )
    if not settings_docs:
        sys.exit("Settings are empty; refusing removal without a settings backup.")

    manifest = {
        "_id": backup_id,
        "kind": "exact_major_pair_removal",
        "schema_version": 1,
        "status": "preparing",
        "created_at": now,
        "pairs": [
            {"school_id": school_id, "major": major}
            for school_id, major in pairs
        ],
        "counts": {
            CANONICAL_AGREEMENTS: len(agreement_docs),
            CANONICAL_ADMISSIONS: len(admission_docs),
            "settings": len(settings_docs),
        },
    }
    records = []
    for collection, docs in (
        (CANONICAL_AGREEMENTS, agreement_docs),
        (CANONICAL_ADMISSIONS, admission_docs),
        ("settings", settings_docs),
    ):
        for doc in docs:
            records.append({
                "_id": f"{backup_id}:{collection}:{doc['_id']}",
                "backup_id": backup_id,
                "collection": collection,
                "original_id": doc["_id"],
                "document": doc,
            })

    manifests = target_db[REMOVAL_BACKUPS]
    documents = target_db[REMOVAL_BACKUP_DOCUMENTS]
    manifests.create_index([("created_at", -1)])
    documents.create_index([("backup_id", 1), ("collection", 1)])
    manifests.insert_one(manifest)
    for index in range(0, len(records), 500):
        documents.insert_many(records[index : index + 500], ordered=True)
    stored = documents.count_documents({"backup_id": backup_id})
    if stored != len(records):
        raise RuntimeError(
            f"Removal backup {backup_id} stored {stored} documents; expected {len(records)}"
        )
    result = manifests.update_one(
        {"_id": backup_id, "status": "preparing"},
        {"$set": {"status": "ready", "document_count": stored, "ready_at": now}},
    )
    if result.matched_count != 1:
        raise RuntimeError(f"Removal backup {backup_id} could not be marked ready")
    return backup_id


def complete_removal_backup(target_db, backup_id, counts):
    """Mark a ready backup as the recovery point for a completed removal."""
    completed_at = datetime.datetime.now(datetime.timezone.utc)
    result = target_db[REMOVAL_BACKUPS].update_one(
        {"_id": backup_id, "status": "ready"},
        {"$set": {
            "status": "completed",
            "completed_at": completed_at,
            "mutation_counts": counts,
        }},
    )
    if result.matched_count != 1:
        raise RuntimeError(f"Removal completed but backup {backup_id} status was not updated")


def upsert_by_id(target_coll, docs):
    """Idempotent copy preserving _ids (replace-or-insert)."""
    ops = [UpdateOne({"_id": d["_id"]}, {"$set": d}, upsert=True) for d in docs]
    n = 0
    for i in range(0, len(ops), 1000):
        res = target_coll.bulk_write(ops[i : i + 1000], ordered=False)
        n += res.upserted_count + res.modified_count + res.matched_count
    return len(ops)


def prepare_agreement_stage(target_db):
    """Build temporary source-shaped inputs from canonical data."""
    if (
        target_db["uc_agreements"].estimated_document_count() == 0
        and target_db[CANONICAL_AGREEMENTS].estimated_document_count() > 0
    ):
        upsert_by_id(
            target_db["uc_agreements"],
            list(target_db[CANONICAL_AGREEMENTS].find()),
        )
    if (
        target_db["uc_major_admissions"].estimated_document_count() == 0
        and target_db[CANONICAL_ADMISSIONS].estimated_document_count() > 0
    ):
        upsert_by_id(
            target_db["uc_major_admissions"],
            list(target_db[CANONICAL_ADMISSIONS].find()),
        )


def reset_agreement_stage(target_db):
    """Recreate removal inputs exactly from canonical data.

    Pair removal must not trust a source-shaped collection left behind by an
    interrupted or canceled prior port. Replacing the temporary inputs here
    guarantees that deleting requested pairs cannot also resurrect or discard
    unrelated programs during the canonical rebuild.
    """
    agreements = list(target_db[CANONICAL_AGREEMENTS].find())
    if not agreements:
        sys.exit("Canonical agreements are empty; refusing pair removal.")
    replace_collection(target_db[AGREEMENT_COLLECTIONS[0]], agreements)
    replace_collection(
        target_db["uc_major_admissions"],
        list(target_db[CANONICAL_ADMISSIONS].find()),
        required=False,
    )


def rebuild_canonical():
    """Install canonical data, then remove all temporary source-shaped inputs."""
    migration = HERE.parent / "server" / "scripts" / "migrateCanonicalSchema.js"
    command = ["node", str(migration), "--apply"]
    try:
        subprocess.run(command, cwd=migration.parent.parent, check=True)
        subprocess.run(
            [*command, "--drop-legacy", "--yes"],
            cwd=migration.parent.parent,
            check=True,
        )
    except FileNotFoundError:
        sys.exit("Node.js is required to rebuild the canonical research schema.")
    except subprocess.CalledProcessError as exc:
        sys.exit(f"Canonical schema rebuild failed (exit {exc.returncode}).")


def replace_collection(target_coll, docs, required=True):
    """Replace a catalog collection with source docs, preserving source _ids."""
    docs = list(docs)
    if required and not docs:
        sys.exit(f"Refusing to replace {target_coll.name}: source query returned zero docs.")
    target_coll.delete_many({})
    for i in range(0, len(docs), 1000):
        target_coll.insert_many(docs[i : i + 1000], ordered=False)
    return len(docs)


def source_school_ids(source_db):
    cc_ids = sorted(
        {row.get("id") for row in source_db["community_colleges"].find({}, {"id": 1, "_id": 0})}
        - {None}
    )
    uc_ids = sorted(
        {row.get("id") for row in source_db["uc_schools"].find({}, {"id": 1, "_id": 0})}
        - {None}
    )
    if not cc_ids:
        sys.exit("No community_colleges ids found in source; refusing to sync catalogs.")
    if not uc_ids:
        sys.exit("No uc_schools ids found in source; refusing to sync university catalogs.")
    return cc_ids, uc_ids


def sync_full_catalogs(source_db, target_db):
    """Copy every CC course and every UC course for the included schools."""
    cc_ids, uc_ids = source_school_ids(source_db)
    return {
        "courses": replace_collection(
            target_db["courses"],
            source_db["courses"].find({"community_college_id": {"$in": cc_ids}}),
        ),
        "university_courses": replace_collection(
            target_db["university_courses"],
            source_db["university_courses"].find({"university_id": {"$in": uc_ids}}),
        ),
    }


def mark_refreshed(target_db, counts):
    now = datetime.datetime.now(datetime.timezone.utc)
    target_db["settings"].update_one(
        {"_id": "app"},
        {
            "$set": {
                "last_data_refresh_at": now,
                "last_refresh_counts": counts,
                "canonical_dirty": True,
            },
            "$setOnInsert": {"visible_pairs": []},
        },
        upsert=True,
    )
    return now


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
    prepare_agreement_stage(target_db)
    counts = {}
    for coll in FULL_COPY_COLLECTIONS:
        counts[coll] = upsert_by_id(target_db[coll], list(source_db[coll].find()))
    counts.update(sync_full_catalogs(source_db, target_db))
    ensure_indexes(target_db)
    refreshed_at = mark_refreshed(target_db, counts)
    rebuild_canonical()
    print(f"Initialized research cluster @ {refreshed_at.isoformat()}:")
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
    prepare_agreement_stage(target_db)
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
    for coll in FULL_COPY_COLLECTIONS:
        counts[coll] = upsert_by_id(target_db[coll], list(source_db[coll].find()))
    for coll in AGREEMENT_COLLECTIONS:
        counts[coll] = upsert_by_id(target_db[coll], list(source_db[coll].find(mfilter)))
    counts["uc_major_admissions"] = upsert_by_id(
        target_db["uc_major_admissions"], list(source_db["uc_major_admissions"].find(mfilter))
    )
    counts.update(sync_full_catalogs(source_db, target_db))
    ensure_indexes(target_db)
    all_names = sorted({m for majors in matched.values() for m in majors})
    refreshed_at = mark_refreshed(target_db, counts)
    rebuild_canonical()
    print(f"\nPorted @ {refreshed_at.isoformat()}:")
    for coll, n in counts.items():
        print(f"  {coll}: {n} docs")


def cmd_remove(args):
    source_db, target_db = connect()
    mfilter = major_filter(args.term, args.exact)
    preview_collection = preferred_collection(
        target_db, CANONICAL_AGREEMENTS, AGREEMENT_COLLECTIONS[0]
    )
    matched = matched_majors(target_db, mfilter, (preview_collection,))
    if not any(matched.values()):
        sys.exit("No majors in the research cluster match that term.")

    print("Removing from the research cluster:")
    for coll, majors in matched.items():
        for m in majors:
            print(f"  [uc] {m}")
    print("(Audit verdicts/groupings/curations are kept; re-adding the major reconnects them.)")
    if args.dry_run:
        print("Dry run only; no DB writes.")
        return
    if not args.yes and input("\nType 'yes' to remove: ").strip().lower() != "yes":
        sys.exit("Aborted.")

    prepare_agreement_stage(target_db)
    counts = {}
    for coll in AGREEMENT_COLLECTIONS:
        counts[coll] = -target_db[coll].delete_many(mfilter).deleted_count
    counts["uc_major_admissions"] = -target_db["uc_major_admissions"].delete_many(mfilter).deleted_count
    for coll in FULL_COPY_COLLECTIONS:
        counts[coll] = upsert_by_id(target_db[coll], list(source_db[coll].find()))
    counts.update(sync_full_catalogs(source_db, target_db))
    ensure_indexes(target_db)

    all_names = sorted({m for majors in matched.values() for m in majors})
    refreshed_at = mark_refreshed(target_db, counts)
    rebuild_canonical()
    print(f"\nRemoved @ {refreshed_at.isoformat()}:")
    for coll, n in counts.items():
        print(f"  {coll}: {n} docs")


def cmd_remove_pairs(args):
    """Preview or remove an explicit set of exact campus-program pairs."""
    pairs = list(dict.fromkeys(args.pair))
    _source_db, target_db = connect()
    preview = pair_removal_preview(target_db, pairs)
    missing = [row for row in preview if row["agreements"] == 0]

    print("Exact campus-program removal preview:")
    for row in preview:
        print(
            f"  [{row['school_id']}] {row['school']} — {row['major']!r}: "
            f"{row['agreements']} agreement(s), {row['admissions']} admission row(s)"
        )
    print(
        f"Total: {sum(row['agreements'] for row in preview)} agreement(s), "
        f"{sum(row['admissions'] for row in preview)} admission row(s)"
    )
    print("Audit verdicts/groupings/curations are kept and may become orphaned.")

    if missing:
        labels = ", ".join(f"{row['school_id']}={row['major']!r}" for row in missing)
        sys.exit(f"Refusing removal: no agreement matches these exact pairs: {labels}")
    if args.dry_run:
        print("Dry run only; no DB writes or staging collections were created.")
        return
    if not args.yes and input("\nType 'yes' to remove exactly these pairs: ").strip().lower() != "yes":
        sys.exit("Aborted.")

    # This is the first write. The durable snapshot must be complete and marked
    # ready before temporary inputs or canonical data can change.
    backup_id = create_removal_backup(target_db, pairs, preview)
    print(f"Durable pre-removal backup ready: {backup_id}")

    # Start from a deterministic copy of canonical data, then verify that the
    # pairs about to be deleted still have the counts shown in the preview.
    reset_agreement_stage(target_db)
    staged_preview = pair_removal_preview_from_collections(
        target_db, pairs, AGREEMENT_COLLECTIONS[0], "uc_major_admissions"
    )
    for before, staged in zip(preview, staged_preview):
        if (
            before["agreements"] != staged["agreements"]
            or before["admissions"] != staged["admissions"]
        ):
            sys.exit(
                "Staged counts changed after preview; refusing removal for "
                f"{before['school_id']}={before['major']!r}."
            )

    removal_filter = exact_pair_filter(pairs)
    counts = {
        AGREEMENT_COLLECTIONS[0]: -target_db[AGREEMENT_COLLECTIONS[0]]
        .delete_many(removal_filter).deleted_count,
        "uc_major_admissions": -target_db["uc_major_admissions"]
        .delete_many(removal_filter).deleted_count,
    }
    # Exact removal must not refresh the source catalogs as a side effect. The
    # canonical rebuild falls back to the already-installed institutions and
    # courses when the legacy catalog collections are absent, so only the two
    # explicitly staged pair-bearing collections change here.
    refreshed_at = mark_refreshed(target_db, counts)
    rebuild_canonical()
    complete_removal_backup(target_db, backup_id, counts)
    print(f"\nRemoved exact pairs @ {refreshed_at.isoformat()}:")
    print(f"  recovery backup: {backup_id}")
    for coll, n in counts.items():
        print(f"  {coll}: {n} docs")


def pair_removal_preview_from_collections(target_db, pairs, agreements, admissions):
    """Internal exact-count check against explicitly selected collections."""
    return [
        {
            "agreements": target_db[agreements].count_documents(
                exact_pair_filter([(school_id, major)])
            ),
            "admissions": target_db[admissions].count_documents(
                exact_pair_filter([(school_id, major)])
            ),
        }
        for school_id, major in pairs
    ]


def cmd_refresh_catalogs(args):
    source_db, target_db = connect()
    prepare_agreement_stage(target_db)
    for coll in FULL_COPY_COLLECTIONS:
        upsert_by_id(target_db[coll], list(source_db[coll].find()))
    counts = sync_full_catalogs(source_db, target_db)
    ensure_indexes(target_db)
    refreshed_at = mark_refreshed(target_db, counts)
    rebuild_canonical()
    print(f"Refreshed full catalogs @ {refreshed_at.isoformat()}:")
    for coll, n in counts.items():
        print(f"  {coll}: {n} docs")


def cmd_status(args):
    _, target_db = connect()
    settings = target_db["settings"].find_one({"_id": "app"})
    if not settings:
        sys.exit("Research cluster not initialized — run `python port.py init` first.")
    print(f"last refreshed: {settings.get('last_data_refresh_at', 'unknown')}")
    agreement_collection = (
        CANONICAL_AGREEMENTS
        if target_db[CANONICAL_AGREEMENTS].estimated_document_count()
        else "uc_agreements"
    )
    majors_by_collection = {
        agreement_collection: sorted(target_db[agreement_collection].distinct("major"))
    }
    for coll, majors in majors_by_collection.items():
        print(f"\n{coll} — {len(majors)} major(s):")
        for m in majors:
            print(f"  {m}")
    print("\ncounts:")
    if agreement_collection == CANONICAL_AGREEMENTS:
        print(f"  {CANONICAL_AGREEMENTS}: {target_db[CANONICAL_AGREEMENTS].estimated_document_count()}")
        print(f"  assist_courses (sending): {target_db['assist_courses'].count_documents({'side': 'sending'})}")
        print(f"  assist_courses (receiving): {target_db['assist_courses'].count_documents({'side': 'receiving'})}")
        print(f"  admissions: {target_db[CANONICAL_ADMISSIONS].estimated_document_count()}")
    else:
        for coll in (*AGREEMENT_COLLECTIONS, "courses", "university_courses", "uc_major_admissions"):
            print(f"  {coll}: {target_db[coll].estimated_document_count()}")


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    sub = ap.add_subparsers(dest="command", required=True)

    sub.add_parser("init", help="copy colleges + schools, create indexes")
    sub.add_parser("refresh-catalogs", help="copy every CC + UC course for the included schools")
    p_list = sub.add_parser("list", help="preview source majors matching a term")
    p_add = sub.add_parser("add", help="port majors matching a term")
    p_remove = sub.add_parser("remove", help="remove majors from the research cluster")
    p_remove_pairs = sub.add_parser(
        "remove-pairs",
        help="safely preview/remove exact UC-campus + major pairs",
    )
    sub.add_parser("status", help="show what the research cluster holds")

    for p in (p_list, p_add, p_remove):
        p.add_argument("term", help="major name (or substring) to match")
        p.add_argument("--exact", action="store_true", help="match the major name exactly")
    for p in (p_add, p_remove):
        p.add_argument("--yes", action="store_true", help="skip the interactive confirm")
    p_remove.add_argument("--dry-run", action="store_true", help="preview without writing")
    p_remove_pairs.add_argument(
        "--pair",
        action="append",
        required=True,
        type=parse_school_major_pair,
        metavar="SCHOOL_ID=EXACT_MAJOR",
        help="exact pair to remove; repeat for a batch",
    )
    p_remove_pairs.add_argument("--dry-run", action="store_true", help="preview without writing")
    p_remove_pairs.add_argument("--yes", action="store_true", help="skip the interactive confirm")

    args = ap.parse_args()
    {
        "init": cmd_init,
        "refresh-catalogs": cmd_refresh_catalogs,
        "list": cmd_list,
        "add": cmd_add,
        "remove": cmd_remove,
        "remove-pairs": cmd_remove_pairs,
        "status": cmd_status,
    }[
        args.command
    ](args)


if __name__ == "__main__":
    main()
