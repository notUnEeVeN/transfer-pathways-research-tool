"""
Import the hand-gathered FULL four-year degree requirements (BSCS/EECS) into the
research DB, modeled in the ASSIST agreement `requirement_groups` shape so the
degree-coverage figure (MA Fig. 1) can reuse the existing choose-N eligibility
engine (server/services/analysis/pathways.chooseNMinimum).

Unlike an agreement, a degree-requirements doc is NOT tied to one community
college: it stores the requirement MODEL only (groups -> sections -> receivers
with parent_id + section_advisement). The figure stamps articulation_status per
community college at compute time — a receiver is "articulated" for a CC when
that CC articulates the receiver's parent_id in its real agreement.

Source (hand-authored): scripts/data/uc_degree_requirements.json
Provenance (per datum, with URLs): docs/figures/degree-coverage-sources.md

Env (scripts/.env or shell):
  TARGET_MONGO_URI (required)
  TARGET_DB_NAME   (default pmt_research)

Output collection:
  curated_requirements (kind=degree):
    { _id: 'degree:<school_id>', school_id, school, program, total_units,
      source_url, requirement_groups[], source, updated_at }

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

# Our scraped data still stores the pre-2025 EE numbering (EECS 16A/16B); the
# current Berkeley catalog renamed these ELENG 66/64. Author codes either way —
# these aliases are tried when a direct code match misses. Normalized form.
CODE_ALIASES = {
    "ELENG 66": "EECS 16A",
    "ELENG 64": "EECS 16B",
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
    return re.sub(r"\s+", " ", s).strip()


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


def ge_area_receiver(code, name, seq, ge_areas=None, assume=False):
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
    }


def build_section(req, tier, title, by_code, by_prefix, report, seq):
    """One authored requirement -> one section {section_advisement, receivers[]}."""
    select = int(req["select"])
    frm = req.get("from")
    ge_area = req.get("ge_area")  # single IGETC area a specific course also satisfies
    section = {"section_advisement": select, "unit_advisement": None, "tier": tier, "receivers": []}
    # Optional authored "units" (the block's stated total, e.g. Berkeley's
    # 20-unit upper-division rule or a 12-unit series) overrides the flat
    # ~4u/course assumption in the unit budget shown on the template page.
    if req.get("units") is not None:
        section["unit_advisement"] = int(req["units"])

    if frm is None:
        # Non-transferable: `select` named slots, never satisfiable by any CC.
        section["receivers"] = [requirement_receiver(tier, title, seq()) for _ in range(select)]
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
        section["receivers"] = [ge_area_receiver(code, label, seq(), assume=True)]
        report["breadth_courses"] += 1

    else:
        raise ValueError(f"Unrecognized `from` in requirement: {req!r}")

    report["required_slots"] += select
    if tier == "transferable":
        report["transferable_slots"] += select
    elif tier == "breadth":
        report["breadth_slots"] += select

    return section


def build_doc(campus_key, campus, by_code, by_prefix, report):
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
            "sections": sections,
        })
    return {
        "_id": f"degree:{campus['school_id']}",
        "legacy_id": str(campus["school_id"]),
        "kind": "degree",
        "institution_id": f"uc:{campus['school_id']}",
        "school_id": int(campus["school_id"]),
        "school": campus["school"],
        "program": campus["program"],
        "total_units": campus.get("total_units"),
        "source_url": campus.get("source_url"),
        "requirement_groups": groups,
        "source": "hand_curated_degree",
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
    for campus_key, campus in campuses.items():
        by_code, by_prefix = school_course_index(db, campus["school_id"])
        report = {"resolved": [], "unresolved": [], "required_slots": 0,
                  "transferable_slots": 0, "breadth_slots": 0, "nontransferable_slots": 0,
                  "breadth_courses": 0}
        doc = build_doc(campus_key, campus, by_code, by_prefix, report)

        print(f"\n=== {campus_key}: {campus['school']} — {campus['program']} ===")
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
            print(f"  !! UNRESOLVED codes ({len(report['unresolved'])}) — fix before trusting the figure:")
            for code, norm in report["unresolved"]:
                print(f"    {code}  (normalized {norm})")

        ops.append(doc)

    if args.dry_run:
        print("\n[dry-run] no write. Re-run without --dry-run to upsert.")
        return

    now = dt.datetime.now(dt.timezone.utc)
    coll = db["curated_requirements"]
    writes = [UpdateOne({"_id": d["_id"]}, {"$set": {**d, "updated_at": now}}, upsert=True) for d in ops]
    res = coll.bulk_write(writes)
    print(f"\nUpserted {res.upserted_count + res.modified_count} degree requirement doc(s) into curated_requirements.")


if __name__ == "__main__":
    main()
