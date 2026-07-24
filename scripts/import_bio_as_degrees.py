#!/usr/bin/env python3
"""Compile completed 2025-2026 Biology degree research into the local app DB.

This importer is intentionally separate from ``import_as_degrees.py``. That
historical importer owns the CS extraction and its legacy type vocabulary;
this one emits the generalized runtime identity instead:

    as_degree:<community_college_id>:bio:<ast|local_as|local_other>

Only terminal checkpoints (``requirements_extracted`` or sourced
``none_found``) are eligible. A sourced negative result emits one explicit
``none_found`` row per slot, so the website can distinguish confirmed absence
from an unresearched empty slot. Imports are additive/upsert-only, never delete
rows, never overwrite a verified row, and preserve any hand-curated requirement
groups already in MongoDB. Use repeated ``--college-id`` flags to publish one
completed research batch at a time.

Examples:

    python scripts/import_bio_as_degrees.py --dry-run
    python scripts/import_bio_as_degrees.py --college-id 2 --college-id 3

Environment (loaded from scripts/.env):
  TARGET_MONGO_URI (required, including for dry-run course resolution)
  TARGET_DB_NAME   (default pmt_research)
"""

from __future__ import annotations

import argparse
from collections import Counter
import datetime as dt
import json
import os
from pathlib import Path
import re
import sys

from dotenv import load_dotenv

try:  # Supports both ``python scripts/...`` and import as a test module.
    from . import bio_as_research
    from .import_as_degrees import build_course_index, merge_with_existing, transform_group
except ImportError:  # pragma: no cover - exercised by the CLI entry point
    import bio_as_research
    from import_as_degrees import build_course_index, merge_with_existing, transform_group


HERE = Path(__file__).resolve().parent
REPO_ROOT = HERE.parent
DEFAULT_COLLEGES_DIR = HERE / "data" / "as_degrees_bio_research" / "colleges"
DEFAULT_OUTPUT_JSON = HERE / "data" / "as_degrees_bio_compiled.json"
MAJOR_SLUG = "bio"
SLOTS = ("ast", "local_as", "local_other")
SOURCE_ACADEMIC_YEAR = bio_as_research.SOURCE_ACADEMIC_YEAR
SLUG_RE = re.compile(r"^[a-z0-9_]+$")
GE_AREAS = {
    "natural_sciences", "social_behavioral", "humanities",
    "language_rationality", "math_competency", "local_pattern",
    "calgetc", "igetc", "csu_ge",
}

load_dotenv(HERE / ".env")


def relative_source(path: Path) -> str:
    try:
        return str(path.resolve().relative_to(REPO_ROOT.resolve()))
    except ValueError:
        return str(path.resolve())


def load_records(colleges_dir: Path, selected_ids: set[int] | None = None) -> list[tuple[Path, dict]]:
    records = []
    found_ids = set()
    for path in sorted(colleges_dir.glob("*.json")):
        payload = json.loads(path.read_text(encoding="utf-8"))
        cc_id = int(payload.get("_meta", {}).get("community_college_id"))
        if selected_ids is not None and cc_id not in selected_ids:
            continue
        found_ids.add(cc_id)
        if payload.get("_meta", {}).get("research_status") in {
            "requirements_extracted", "none_found",
        }:
            records.append((path, payload))
    missing = (selected_ids or set()) - found_ids
    if missing:
        raise ValueError(f"no research checkpoint for college id(s): {sorted(missing)}")
    return records


def validate_source_record(path: Path, payload: dict) -> None:
    meta = payload.get("_meta") or {}
    cc_id = int(meta.get("community_college_id"))
    if meta.get("major_slug") != MAJOR_SLUG:
        raise ValueError(f"{path}: major_slug must be {MAJOR_SLUG}")
    status = meta.get("research_status")
    degrees = payload.get("degrees") or []
    if status == "none_found":
        if degrees:
            raise ValueError(f"{path}: none_found cannot carry degrees")
        sources = payload.get("none_found_sources") or []
        if not sources:
            raise ValueError(f"{path}: none_found needs official negative sources")
        for source_index, source in enumerate(sources):
            if not str(source.get("url") or "").startswith(("http://", "https://")):
                raise ValueError(
                    f"{path}: none_found_sources[{source_index}]: HTTP(S) URL required"
                )
            if source.get("catalog_year") != SOURCE_ACADEMIC_YEAR:
                raise ValueError(
                    f"{path}: none_found_sources[{source_index}] catalog_year must be "
                    f"{SOURCE_ACADEMIC_YEAR}"
                )
        return
    if status != "requirements_extracted":
        raise ValueError(f"{path}: research_status is not terminal")
    seen_slots = set()
    for index, degree in enumerate(degrees):
        prefix = f"{path}: degrees[{index}]"
        slot = degree.get("degree_type_hint")
        if slot not in SLOTS:
            raise ValueError(f"{prefix}: degree_type_hint must be one of {SLOTS}")
        if slot in seen_slots:
            raise ValueError(f"{path}: multiple degrees map to {cc_id}:{MAJOR_SLUG}:{slot}")
        seen_slots.add(slot)
        if degree.get("catalog_year") != SOURCE_ACADEMIC_YEAR:
            raise ValueError(f"{prefix}: catalog_year must be {SOURCE_ACADEMIC_YEAR}")
        sources = degree.get("sources") or []
        if not sources:
            raise ValueError(f"{prefix}: at least one official source is required")
        for source_index, source in enumerate(sources):
            if source.get("catalog_year") != SOURCE_ACADEMIC_YEAR:
                raise ValueError(
                    f"{prefix}.sources[{source_index}]: catalog_year must be "
                    f"{SOURCE_ACADEMIC_YEAR}"
                )


def _compiled_doc_error(doc: dict, known_college_ids: set[int]) -> str | None:
    match = re.fullmatch(r"(\d+):([a-z0-9_]+):([a-z0-9_]+)", str(doc.get("legacy_id") or ""))
    if not match:
        return "legacy_id must be <community_college_id>:<major>:<slot>"
    cc_id, major, slot = int(match.group(1)), match.group(2), match.group(3)
    if cc_id not in known_college_ids:
        return f"community college cc:{cc_id} does not exist"
    if (doc.get("community_college_id"), doc.get("college_id")) != (cc_id, f"cc:{cc_id}"):
        return "college fields do not match legacy_id"
    if major != MAJOR_SLUG or doc.get("major_slug") != major:
        return "major fields do not match legacy_id"
    if slot not in SLOTS or doc.get("degree_type") != slot:
        return "degree_type does not match legacy_id"
    if doc.get("_id") != f"as_degree:{doc['legacy_id']}":
        return "_id must be as_degree:<legacy_id>"
    if doc.get("status") not in {"found", "none_found", "ambiguous"}:
        return "invalid status"
    if doc.get("catalog_year") != SOURCE_ACADEMIC_YEAR:
        return f"catalog_year must be {SOURCE_ACADEMIC_YEAR}"
    if doc.get("status") != "found":
        groups = doc.get("requirement_groups")
        if groups not in (None, []):
            return f"{doc['status']} rows cannot carry requirement_groups"
        return None
    if not isinstance(doc.get("degree_title_seen"), str) or not doc["degree_title_seen"].strip():
        return "degree_title_seen is required on a found row"
    if not re.match(r"^https?://", str(doc.get("catalog_url") or "")):
        return "catalog_url must be an HTTP(S) URL"
    if doc.get("unit_system") not in {"semester", "quarter"}:
        return "unit_system must be semester or quarter"
    if not isinstance(doc.get("total_units"), (int, float)) or isinstance(doc.get("total_units"), bool) or doc["total_units"] <= 0:
        return "total_units must be a positive number"
    if doc.get("verification") is not None and not isinstance(doc.get("verification"), dict):
        return "verification must be an object"
    if not isinstance(doc.get("covered_concepts"), list) or any(
        not isinstance(value, str) for value in doc["covered_concepts"]
    ):
        return "covered_concepts must be an array of strings"
    groups = doc.get("requirement_groups")
    if not isinstance(groups, list) or not groups:
        return "requirement_groups must be non-empty"
    seen_group_ids = set()
    for group in groups:
        group_id = str(group.get("group_id") or "")
        if not SLUG_RE.fullmatch(group_id) or group_id in seen_group_ids:
            return f"invalid or duplicate group_id: {group_id!r}"
        seen_group_ids.add(group_id)
        if group.get("template_group") is not None and group.get("template_group") != group_id:
            return f"group {group_id}: template_group must match group_id or be null"
        if group.get("source") not in {"extracted", "curated", "template_default"}:
            return f"group {group_id}: invalid source"
        if group.get("source") == "extracted":
            confidence = group.get("confidence")
            if not isinstance(confidence, (int, float)) or isinstance(confidence, bool) or not 0 <= confidence <= 1:
                return f"group {group_id}: extracted confidence must be in [0, 1]"
        elif group.get("confidence") is not None:
            return f"group {group_id}: non-extracted confidence must be null"
        if group.get("ge_area") is not None and group.get("ge_area") not in GE_AREAS:
            return f"group {group_id}: invalid ge_area"
        if group.get("source") == "template_default":
            if group.get("template_group") is None or group.get("sections"):
                return f"group {group_id}: invalid template_default stub"
            continue
        if group.get("units_fill") is True:
            if group.get("sections"):
                return f"group {group_id}: units_fill cannot carry sections"
            continue
        sections = group.get("sections")
        if not isinstance(sections, list) or not sections:
            return f"group {group_id}: sections must be non-empty"
        for section in sections:
            if not isinstance(section, dict):
                return f"group {group_id}: section must be an object"
            for key in ("section_advisement", "unit_advisement"):
                value = section.get(key)
                if value is not None and (
                    not isinstance(value, (int, float)) or isinstance(value, bool) or value <= 0
                ):
                    return f"group {group_id}: {key} must be null or positive"
            receivers = section.get("receivers")
            if not isinstance(receivers, list):
                return f"group {group_id}: receivers must be an array"
            if group.get("ge_area") is None and not receivers:
                return f"group {group_id}: non-GE section needs a receiver"
            for receiver in receivers:
                if not isinstance(receiver, dict) or receiver.get("receiving") is not None:
                    return f"group {group_id}: invalid receiver"
                if receiver.get("articulation_status") != "articulated":
                    return f"group {group_id}: receiver must be articulated"
                options = receiver.get("options")
                if not isinstance(options, list) or not options:
                    return f"group {group_id}: receiver needs options"
                for option in options:
                    if not isinstance(option, dict):
                        return f"group {group_id}: option must be an object"
                    ids = option.get("course_ids")
                    keys = option.get("course_keys")
                    if not isinstance(ids, list) or not ids or any(type(value) is not int for value in ids):
                        return f"group {group_id}: invalid course_ids"
                    if keys != [f"cc:{value}" for value in ids]:
                        return f"group {group_id}: course_keys do not mirror course_ids"
        unresolved = group.get("unresolved_courses_seen")
        if unresolved is not None and (
            not isinstance(unresolved, list)
            or any(not isinstance(row, dict) or not isinstance(row.get("course_code_seen"), str) for row in unresolved)
        ):
            return f"group {group_id}: invalid unresolved_courses_seen"
    return None


def compile_records(
    records: list[tuple[Path, dict]],
    course_index: dict,
    title_index: dict,
    concept_by_course_id: dict,
    known_college_ids: set[int],
    now: dt.datetime,
) -> tuple[list[dict], dict]:
    docs = []
    stats = {
        "degrees_examined": 0,
        "courses_considered": 0,
        "resolved_by_number": 0,
        "resolved_by_title": 0,
        "unresolved": 0,
        "dropped_groups": [],
        "modeling_warnings": [],
        "title_matches": [],
        "by_slot": Counter(),
        "none_found_rows": 0,
    }
    for path, payload in records:
        validate_source_record(path, payload)
        meta = payload["_meta"]
        cc_id = int(meta["community_college_id"])
        source = relative_source(path)
        if meta.get("research_status") == "none_found":
            negative_sources = payload.get("none_found_sources") or []
            catalog_url = negative_sources[0].get("url")
            for slot in SLOTS:
                legacy_id = f"{cc_id}:{MAJOR_SLUG}:{slot}"
                doc = {
                    "_id": f"as_degree:{legacy_id}",
                    "legacy_id": legacy_id,
                    "kind": "as_degree",
                    "community_college_id": cc_id,
                    "college_id": f"cc:{cc_id}",
                    "major_slug": MAJOR_SLUG,
                    "degree_type": slot,
                    "template_ref": None,
                    "status": "none_found",
                    "degree_title_seen": None,
                    "catalog_url": catalog_url,
                    "catalog_year": SOURCE_ACADEMIC_YEAR,
                    "unit_system": None,
                    "total_units": None,
                    "requirement_groups": [],
                    "covered_concepts": [],
                    "verification": {
                        "verified": False,
                        "verified_by": None,
                        "verified_at": None,
                        "notes": None,
                    },
                    "extraction": {
                        "artifact": source,
                        "confidence": 1,
                        "needs_browser": False,
                        "notes": payload.get("notes") or "",
                        "catalog_sources": negative_sources,
                    },
                    "source": source,
                    "updated_at": now,
                }
                error = _compiled_doc_error(doc, known_college_ids)
                if error:
                    raise ValueError(f"internal error compiling {doc['_id']}: {error}")
                docs.append(doc)
                stats["by_slot"][slot] += 1
                stats["none_found_rows"] += 1
            continue
        for degree in payload.get("degrees") or []:
            stats["degrees_examined"] += 1
            slot = degree["degree_type_hint"]
            confidence = degree.get("extraction_confidence")
            if not isinstance(confidence, (int, float)) or isinstance(confidence, bool) or not 0 <= confidence <= 1:
                raise ValueError(f"{path}: {slot} extraction_confidence must be in [0, 1]")
            groups = []
            covered_concepts = set()
            used_group_ids = set()
            degree_dropped = []
            degree_modeling_warnings = []
            degree_title_matches = []
            degree_unresolved = 0
            for index, raw_group in enumerate(degree.get("major_groups") or []):
                transformed = transform_group(
                    raw_group,
                    cc_id,
                    course_index,
                    title_index,
                    concept_by_course_id,
                    confidence,
                    used_group_ids,
                    index,
                )
                (group, considered, resolved_number, resolved_title,
                 unresolved_entries, title_samples, concepts) = transformed
                stats["courses_considered"] += considered
                stats["resolved_by_number"] += resolved_number
                stats["resolved_by_title"] += resolved_title
                stats["unresolved"] += len(unresolved_entries)
                degree_unresolved += len(unresolved_entries)
                covered_concepts |= concepts
                for sample in title_samples:
                    enriched = {
                        "group_label_seen": raw_group.get("label_seen"),
                        **sample,
                    }
                    degree_title_matches.append(enriched)
                    stats["title_matches"].append({
                        "community_college_id": cc_id,
                        "college_name": meta.get("college_name"),
                        "slot": slot,
                        **enriched,
                    })
                if group is None:
                    degree_dropped.append(raw_group)
                    stats["dropped_groups"].append({
                        "community_college_id": cc_id,
                        "college_name": meta.get("college_name"),
                        "slot": slot,
                        "label_seen": raw_group.get("label_seen"),
                    })
                    continue
                # Preserve the catalog's actual rule and any paired-choice prose
                # for the JSON reviewer; the canonical skeleton remains usable.
                group["rule_seen"] = raw_group.get("rule")
                group["choose_n_seen"] = raw_group.get("choose_n")
                group["units_min_seen"] = raw_group.get("units_min")
                group["units_max_seen"] = raw_group.get("units_max")
                if raw_group.get("choice_structure_seen"):
                    group["choice_structure_seen"] = raw_group["choice_structure_seen"]
                    warning = (
                        f"{raw_group.get('label_seen')}: catalog choice prose is preserved, "
                        "but this speed-first compile flattens its paired/conditional choices. "
                        "Structure it by hand before analysis."
                    )
                    group["modeling_warning"] = warning
                    degree_modeling_warnings.append(warning)
                alternatives = [
                    {
                        "course_code_seen": f"{course.get('prefix', '')} {course.get('number', '')}".strip(),
                        "alternative_seen": course.get("alternative_seen"),
                    }
                    for course in raw_group.get("courses") or []
                    if course.get("alternative_seen")
                ]
                if alternatives:
                    group["alternatives_seen"] = alternatives
                    warning = (
                        f"{raw_group.get('label_seen')}: honors/course alternatives are preserved "
                        "as source prose but are not linked in the first-pass skeleton."
                    )
                    group["modeling_warning"] = " ".join(filter(None, [group.get("modeling_warning"), warning]))
                    degree_modeling_warnings.append(warning)
                if raw_group.get("rule") == "all" and group.get("sections"):
                    # Do not silently reduce an all-required rule when one raw
                    # course is unresolved. The impossible count keeps the gap
                    # visible until a human links that course.
                    group["sections"][0]["section_advisement"] = len(raw_group.get("courses") or [])
                groups.append(group)

            stats["modeling_warnings"].extend({
                "community_college_id": cc_id,
                "college_name": meta.get("college_name"),
                "slot": slot,
                "warning": warning,
            } for warning in degree_modeling_warnings)

            if not groups:
                raise ValueError(f"{path}: {slot} has no importable requirement groups")
            legacy_id = f"{cc_id}:{MAJOR_SLUG}:{slot}"
            degree_notes = "\n\n".join(filter(None, [meta.get("notes"), payload.get("notes"), degree.get("notes")]))
            doc = {
                "_id": f"as_degree:{legacy_id}",
                "legacy_id": legacy_id,
                "kind": "as_degree",
                "community_college_id": cc_id,
                "college_id": f"cc:{cc_id}",
                "major_slug": MAJOR_SLUG,
                "degree_type": slot,
                "template_ref": None,
                "status": "found",
                "degree_title_seen": degree.get("degree_title_seen"),
                "award_seen": degree.get("award_seen"),
                "catalog_url": degree.get("catalog_url"),
                "catalog_year": degree.get("catalog_year"),
                "unit_system": degree.get("unit_system"),
                "total_units": degree.get("total_units"),
                "major_units_min": degree.get("major_units_min"),
                "major_units_max": degree.get("major_units_max"),
                "tmc_version_seen": degree.get("tmc_version_seen"),
                "catalog_status_seen": degree.get("catalog_status_seen"),
                "requirement_groups": groups,
                "covered_concepts": sorted(covered_concepts),
                "analysis_ready": False,
                "analysis_blockers": sorted(set(
                    ["human verification required", "Biology degree template not yet configured"]
                    + (["catalog choice structure needs modeling"] if degree_modeling_warnings else [])
                    + (["catalog courses remain unresolved"] if degree_unresolved else [])
                )),
                "verification": {
                    "verified": False,
                    "verified_by": None,
                    "verified_at": None,
                    "notes": None,
                },
                "extraction": {
                    "artifact": source,
                    "confidence": confidence,
                    "needs_browser": bool(
                        degree_dropped or degree_unresolved or degree_modeling_warnings
                    ),
                    "notes": degree_notes,
                    "catalog_sources": degree.get("sources") or [],
                    "dropped_unresolved_groups": degree_dropped,
                    "modeling_warnings": degree_modeling_warnings,
                    "title_fallback_matches": degree_title_matches,
                },
                "source": source,
                "updated_at": now,
            }
            error = _compiled_doc_error(doc, known_college_ids)
            if error:
                raise ValueError(f"internal error compiling {doc['_id']}: {error}")
            docs.append(doc)
            stats["by_slot"][slot] += 1
    return docs, stats


def serializable(value):
    if isinstance(value, (dt.datetime, dt.date)):
        return value.isoformat()
    raise TypeError(f"cannot serialize {type(value).__name__}")


def merge_for_publish(doc: dict, existing: dict | None):
    """Protect every record a person has touched, not only final verdicts.

    The save endpoint stamps ``curated_by`` and ``curated_at`` on any human
    save, including an unverified work-in-progress. A batch refresh cannot
    safely infer which of those fields the reviewer meant to keep, so it skips
    the whole row. Untouched machine rows still use the established merge that
    preserves any older group-level curation defensively.
    """
    if existing and (existing.get("curated_by") is not None or existing.get("curated_at") is not None):
        return None, False, True, False
    merged, skipped_verified, preserved_curated = merge_with_existing(doc, existing)
    return merged, skipped_verified, False, preserved_curated


def write_compiled_artifact(path: Path, docs: list[dict], now: dt.datetime) -> None:
    by_slot = Counter(doc.get("degree_type") for doc in docs)
    payload = {
        "_meta": {
            "major_slug": MAJOR_SLUG,
            "source_academic_year": SOURCE_ACADEMIC_YEAR,
            "generated_at": now,
            "document_count": len(docs),
            "by_slot": dict(by_slot),
            "purpose": "Cumulative snapshot of Biology as_degree rows currently published to the local database.",
        },
        "documents": docs,
    }
    path.parent.mkdir(parents=True, exist_ok=True)
    temporary = path.with_suffix(path.suffix + ".tmp")
    temporary.write_text(
        json.dumps(payload, indent=2, ensure_ascii=False, default=serializable) + "\n",
        encoding="utf-8",
    )
    os.replace(temporary, path)


def report(
    stats: dict,
    docs: list[dict],
    *,
    dry_run: bool,
    skipped_verified: int,
    skipped_human: int,
    preserved_curated: int,
) -> None:
    verb = "Would publish" if dry_run else "Published"
    print(f"{verb} {len(docs)} Biology degree row(s) for {SOURCE_ACADEMIC_YEAR}.")
    print("By slot:", ", ".join(f"{slot}={stats['by_slot'][slot]}" for slot in SLOTS))
    if stats["none_found_rows"]:
        print(f"Explicit confirmed-none rows: {stats['none_found_rows']}")
    considered = stats["courses_considered"]
    resolved = stats["resolved_by_number"] + stats["resolved_by_title"]
    rate = (resolved / considered * 100) if considered else 100.0
    print(
        f"Course links: {resolved}/{considered} ({rate:.1f}%); "
        f"number={stats['resolved_by_number']}, title={stats['resolved_by_title']}, "
        f"unresolved={stats['unresolved']}"
    )
    print(
        f"Verified rows skipped: {skipped_verified}; human-saved drafts skipped: "
        f"{skipped_human}; curated rows preserved: {preserved_curated}"
    )
    if stats["dropped_groups"]:
        print(f"WARNING: {len(stats['dropped_groups'])} entirely unresolved group(s) remain in extraction metadata:")
        for row in stats["dropped_groups"]:
            print(f"  {row['college_name']} ({row['community_college_id']}) {row['slot']}: {row['label_seen']}")
    if stats["modeling_warnings"]:
        print(
            f"REVIEW REQUIRED: {len(stats['modeling_warnings'])} catalog choice/alternative "
            "warning(s); affected rows are marked analysis_ready=false."
        )
    if stats["title_matches"]:
        print(f"Title-fallback links: {len(stats['title_matches'])} (stored in extraction.title_fallback_matches)")


def main(argv=None) -> int:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--colleges-dir", default=str(DEFAULT_COLLEGES_DIR))
    parser.add_argument("--output-json", default=str(DEFAULT_OUTPUT_JSON))
    parser.add_argument("--college-id", action="append", type=int, dest="college_ids")
    parser.add_argument("--dry-run", action="store_true", help="compile and report without DB or artifact writes")
    args = parser.parse_args(argv)

    uri = os.environ.get("TARGET_MONGO_URI")
    if not uri:
        parser.error("TARGET_MONGO_URI is required for exact course resolution")

    from pymongo import MongoClient, ReplaceOne

    client = MongoClient(uri, serverSelectionTimeoutMS=8000)
    db = client[os.environ.get("TARGET_DB_NAME", "pmt_research")]
    db.command("ping")
    selected_ids = set(args.college_ids) if args.college_ids else None
    records = load_records(Path(args.colleges_dir), selected_ids)
    if not records:
        raise ValueError("no terminal research records selected")
    cc_ids = {int(payload["_meta"]["community_college_id"]) for _, payload in records}
    known_college_ids = {
        int(str(row["_id"]).split(":", 1)[1])
        for row in db["assist_institutions"].find(
            {"kind": "community_college", "_id": {"$regex": r"^cc:\d+$"}},
            {"_id": 1},
        )
    }
    course_index, title_index, concepts, collisions = build_course_index(db, cc_ids)
    if collisions:
        print(f"WARNING: {collisions} duplicate course-key collision(s) in assist_courses")
    now = dt.datetime.now(dt.timezone.utc)
    docs, stats = compile_records(
        records, course_index, title_index, concepts, known_college_ids, now
    )

    collection = db["curated_requirements"]
    existing = {
        row["_id"]: row
        for row in collection.find({"_id": {"$in": [doc["_id"] for doc in docs]}})
    }
    merged_docs = []
    skipped_verified = 0
    skipped_human = 0
    preserved_curated = 0
    for doc in docs:
        merged, skipped, human_saved, curated = merge_for_publish(
            doc, existing.get(doc["_id"])
        )
        skipped_verified += int(skipped)
        skipped_human += int(human_saved)
        preserved_curated += int(curated)
        if merged is not None:
            merged_docs.append(merged)

    if not args.dry_run:
        if merged_docs:
            collection.bulk_write(
                [ReplaceOne({"_id": doc["_id"]}, doc, upsert=True) for doc in merged_docs],
                ordered=False,
            )
        published_docs = list(collection.find({
            "kind": "as_degree",
            "major_slug": MAJOR_SLUG,
        }).sort([("community_college_id", 1), ("degree_type", 1)]))
        write_compiled_artifact(Path(args.output_json), published_docs, now)
    report(
        stats,
        merged_docs,
        dry_run=args.dry_run,
        skipped_verified=skipped_verified,
        skipped_human=skipped_human,
        preserved_curated=preserved_curated,
    )
    if not args.dry_run:
        print(f"Compiled artifact: {args.output_json}")
    return 0


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except (OSError, ValueError, json.JSONDecodeError) as exc:
        print(f"error: {exc}", file=sys.stderr)
        raise SystemExit(1)
