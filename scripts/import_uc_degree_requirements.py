"""
Import researched FULL four-year degree requirements into the research DB,
modeled in the ASSIST agreement `requirement_groups` shape so the degree-
coverage and associate-degree contribution analyses can reuse the existing
choose-N/unit engines.

Unlike an agreement, a degree-requirements doc is NOT tied to one community
college: it stores the requirement MODEL only (groups -> sections -> receivers
with parent_id + section_advisement). The figure stamps articulation_status per
community college at compute time — a receiver is "articulated" for a CC when
that CC articulates the receiver's parent_id in its real agreement.

Sources:
  scripts/data/uc_degree_requirements.json       historical hand-verified CS
  scripts/data/uc_degree_requirements_bio.json  AI research; human review due
  scripts/data/uc_degree_requirements_econ.json AI research; human review due
Provenance:
  docs/figures/degree-coverage-sources.md
  docs/figures/degree-coverage-sources-bio-econ.md

Env (scripts/.env or shell):
  TARGET_MONGO_URI (required)
  TARGET_DB_NAME   (default pmt_research)

Output collection:
  curated_requirements (kind=degree):
    { _id: 'degree:<school_id>:<major_slug>', school_id, major_slug, school,
      program, total_units, source_url, sources[], requirement_groups[],
      source, updated_at }

Every degree uses a major-scoped identity, including the historical CS source:
`degree:<school_id>:<major_slug>`. A source without `_meta.major_slug` defaults
to `cs` for backwards compatibility, but it is still written with the scoped
identity. After a successful CS upsert, the importer removes only that campus's
exact legacy `degree:<school_id>` row so list views cannot show duplicates.

Usage:
  python scripts/import_uc_degree_requirements.py --dry-run      # resolve + report, NO write
  python scripts/import_uc_degree_requirements.py                # upsert into the DB
  python scripts/import_uc_degree_requirements.py --only UCB     # limit to one campus
"""
import argparse
import datetime as dt
import hashlib
import json
import os
import re
import sys
from pathlib import Path

from dotenv import load_dotenv
from pymongo import MongoClient, UpdateOne

HERE = Path(__file__).resolve().parent
load_dotenv(HERE / ".env")

DEFAULT_SOURCE = HERE / "data" / "uc_degree_requirements.json"
MAJOR_SLUG_RE = re.compile(r"^[a-z0-9_]+$")
LEGACY_MIGRATION_CONTROL_FIELDS = {
    "_id", "legacy_id", "major_slug", "updated_at",
}

# Our scraped data still stores the pre-2025 EE numbering (EECS 16A/16B); the
# current Berkeley catalog renamed these ELENG 66/64. Author codes either way —
# these aliases are tried when a direct code match misses. Normalized form.
CODE_ALIASES = {
    "ELENG 66": "EECS 16A",
    "ELENG 64": "EECS 16B",
    # UCSD renamed its organic chemistry sequence in the receiving-course
    # snapshot before every current catalog/checklist link caught up.
    "CHEM 40A": "CHEM 41A",
    "CHEM 40B": "CHEM 41B",
}


def _env(name, default=None, required=False):
    val = os.environ.get(name, default)
    if required and not val:
        sys.exit(f"Missing required env var {name} (set it in scripts/.env or the shell).")
    return val


def connect():
    uri = _env("TARGET_MONGO_URI", required=True)
    name = _env("TARGET_DB_NAME", "pmt_research")
    return MongoClient(uri)[name]


def normalize_code(value):
    s = str(value or "").upper().replace("&", " AND ")
    s = re.sub(r"[^A-Z0-9]+", " ", s)
    s = re.sub(r"\s+", " ", s).strip()
    # Catalogs inconsistently pad course numbers (UCR writes CHEM 001A and
    # CHEM 01LA while ASSIST stores CHEM 1A and CHEM 1LA). Normalize both
    # index and authored code, preserving meaningful zeros after letters.
    return re.sub(r"\b0+(?=\d)", "", s)


def leading_int(number):
    """The integer prefix of a course number ('61B' -> 61, '7A' -> 7, 'C8' -> 8).
    Used to tell lower-division (<100) from upper-division for the breadth proxy."""
    m = re.search(r"\d+", str(number or ""))
    return int(m.group()) if m else None


def school_course_index(db, school_id):
    """normalized 'PREFIX NUMBER' -> {parent_id, units, prefix, number, title}
    for one university, plus a by-prefix bucket used by the breadth proxy."""
    by_code, by_prefix = {}, {}
    query = {"institution_id": f"uc:{int(school_id)}", "side": "receiving"}
    for row in db["assist_courses"].find(
        query,
        {"parent_id": 1, "prefix": 1, "number": 1, "title": 1,
         "min_units": 1, "max_units": 1, "_id": 0},
    ):
        code = normalize_code(f"{row.get('prefix', '')} {row.get('number', '')}")
        info = {
            "parent_id": int(row["parent_id"]),
            "units": row.get("max_units") or row.get("min_units"),
            "prefix": row.get("prefix"),
            "number": row.get("number"),
            "title": row.get("title"),
        }
        by_code[code] = info
        by_prefix.setdefault(str(row.get("prefix", "")).upper(), []).append(info)
    return by_code, by_prefix


def resolve_code(code, by_code):
    """A single course code -> course info, trying the ELENG<->EECS alias on miss."""
    norm = normalize_code(code)
    if norm in by_code:
        return by_code[norm], norm
    alias = CODE_ALIASES.get(norm)
    if alias and alias in by_code:
        return by_code[alias], alias
    return None, norm


# Every receiver carries the full ASSIST-agreement shape so the shared
# RequirementsLedger renders it and the choose-N eligibility engine consumes it
# unchanged. `articulation_status`/`options` are null/empty in the stored
# template (no community college yet); the per-CC evaluation fills them in.
def _hash(*parts):
    return hashlib.sha256("|".join(str(p) for p in parts).encode()).hexdigest()


def course_receiver(info, tier, seq):
    return {
        "receiving": {"kind": "course", "parent_id": info["parent_id"], "units": info.get("units")},
        "articulation_status": None,
        "not_articulated_reason": None,
        "options": [],
        "options_conjunction": "or",
        "hash_id": _hash("course", info["parent_id"], seq),
        "tier": tier,
    }


def requirement_receiver(tier, name, seq):
    return {
        "receiving": {"kind": "requirement", "parent_id": None, "units": None, "name": name},
        "articulation_status": None,
        "not_articulated_reason": None,
        "options": [],
        "options_conjunction": "or",
        "hash_id": _hash("requirement", name, seq),
        "tier": tier,
    }


def series_receiver(parent_ids, tier, seq):
    # A complete course sequence taken as one unit ("mixing of courses between
    # series is not allowed") — articulated only when EVERY course in the
    # series articulates. Same `kind: "series"` shape real ASSIST agreements
    # use, so the shared ledger renders it bracketed ("A and B and C").
    return {
        "receiving": {"kind": "series", "parent_ids": parent_ids, "conjunction": "and", "parent_id": None, "units": None},
        "articulation_status": None,
        "not_articulated_reason": None,
        "options": [],
        "options_conjunction": "or",
        "hash_id": _hash("series", "-".join(str(p) for p in parent_ids), seq),
        "tier": tier,
    }


def ge_area_receiver(code, name, seq, ge_areas=None, assume=False,
                     credit_role=None):
    return {
        "receiving": {"kind": "ge_area", "code": code, "name": name, "parent_id": None, "units": None},
        "articulation_status": None,
        "not_articulated_reason": None,
        "options": [],
        "options_conjunction": "or",
        "hash_id": _hash("ge_area", code, seq),
        "tier": "breadth",
        # How the per-CC evaluation decides coverage: match the CC's course
        # igetc_area tags, or assume it's satisfiable everywhere.
        "ge_areas": ge_areas or [],
        "assume_satisfiable": bool(assume),
        "credit_role": credit_role,
    }


def build_section(req, tier, title, by_code, by_prefix, report, seq):
    """One authored requirement -> one section {section_advisement, receivers[]}."""
    select = int(req["select"])
    frm = req.get("from")
    ge_area = req.get("ge_area")  # single IGETC area a specific course also satisfies
    section = {
        "section_advisement": select,
        "unit_advisement": None,
        "tier": tier,
        "receivers": [],
        "source_refs": list(req.get("source_refs", [])),
        "note": req.get("note"),
        "course_level": req.get("course_level"),
        "cc_articulable": req.get("cc_articulable"),
        "overlap_key": req.get("overlap_key"),
        "human_review": req.get("human_review"),
    }
    # Optional authored "units" (the block's stated total, e.g. Berkeley's
    # 20-unit upper-division rule or a 12-unit series) overrides the flat
    # ~4u/course assumption in the unit budget shown on the template page.
    if req.get("units") is not None:
        section["unit_advisement"] = req["units"]

    if frm is None:
        # Non-transferable: `select` named slots, never satisfiable by any CC.
        # An authored "label" names the slot(s) (e.g. a specific upper-division
        # course); otherwise the group title is the slot name.
        slot_name = req.get("label") or title
        section["receivers"] = [requirement_receiver(tier, slot_name, seq()) for _ in range(select)]
        report["nontransferable_slots"] += select

    elif isinstance(frm, list):
        # Explicit course alternatives, resolved to parent_ids. When the authored
        # requirement carries a ge_area (e.g. R&C R1A -> IGETC 1A), the evaluation
        # can fall back to the CC's GE-area tags when direct articulation is absent.
        if ge_area:
            section["ge_areas"] = [ge_area]
        for code in frm:
            info, norm = resolve_code(code, by_code)
            if info:
                r = course_receiver(info, tier, seq())
                if ge_area:
                    r["ge_areas"] = [ge_area]
                section["receivers"].append(r)
                report["resolved"].append((code, norm, info["parent_id"]))
            else:
                # Real requirement with no ASSIST receiving record (honors
                # variants, brand-new courses): keep it visible as a named
                # slot that no CC can satisfy, rather than hiding it.
                section["receivers"].append(
                    requirement_receiver(tier, f"{code} (no ASSIST articulation)", seq()))
                report["unresolved"].append((code, norm))

    elif isinstance(frm, dict) and "series" in frm:
        # Choose `select` complete series ("in its entirety — mixing of
        # courses between series is not allowed"). One receiver per series;
        # a series with any unresolvable course is dropped with a report line.
        for series_codes in frm["series"]:
            pids = []
            ok = True
            for code in series_codes:
                info, norm = resolve_code(code, by_code)
                if info:
                    pids.append(info["parent_id"])
                    report["resolved"].append((code, norm, info["parent_id"]))
                else:
                    ok = False
                    report["unresolved"].append((code, norm))
            if ok and pids:
                section["receivers"].append(series_receiver(pids, tier, seq()))

    elif isinstance(frm, dict) and "ge_areas" in frm:
        # Breadth by GE area: coverage comes from the CC's course igetc_area tags.
        section["ge_areas"] = list(frm["ge_areas"])
        code = frm.get("code", "H/SS")
        label = frm.get("label", f"Complete {select} from IGETC areas {', '.join(frm['ge_areas'])}")
        section["receivers"] = [ge_area_receiver(code, label, seq(), ge_areas=frm["ge_areas"])]
        report["breadth_courses"] += 1

    elif isinstance(frm, dict) and frm.get("assume"):
        # Assumed satisfiable everywhere (UC-wide requirement, universal at CCs).
        code = frm.get("code", "REQ")
        label = frm.get("label", f"{title} — assumed satisfiable")
        section["assume_satisfiable"] = True
        section["receivers"] = [ge_area_receiver(
            code, label, seq(), assume=True,
            credit_role=frm.get("credit_role") or req.get("credit_role"),
        )]
        report["breadth_courses"] += 1

    else:
        raise ValueError(f"Unrecognized `from` in requirement: {req!r}")

    report["required_slots"] += select
    if tier == "transferable":
        report["transferable_slots"] += select
    elif tier == "breadth":
        report["breadth_slots"] += select

    return section


def source_identity(data, campus):
    """Return the validated major slug and scoped-id policy for one campus.

    A campus-level major_slug is allowed for forward-compatible combined
    authoring files. Missing metadata defaults to CS, but all degree identities
    are major-scoped so no major can collide with another.
    """
    meta = data.get("_meta") if isinstance(data.get("_meta"), dict) else {}
    raw = campus.get("major_slug", meta.get("major_slug"))
    slug = str(raw if raw is not None else "cs").strip()
    if not MAJOR_SLUG_RE.fullmatch(slug):
        raise ValueError(
            f"major_slug must match {MAJOR_SLUG_RE.pattern}; got {slug!r}"
        )
    return slug, True


def merge_legacy_fields(doc, legacy_doc=None, modern_doc=None):
    """Carry DB-only curation fields across an old CS id migration.

    Authored fields in ``doc`` always win. If a modern row already exists, its
    DB-only fields also win. Everything else from the legacy row is retained,
    except identity/timestamp controls that must be regenerated for the new id.
    """
    merged = dict(doc)
    legacy_doc = legacy_doc or {}
    modern_doc = modern_doc or {}
    for key, value in legacy_doc.items():
        if key in LEGACY_MIGRATION_CONTROL_FIELDS:
            continue
        if key not in merged and key not in modern_doc:
            merged[key] = value
    return merged


def validate_existing_cs_doc(doc, school_id, *, legacy):
    """Reject an unsafe row before any CS identity migration writes occur."""
    if doc is None:
        return
    expected_id = f"degree:{school_id}" if legacy else f"degree:{school_id}:cs"
    if doc.get("_id") != expected_id:
        raise ValueError(f"unexpected CS degree id: {doc.get('_id')!r}")
    if doc.get("kind") != "degree":
        raise ValueError(f"{expected_id} is not a degree document")
    try:
        stored_school_id = int(doc.get("school_id"))
    except (TypeError, ValueError):
        stored_school_id = None
    if stored_school_id != int(school_id):
        raise ValueError(
            f"{expected_id} has school_id {doc.get('school_id')!r}; "
            f"expected {school_id}"
        )
    stamp = doc.get("major_slug")
    allowed = {None, "", "cs"} if legacy else {"cs"}
    if stamp not in allowed:
        raise ValueError(
            f"{expected_id} has incompatible major_slug {stamp!r}"
        )


def preflight_legacy_cs_migration(coll, docs):
    """Load and validate legacy/modern CS rows without mutating Mongo."""
    cs_docs = [doc for doc in docs if doc.get("major_slug") == "cs"]
    if not cs_docs:
        return {}
    ids = []
    for doc in cs_docs:
        ids.extend([f"degree:{doc['school_id']}", doc["_id"]])
    existing = {row["_id"]: row for row in coll.find({"_id": {"$in": ids}})}
    migrations = {}
    for doc in cs_docs:
        school_id = int(doc["school_id"])
        old_id = f"degree:{school_id}"
        new_id = doc["_id"]
        old = existing.get(old_id)
        modern = existing.get(new_id)
        validate_existing_cs_doc(old, school_id, legacy=True)
        validate_existing_cs_doc(modern, school_id, legacy=False)
        if old is not None and modern is not None:
            raise ValueError(
                f"refusing CS migration: both {old_id} and {new_id} exist"
            )
        if old is not None:
            migrations[new_id] = old
    return migrations


def build_doc(campus_key, campus, by_code, by_prefix, report,
              major_slug="cs", major_scoped_id=True):
    counter = [0]
    def seq():
        counter[0] += 1
        return counter[0]
    groups = []
    for g in campus["groups"]:
        tier = g["tier"]
        sections = [build_section(req, tier, g["title"], by_code, by_prefix, report, seq) for req in g["requirements"]]
        groups.append({
            "is_required": True,
            "group_conjunction": "And",
            "title": g["title"],
            "tier": tier,
            "source_refs": list(g.get("source_refs", [])),
            "note": g.get("note"),
            "course_level": g.get("course_level"),
            "cc_articulable": g.get("cc_articulable"),
            "overlap_key": g.get("overlap_key"),
            "human_review": g.get("human_review"),
            "sections": sections,
        })
    school_id = int(campus["school_id"])
    row_id = f"degree:{school_id}:{major_slug}" if major_scoped_id else f"degree:{school_id}"
    legacy_id = f"{school_id}:{major_slug}" if major_scoped_id else str(school_id)
    research_status = campus.get(
        "research_status",
        "hand_verified" if major_slug == "cs" else "needs_human_verification",
    )
    source_method = campus.get(
        "source_method",
        "ai_web_research" if str(research_status).startswith("ai_researched")
        else "hand_curated",
    )
    return {
        "_id": row_id,
        "legacy_id": legacy_id,
        "kind": "degree",
        "institution_id": f"uc:{school_id}",
        "school_id": school_id,
        "major_slug": major_slug,
        "school": campus["school"],
        "program": campus["program"],
        "total_units": campus.get("total_units"),
        "source_url": campus.get("source_url"),
        "sources": campus.get("sources", []),
        "catalog_year": campus.get("catalog_year"),
        "college": campus.get("college"),
        # Keep the organizational owner of the major separate from the body
        # that sets GE. They are usually the same L&S college, but UC San
        # Diego's residential colleges and UC Merced's campuswide GE are
        # important counterexamples.
        "academic_unit": campus.get("academic_unit", campus.get("college")),
        "ge_authority": campus.get("ge_authority", campus.get("college")),
        "degree_variant": campus.get("degree_variant"),
        "unit_system": campus.get("unit_system"),
        "ge_model": campus.get("ge_model"),
        "ge_variants": campus.get("ge_variants", []),
        "research_status": research_status,
        "source_method": source_method,
        "unit_audit": campus.get("unit_audit"),
        "modeling_notes": campus.get("modeling_notes", []),
        "data_quality_flags": campus.get("data_quality_flags", []),
        "requirement_groups": groups,
        "source": "ai_researched_degree" if source_method == "ai_web_research"
        else "hand_curated_degree",
        "campus_key": campus_key,
    }


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--source", default=str(DEFAULT_SOURCE))
    ap.add_argument("--only", help="limit to one campus key, e.g. UCB")
    ap.add_argument("--dry-run", action="store_true", help="resolve + report, do not write")
    args = ap.parse_args()

    data = json.loads(Path(args.source).read_text(encoding="utf-8"))
    campuses = {k: v for k, v in data.items() if not k.startswith("_")}
    if args.only:
        campuses = {args.only: campuses[args.only]}

    db = connect()
    ops = []
    legacy_cs_ids = []
    seen_ids = set()
    for campus_key, campus in campuses.items():
        try:
            major_slug, major_scoped_id = source_identity(data, campus)
        except ValueError as error:
            sys.exit(f"{campus_key}: {error}")
        by_code, by_prefix = school_course_index(db, campus["school_id"])
        report = {"resolved": [], "unresolved": [], "required_slots": 0,
                  "transferable_slots": 0, "breadth_slots": 0, "nontransferable_slots": 0,
                  "breadth_courses": 0}
        doc = build_doc(
            campus_key, campus, by_code, by_prefix, report,
            major_slug=major_slug, major_scoped_id=major_scoped_id,
        )
        if doc["_id"] in seen_ids:
            sys.exit(f"duplicate degree identity in source: {doc['_id']}")
        seen_ids.add(doc["_id"])
        if major_slug == "cs":
            legacy_cs_ids.append(f"degree:{int(campus['school_id'])}")

        print(
            f"\n=== {campus_key}: {campus['school']} — {campus['program']} "
            f"[{major_slug}] ==="
        )
        print(f"  identity: {doc['_id']}")
        print(f"  requirement slots (denominator): {report['required_slots']}"
              f"  [transferable {report['transferable_slots']}"
              f" + breadth {report['breadth_slots']}"
              f" + non-transferable {report['nontransferable_slots']}]")
        print(f"  breadth proxy receiver courses: {report['breadth_courses']}")
        print(f"  resolved courses ({len(report['resolved'])}):")
        for code, norm, pid in report["resolved"]:
            arrow = f" (via {norm})" if normalize_code(code) != norm else ""
            print(f"    {code:<16} -> parent_id {pid}{arrow}")
        if report["unresolved"]:
            print(f"  !! UNRESOLVED codes ({len(report['unresolved'])}) — kept as named never-satisfiable slots; verify each is truly un-articulated:")
            for code, norm in report["unresolved"]:
                print(f"    {code}  (normalized {norm})")

        ops.append(doc)

    coll = db["curated_requirements"]
    try:
        legacy_migrations = preflight_legacy_cs_migration(coll, ops)
    except ValueError as error:
        sys.exit(f"CS identity migration preflight failed: {error}")

    if args.dry_run:
        if legacy_migrations:
            print(
                "\n[dry-run] validated legacy CS migrations: "
                + ", ".join(sorted(
                    old["_id"] for old in legacy_migrations.values()
                ))
            )
        elif legacy_cs_ids:
            print("\n[dry-run] CS identities are already major-scoped.")
        print("\n[dry-run] no write. Re-run without --dry-run to upsert.")
        return

    now = dt.datetime.now(dt.timezone.utc)
    writes = []
    for doc in ops:
        fields = dict(doc)
        legacy_doc = legacy_migrations.get(doc["_id"])
        if legacy_doc:
            fields = merge_legacy_fields(fields, legacy_doc)
        fields["updated_at"] = now
        writes.append(UpdateOne(
            {"_id": doc["_id"]}, {"$set": fields}, upsert=True,
        ))
    res = coll.bulk_write(writes)
    deleted = 0
    if legacy_migrations:
        guards = [{
            "_id": old["_id"],
            "kind": "degree",
            "school_id": int(old["school_id"]),
            "$or": [
                {"major_slug": {"$exists": False}},
                {"major_slug": None},
                {"major_slug": "cs"},
            ],
        } for old in legacy_migrations.values()]
        delete_result = coll.delete_many({"$or": guards})
        deleted = delete_result.deleted_count
        if deleted != len(legacy_migrations):
            sys.exit(
                "CS templates were safely upserted, but legacy cleanup was "
                f"incomplete: expected {len(legacy_migrations)} deletions, "
                f"got {deleted}. Both copies may remain; inspect before retrying."
            )
    print(
        f"\nUpserted {res.upserted_count + res.modified_count} degree requirement "
        f"doc(s) into curated_requirements; removed {deleted} legacy CS doc(s)."
    )


if __name__ == "__main__":
    main()
