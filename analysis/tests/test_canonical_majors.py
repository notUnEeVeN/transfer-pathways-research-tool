"""Paper analyses are permanently isolated to nine exact CS program pins."""

import json
import subprocess
from pathlib import Path

from major_pins import (
    CANONICAL_CS_PROGRAMS,
    canonical_cs_scope_fingerprint,
    canonical_cs_query,
    canonical_cs_scope_metadata,
    canonical_json_fingerprint,
)


def test_has_exactly_one_canonical_cs_program_per_figure_campus():
    assert set(CANONICAL_CS_PROGRAMS) == {7, 46, 79, 89, 117, 120, 128, 132, 144}
    assert len(CANONICAL_CS_PROGRAMS) == 9
    assert CANONICAL_CS_PROGRAMS[7] == "CSE: Computer Science B.S."
    assert CANONICAL_CS_PROGRAMS[79] == "Electrical Engineering & Computer Sciences, B.S."
    assert CANONICAL_CS_PROGRAMS[144] == "COMPUTER SCIENCE AND ENGINEERING, B.S. "


def test_query_exact_matches_each_campus_program_pair():
    clauses = canonical_cs_query()["$or"]
    assert len(clauses) == 9
    assert {clause["uc_school_id"] for clause in clauses} == set(CANONICAL_CS_PROGRAMS)
    assert all(clause["major"] == CANONICAL_CS_PROGRAMS[clause["uc_school_id"]]
               for clause in clauses)
    assert all(not isinstance(clause["major"], dict) for clause in clauses)


def test_scope_metadata_records_every_exact_pin():
    scope = canonical_cs_scope_metadata()
    assert scope["slug"] == "cs"
    assert scope["label"] == "Computer Science"
    assert scope["program_pins"] == [
        {"school_id": school_id, "program": CANONICAL_CS_PROGRAMS[school_id]}
        for school_id in sorted(CANONICAL_CS_PROGRAMS)
    ]
    assert canonical_cs_scope_fingerprint() == canonical_json_fingerprint(scope)
    assert len(canonical_cs_scope_fingerprint()) == 64


def test_python_paper_pins_match_the_website_major_config():
    root = Path(__file__).resolve().parents[2]
    script = (
        "const {getMajor}=require('./server/config/majors');"
        "process.stdout.write(JSON.stringify(getMajor('cs').programs));"
    )
    result = subprocess.run(
        ["node", "-e", script], cwd=root, text=True, capture_output=True, check=True,
    )
    assert json.loads(result.stdout) == {
        str(school_id): [program]
        for school_id, program in CANONICAL_CS_PROGRAMS.items()
    }
