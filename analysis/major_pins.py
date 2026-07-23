"""Exact program pins used by the CS paper analyses.

Paper figures are major-specific.  They must never discover their corpus with
a title substring or an admin/settings selection: either can silently add a
sibling degree when the research database grows.  This module is the Python
side's explicit, one-program-per-campus contract.  Keep it aligned with the
``cs.programs`` entry in ``server/config/majors.js``.
"""

import hashlib
import json

CS_MAJOR_SLUG = "cs"
CS_MAJOR_LABEL = "Computer Science"

# Verbatim ASSIST names.  The trailing space in Merced's stored program name
# is intentional and therefore part of the exact pin.
CANONICAL_CS_PROGRAMS = {
    7: "CSE: Computer Science B.S.",
    46: "Computer Science, B.S.",
    79: "Electrical Engineering & Computer Sciences, B.S.",
    89: "Computer Science B.S.",
    117: "Computer Science/B.S.",
    120: "Computer Science, B.S.",
    128: "Computer Science, B.S.",
    132: "Computer Science B.S.",
    144: "COMPUTER SCIENCE AND ENGINEERING, B.S. ",
}


def canonical_cs_query():
    """Mongo filter for exactly the nine canonical campus/program pairs."""
    return {
        "$or": [
            {"uc_school_id": school_id, "major": program}
            for school_id, program in sorted(CANONICAL_CS_PROGRAMS.items())
        ]
    }


def canonical_cs_scope_metadata():
    """Serializable provenance written into regenerated result artifacts."""
    return {
        "slug": CS_MAJOR_SLUG,
        "label": CS_MAJOR_LABEL,
        "program_pins": [
            {"school_id": school_id, "program": program}
            for school_id, program in sorted(CANONICAL_CS_PROGRAMS.items())
        ],
    }


def canonical_json_fingerprint(value):
    """Stable SHA-256 for provenance objects and generated artifacts."""
    payload = json.dumps(value, sort_keys=True, separators=(",", ":"), ensure_ascii=False)
    return hashlib.sha256(payload.encode("utf-8")).hexdigest()


def canonical_cs_scope_fingerprint():
    return canonical_json_fingerprint(canonical_cs_scope_metadata())


def major_document_filter(major_slug):
    """Mongo clause for major-stamped curation documents.

    CS curation predates ``major_slug``, so missing/null stamps belong to CS
    for backward compatibility. Every other major is opt-in and must carry its
    explicit stamp. This mirrors ``pathways.js::majorDocumentFilter``.
    """
    slug = str(major_slug or "").strip()
    if not slug:
        return {}
    if slug == CS_MAJOR_SLUG:
        return {
            "$or": [
                {"major_slug": slug},
                {"major_slug": {"$exists": False}},
                {"major_slug": None},
            ]
        }
    return {"major_slug": slug}
