"""
Import hand-gathered CC course prerequisites into ref_prerequisites.

Source (prior research repo), one JSON per college:
  ../transfer-agreements-analysis/prerequisites/<college>_prereqs.json
each a list of { courseCode, courseName, units, prerequisites: [courseCode...] }.

These are hand-curated (a person read catalogs), so they live in an editable
reference table rather than being recomputed. The console's References tab
edits them in place.

Env (scripts/.env or shell):
  TARGET_MONGO_URI (required, unless --dry-run)
  TARGET_DB_NAME   (default pmt_research)

Output collection:
  ref_prerequisites:
    { _id: "<college_slug>:<normalized_course_code>", college, course_code,
      course_name, units, prerequisites[], source, updated_at }
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

DEFAULT_DIR = HERE.parent.parent / "transfer-agreements-analysis" / "prerequisites"


def _env(name, default=None, required=False):
    val = os.environ.get(name, default)
    if required and not val:
        sys.exit(f"Missing required env var {name} (set it in scripts/.env or the shell).")
    return val


def norm_code(code):
    return re.sub(r"\s+", " ", str(code or "").upper()).strip()


def college_from_filename(path):
    slug = path.name.replace("_prereqs.json", "")
    words = [w for w in slug.split("_") if w]
    name = " ".join(w.upper() if w in ("la", "smc") else w.capitalize() for w in words)
    return slug, name


def build_docs(src_dir):
    now = dt.datetime.now(dt.timezone.utc)
    docs = []
    files = sorted(p for p in src_dir.glob("*_prereqs.json"))
    for path in files:
        slug, college = college_from_filename(path)
        try:
            rows = json.loads(path.read_text(encoding="utf-8"))
        except json.JSONDecodeError as e:
            sys.exit(f"Bad JSON in {path.name}: {e}")
        for r in rows:
            code = norm_code(r.get("courseCode"))
            if not code:
                continue
            docs.append({
                "_id": f"{slug}:{code.replace(' ', '_')}",
                "college": college,
                "course_code": code,
                "course_name": r.get("courseName"),
                "units": r.get("units"),
                "prerequisites": [norm_code(c) for c in (r.get("prerequisites") or [])],
                "source": f"transfer-agreements-analysis/prerequisites/{path.name}",
                "updated_at": now,
            })
    return docs, [p.name for p in files]


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--src-dir", default=str(DEFAULT_DIR), help="prerequisites/ directory")
    ap.add_argument("--dry-run", action="store_true", help="parse and report without writing")
    args = ap.parse_args()

    src_dir = Path(args.src_dir)
    if not src_dir.exists():
        sys.exit(f"prerequisites dir not found: {src_dir}")

    docs, files = build_docs(src_dir)
    colleges = sorted({d["college"] for d in docs})
    print(f"Parsed {len(docs)} course prerequisites across {len(colleges)} colleges from {len(files)} files.")
    if docs:
        print("Sample:", json.dumps({k: v for k, v in docs[0].items() if k != "updated_at"}, ensure_ascii=False))

    if args.dry_run:
        print("Dry run only; no DB writes.")
        return

    from pymongo import MongoClient, UpdateOne
    uri = _env("TARGET_MONGO_URI", required=True)
    db = MongoClient(uri)[_env("TARGET_DB_NAME", "pmt_research")]
    ops = [UpdateOne({"_id": d["_id"]}, {"$set": d}, upsert=True) for d in docs]
    if ops:
        db["ref_prerequisites"].bulk_write(ops, ordered=False)
        db["ref_prerequisites"].create_index("college")
        db["ref_prerequisites"].create_index("course_code")
    print(f"ref_prerequisites updated ({len(ops)} rows).")


if __name__ == "__main__":
    main()
