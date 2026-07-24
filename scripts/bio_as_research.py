#!/usr/bin/env python3
"""Resumable statewide discovery and checkpoint tooling for Biology degrees.

This script owns discovery and source-preserving checkpoints; it never writes
MongoDB itself. Once a checkpoint is complete and validated, publish it through
``scripts/import_bio_as_degrees.py``. The historical ``import_as_degrees.py``
still belongs only to the CS extraction.

Typical use:

    python scripts/bio_as_research.py discover
    python scripts/bio_as_research.py status
    python scripts/bio_as_research.py next --limit 12
    python scripts/bio_as_research.py scaffold --college-id 2
    python scripts/bio_as_research.py validate

``discover`` checkpoints after every college response. Re-running it skips
completed rows and retries only interrupted/error rows unless ``--refresh`` is
passed.
"""

from __future__ import annotations

import argparse
from collections import Counter
from concurrent.futures import ThreadPoolExecutor, as_completed
from datetime import datetime, timezone
import hashlib
import json
import os
from pathlib import Path
import re
import sys
import unicodedata
from urllib.parse import urlencode
from urllib.request import Request, urlopen


HERE = Path(__file__).resolve().parent
REPO_ROOT = HERE.parent
CS_EXTRACTION = HERE / "data" / "as_degrees_cs_extraction.json"
RESEARCH_ROOT = HERE / "data" / "as_degrees_bio_research"
INVENTORY_PATH = RESEARCH_ROOT / "inventory.json"
COLLEGES_DIR = RESEARCH_ROOT / "colleges"
TMC_VERSIONS_PATH = RESEARCH_ROOT / "tmc_versions.json"
SOURCE_ACADEMIC_YEAR = "2025-2026"

ICGTC_BASE = "https://icangotocollege.com"
BIOLOGY_CATEGORY_ID = "7030"
CATEGORY_ENDPOINT = (
    f"{ICGTC_BASE}/api/transfer-tool/degree-program-categories/colleges"
)
PROGRAM_ENDPOINT = f"{ICGTC_BASE}/api/transfer-tool/colleges/degree-programs"

RESEARCH_STATUSES = {
    "inventory_only",
    "catalog_found",
    "requirements_extracted",
    "needs_browser",
    "needs_scope_decision",
    "none_found",
}
DEGREE_TYPE_HINTS = {"ast", "local_as", "local_other", "unknown"}
TERMINAL_RESEARCH_STATUSES = {"requirements_extracted", "none_found"}
# Keep checkpoint semantics aligned with the runtime transformer. Catching an
# unsupported research-only spelling here prevents a completed source record
# from failing only when it reaches database publication.
MAJOR_GROUP_RULES = {"ge_area", "electives", "all", "choose_courses", "choose_units"}


def utc_stamp() -> str:
    return datetime.now(timezone.utc).replace(microsecond=0).isoformat()


def load_json(path: Path):
    with path.open(encoding="utf-8") as handle:
        return json.load(handle)


def write_json_atomic(path: Path, payload) -> None:
    """Write a valid checkpoint even if the process is interrupted mid-run."""
    path.parent.mkdir(parents=True, exist_ok=True)
    temporary = path.with_suffix(path.suffix + ".tmp")
    with temporary.open("w", encoding="utf-8") as handle:
        json.dump(payload, handle, indent=2, ensure_ascii=False)
        handle.write("\n")
    os.replace(temporary, path)


def fetch_json(url: str, timeout: int = 25):
    request = Request(
        url,
        headers={
            "Accept": "application/json",
            "User-Agent": "PMT-Biology-AS-research/1.0 (+local academic research)",
        },
    )
    with urlopen(request, timeout=timeout) as response:  # noqa: S310 - fixed HTTPS hosts
        return json.load(response)


def normalize_college_name(value: str) -> str:
    value = unicodedata.normalize("NFKD", str(value or ""))
    value = "".join(char for char in value if not unicodedata.combining(char))
    value = value.lower().replace("&", " and ")
    value = re.sub(r"\bmt\.?\b", "mount", value)
    value = re.sub(r"\btrade[ -]?tech\b", "trade technical", value)
    value = re.sub(r"[^a-z0-9]+", " ", value)
    return " ".join(value.split())


# Official directory display names occasionally omit or add "Community" or
# "College of". Keep these explicit: a fuzzy match between colleges would make
# a fast research pass look complete while attaching sources to the wrong ID.
COLLEGE_NAME_ALIASES = {
    normalize_college_name("College of Alameda"): normalize_college_name("Alameda"),
    normalize_college_name("Coastline Community College"): normalize_college_name("Coastline College"),
    normalize_college_name("Lassen Community College"): normalize_college_name("Lassen College"),
    normalize_college_name("Madera Community College"): normalize_college_name("Madera College"),
}


def program_type_hint(title: str) -> str:
    """Conservative inventory hint; the college catalog remains authoritative."""
    lowered = normalize_college_name(title)
    if re.search(r"\b(?:as|a s) t\b", lowered) or "for transfer" in lowered:
        return "ast"
    if re.search(r"\bassociate (in|of) science\b", lowered) or re.search(r"\ba s\b", lowered):
        return "local_as"
    if re.search(r"\bassociate (in|of) arts\b", lowered) or re.search(r"\ba a\b", lowered):
        return "local_other"
    return "unknown"


def repo_colleges(cs_extraction_path: Path = CS_EXTRACTION) -> list[dict]:
    data = load_json(cs_extraction_path)
    rows = []
    for row in data.get("survey", []):
        rows.append({
            "community_college_id": int(row["community_college_id"]),
            "college_name": row["college_name"],
        })
    rows.sort(key=lambda row: row["community_college_id"])
    return rows


def match_statewide_colleges(repo_rows: list[dict], statewide_rows: list[dict]):
    by_name = {}
    for row in statewide_rows:
        key = normalize_college_name(row.get("title"))
        if key in by_name:
            raise ValueError(f"duplicate statewide college name after normalization: {key}")
        by_name[key] = row

    matched = {}
    used_statewide_ids = set()
    for row in repo_rows:
        key = normalize_college_name(row["college_name"])
        key = COLLEGE_NAME_ALIASES.get(key, key)
        candidate = by_name.get(key)
        if candidate is None:
            continue
        matched[row["community_college_id"]] = candidate
        used_statewide_ids.add(str(candidate.get("id")))

    unmatched_statewide = [
        row for row in statewide_rows if str(row.get("id")) not in used_statewide_ids
    ]
    return matched, unmatched_statewide


def category_url() -> str:
    return CATEGORY_ENDPOINT + "?" + urlencode({
        "degree_program_id": BIOLOGY_CATEGORY_ID,
        "search_string": "",
        "distance": 0,
        "orderby": "title",
    })


def programs_url(statewide_college_id: str) -> str:
    return PROGRAM_ENDPOINT + "?" + urlencode({
        "college_id": statewide_college_id,
        "search_string": "biology",
    })


def initial_inventory(repo_rows: list[dict]) -> dict:
    compact_ids = json.dumps(
        sorted(row["community_college_id"] for row in repo_rows),
        separators=(",", ":"),
    ).encode()
    return {
        "_meta": {
            "major_slug": "bio",
            "source_academic_year": SOURCE_ACADEMIC_YEAR,
            "purpose": "Resumable statewide inventory for Biology associate-degree research.",
            "created_at": utc_stamp(),
            "last_checkpoint_at": None,
            "statewide_category_id": BIOLOGY_CATEGORY_ID,
            "statewide_source_url": category_url(),
            "statewide_source_name": "I Can Go to College — California Community Colleges",
            "source_role": (
                "Fast official discovery index only. Each included degree still needs one "
                "college-catalog source for title, award, units, and requirements."
            ),
            "college_count": len(repo_rows),
            "college_universe_source": "scripts/data/as_degrees_cs_extraction.json#survey",
            "canonical_college_ids_sha256": hashlib.sha256(compact_ids).hexdigest(),
            "completed_discovery_count": 0,
            "unmatched_statewide_colleges": [],
        },
        "colleges": [
            {
                **row,
                "discovery_status": "pending",
                "discovery_source_url": category_url(),
                "statewide_listing_status": "unknown",
                "statewide_college_id": None,
                "statewide_college_uri": None,
                "programs_source_url": None,
                "programs": [],
                "discovery_error": None,
                "checked_at": None,
            }
            for row in repo_rows
        ],
    }


def inventory_index(inventory: dict) -> dict[int, dict]:
    return {int(row["community_college_id"]): row for row in inventory.get("colleges", [])}


def checkpoint_inventory(inventory: dict, output: Path) -> None:
    complete = sum(
        row.get("discovery_status") == "complete"
        for row in inventory.get("colleges", [])
    )
    inventory["_meta"]["completed_discovery_count"] = complete
    inventory["_meta"]["last_checkpoint_at"] = utc_stamp()
    inventory["colleges"].sort(key=lambda row: int(row["community_college_id"]))
    write_json_atomic(output, inventory)


def discover(args) -> int:
    output = Path(args.inventory)
    repo_rows = repo_colleges(Path(args.college_source))
    if output.exists() and not args.refresh:
        inventory = load_json(output)
        existing = inventory_index(inventory)
        expected_ids = {row["community_college_id"] for row in repo_rows}
        if set(existing) != expected_ids:
            raise ValueError(
                "existing inventory college universe differs from the canonical 115-school source; "
                "use --refresh after reviewing the change"
            )
    else:
        inventory = initial_inventory(repo_rows)

    category_payload = fetch_json(category_url())
    statewide_rows = category_payload.get("colleges", [])
    matched, unmatched_statewide = match_statewide_colleges(repo_rows, statewide_rows)
    if unmatched_statewide:
        names = ", ".join(str(row.get("title")) for row in unmatched_statewide)
        raise ValueError(f"statewide Biology colleges do not map to a canonical repo college: {names}")

    inventory["_meta"]["statewide_listing_count"] = len(statewide_rows)
    inventory["_meta"]["unmatched_statewide_colleges"] = []
    rows_by_id = inventory_index(inventory)

    pending = []
    for repo_row in repo_rows:
        cc_id = repo_row["community_college_id"]
        row = rows_by_id[cc_id]
        listing = matched.get(cc_id)
        if listing is None:
            row.update({
                "discovery_status": "complete",
                "statewide_listing_status": "not_listed",
                "statewide_college_id": None,
                "statewide_college_uri": None,
                "programs_source_url": None,
                "programs": [],
                "discovery_error": None,
                "checked_at": utc_stamp(),
            })
            continue
        row.update({
            "statewide_listing_status": "listed",
            "statewide_college_id": str(listing["id"]),
            "statewide_college_uri": listing.get("uri"),
            "programs_source_url": programs_url(str(listing["id"])),
        })
        if args.refresh or row.get("discovery_status") != "complete":
            pending.append(row)

    checkpoint_inventory(inventory, output)
    if not pending:
        print(f"Discovery already complete: {output}")
        return 0

    def fetch_programs(row):
        return row, fetch_json(row["programs_source_url"])

    with ThreadPoolExecutor(max_workers=max(1, args.workers)) as pool:
        future_to_row = {pool.submit(fetch_programs, row): row for row in pending}
        for future in as_completed(future_to_row):
            row = future_to_row[future]
            try:
                row, programs = future.result()
                filtered = [
                    program for program in programs
                    if str(program.get("degree_program_id")) == BIOLOGY_CATEGORY_ID
                ]
                row["programs"] = [
                    {
                        "statewide_program_id": str(program.get("id")),
                        "title": program.get("title"),
                        "degree_type_hint": program_type_hint(program.get("title", "")),
                        "source_url": ICGTC_BASE + str(program.get("uri", "")),
                    }
                    for program in filtered
                ]
                row["discovery_status"] = "complete"
                row["discovery_error"] = None
                row["checked_at"] = utc_stamp()
            except Exception as exc:  # preserve the row and retry on the next run
                row["discovery_status"] = "error"
                row["discovery_error"] = f"{type(exc).__name__}: {exc}"
                row["checked_at"] = utc_stamp()
            checkpoint_inventory(inventory, output)
            done = inventory["_meta"]["completed_discovery_count"]
            print(f"checkpoint {done}/{len(repo_rows)}: {row['college_name']}")

    errors = [row for row in inventory["colleges"] if row["discovery_status"] == "error"]
    print(f"Wrote {output}; discovery errors: {len(errors)}")
    return 1 if errors else 0


def research_files(colleges_dir: Path) -> dict[int, tuple[Path, dict]]:
    out = {}
    if not colleges_dir.is_dir():
        return out
    for path in sorted(colleges_dir.glob("*.json")):
        payload = load_json(path)
        cc_id = int(payload.get("_meta", {}).get("community_college_id"))
        if cc_id in out:
            raise ValueError(f"duplicate research record for college {cc_id}")
        out[cc_id] = (path, payload)
    return out


def summarize(inventory: dict, records: dict[int, tuple[Path, dict]]) -> dict:
    program_hints = Counter()
    program_count = 0
    for row in inventory.get("colleges", []):
        for program in row.get("programs", []):
            program_count += 1
            program_hints[program.get("degree_type_hint", "unknown")] += 1
    research_statuses = Counter(
        payload.get("_meta", {}).get("research_status", "invalid")
        for _, payload in records.values()
    )
    extracted_degrees = sum(
        len(payload.get("degrees", [])) for _, payload in records.values()
    )
    return {
        "colleges": len(inventory.get("colleges", [])),
        "discovery_complete": sum(
            row.get("discovery_status") == "complete"
            for row in inventory.get("colleges", [])
        ),
        "statewide_listed": sum(
            row.get("statewide_listing_status") == "listed"
            for row in inventory.get("colleges", [])
        ),
        "program_candidates": program_count,
        "program_hints": dict(sorted(program_hints.items())),
        "research_records": len(records),
        "research_statuses": dict(sorted(research_statuses.items())),
        "extracted_degrees": extracted_degrees,
        "remaining_colleges": len(inventory.get("colleges", [])) - sum(
            payload.get("_meta", {}).get("research_status")
            in TERMINAL_RESEARCH_STATUSES
            for _, payload in records.values()
        ),
    }


def status(args) -> int:
    inventory = load_json(Path(args.inventory))
    records = research_files(Path(args.colleges_dir))
    summary = summarize(inventory, records)
    if args.json:
        print(json.dumps(summary, indent=2))
        return 0
    print(f"College universe:        {summary['colleges']}")
    print(f"Discovery complete:      {summary['discovery_complete']}")
    print(f"Statewide index listed:  {summary['statewide_listed']}")
    print(f"Program candidates:      {summary['program_candidates']}")
    print(f"Candidate type hints:    {summary['program_hints']}")
    print(f"Research records:        {summary['research_records']}")
    print(f"Research statuses:       {summary['research_statuses']}")
    print(f"Extracted degrees:       {summary['extracted_degrees']}")
    print(f"Colleges remaining:      {summary['remaining_colleges']}")
    return 0


def pending_rows(inventory: dict, records: dict[int, tuple[Path, dict]]) -> list[dict]:
    rows = []
    for row in inventory.get("colleges", []):
        cc_id = int(row["community_college_id"])
        record = records.get(cc_id)
        research_status = (
            record[1].get("_meta", {}).get("research_status", "invalid")
            if record
            else "not_started"
        )
        if research_status not in TERMINAL_RESEARCH_STATUSES:
            rows.append({**row, "research_status": research_status})
    rows.sort(key=lambda row: (
        row.get("research_status") == "not_started",
        row.get("statewide_listing_status") != "listed",
        int(row["community_college_id"]),
    ))
    return rows


def next_rows(args) -> int:
    inventory = load_json(Path(args.inventory))
    records = research_files(Path(args.colleges_dir))
    rows = pending_rows(inventory, records)
    if args.start_after is not None:
        rows = [row for row in rows if int(row["community_college_id"]) > args.start_after]
    for row in rows[: args.limit]:
        titles = " | ".join(program.get("title") or "" for program in row.get("programs", []))
        print(
            f"{row['community_college_id']}\t{row['college_name']}\t"
            f"{row['research_status']}\t{titles or '[not listed]'}"
        )
    return 0


def scaffold_payload(inventory_row: dict) -> dict:
    return {
        "_meta": {
            "community_college_id": int(inventory_row["community_college_id"]),
            "college_name": inventory_row["college_name"],
            "major_slug": "bio",
            "research_status": "inventory_only",
            "created_at": utc_stamp(),
            "updated_at": utc_stamp(),
            "resume_note": (
                f"Open the official {SOURCE_ACADEMIC_YEAR} college catalog and extract "
                "one source for each "
                "general Biology/Biological Sciences AS-T, AS, or AA; ignore other awards."
            ),
        },
        "inventory": {
            "statewide_listing_status": inventory_row.get("statewide_listing_status"),
            "programs_source_url": inventory_row.get("programs_source_url"),
            "checked_at": inventory_row.get("checked_at"),
            "programs": inventory_row.get("programs", []),
        },
        "degrees": [],
        "out_of_scope_candidates": [],
        "notes": "",
    }


def scaffold(args) -> int:
    inventory = load_json(Path(args.inventory))
    row = inventory_index(inventory).get(args.college_id)
    if row is None:
        raise ValueError(f"unknown community college id: {args.college_id}")
    output = Path(args.colleges_dir) / f"{args.college_id:03d}.json"
    if output.exists() and not args.force:
        raise FileExistsError(f"research record already exists: {output}")
    write_json_atomic(output, scaffold_payload(row))
    print(output)
    return 0


def validate_research_record(path: Path, payload: dict, inventory_by_id: dict[int, dict]) -> list[str]:
    errors = []
    meta = payload.get("_meta")
    if not isinstance(meta, dict):
        return [f"{path}: _meta must be an object"]
    try:
        cc_id = int(meta.get("community_college_id"))
    except (TypeError, ValueError):
        return [f"{path}: _meta.community_college_id must be an integer"]
    expected = inventory_by_id.get(cc_id)
    if expected is None:
        errors.append(f"{path}: college {cc_id} is not in inventory")
    elif meta.get("college_name") != expected.get("college_name"):
        errors.append(f"{path}: college_name does not match inventory")
    if path.stem != f"{cc_id:03d}":
        errors.append(f"{path}: filename must be {cc_id:03d}.json")
    if meta.get("major_slug") != "bio":
        errors.append(f"{path}: _meta.major_slug must be bio")
    status_value = meta.get("research_status")
    if status_value not in RESEARCH_STATUSES:
        errors.append(f"{path}: invalid research_status {status_value!r}")

    degrees = payload.get("degrees")
    if not isinstance(degrees, list):
        errors.append(f"{path}: degrees must be an array")
        degrees = []
    if status_value == "requirements_extracted" and not degrees:
        errors.append(f"{path}: requirements_extracted needs at least one degree")
    if status_value == "none_found" and degrees:
        errors.append(f"{path}: none_found cannot contain degrees")
    if status_value == "none_found":
        negative_sources = payload.get("none_found_sources")
        if not isinstance(negative_sources, list) or not negative_sources:
            errors.append(f"{path}: none_found needs at least one none_found_sources entry")
        else:
            for source_index, source in enumerate(negative_sources):
                if not str(source.get("url") or "").startswith(("http://", "https://")):
                    errors.append(
                        f"{path}: none_found_sources[{source_index}].url must be HTTP(S)"
                    )
                if source.get("catalog_year") != SOURCE_ACADEMIC_YEAR:
                    errors.append(
                        f"{path}: none_found_sources[{source_index}].catalog_year must be "
                        f"{SOURCE_ACADEMIC_YEAR}"
                    )
    for index, degree in enumerate(degrees):
        prefix = f"{path}: degrees[{index}]"
        if degree.get("degree_type_hint") not in DEGREE_TYPE_HINTS:
            errors.append(f"{prefix}.degree_type_hint must be one of {sorted(DEGREE_TYPE_HINTS)}")
        for field in ("degree_title_seen", "award_seen", "catalog_url", "catalog_year"):
            if not str(degree.get(field) or "").strip():
                errors.append(f"{prefix}.{field} is required")
        if not str(degree.get("catalog_url") or "").startswith(("http://", "https://")):
            errors.append(f"{prefix}.catalog_url must be an HTTP(S) URL")
        if degree.get("catalog_year") != SOURCE_ACADEMIC_YEAR:
            errors.append(
                f"{prefix}.catalog_year must be {SOURCE_ACADEMIC_YEAR}"
            )
        sources = degree.get("sources")
        if not isinstance(sources, list) or not sources:
            errors.append(f"{prefix}.sources needs at least one source")
        else:
            for source_index, source in enumerate(sources):
                if not str(source.get("url") or "").startswith(("http://", "https://")):
                    errors.append(f"{prefix}.sources[{source_index}].url must be HTTP(S)")
                if source.get("catalog_year") != SOURCE_ACADEMIC_YEAR:
                    errors.append(
                        f"{prefix}.sources[{source_index}].catalog_year must be "
                        f"{SOURCE_ACADEMIC_YEAR}"
                    )
        major_groups = degree.get("major_groups")
        if not isinstance(major_groups, list):
            errors.append(f"{prefix}.major_groups must be an array")
        else:
            for group_index, group in enumerate(major_groups):
                group_prefix = f"{prefix}.major_groups[{group_index}]"
                if not isinstance(group, dict):
                    errors.append(f"{group_prefix} must be an object")
                    continue
                rule = group.get("rule")
                if rule not in MAJOR_GROUP_RULES:
                    errors.append(
                        f"{group_prefix}.rule must be one of "
                        f"{sorted(MAJOR_GROUP_RULES)}; found {rule!r}"
                    )
                if not isinstance(group.get("courses"), list):
                    errors.append(f"{group_prefix}.courses must be an array")
    candidates = payload.get("out_of_scope_candidates", [])
    if not isinstance(candidates, list):
        errors.append(f"{path}: out_of_scope_candidates must be an array")
    elif candidates:
        errors.append(
            f"{path}: out_of_scope_candidates must stay empty; specialized/adjacent "
            "programs are outside this research pass"
        )
    return errors


def validate(args) -> int:
    inventory = load_json(Path(args.inventory))
    rows = inventory.get("colleges")
    errors = []
    if inventory.get("_meta", {}).get("source_academic_year") != SOURCE_ACADEMIC_YEAR:
        errors.append(
            f"inventory._meta.source_academic_year must be {SOURCE_ACADEMIC_YEAR}"
        )
    tmc_path = TMC_VERSIONS_PATH
    if tmc_path.exists():
        tmc = load_json(tmc_path)
        if tmc.get("_meta", {}).get("source_academic_year") != SOURCE_ACADEMIC_YEAR:
            errors.append(
                f"tmc_versions._meta.source_academic_year must be {SOURCE_ACADEMIC_YEAR}"
            )
        version_keys = {row.get("key") for row in tmc.get("versions", [])}
        if version_keys != {"biology_2015_rev2"}:
            errors.append(
                "tmc_versions must contain only biology_2015_rev2 for the pinned cohort"
            )
    if not isinstance(rows, list):
        errors.append("inventory.colleges must be an array")
        rows = []
    ids = [int(row["community_college_id"]) for row in rows]
    if len(ids) != len(set(ids)):
        errors.append("inventory has duplicate community_college_id values")
    if len(rows) != 115:
        errors.append(f"inventory must retain the canonical 115-college universe; found {len(rows)}")
    by_id = inventory_index(inventory)
    records = research_files(Path(args.colleges_dir))
    for path, payload in records.values():
        errors.extend(validate_research_record(path, payload, by_id))
    if errors:
        print("\n".join(errors), file=sys.stderr)
        return 1
    print(f"Valid: 115 inventory rows; {len(records)} college research records")
    return 0


def parser() -> argparse.ArgumentParser:
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("--inventory", default=str(INVENTORY_PATH))
    ap.add_argument("--colleges-dir", default=str(COLLEGES_DIR))
    sub = ap.add_subparsers(dest="command", required=True)

    discover_ap = sub.add_parser("discover", help="checkpoint the official statewide Biology inventory")
    discover_ap.add_argument("--college-source", default=str(CS_EXTRACTION))
    discover_ap.add_argument("--workers", type=int, default=12)
    discover_ap.add_argument("--refresh", action="store_true")
    discover_ap.set_defaults(func=discover)

    status_ap = sub.add_parser("status", help="show resumable progress")
    status_ap.add_argument("--json", action="store_true")
    status_ap.set_defaults(func=status)

    next_ap = sub.add_parser("next", help="list colleges without a research record")
    next_ap.add_argument("--limit", type=int, default=12)
    next_ap.add_argument("--start-after", type=int)
    next_ap.set_defaults(func=next_rows)

    scaffold_ap = sub.add_parser("scaffold", help="create one college checkpoint from inventory")
    scaffold_ap.add_argument("--college-id", required=True, type=int)
    scaffold_ap.add_argument("--force", action="store_true")
    scaffold_ap.set_defaults(func=scaffold)

    validate_ap = sub.add_parser("validate", help="validate inventory and completed checkpoints")
    validate_ap.set_defaults(func=validate)
    return ap


def main(argv=None) -> int:
    args = parser().parse_args(argv)
    try:
        return args.func(args)
    except (OSError, ValueError, json.JSONDecodeError) as exc:
        print(f"error: {exc}", file=sys.stderr)
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
