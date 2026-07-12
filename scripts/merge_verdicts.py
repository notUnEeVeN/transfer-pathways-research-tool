"""
Merge research audit verdicts back into the main PMT audit store.

Run ONCE at the end of the research project (or whenever you want to fold the
partners' auditing work into the main tool). Runs on your machine with both
connection strings — nothing automatic, nothing hosted.

Why it works: port.py preserved agreement `_id`s, so a research verdict's
`doc_id` refers to the same agreement in the main store. Verdicts carry
`verdict_origin: 'research'`, so research-sourced rows remain identifiable.
The main tool's staleness logic
(raw_template_hash / parser_output_hash comparison) then naturally marks any
verdict whose agreement has since been re-parsed as stale, instead of letting
it silently misreport.

Conflict policy: a doc that already has a verdict in the main store is SKIPPED
by default (your own auditing wins); pass --prefer-research to overwrite.

Env (scripts/.env or shell):
    RESEARCH_MONGO_URI / RESEARCH_DB_NAME (default pmt_research) — verdict source
    MAIN_AUDIT_MONGO_URI / MAIN_AUDIT_DB_NAME (default pmt_data) — main audit store
        (point this at whatever your AUDIT_MONGO_URI is in the main tooling:
        local Mongo, or the shared Atlas audit cluster)

Run from scripts/:
    python merge_verdicts.py --dry-run
    python merge_verdicts.py
    python merge_verdicts.py --prefer-research --yes
"""
import argparse
import os
import sys
from pathlib import Path

from dotenv import load_dotenv
from pymongo import MongoClient

HERE = Path(__file__).resolve().parent
load_dotenv(HERE / ".env")

RESEARCH_REVIEWS = "agreement_reviews"
MAIN_AUDIT_RESULTS = "audit_results"


def _env(name, default=None, required=False):
    val = os.environ.get(name, default)
    if required and not val:
        sys.exit(f"Missing required env var {name} (set it in scripts/.env or the shell).")
    return val


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--dry-run", action="store_true", help="report the plan, write nothing")
    ap.add_argument("--prefer-research", action="store_true",
                    help="overwrite main-store verdicts on conflict (default: skip)")
    ap.add_argument("--yes", action="store_true", help="skip the interactive confirm")
    args = ap.parse_args()

    research = MongoClient(_env("RESEARCH_MONGO_URI", required=True))[
        _env("RESEARCH_DB_NAME", "pmt_research")
    ]
    main_store = MongoClient(_env("MAIN_AUDIT_MONGO_URI", required=True))[
        _env("MAIN_AUDIT_DB_NAME", "pmt_data")
    ]

    rows = list(research[RESEARCH_REVIEWS].find())
    if not rows:
        sys.exit("No research verdicts to merge.")

    existing = {
        d["doc_id"] for d in main_store[MAIN_AUDIT_RESULTS].find({}, {"doc_id": 1})
    }
    fresh = [r for r in rows if r["doc_id"] not in existing]
    conflicts = [r for r in rows if r["doc_id"] in existing]

    print(f"Research verdicts: {len(rows)}")
    print(f"  new to the main store:      {len(fresh)}")
    print(f"  conflicts (already judged): {len(conflicts)}"
          f" -> {'OVERWRITE (--prefer-research)' if args.prefer_research else 'skip'}")
    if args.dry_run:
        print("\n--dry-run: nothing written.")
        return
    if not args.yes and input("\nType 'yes' to merge: ").strip().lower() != "yes":
        sys.exit("Aborted.")

    to_write = rows if args.prefer_research else fresh
    written = 0
    for r in to_write:
        doc = dict(r)
        doc.pop("_id", None)  # target keeps its own row identity; doc_id is the key
        main_store[MAIN_AUDIT_RESULTS].update_one(
            {"doc_id": doc["doc_id"]}, {"$set": doc}, upsert=True
        )
        written += 1
    print(f"\nMerged {written} verdicts "
          f"({len(conflicts) if args.prefer_research else 0} overwrites, "
          f"{0 if args.prefer_research else len(conflicts)} skipped).")


if __name__ == "__main__":
    main()
