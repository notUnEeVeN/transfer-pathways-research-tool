"""Major-stamped curation cannot leak into the canonical CS paper models."""

import paper_credit_loss as credit
import paper_district_heatmap as district
from major_pins import (
    canonical_major_query,
    canonical_major_scope_metadata,
    major_document_filter,
)


def _matches_major_clause(row, query):
    clauses = query.get("$or")
    if not clauses:
        return row.get("major_slug") == query.get("major_slug")
    return (
        row.get("major_slug") == "cs"
        or "major_slug" not in row
        or row.get("major_slug") is None
    )


class FakeCursor(list):
    def sort(self, _fields):
        return self


class FakeCollection:
    def __init__(self, rows):
        self.rows = rows
        self.queries = []

    def find(self, query, _fields=None):
        self.queries.append(query)
        rows = [row for row in self.rows
                if row.get("kind") == query.get("kind") and _matches_major_clause(row, query)]
        return FakeCursor(rows)


class FakeDB:
    def __init__(self, *, requirements=(), mappings=()):
        self.curated_requirements = FakeCollection(list(requirements))
        self.curated_mappings = FakeCollection(list(mappings))


def requirement(school_id, group_id, parent_id, **extra):
    return {
        "kind": "transfer_minimum",
        "school_id": school_id,
        "group_id": group_id,
        "set_id": "A",
        "source_order": 0,
        "receiving_code": f"COURSE {parent_id}",
        "parent_ids": [parent_id],
        **extra,
    }


def test_major_document_filter_matches_the_server_legacy_cs_rule():
    assert major_document_filter("cs") == {
        "$or": [
            {"major_slug": "cs"},
            {"major_slug": {"$exists": False}},
            {"major_slug": None},
        ]
    }
    assert major_document_filter("bio") == {"major_slug": "bio"}
    assert major_document_filter("") == {}


def test_biology_and_economics_use_exact_configured_program_pairs():
    bio = canonical_major_scope_metadata("bio")
    econ = canonical_major_scope_metadata("econ")
    assert bio["label"] == "Biology"
    assert econ["label"] == "Economics"
    assert len(bio["program_pins"]) == len(econ["program_pins"]) == 9
    assert {"uc_school_id": 79, "major": "Molecular and Cell Biology, B.A."} \
        in canonical_major_query("bio")["$or"]
    assert {"uc_school_id": 89, "major": "Economics A.B."} \
        in canonical_major_query("econ")["$or"]
    provenance = credit.result_provenance("2026-07-23T00:00:00Z", "bio", artifact_version=2)
    assert provenance["dataset_version"] == "2026-07-23-canonical-bio-v2"
    assert provenance["major_scope"]["slug"] == "bio"


def test_both_paper_requirement_loaders_reject_other_major_rows():
    rows = [
        requirement(7, "cs-stamped", 101, major_slug="cs"),
        requirement(46, "cs-legacy", 102),
        requirement(79, "cs-null", 103, major_slug=None),
        requirement(7, "bio-leak", 201, major_slug="bio"),
        requirement(7, "econ-leak", 301, major_slug="econ"),
        requirement(7, "blank-is-not-legacy", 401, major_slug=""),
    ]
    expected_groups = {"cs-stamped"}
    for loader in (credit.load_requirement_models, district.load_requirement_models):
        db = FakeDB(requirements=rows)
        models = loader(db)
        assert set(models) == {7, 46, 79}
        assert set(models[7]["groups"]) == expected_groups
        assert set(models[46]["groups"]) == {"cs-legacy"}
        assert set(models[79]["groups"]) == {"cs-null"}
        assert db.curated_requirements.queries == [{
            "kind": "transfer_minimum",
            **major_document_filter("cs"),
        }]


def test_receiver_overrides_are_scoped_to_cs_and_legacy_rows():
    rows = [
        {"kind": "receiver_override", "receiver_hash": "cs", "major_slug": "cs", "exclude": True},
        {"kind": "receiver_override", "receiver_hash": "legacy", "exclude": True},
        {"kind": "receiver_override", "receiver_hash": "null", "major_slug": None, "exclude": True},
        {"kind": "receiver_override", "receiver_hash": "bio", "major_slug": "bio", "exclude": True},
        {"kind": "receiver_override", "receiver_hash": "econ", "major_slug": "econ", "exclude": True},
    ]
    db = FakeDB(mappings=rows)
    overrides = credit.load_curation(db)["override_by_hash"]
    assert set(overrides) == {"cs", "legacy", "null"}
    assert db.curated_mappings.queries == [{
        "kind": "receiver_override",
        **major_document_filter("cs"),
    }]

    bio_db = FakeDB(mappings=rows)
    assert set(credit.load_curation(bio_db, "bio")["override_by_hash"]) == {"bio"}
    assert bio_db.curated_mappings.queries == [{
        "kind": "receiver_override",
        **major_document_filter("bio"),
    }]
