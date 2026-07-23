"""Exact program pins used by major-scoped paper-method analyses.

Paper figures are major-specific.  They must never discover their corpus with
a title substring or an admin/settings selection: either can silently add a
sibling degree when the research database grows.  This module is the Python
side's explicit, one-program-per-campus contract. Keep these scopes aligned
with the corresponding ``programs`` entries in ``server/config/majors.js``.
"""

import hashlib
import json

CS_MAJOR_SLUG = "cs"
CS_MAJOR_LABEL = "Computer Science"

MAJOR_SCOPES = {
    "cs": {
        "label": CS_MAJOR_LABEL,
        # The trailing space in Merced's stored program name is intentional.
        "programs": {
            7: "CSE: Computer Science B.S.",
            46: "Computer Science, B.S.",
            79: "Electrical Engineering & Computer Sciences, B.S.",
            89: "Computer Science B.S.",
            117: "Computer Science/B.S.",
            120: "Computer Science, B.S.",
            128: "Computer Science, B.S.",
            132: "Computer Science B.S.",
            144: "COMPUTER SCIENCE AND ENGINEERING, B.S. ",
        },
    },
    "bio": {
        "label": "Biology",
        "programs": {
            7: "Biology: General Biology B.S.",
            46: "Biology, B.A. or B.S.",
            79: "Molecular and Cell Biology, B.A.",
            89: "Biological Sciences B.S.",
            117: "Biology/B.S.",
            120: "Biological Sciences, B.S.",
            128: "Biological Sciences, B.A. & B.S.",
            132: "Biology B.S.",
            144: "BIOLOGICAL SCIENCES, General Biology Emphasis, B.S.",
        },
    },
    "econ": {
        "label": "Economics",
        "programs": {
            7: "Economics B.A.",
            46: "Economics, B.A.",
            79: "Economics, B.A.",
            89: "Economics A.B.",
            117: "Economics/B.A.",
            120: "Economics, B.A.",
            128: "Economics, B.A.",
            132: "Economics B.A.",
            144: "ECONOMICS, B.A.",
        },
    },
}


def canonical_major_scope(major_slug):
    """Return one configured analysis scope or reject an unknown slug."""
    slug = str(major_slug or "").strip()
    try:
        return MAJOR_SCOPES[slug]
    except KeyError as exc:
        raise ValueError(
            f"unknown major slug {slug!r}; expected one of {', '.join(sorted(MAJOR_SCOPES))}"
        ) from exc


def canonical_major_query(major_slug):
    """Mongo filter for exactly one configured program per UC campus."""
    programs = canonical_major_scope(major_slug)["programs"]
    return {
        "$or": [
            {"uc_school_id": school_id, "major": program}
            for school_id, program in sorted(programs.items())
        ]
    }


def canonical_major_scope_metadata(major_slug):
    """Serializable provenance written into regenerated result artifacts."""
    slug = str(major_slug).strip()
    scope = canonical_major_scope(slug)
    return {
        "slug": slug,
        "label": scope["label"],
        "program_pins": [
            {"school_id": school_id, "program": program}
            for school_id, program in sorted(scope["programs"].items())
        ],
    }


def canonical_json_fingerprint(value):
    """Stable SHA-256 for provenance objects and generated artifacts."""
    payload = json.dumps(value, sort_keys=True, separators=(",", ":"), ensure_ascii=False)
    return hashlib.sha256(payload.encode("utf-8")).hexdigest()


def canonical_major_scope_fingerprint(major_slug):
    return canonical_json_fingerprint(canonical_major_scope_metadata(major_slug))


# Backward-compatible CS names used by the frozen paper ports and their tests.
CANONICAL_CS_PROGRAMS = MAJOR_SCOPES[CS_MAJOR_SLUG]["programs"]


def canonical_cs_query():
    return canonical_major_query(CS_MAJOR_SLUG)


def canonical_cs_scope_metadata():
    return canonical_major_scope_metadata(CS_MAJOR_SLUG)


def canonical_cs_scope_fingerprint():
    return canonical_major_scope_fingerprint(CS_MAJOR_SLUG)


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
