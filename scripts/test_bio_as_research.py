import json
from pathlib import Path
import tempfile
import unittest

from scripts import bio_as_research as research


class BiologyAsResearchTest(unittest.TestCase):
    def test_program_type_hints_are_conservative(self):
        self.assertEqual(
            research.program_type_hint("Associate in Science in Biology for Transfer"),
            "ast",
        )
        self.assertEqual(research.program_type_hint("Biology A.S.-T."), "ast")
        self.assertEqual(
            research.program_type_hint("Biological Sciences, Associate in Science"),
            "local_as",
        )
        self.assertEqual(
            research.program_type_hint("Biology, Associate in Arts"),
            "local_other",
        )
        self.assertEqual(research.program_type_hint("Biology"), "unknown")

    def test_statewide_name_aliases_do_not_use_fuzzy_matching(self):
        repo_rows = [
            {"community_college_id": 111, "college_name": "College of Alameda"},
            {"community_college_id": 105, "college_name": "Coastline Community College"},
            {"community_college_id": 2, "college_name": "Evergreen Valley College"},
        ]
        statewide_rows = [
            {"id": "alameda", "title": "Alameda"},
            {"id": "coastline", "title": "Coastline College"},
            {"id": "evc", "title": "Evergreen Valley College"},
            {"id": "mystery", "title": "Mystery College"},
        ]
        matched, unmatched = research.match_statewide_colleges(repo_rows, statewide_rows)
        self.assertEqual(set(matched), {2, 105, 111})
        self.assertEqual([row["id"] for row in unmatched], ["mystery"])

    def test_checkpoint_summary_counts_only_existing_college_files(self):
        inventory = research.initial_inventory([
            {"community_college_id": 2, "college_name": "Evergreen Valley College"},
            {"community_college_id": 3, "college_name": "Los Angeles City College"},
        ])
        inventory["colleges"][0]["discovery_status"] = "complete"
        inventory["colleges"][0]["statewide_listing_status"] = "listed"
        inventory["colleges"][0]["programs"] = [
            {"degree_type_hint": "ast", "title": "Biology for Transfer"},
            {"degree_type_hint": "local_other", "title": "Biology A.A."},
        ]
        records = {
            2: (Path("002.json"), {
                "_meta": {"research_status": "requirements_extracted"},
                "degrees": [{}, {}],
            }),
        }
        self.assertEqual(research.summarize(inventory, records), {
            "colleges": 2,
            "discovery_complete": 1,
            "statewide_listed": 1,
            "program_candidates": 2,
            "program_hints": {"ast": 1, "local_other": 1},
            "research_records": 1,
            "research_statuses": {"requirements_extracted": 1},
            "extracted_degrees": 2,
            "remaining_colleges": 1,
        })

    def test_scaffold_round_trips_through_record_validator(self):
        inventory_row = {
            "community_college_id": 2,
            "college_name": "Evergreen Valley College",
            "statewide_listing_status": "listed",
            "programs_source_url": "https://example.edu/programs",
            "checked_at": "2026-07-23T00:00:00+00:00",
            "programs": [],
        }
        payload = research.scaffold_payload(inventory_row)
        errors = research.validate_research_record(
            Path("002.json"), payload, {2: inventory_row}
        )
        self.assertEqual(errors, [])
        self.assertEqual(
            research.SOURCE_ACADEMIC_YEAR,
            "2025-2026",
        )
        self.assertIn("2025-2026", payload["_meta"]["resume_note"])

    def test_next_rows_resurfaces_partial_checkpoints(self):
        inventory = research.initial_inventory([
            {"community_college_id": 2, "college_name": "Evergreen Valley College"},
            {"community_college_id": 3, "college_name": "Los Angeles City College"},
            {"community_college_id": 4, "college_name": "College of Marin"},
        ])
        records = {
            2: (Path("002.json"), {
                "_meta": {"research_status": "requirements_extracted"},
            }),
            3: (Path("003.json"), {
                "_meta": {"research_status": "inventory_only"},
            }),
        }
        pending = research.pending_rows(inventory, records)
        self.assertEqual(
            [(row["community_college_id"], row["research_status"]) for row in pending],
            [(3, "inventory_only"), (4, "not_started")],
        )

    def test_extracted_degree_requires_a_catalog_source(self):
        inventory_row = {
            "community_college_id": 2,
            "college_name": "Evergreen Valley College",
        }
        payload = research.scaffold_payload(inventory_row)
        payload["_meta"]["research_status"] = "requirements_extracted"
        payload["degrees"] = [{
            "degree_type_hint": "ast",
            "degree_title_seen": "Biology for Transfer",
            "award_seen": "A.S.-T.",
            "catalog_url": "",
            "catalog_year": "2025-2026",
            "sources": [],
            "major_groups": [],
        }]
        errors = research.validate_research_record(
            Path("002.json"), payload, {2: inventory_row}
        )
        self.assertTrue(any("catalog_url" in error for error in errors))
        self.assertTrue(any("sources needs" in error for error in errors))

    def test_validator_rejects_newer_catalog_and_source_years(self):
        inventory_row = {
            "community_college_id": 2,
            "college_name": "Evergreen Valley College",
        }
        payload = research.scaffold_payload(inventory_row)
        payload["_meta"]["research_status"] = "requirements_extracted"
        payload["degrees"] = [{
            "degree_type_hint": "ast",
            "degree_title_seen": "Biology for Transfer",
            "award_seen": "A.S.-T.",
            "catalog_url": "https://example.edu/biology",
            "catalog_year": "2026-2027",
            "sources": [{
                "url": "https://example.edu/catalog",
                "catalog_year": "2026-2027",
            }],
            "major_groups": [],
        }]
        errors = research.validate_research_record(
            Path("002.json"), payload, {2: inventory_row}
        )
        self.assertTrue(any("catalog_year must be 2025-2026" in error for error in errors))

    def test_validator_rejects_group_rules_the_importer_cannot_transform(self):
        inventory_row = {
            "community_college_id": 2,
            "college_name": "Evergreen Valley College",
        }
        payload = research.scaffold_payload(inventory_row)
        payload["_meta"]["research_status"] = "requirements_extracted"
        payload["degrees"] = [{
            "degree_type_hint": "ast",
            "degree_title_seen": "Biology for Transfer",
            "award_seen": "A.S.-T.",
            "catalog_url": "https://example.edu/biology",
            "catalog_year": "2025-2026",
            "sources": [{
                "url": "https://example.edu/catalog",
                "catalog_year": "2025-2026",
            }],
            "major_groups": [{
                "label_seen": "Choose one",
                "rule": "choose_n",
                "choose_n": 1,
                "courses": [],
            }],
        }]
        errors = research.validate_research_record(
            Path("002.json"), payload, {2: inventory_row}
        )
        self.assertTrue(any("rule must be one of" in error for error in errors))

    def test_atomic_writer_leaves_valid_json(self):
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / "checkpoint.json"
            research.write_json_atomic(path, {"ok": True})
            self.assertEqual(json.loads(path.read_text()), {"ok": True})
            self.assertFalse(path.with_suffix(".json.tmp").exists())

    def test_none_found_requires_a_negative_official_source(self):
        inventory_row = {
            "community_college_id": 40,
            "college_name": "Lake Tahoe Community College",
        }
        payload = research.scaffold_payload(inventory_row)
        payload["_meta"]["research_status"] = "none_found"
        errors = research.validate_research_record(
            Path("040.json"), payload, {40: inventory_row}
        )
        self.assertTrue(any("none_found_sources" in error for error in errors))

        payload["none_found_sources"] = [{
            "url": "https://example.edu/programs",
            "catalog_year": "2025-2026",
        }]
        errors = research.validate_research_record(
            Path("040.json"), payload, {40: inventory_row}
        )
        self.assertFalse(any("none_found_sources" in error for error in errors))

    def test_out_of_scope_candidates_are_rejected_for_the_narrow_scope(self):
        inventory_row = {
            "community_college_id": 2,
            "college_name": "Evergreen Valley College",
        }
        payload = research.scaffold_payload(inventory_row)
        payload["out_of_scope_candidates"] = [{
            "title_seen": "Biotechnology",
            "award_seen": "A.S.",
            "reason": "Specialized degree",
            "scope_status": "out_of_scope",
        }]
        errors = research.validate_research_record(
            Path("002.json"), payload, {2: inventory_row}
        )
        self.assertTrue(any("must stay empty" in error for error in errors))

    def test_tmc_versions_are_pinned_to_the_2025_2026_cohort(self):
        path = (
            Path(__file__).resolve().parent
            / "data"
            / "as_degrees_bio_research"
            / "tmc_versions.json"
        )
        payload = json.loads(path.read_text())
        self.assertEqual(payload["_meta"]["source_academic_year"], "2025-2026")
        versions = {row["key"]: row for row in payload["versions"]}
        prior = versions["biology_2015_rev2"]
        self.assertEqual(set(versions), {"biology_2015_rev2"})
        self.assertEqual((prior["major_units_min"], prior["major_units_max"]), (29, 38))
        self.assertIn("physics_sequence", {row["group_id"] for row in prior["groups"]})


if __name__ == "__main__":
    unittest.main()
