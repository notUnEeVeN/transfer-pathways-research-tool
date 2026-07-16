"""
Import the prerequisite concept vocabulary and the course->concept mapping.

Two inputs, applied in order (concepts first so mapping slugs can validate):

  scripts/data/prereq_concepts.json   -> curated_requirements (kind prereq_concept)
  scripts/data/course_concepts.json   -> concept* fields on assist_courses

Rules (spec docs/superpowers/specs/2026-07-15-prerequisite-concept-graph-design.md):
  - never overwrite a course whose concept_curated_by is set (human wins);
  - warn when the live course title differs from the row's title_seen;
  - the concept graph must be acyclic and reference only known slugs.

Env (scripts/.env or shell):
  TARGET_MONGO_URI (required, unless --dry-run)
  TARGET_DB_NAME   (default pmt_research)
"""
import argparse
import datetime as dt
import json
import os
import re
import sys
from pathlib import Path

from dotenv import load_dotenv

HERE = Path(__file__).resolve().parent
load_dotenv(HERE / ".env")

DEFAULT_CONCEPTS = HERE / "data" / "prereq_concepts.json"
DEFAULT_MAPPING = HERE / "data" / "course_concepts.json"

SLUG_RE = re.compile(r"^[a-z0-9_]+$")
DISCIPLINES = {"math", "physics", "chem", "cs", "bio", "engr", "stats", "other"}
MACHINE_SOURCE = "llm_session_v1"


def _env(name, default=None, required=False):
    val = os.environ.get(name, default)
    if required and not val:
        sys.exit(f"Missing required env var {name} (set it in scripts/.env or the shell).")
    return val


def load_json(path):
    try:
        return json.loads(Path(path).read_text(encoding="utf-8"))
    except json.JSONDecodeError as e:
        sys.exit(f"Bad JSON in {Path(path).name}: {e}")


def flatten_requires(reqs):
    """A requires entry is a slug (AND) or a list of slugs (OR-group)."""
    out = []
    for e in reqs or []:
        out.extend(str(x) for x in e) if isinstance(e, list) else out.append(str(e))
    return out


def validate_concepts(concepts):
    slugs = [c.get("slug") for c in concepts]
    if len(slugs) != len(set(slugs)):
        sys.exit("duplicate concept slugs in prereq_concepts.json")
    graph = {}
    for c in concepts:
        slug = str(c.get("slug") or "")
        if not SLUG_RE.match(slug):
            sys.exit(f"bad slug: {slug!r}")
        if c.get("discipline") not in DISCIPLINES:
            sys.exit(f"{slug}: discipline must be one of {sorted(DISCIPLINES)}")
        for e in c.get("requires") or []:
            if isinstance(e, list) and not (e and all(isinstance(x, str) for x in e)):
                sys.exit(f"{slug}: an OR-group must be a non-empty list of slugs")
        graph[slug] = flatten_requires(c.get("requires"))
    for slug, reqs in graph.items():
        for r in reqs:
            if r not in graph:
                sys.exit(f"{slug}: requires unknown concept {r!r}")
    for c in concepts:
        slug = str(c.get("slug") or "")
        for s in c.get("satisfies") or []:
            if s == slug:
                sys.exit(f"{slug}: satisfies must not reference itself")
            if s not in graph:
                sys.exit(f"{slug}: satisfies unknown concept {s!r}")
    state = {}
    def visit(node, path):
        if state.get(node) == "done":
            return None
        if state.get(node) == "visiting":
            return path + [node]
        state[node] = "visiting"
        for nxt in graph.get(node, []):
            cycle = visit(nxt, path + [node])
            if cycle:
                return cycle
        state[node] = "done"
        return None
    for slug in graph:
        cycle = visit(slug, [])
        if cycle:
            sys.exit(f"concept cycle: {' -> '.join(cycle)}")
    return graph


def validate_mapping(rows, graph):
    for row in rows:
        cid = row.get("course_id")
        if not isinstance(cid, (int, float)) or int(cid) != cid:
            sys.exit(f"mapping row has non-numeric course_id: {row!r}")
        concept = row.get("concept")
        if concept is not None and concept not in graph:
            sys.exit(f"course {cid}: unknown concept {concept!r}")
        conf = row.get("confidence")
        if not isinstance(conf, (int, float)) or not (0 <= conf <= 1):
            sys.exit(f"course {cid}: confidence must be in [0, 1]")


def build_concept_rows(concepts, now, source):
    return [{
        "_id": f"prereq_concept:{c['slug']}",
        "legacy_id": c["slug"],
        "kind": "prereq_concept",
        "slug": c["slug"],
        "name": c.get("name") or c["slug"],
        "discipline": c["discipline"],
        "requires": [
            [str(x) for x in e] if isinstance(e, list) else str(e)
            for e in (c.get("requires") or [])
        ],
        "satisfies": [str(s) for s in (c.get("satisfies") or [])],
        "note": c.get("note") or "",
        "source": source,
        "updated_at": now,
    } for c in concepts]


def warn_same_as_mismatches(db, ids):
    """Cross-listed peers classified with differing concepts are flagged here,
    not just in QA (spec §2: 'peers with differing concepts are flagged...
    at import time')."""
    docs = list(db["assist_courses"].find({"_id": {"$in": ids}}, {"same_as_keys": 1, "concept": 1}))
    concept_of = {d["_id"]: d.get("concept") for d in docs}
    peer_ids = {p for d in docs for p in (d.get("same_as_keys") or []) if p not in concept_of}
    if peer_ids:
        concept_of.update({
            d["_id"]: d.get("concept")
            for d in db["assist_courses"].find({"_id": {"$in": list(peer_ids)}}, {"concept": 1})
        })
    mismatches = 0
    for d in docs:
        concept = concept_of.get(d["_id"])
        if concept is None:
            continue
        for peer in d.get("same_as_keys") or []:
            peer_concept = concept_of.get(peer)
            if peer_concept is not None and peer_concept != concept:
                print(f"  same_as mismatch: {d['_id']} ({concept}) vs {peer} ({peer_concept})")
                mismatches += 1
    print(f"same_as check: {mismatches} mismatch(es) found.")


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--concepts-json", default=str(DEFAULT_CONCEPTS))
    ap.add_argument("--mapping-json", default=str(DEFAULT_MAPPING))
    ap.add_argument("--dry-run", action="store_true", help="parse and report without writing")
    args = ap.parse_args()

    for p in (args.concepts_json, args.mapping_json):
        if not Path(p).exists():
            sys.exit(f"source not found: {p}")

    concepts_doc = load_json(args.concepts_json)
    mapping_doc = load_json(args.mapping_json)
    concepts = concepts_doc.get("concepts") or []
    rows = mapping_doc.get("rows") or []

    graph = validate_concepts(concepts)
    validate_mapping(rows, graph)

    now = dt.datetime.now(dt.timezone.utc)
    source = f"scripts/data/{Path(args.concepts_json).name}"
    concept_rows = build_concept_rows(concepts, now, source)
    mapped = sum(1 for r in rows if r.get("concept"))
    print(f"Concepts: {len(concept_rows)} ({sum(1 for c in concepts if c.get('requires'))} with rules)")
    print(f"Mapping rows: {len(rows)} ({mapped} mapped, {len(rows) - mapped} examined-not-relevant)")
    if concept_rows:
        sample = {k: v for k, v in concept_rows[0].items() if k != "updated_at"}
        print("Concept sample:", json.dumps(sample, ensure_ascii=False))
    if rows:
        print("Mapping sample:", json.dumps(rows[0], ensure_ascii=False))

    if args.dry_run:
        print("Dry run only; no DB writes.")
        print("same_as check runs on live imports only.")
        return

    from pymongo import MongoClient, UpdateOne
    uri = _env("TARGET_MONGO_URI", required=True)
    db = MongoClient(uri)[_env("TARGET_DB_NAME", "pmt_research")]

    if concept_rows:
        db["curated_requirements"].bulk_write([
            UpdateOne({"_id": row["_id"]}, {"$set": row}, upsert=True) for row in concept_rows
        ], ordered=False)
    print(f"curated_requirements updated ({len(concept_rows)} concept rows).")

    ids = [f"cc:{int(r['course_id'])}" for r in rows]
    existing = {
        doc["_id"]: doc
        for doc in db["assist_courses"].find(
            {"_id": {"$in": ids}}, {"concept_curated_by": 1, "title": 1}
        )
    }
    ops, skipped_curated, missing, drifted = [], 0, 0, 0
    for row in rows:
        cid = f"cc:{int(row['course_id'])}"
        live = existing.get(cid)
        if live is None:
            missing += 1
            continue
        if live.get("concept_curated_by"):
            skipped_curated += 1
            continue
        if row.get("title_seen") and live.get("title") and row["title_seen"] != live["title"]:
            drifted += 1
            print(f"  title drift {cid}: classified {row['title_seen']!r}, live {live['title']!r}")
        # Flags ride in concept_note so the console can surface/filter them
        # (e.g. "combined_course", "needs_review"); an explicit note comes first.
        note_parts = [p for p in [row.get("note"), ", ".join(row.get("flags") or [])] if p]
        ops.append(UpdateOne({"_id": cid}, {"$set": {
            "concept": row.get("concept"),
            "concept_source": MACHINE_SOURCE,
            "concept_confidence": float(row["confidence"]),
            "concept_title_seen": row.get("title_seen"),
            "concept_note": "; ".join(note_parts),
        }}, upsert=False))
    if ops:
        db["assist_courses"].bulk_write(ops, ordered=False)
    print(
        f"assist_courses updated ({len(ops)} rows; {skipped_curated} human-curated preserved; "
        f"{missing} not in catalog; {drifted} title drifts)."
    )
    warn_same_as_mismatches(db, ids)


if __name__ == "__main__":
    main()
