"""
Import the statewide CS AS-degree templates and transform the raw CS-degree
extraction artifact into per-college `as_degree` documents.

Two inputs:

  scripts/data/as_degree_template.json      -> curated_requirements (kind as_degree_template)
  scripts/data/as_degrees_cs_extraction.json -> curated_requirements (kind as_degree)

Shapes (spec docs/superpowers/specs/2026-07-17-as-degree-data-design.md §1A/§1B;
contract enforced server-side by validateAsDegreeTemplate/validateAsDegree in
server/controllers/CanonicalData.js, mirrored here so a transformed doc never
fails that validator):

  as_degree_template: {_id, legacy_id, kind, slug, name, total_units_min, groups, ...}
  as_degree:          {_id, legacy_id, kind, community_college_id, college_id,
                        major_slug, degree_type, template_ref, status,
                        degree_title_seen, catalog_url, catalog_year,
                        unit_system, total_units, requirement_groups,
                        verification, extraction, source, updated_at}

Transformation (extraction major_group -> as_degree requirement_group):
  rule "ge_area"        -> ge_area set (normalized to GE_AREAS), one section
                           with unit_advisement=units_min, receivers: [].
  rule "electives"      -> units_fill: true group, no sections.
  rule "all"             -> one section, all courses become receivers.
  rule "choose_courses"  -> one section, section_advisement=choose_n (or 1).
  rule "choose_units"    -> one section, unit_advisement=units_min.
  A course that fails resolution against assist_courses (sending side) is
  never a receiver; it lands in the group's unresolved_courses_seen. A
  non-ge_area/electives group that ends with zero receivers is dropped
  (never emitted with an empty sections/receivers array, which would fail
  validateAsDegree) — its unresolved entries are still counted/reported.

Course resolution: an index built once from assist_courses (side='sending')
keyed by (community_college_id, prefix.upper().strip(), norm_number(number)),
with a prefix-internal-spaces-removed fallback (e.g. "C S" -> "CS").
norm_number strips leading/trailing non-alphanumeric artifacts (dashes,
dots, stray spaces — e.g. Merced's "MATH -06") before the zero-stripping
regex, applied identically on both sides of the index. A course that still
fails number resolution (typically a catalog renumbered under California
Common Course Numbering, e.g. "MATH C2210" vs assist_courses' old "MATH
30") gets one conservative title-based fallback attempt within the same
college (see resolve_by_title) before being marked unresolved.

Merge semantics on re-import (spec §3.2): a doc whose verification.verified
is true is skipped entirely; otherwise any existing group with
source=='curated' is preserved (matched by group_id) over the artifact's
same-id group, and the existing verification object is kept. The importer
never writes verification.notes (strictly user-authored).

Template import refuses to run unless the template file's _meta.status is
'locked', unless --allow-draft-template is passed.

Woodland Community College (community_college_id 147) is a verified
none_found and is intentionally absent from the extraction array; v1 emits
no doc for it (a none_found as_degree row has no enum-valid degree_type to
put in its id slug) — just a console note.

Env (scripts/.env or shell):
  TARGET_MONGO_URI (required for a live import; optional for --dry-run —
                     if set, still used read-only to build the course index
                     and check merge state against existing docs)
  TARGET_DB_NAME   (default pmt_research)
"""
import argparse
import datetime as dt
import json
import os
import re
import sys
from collections import Counter
from pathlib import Path

from dotenv import load_dotenv

HERE = Path(__file__).resolve().parent
load_dotenv(HERE / ".env")

DEFAULT_TEMPLATE_JSON = HERE / "data" / "as_degree_template.json"
DEFAULT_EXTRACTION_JSON = HERE / "data" / "as_degrees_cs_extraction.json"

WOODLAND_CC_ID = 147

SLUG_RE = re.compile(r"^[a-z0-9_]+$")
NUMBER_RE = re.compile(r"^0*([0-9]+)([A-Z]*)$")
NUMBER_EDGE_RE = re.compile(r"^[^A-Za-z0-9]+|[^A-Za-z0-9]+$")

# Title-fallback normalization (see normalize_title_tokens / resolve_by_title).
TITLE_STOPWORDS = {"the", "a", "an", "of", "for", "and", "with", "to", "in"}
TITLE_QUALIFIER_PHRASES = [
    "early transcendentals",
    "with support",
    "honors",
    "lecture",
    "laboratory",
]
# The individual words making up TITLE_QUALIFIER_PHRASES (minus stopwords
# like "with"). Used to tell a genuine qualifier variant (same course, e.g.
# '... with Support') apart from a genuine subject/track difference (e.g.
# 'Business Calculus I' vs 'Analytic Geometry and Calculus I') when breaking
# ties in resolve_by_title.
TITLE_QUALIFIER_WORDS = {"early", "transcendentals", "support", "honors", "lecture", "laboratory"}
TITLE_PAREN_RE = re.compile(r"\([^)]*\)")
TITLE_NONWORD_RE = re.compile(r"[^a-z0-9\s]")
TITLE_WS_RE = re.compile(r"\s+")

# Mirrors server/controllers/CanonicalData.js exactly — keep in sync.
GE_AREAS = [
    "natural_sciences", "social_behavioral", "humanities", "language_rationality", "math_competency",
    "local_pattern", "calgetc", "igetc", "csu_ge",
]
AS_DEGREE_STATUSES = ["found", "none_found", "ambiguous"]
AS_DEGREE_SOURCES = ["extracted", "template_default", "curated"]
AS_DEGREE_TYPES = ["local_cs_as", "local_computing", "ast"]
UNIT_SYSTEMS = ["semester", "quarter"]
MAJOR_GROUP_RULES = {"ge_area", "electives", "all", "choose_courses", "choose_units"}


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


# ── small text/number helpers ──────────────────────────────────────────────

def slugify(text, fallback):
    s = re.sub(r"[^a-z0-9]+", "_", (text or "").strip().lower()).strip("_")
    return s or fallback


def make_group_id(label_seen, idx, used):
    base = slugify(label_seen, f"g{idx}")
    gid, n = base, 2
    while gid in used:
        gid = f"{base}_{n}"
        n += 1
    used.add(gid)
    return gid


def norm_number(raw):
    """Uppercase, strip spaces, strip leading zeros, keep any letter suffix.
    '007A'->'7A', '044'->'44', '1A'->'1A'. Also strips leading/trailing
    non-alphanumeric artifacts (dashes, dots, stray spaces) BEFORE the
    zero-stripping regex runs, so malformed assist_courses numbers like
    '-06' or ' 007A ' normalize the same as clean extracted numbers ('6',
    '7A'). Applied identically to both the assist_courses index keys and
    the extracted course numbers so they meet in the middle."""
    s = str(raw or "").strip().upper().replace(" ", "")
    s = NUMBER_EDGE_RE.sub("", s)
    m = NUMBER_RE.match(s)
    if not m:
        return s
    digits, suffix = m.groups()
    return f"{digits}{suffix}"


def normalize_ge_area(raw):
    s = (raw or "").lower()
    if "cal-getc" in s or "calgetc" in s:
        return "calgetc"
    if "igetc" in s:
        return "igetc"
    if "csu" in s:
        return "csu_ge"
    if "local" in s:
        return "local_pattern"
    return "local_pattern"


def _title_tokens(raw, strip_qualifiers):
    """Lowercase, drop parentheticals (e.g. '(formerly MATH-04A)'), strip
    punctuation, collapse whitespace, drop stopwords. When strip_qualifiers
    is True, also drop trailing-qualifier phrases (early transcendentals,
    with support, honors, lecture, laboratory) so e.g. 'Calculus I: Early
    Transcendentals' compares equal to 'Calculus I'."""
    s = (raw or "").lower()
    s = TITLE_PAREN_RE.sub(" ", s)
    s = TITLE_NONWORD_RE.sub(" ", s)
    s = TITLE_WS_RE.sub(" ", s).strip()
    if strip_qualifiers:
        for phrase in TITLE_QUALIFIER_PHRASES:
            s = re.sub(r"\b" + re.escape(phrase) + r"\b", " ", s)
        s = TITLE_WS_RE.sub(" ", s).strip()
    return [t for t in s.split() if t and t not in TITLE_STOPWORDS]


def normalize_title_tokens(raw):
    """Tokens used for the primary strong-match test (qualifiers dropped)."""
    return _title_tokens(raw, strip_qualifiers=True)


def normalize_title_tokens_raw(raw):
    """Tokens with qualifier phrases (support/honors/etc) kept — used only to
    break ties between candidates that collapse to the same qualifier-
    stripped tokens (e.g. a course and its 'with Support' co-requisite
    variant), by preferring whichever candidate is literally closer to the
    extracted title."""
    return _title_tokens(raw, strip_qualifiers=False)


def is_strong_title_match(extracted_tokens, candidate_tokens):
    """Conservative strong-match test: token-set Jaccard >= 0.6, OR one
    token set is a superset of the other (e.g. extracted 'Calculus I' ⊆
    assist 'Analytic Geometry and Calculus I'). A single shared token is
    never enough UNLESS the two titles are otherwise identical — this is
    what keeps a lone generic word like 'programming' from linking two
    unrelated courses."""
    e, c = set(extracted_tokens), set(candidate_tokens)
    if not e or not c:
        return False
    inter = e & c
    if not inter:
        return False
    if len(inter) == 1 and e != c:
        return False
    union = e | c
    jaccard = len(inter) / len(union)
    superset = e.issubset(c) or c.issubset(e)
    return jaccard >= 0.6 or superset


# ── course resolution ───────────────────────────────────────────────────────

def build_course_index(db, cc_ids):
    """Builds the (cc_id, prefix, norm_number) -> course_id index (sending
    side) plus a per-college title index used by the title fallback:
    {cc_id: [{course_id, prefix, number, title, tokens}]}."""
    cursor = db["assist_courses"].find(
        {"side": "sending", "community_college_id": {"$in": list(cc_ids)}},
        {"community_college_id": 1, "course_id": 1, "prefix": 1, "number": 1, "title": 1},
    )
    index, title_index, collisions = {}, {}, 0
    for row in cursor:
        cc_id = row.get("community_college_id")
        prefix = str(row.get("prefix") or "").strip().upper()
        course_id = row.get("course_id")
        key = (cc_id, prefix, norm_number(row.get("number")))
        if key in index and index[key] != course_id:
            collisions += 1
        else:
            index.setdefault(key, course_id)
        title = row.get("title")
        if title:
            title_index.setdefault(cc_id, []).append({
                "course_id": course_id,
                "prefix": prefix,
                "title": title,
                "tokens": normalize_title_tokens(title),
            })
    return index, title_index, collisions


def resolve_course(index, cc_id, prefix, number):
    prefix = str(prefix or "").strip().upper()
    num = norm_number(number)
    key = (cc_id, prefix, num)
    if key in index:
        return index[key]
    prefix2 = prefix.replace(" ", "")
    if prefix2 != prefix:
        key2 = (cc_id, prefix2, num)
        if key2 in index:
            return index[key2]
    return None


def _strong_title_candidates(pool, e_tokens):
    return [entry for entry in pool if is_strong_title_match(e_tokens, entry["tokens"])]


def resolve_by_title(title_index, cc_id, prefix, title):
    """Conservative title-based fallback for a course whose number didn't
    resolve (e.g. catalog uses California Common Course Numbering — 'MATH
    C2210' — while assist_courses still has the old number 'MATH 30').
    Prefers same-prefix candidates, falling back to any prefix in the
    college (calculus is often cross-listed). Returns
    (course_id_or_None, matched_title_or_None); None means either no strong
    match or a genuine, unresolved ambiguity between >=2 distinct courses —
    both are intentionally left UNRESOLVED rather than guessed."""
    entries = title_index.get(cc_id) or []
    if not entries:
        return None, None
    e_tokens = normalize_title_tokens(title)
    if not e_tokens:
        return None, None
    prefix = str(prefix or "").strip().upper()

    same_prefix_pool = [entry for entry in entries if entry["prefix"] == prefix]
    candidates = _strong_title_candidates(same_prefix_pool, e_tokens) if same_prefix_pool else []
    if not candidates:
        candidates = _strong_title_candidates(entries, e_tokens)
    if not candidates:
        return None, None

    by_course_id = {}
    for entry in candidates:
        by_course_id.setdefault(entry["course_id"], entry)
    if len(by_course_id) == 1:
        (entry,) = by_course_id.values()
        return entry["course_id"], entry["title"]

    # Multiple distinct courses matched strongly. This happens two ways:
    #  (a) a coarse (jaccard>=0.6) tie between adjacent sequence courses
    #      whose only difference is a level/roman-numeral — e.g. extracted
    #      'Java Programming - Level 1' also weakly overlaps '... Level 2'
    #      (jaccard exactly 0.6). If exactly one tied candidate is a literal
    #      EXACT match (identical qualifier-preserving raw tokens), that one
    #      is unambiguously right regardless of what else weakly matched —
    #      resolve to it immediately.
    e_raw = set(normalize_title_tokens_raw(title))
    exact = [entry for entry in by_course_id.values() if set(normalize_title_tokens_raw(entry["title"])) == e_raw]
    if len(exact) == 1:
        return exact[0]["course_id"], exact[0]["title"]
    if len(exact) > 1:
        return None, None  # duplicate identical titles under different course_ids — genuinely ambiguous

    #  (b) a college has both a base course and a qualifier variant (e.g.
    #      'Analytic Geometry and Calculus I' and '... with Support') that
    #      collapse to the same qualifier-stripped tokens. This is safe to
    #      break a tie on ONLY when every tied candidate is the same
    #      underlying course modulo a recognized qualifier — same CORE
    #      (qualifier words removed) tokens. If the tied candidates' cores
    #      differ at all — e.g. 'Business Calculus I' vs 'Analytic Geometry
    #      and Calculus I', both of which are (wrongly) a superset of bare
    #      extracted tokens {calculus, i} — that's a genuine subject/track
    #      difference, not a qualifier variant, and guessing between them
    #      risks linking the wrong course. Stay unresolved in that case.
    cores = {}
    for entry in by_course_id.values():
        c_raw = set(normalize_title_tokens_raw(entry["title"]))
        core = frozenset(c_raw - TITLE_QUALIFIER_WORDS)
        cores.setdefault(core, []).append(entry)
    if len(cores) != 1:
        return None, None

    # All tied candidates share one core — the only disagreement is which
    # qualifier words (support/honors/lecture/laboratory/early
    # transcendentals) they carry. Pick whichever is literally closest to
    # the extracted title's own qualifier signal (smallest symmetric token
    # difference against qualifier-preserving tokens on both sides).
    # Resolve only if exactly one candidate is a strict closest match; a
    # real tie stays unresolved.
    scored = []
    for entry in by_course_id.values():
        c_raw = set(normalize_title_tokens_raw(entry["title"]))
        distance = len(c_raw - e_raw) + len(e_raw - c_raw)
        scored.append((distance, entry))
    scored.sort(key=lambda pair: pair[0])
    if len(scored) >= 2 and scored[0][0] == scored[1][0]:
        return None, None
    best = scored[0][1]
    return best["course_id"], best["title"]


# ── group transform ─────────────────────────────────────────────────────────

def transform_group(mg, cc_id, index, title_index, confidence, used_gids, idx):
    """Returns (group_doc_or_None, considered, resolved_by_number,
    resolved_by_title, unresolved_entries, title_match_samples).
    considered/resolved counts are 0 for ge_area/electives, which never
    attempt resolution. group_doc is None when a non-ge_area, non-electives
    group ends with zero receivers (dropped rather than emitted invalid);
    unresolved_entries is still returned so the caller can report it even
    though it isn't embedded in any emitted group."""
    label_seen = mg.get("label_seen") or ""
    rule = mg.get("rule")
    if rule not in MAJOR_GROUP_RULES:
        sys.exit(f"unknown major_group rule: {rule!r} (label {label_seen!r})")
    gid = make_group_id(label_seen, idx, used_gids)
    common = {
        "group_id": gid,
        "template_group": None,
        "source": "extracted",
        "confidence": confidence,
        "curated_by": None,
        "label_seen": label_seen,
        "unresolved_courses_seen": [],
    }

    if rule == "ge_area":
        group = dict(common)
        group["ge_area"] = normalize_ge_area(mg.get("ge_area"))
        group["sections"] = [{
            "section_advisement": None,
            "unit_advisement": mg.get("units_min"),
            "receivers": [],
        }]
        return group, 0, 0, 0, [], []

    if rule == "electives":
        group = dict(common)
        group["units_fill"] = True
        return group, 0, 0, 0, [], []

    courses = mg.get("courses") or []
    receivers, unresolved_entries, title_match_samples = [], [], []
    resolved_by_number = resolved_by_title = 0
    for c in courses:
        prefix, number, title_seen = c.get("prefix"), c.get("number"), c.get("title_seen")
        cid = resolve_course(index, cc_id, prefix, number)
        matched_by_title = False
        if cid is None:
            cid, matched_title = resolve_by_title(title_index, cc_id, prefix, title_seen)
            if cid is not None:
                matched_by_title = True
                title_match_samples.append({
                    "extracted": title_seen,
                    "matched": matched_title,
                    "course_id": cid,
                })
        if cid is None:
            entry = {
                "course_code_seen": f"{(prefix or '').strip()} {(number or '').strip()}".strip(),
                "title_seen": title_seen,
                "units_seen": c.get("units_seen"),
            }
            common["unresolved_courses_seen"].append(entry)
            unresolved_entries.append(entry)
            continue
        receivers.append({
            "receiving": None,
            "articulation_status": "articulated",
            "not_articulated_reason": None,
            "options": [{
                "course_ids": [int(cid)],
                "course_conjunction": "and",
                "course_keys": [f"cc:{int(cid)}"],
            }],
            "options_conjunction": "and",
            "hash_id": None,
        })
        if matched_by_title:
            resolved_by_title += 1
        else:
            resolved_by_number += 1

    considered = len(courses)
    if not receivers:
        return None, considered, resolved_by_number, resolved_by_title, unresolved_entries, title_match_samples

    if rule == "all":
        section = {"section_advisement": None, "unit_advisement": None, "receivers": receivers}
    elif rule == "choose_courses":
        section = {"section_advisement": mg.get("choose_n") or 1, "unit_advisement": None, "receivers": receivers}
    else:  # choose_units
        section = {"section_advisement": None, "unit_advisement": mg.get("units_min"), "receivers": receivers}

    group = dict(common)
    group["sections"] = [section]
    return group, considered, resolved_by_number, resolved_by_title, unresolved_entries, title_match_samples


# ── internal shape assertions (mirror validateAsDegree/validateAsDegreeTemplate) ──
# Defense in depth: never emit a doc our own transform got wrong. These
# duplicate the server-side JS validators in server/controllers/CanonicalData.js
# so a bug here is caught at import time, not at PUT time.

def assert_as_degree_shape(doc, known_college_ids, known_template_ids):
    err = _check_as_degree(doc, known_college_ids, known_template_ids)
    if err:
        sys.exit(f"internal error building {doc.get('_id')}: {err}")


def _check_as_degree(doc, known_college_ids, known_template_ids):
    m = re.match(r"^(\d+):([a-z0-9_]+)$", str(doc.get("legacy_id") or ""))
    if not m:
        return "row id must look like <community_college_id>:<degree_type>"
    cc_id = int(m.group(1))
    if doc.get("community_college_id") != cc_id:
        return "community_college_id must match the numeric part of the row id"
    if doc.get("college_id") != f"cc:{cc_id}":
        return f"college_id must be 'cc:{cc_id}'"
    if doc.get("degree_type") not in AS_DEGREE_TYPES:
        return f"degree_type must be one of {AS_DEGREE_TYPES}"
    if doc["degree_type"] != m.group(2):
        return "degree_type must match the slug part of the row id"
    if not isinstance(doc.get("major_slug"), str) or not SLUG_RE.match(doc["major_slug"]):
        return "major_slug must be a non-empty slug"
    if known_college_ids is not None and cc_id not in known_college_ids:
        return f"no community college with id cc:{cc_id}"
    if doc.get("template_ref") is not None and known_template_ids is not None:
        if doc["template_ref"] not in known_template_ids:
            return f"template_ref not found: {doc['template_ref']}"
    if doc.get("status") not in AS_DEGREE_STATUSES:
        return f"status must be one of {AS_DEGREE_STATUSES}"
    if doc.get("status") != "found":
        rg = doc.get("requirement_groups")
        if rg is not None and (not isinstance(rg, list) or len(rg)):
            return f"a {doc['status']} row must not carry requirement_groups"
        return None
    if not isinstance(doc.get("degree_title_seen"), str) or not doc["degree_title_seen"].strip():
        return "degree_title_seen is required on a found row"
    if not isinstance(doc.get("catalog_url"), str) or not re.match(r"^https?://", doc["catalog_url"]):
        return "catalog_url must be an http(s) URL"
    if not isinstance(doc.get("catalog_year"), str) or not doc["catalog_year"].strip():
        return "catalog_year is required on a found row"
    if doc.get("unit_system") not in UNIT_SYSTEMS:
        return f"unit_system must be one of {UNIT_SYSTEMS}"
    tu = doc.get("total_units")
    if not isinstance(tu, (int, float)) or isinstance(tu, bool) or tu <= 0:
        return "total_units must be a positive number"
    groups = doc.get("requirement_groups")
    if not isinstance(groups, list) or not groups:
        return "requirement_groups must be a non-empty array on a found row"
    seen_ids = set()
    for g in groups:
        err = _check_as_degree_group(g, seen_ids)
        if err:
            return err
    return None


def _check_as_degree_group(g, seen_ids):
    if not isinstance(g, dict):
        return "each group must be an object"
    gid = str(g.get("group_id") or "")
    if not SLUG_RE.match(gid):
        return "each group needs a group_id matching ^[a-z0-9_]+$"
    if gid in seen_ids:
        return f"duplicate group_id: {gid}"
    seen_ids.add(gid)
    tg = g.get("template_group")
    if tg is not None and tg != gid:
        return f"group {gid}: template_group must equal group_id or be null"
    if g.get("source") not in AS_DEGREE_SOURCES:
        return f"group {gid}: source must be one of {AS_DEGREE_SOURCES}"
    if g.get("source") == "extracted":
        c = g.get("confidence")
        if not isinstance(c, (int, float)) or isinstance(c, bool) or c < 0 or c > 1:
            return f"group {gid}: an extracted group needs confidence in [0,1]"
    elif g.get("confidence") is not None:
        return f"group {gid}: confidence must be null unless source is extracted"
    ge_area = g.get("ge_area")
    if ge_area is not None and ge_area not in GE_AREAS:
        return f"group {gid}: ge_area must be one of {GE_AREAS}"
    if g.get("source") == "template_default":
        if g.get("template_group") is None:
            return f"group {gid}: a template_default group needs template_group"
        if isinstance(g.get("sections"), list) and len(g["sections"]):
            return f"group {gid}: a template_default stub must not carry sections"
        return None
    if g.get("units_fill") is True:
        if isinstance(g.get("sections"), list) and len(g["sections"]):
            return f"group {gid}: a units_fill group must not have sections"
        return None
    sections = g.get("sections")
    if not isinstance(sections, list) or not sections:
        return f"group {gid}: sections must be a non-empty array"
    for s in sections:
        err = _check_as_degree_section(s, gid, ge_area)
        if err:
            return err
    unresolved = g.get("unresolved_courses_seen")
    if unresolved is not None:
        if not isinstance(unresolved, list) or any(
            not isinstance(u, dict) or not isinstance(u.get("course_code_seen"), str) for u in unresolved
        ):
            return f"group {gid}: unresolved_courses_seen must be an array of {{course_code_seen, ...}}"
    return None


def _check_as_degree_section(s, gid, ge_area):
    if not isinstance(s, dict):
        return f"group {gid}: each section must be an object"
    for key in ("section_advisement", "unit_advisement"):
        v = s.get(key)
        if v is not None and (not isinstance(v, (int, float)) or isinstance(v, bool) or v <= 0):
            return f"group {gid}: {key} must be null or a positive number"
    receivers = s.get("receivers")
    if not isinstance(receivers, list):
        return f"group {gid}: each section needs a receivers array"
    if ge_area is None and not receivers:
        return f"group {gid}: a non-ge_area section must list at least one receiver"
    for r in receivers:
        if not isinstance(r, dict):
            return f"group {gid}: each receiver must be an object"
        if r.get("receiving") is not None:
            return f"group {gid}: receiving must be null on as_degree receivers"
        if r.get("articulation_status") != "articulated":
            return f"group {gid}: articulation_status must be 'articulated'"
        options = r.get("options")
        if not isinstance(options, list) or not options:
            return f"group {gid}: each receiver needs at least one option"
        for o in options:
            err = _check_as_degree_option(o, gid)
            if err:
                return err
    return None


def _check_as_degree_option(o, gid):
    if not isinstance(o, dict):
        return f"group {gid}: each option must be an object"
    cids = o.get("course_ids")
    if not isinstance(cids, list) or not cids or any(not isinstance(x, int) or isinstance(x, bool) for x in cids):
        return f"group {gid}: option course_ids must be a non-empty array of Numbers"
    keys = o.get("course_keys")
    if not isinstance(keys, list) or len(keys) != len(cids) or any(k != f"cc:{cids[i]}" for i, k in enumerate(keys)):
        return f"group {gid}: course_keys must mirror course_ids as 'cc:<n>'"
    return None


def assert_as_degree_template_shape(doc, known_concepts):
    err = _check_as_degree_template(doc, known_concepts)
    if err:
        sys.exit(f"internal error building {doc.get('_id')}: {err}")


def _check_as_degree_template(doc, known_concepts):
    slug = str(doc.get("slug") or "")
    if not SLUG_RE.match(slug):
        return "slug must match ^[a-z0-9_]+$"
    if slug != str(doc.get("legacy_id")):
        return "slug must equal the row id"
    if not isinstance(doc.get("name"), str) or not doc["name"].strip():
        return "name is required"
    tum = doc.get("total_units_min")
    if not isinstance(tum, (int, float)) or isinstance(tum, bool) or tum <= 0:
        return "total_units_min must be a positive number"
    groups = doc.get("groups")
    if not isinstance(groups, list) or not groups:
        return "groups must be a non-empty array"
    seen_ids = set()
    for g in groups:
        err = _check_template_group(g, seen_ids, known_concepts)
        if err:
            return err
    return None


def _check_template_group(g, seen_ids, known_concepts):
    if not isinstance(g, dict):
        return "each group must be an object"
    gid = str(g.get("group_id") or "")
    if not SLUG_RE.match(gid):
        return "each group needs a group_id matching ^[a-z0-9_]+$"
    if gid in seen_ids:
        return f"duplicate group_id: {gid}"
    seen_ids.add(gid)
    if not isinstance(g.get("label"), str) or not g["label"].strip():
        return f"group {gid}: label is required"
    ge_area = g.get("ge_area")
    if ge_area is not None and ge_area not in GE_AREAS:
        return f"group {gid}: ge_area must be one of {GE_AREAS}"
    if g.get("units_fill") is True:
        if g.get("sections") is not None:
            return f"group {gid}: a units_fill group must not have sections"
        return None
    sections = g.get("sections")
    if not isinstance(sections, list) or not sections:
        return f"group {gid}: sections must be a non-empty array"
    for s in sections:
        if not isinstance(s, dict):
            return f"group {gid}: each section must be an object"
        for key in ("section_advisement", "unit_advisement"):
            v = s.get(key)
            if v is not None and (not isinstance(v, (int, float)) or isinstance(v, bool) or v <= 0):
                return f"group {gid}: {key} must be null or a positive number"
        slots = s.get("slots")
        if not isinstance(slots, list):
            return f"group {gid}: each section needs a slots array"
        if ge_area is None and not slots:
            return f"group {gid}: a non-ge_area section must list at least one slot"
        for slot in slots:
            alts = slot.get("concepts") if isinstance(slot, dict) else None
            if not isinstance(alts, list) or not alts or any(not isinstance(c, str) for c in alts):
                return f"group {gid}: each slot needs a non-empty concepts array of slugs"
            if known_concepts is not None:
                for c in alts:
                    if c not in known_concepts:
                        return f"group {gid}: slot references unknown concept: {c}"
    return None


# ── template build ──────────────────────────────────────────────────────────

def build_template_rows(templates, source, now, known_concepts):
    rows, ref_by_degree_type, seen_slugs = [], {}, set()
    for t in templates:
        slug = t.get("slug")
        if not slug or not SLUG_RE.match(slug):
            sys.exit(f"template slug invalid: {slug!r}")
        if slug in seen_slugs:
            sys.exit(f"duplicate template slug: {slug}")
        seen_slugs.add(slug)
        degree_type = t.get("degree_type")
        if degree_type not in AS_DEGREE_TYPES:
            sys.exit(f"template {slug}: degree_type must be one of {AS_DEGREE_TYPES}")
        row = {
            "_id": f"as_degree_template:{slug}",
            "legacy_id": slug,
            "kind": "as_degree_template",
            "slug": slug,
            "name": t.get("name"),
            "total_units_min": t.get("total_units_min"),
            "groups": t.get("groups"),
            "source": source,
            "updated_at": now,
        }
        if t.get("note"):
            row["note"] = t["note"]
        assert_as_degree_template_shape(row, known_concepts)
        rows.append(row)
        ref_by_degree_type[degree_type] = row["_id"]
    return rows, ref_by_degree_type


# ── degree transform (whole extraction) ─────────────────────────────────────

def transform_all(extraction, course_index, title_index, source, now, ref_by_degree_type, known_college_ids, known_template_ids):
    docs = []
    stats = {
        "by_type": Counter(),
        "examined_by_type": Counter(),
        "resolved": 0,
        "resolved_by_number": 0,
        "resolved_by_title": 0,
        "considered": 0,
        "unresolved_samples": [],       # [(college_name, cc_id, degree_type, [entries])]
        "flagged_heavy": [],            # [{college_name, cc_id, degree_type, unresolved, considered}]
        "skipped_zero_groups": [],      # [(college_name, cc_id, degree_type)]
        "title_match_samples": [],      # [{college_name, cc_id, extracted, matched, course_id}]
    }
    for college in extraction:
        cc_id = college["community_college_id"]
        college_name = college.get("college_name")
        needs_browser = bool(college.get("needs_browser"))
        notes = college.get("notes") or ""

        for deg in college.get("degrees") or []:
            degree_type = deg.get("degree_type")
            if degree_type not in AS_DEGREE_TYPES:
                sys.exit(f"{college_name} ({cc_id}): unknown degree_type {degree_type!r}")
            confidence = deg.get("extraction_confidence")
            if not isinstance(confidence, (int, float)) or isinstance(confidence, bool) or not (0 <= confidence <= 1):
                sys.exit(f"{college_name} ({cc_id}) {degree_type}: extraction_confidence out of [0,1]")
            stats["examined_by_type"][degree_type] += 1

            used_gids = set()
            requirement_groups = []
            degree_considered = degree_resolved = 0
            degree_unresolved_samples = []

            for idx, mg in enumerate(deg.get("major_groups") or []):
                group_doc, considered, resolved_by_number, resolved_by_title, unresolved_entries, title_match_samples = transform_group(
                    mg, cc_id, course_index, title_index, confidence, used_gids, idx
                )
                degree_considered += considered
                degree_resolved += resolved_by_number + resolved_by_title
                stats["considered"] += considered
                stats["resolved"] += resolved_by_number + resolved_by_title
                stats["resolved_by_number"] += resolved_by_number
                stats["resolved_by_title"] += resolved_by_title
                if unresolved_entries:
                    degree_unresolved_samples.extend(unresolved_entries)
                for sample in title_match_samples:
                    stats["title_match_samples"].append({
                        "college_name": college_name, "cc_id": cc_id, "degree_type": degree_type,
                        "extracted": sample["extracted"], "matched": sample["matched"],
                        "course_id": sample["course_id"],
                    })
                if group_doc is not None:
                    requirement_groups.append(group_doc)

            if not requirement_groups:
                stats["skipped_zero_groups"].append((college_name, cc_id, degree_type))
                print(
                    f"WARNING: {college_name} ({cc_id}) {degree_type}: zero requirement_groups "
                    "survived transform; degree doc SKIPPED (would fail validateAsDegree)."
                )
                continue

            degree_unresolved = degree_considered - degree_resolved
            if degree_considered > 0 and degree_unresolved / degree_considered > 0.5:
                stats["flagged_heavy"].append({
                    "college_name": college_name, "cc_id": cc_id, "degree_type": degree_type,
                    "unresolved": degree_unresolved, "considered": degree_considered,
                })
            if degree_unresolved_samples:
                stats["unresolved_samples"].append((college_name, cc_id, degree_type, degree_unresolved_samples))

            stats["by_type"][degree_type] += 1
            doc = {
                "_id": f"as_degree:{cc_id}:{degree_type}",
                "legacy_id": f"{cc_id}:{degree_type}",
                "kind": "as_degree",
                "community_college_id": cc_id,
                "college_id": f"cc:{cc_id}",
                "major_slug": "cs",
                "degree_type": degree_type,
                "template_ref": ref_by_degree_type.get(degree_type),
                "status": "found",
                "degree_title_seen": deg.get("degree_title_seen"),
                "catalog_url": deg.get("catalog_url"),
                "catalog_year": deg.get("catalog_year"),
                "unit_system": deg.get("unit_system"),
                "total_units": deg.get("total_units"),
                "requirement_groups": requirement_groups,
                "verification": {"verified": False, "verified_by": None, "verified_at": None, "notes": None},
                "extraction": {
                    "artifact": source,
                    "confidence": confidence,
                    "needs_browser": needs_browser,
                    "notes": notes,
                },
                "source": source,
                "updated_at": now,
            }
            assert_as_degree_shape(doc, known_college_ids, known_template_ids)
            docs.append(doc)
    return docs, stats


# ── merge semantics (re-import) ─────────────────────────────────────────────

def merge_with_existing(doc, existing):
    """Returns (merged_doc_or_None, skipped_verified, had_curated_groups)."""
    if existing is None:
        return doc, False, False
    verification = existing.get("verification") or {}
    if verification.get("verified") is True:
        return None, True, False
    existing_curated = {
        g.get("group_id"): g
        for g in (existing.get("requirement_groups") or [])
        if g.get("source") == "curated"
    }
    had_curated = False
    if existing_curated:
        new_ids = {g.get("group_id") for g in doc["requirement_groups"]}
        merged = [existing_curated.get(g.get("group_id"), g) for g in doc["requirement_groups"]]
        for gid, g in existing_curated.items():
            if gid not in new_ids:
                merged.append(g)
        doc["requirement_groups"] = merged
        had_curated = True
    if "verification" in existing:
        doc["verification"] = existing["verification"]
    return doc, False, had_curated


# ── reporting ────────────────────────────────────────────────────────────────

def print_report(template_rows, docs, stats, dry_run):
    verb = "would import" if dry_run else "imported"
    print(f"Templates {verb}: {', '.join(r['slug'] for r in template_rows) or '(none)'}")

    print(f"Degrees transformed: {sum(stats['by_type'].values())} of {sum(stats['examined_by_type'].values())} examined")
    for t in AS_DEGREE_TYPES:
        print(f"  {t}: {stats['by_type'][t]} transformed / {stats['examined_by_type'][t]} examined")
    if stats["skipped_zero_groups"]:
        print(f"  skipped (zero requirement_groups after transform): {len(stats['skipped_zero_groups'])}")
        for name, cc_id, dtype in stats["skipped_zero_groups"]:
            print(f"    {name} ({cc_id}) {dtype}")

    considered, resolved = stats["considered"], stats["resolved"]
    resolved_by_number, resolved_by_title = stats["resolved_by_number"], stats["resolved_by_title"]
    unresolved = considered - resolved
    rate = (resolved / considered * 100) if considered else 100.0
    print(f"Courses: {resolved} resolved / {unresolved} unresolved of {considered} considered ({rate:.1f}% resolved)")
    print(f"  resolved by number: {resolved_by_number}")
    print(f"  resolved by title fallback: {resolved_by_title}")
    print(f"  still unresolved: {unresolved}")

    if stats["title_match_samples"]:
        samples = stats["title_match_samples"]
        cap = 20
        print(f"Title-match sample ({len(samples)} total title resolutions, showing up to {cap}):")
        for s in samples[:cap]:
            print(f"  {s['college_name']} ({s['cc_id']}) {s['degree_type']}: "
                  f"extracted \"{s['extracted']}\" -> assist \"{s['matched']}\" (course_id {s['course_id']})")
        if len(samples) > cap:
            print(f"  ... and {len(samples) - cap} more title matches")

    if stats["unresolved_samples"]:
        cap_colleges, cap_courses = 5, 5
        shown = stats["unresolved_samples"][:cap_colleges]
        for name, cc_id, dtype, entries in shown:
            print(f"  {name} ({cc_id}) {dtype}: {len(entries)} unresolved")
            for e in entries[:cap_courses]:
                print(f"    {e['course_code_seen']} — {e.get('title_seen') or '?'}")
            if len(entries) > cap_courses:
                print(f"    ... and {len(entries) - cap_courses} more")
        if len(stats["unresolved_samples"]) > cap_colleges:
            print(f"  ... and {len(stats['unresolved_samples']) - cap_colleges} more colleges with unresolved courses")

    if stats["flagged_heavy"]:
        print(f"Flagged (>50% of a degree's courses unresolved): {len(stats['flagged_heavy'])}")
        for f in stats["flagged_heavy"]:
            pct = f["unresolved"] / f["considered"] * 100
            print(f"  {f['college_name']} ({f['cc_id']}) {f['degree_type']}: {f['unresolved']}/{f['considered']} ({pct:.0f}%)")
    else:
        print("Flagged (>50% unresolved): none")

    if docs:
        sample = {k: v for k, v in docs[0].items() if k != "updated_at"}
        print("Doc sample:", json.dumps(sample, ensure_ascii=False)[:800], "...")


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--template-json", default=str(DEFAULT_TEMPLATE_JSON))
    ap.add_argument("--extraction-json", default=str(DEFAULT_EXTRACTION_JSON))
    ap.add_argument("--dry-run", action="store_true", help="validate + transform + report; write nothing")
    ap.add_argument("--allow-draft-template", action="store_true",
                     help="import templates even if _meta.status != 'locked'")
    args = ap.parse_args()

    for p in (args.template_json, args.extraction_json):
        if not Path(p).exists():
            sys.exit(f"source not found: {p}")

    template_doc = load_json(args.template_json)
    extraction_doc = load_json(args.extraction_json)

    templates = template_doc.get("templates") or []
    meta_status = (template_doc.get("_meta") or {}).get("status")
    if meta_status != "locked" and not args.allow_draft_template:
        sys.exit(
            f"Template file status is {meta_status!r}, not 'locked'. "
            "Pass --allow-draft-template to import draft templates anyway."
        )

    extraction = extraction_doc.get("extraction") or []
    if not isinstance(extraction, list):
        sys.exit("extraction.json: top-level 'extraction' must be an array")

    cc_ids_in_extraction = sorted({c["community_college_id"] for c in extraction})
    if WOODLAND_CC_ID not in cc_ids_in_extraction:
        print(f"Woodland CC ({WOODLAND_CC_ID}): verified none_found — no doc emitted.")

    # Read-only DB access: builds the course index (and, for a live run,
    # institution/existing-doc lookups). Validation of static shape happens
    # regardless of DB availability; only course resolution depends on it.
    uri = os.environ.get("TARGET_MONGO_URI")
    db = None
    if uri:
        from pymongo import MongoClient
        try:
            client = MongoClient(uri, serverSelectionTimeoutMS=8000)
            db = client[os.environ.get("TARGET_DB_NAME", "pmt_research")]
            db.command("ping")
        except Exception as e:  # pragma: no cover - network/env dependent
            print(f"Could not reach TARGET_MONGO_URI ({e}); proceeding without course resolution.")
            db = None
    elif not args.dry_run:
        _env("TARGET_MONGO_URI", required=True)  # exits with the standard message
    else:
        print("TARGET_MONGO_URI not set; skipping course index build (dry run, no resolution).")

    course_index, title_index, known_concepts, known_college_ids = {}, {}, None, None
    if db is not None:
        course_index, title_index, collisions = build_course_index(db, cc_ids_in_extraction)
        print(f"Course index: {len(course_index)} sending-side keys across {len(cc_ids_in_extraction)} colleges"
              f"{f' ({collisions} key collisions kept first-seen)' if collisions else ''}.")
        known_concepts = {
            r["slug"] for r in db["curated_requirements"].find({"kind": "prereq_concept"}, {"slug": 1})
        }
        known_college_ids = {
            int(r["_id"].split(":", 1)[1])
            for r in db["assist_institutions"].find({"kind": "community_college"}, {"_id": 1})
        }

    now = dt.datetime.now(dt.timezone.utc)
    template_source = f"scripts/data/{Path(args.template_json).name}"
    extraction_source = f"scripts/data/{Path(args.extraction_json).name}"

    template_rows, ref_by_degree_type = build_template_rows(templates, template_source, now, known_concepts)
    known_template_ids = {r["_id"] for r in template_rows}

    docs, stats = transform_all(
        extraction, course_index, title_index, extraction_source, now, ref_by_degree_type,
        known_college_ids, known_template_ids,
    )

    print_report(template_rows, docs, stats, args.dry_run)

    if args.dry_run:
        print("Dry run only; no DB writes.")
        return

    if db is None:
        sys.exit("TARGET_MONGO_URI is required for a live import.")

    from pymongo import ReplaceOne

    if template_rows:
        db["curated_requirements"].bulk_write(
            [ReplaceOne({"_id": r["_id"]}, r, upsert=True) for r in template_rows], ordered=False
        )

    existing_by_id = {
        d["_id"]: d
        for d in db["curated_requirements"].find({"_id": {"$in": [d["_id"] for d in docs]}})
    }
    ops, skipped_verified, curated_preserved_docs = [], 0, 0
    for doc in docs:
        merged, was_skipped, had_curated = merge_with_existing(doc, existing_by_id.get(doc["_id"]))
        if was_skipped:
            skipped_verified += 1
            print(f"  skipped (verified): {doc['_id']}")
            continue
        if had_curated:
            curated_preserved_docs += 1
        ops.append(ReplaceOne({"_id": merged["_id"]}, merged, upsert=True))
    if ops:
        db["curated_requirements"].bulk_write(ops, ordered=False)
    print(
        f"as_degree docs upserted: {len(ops)}; skipped (verified): {skipped_verified}; "
        f"curated groups preserved in {curated_preserved_docs} doc(s)."
    )


if __name__ == "__main__":
    main()
