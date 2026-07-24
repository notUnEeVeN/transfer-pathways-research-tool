import datetime as dt
import json
from pathlib import Path
import tempfile
import unittest

from scripts import import_bio_as_degrees as importer


def sample_payload(year="2025-2026"):
    return {
        "_meta": {
            "community_college_id": 2,
            "college_name": "Evergreen Valley College",
            "major_slug": "bio",
            "research_status": "requirements_extracted",
        },
        "degrees": [{
            "degree_type_hint": "ast",
            "degree_title_seen": "Biology A.S.-T.",
            "award_seen": "A.S.-T.",
            "catalog_url": "https://example.edu/2025-2026/biology",
            "catalog_year": year,
            "unit_system": "semester",
            "total_units": 60,
            "major_units_min": 4,
            "major_units_max": 4,
            "extraction_confidence": 0.9,
            "sources": [{"url": "https://example.edu/catalog", "catalog_year": year}],
            "major_groups": [{
                "label_seen": "Required Biology",
                "rule": "all",
                "choose_n": None,
                "units_min": 4,
                "ge_area": None,
                "courses": [{
                    "prefix": "BIOL",
                    "number": "1",
                    "title_seen": "Cell and Molecular Biology",
                    "units_seen": 4,
                }],
            }],
        }],
        "notes": "",
    }


class ImportBiologyAsDegreesTest(unittest.TestCase):
    def test_load_records_selects_only_completed_checkpoints(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            (root / "002.json").write_text(json.dumps(sample_payload()))
            partial = sample_payload()
            partial["_meta"]["community_college_id"] = 3
            partial["_meta"]["research_status"] = "inventory_only"
            (root / "003.json").write_text(json.dumps(partial))
            records = importer.load_records(root)
            self.assertEqual([path.name for path, _ in records], ["002.json"])

    def test_none_found_compiles_explicit_rows_for_all_slots(self):
        payload = sample_payload()
        payload["_meta"]["research_status"] = "none_found"
        payload["degrees"] = []
        payload["none_found_sources"] = [{
            "url": "https://example.edu/2025-2026/degrees",
            "catalog_year": "2025-2026",
        }]
        docs, stats = importer.compile_records(
            [(Path("scripts/data/040.json"), payload)],
            {}, {}, {}, {2},
            dt.datetime(2026, 7, 23, tzinfo=dt.timezone.utc),
        )
        self.assertEqual([doc["degree_type"] for doc in docs], list(importer.SLOTS))
        self.assertTrue(all(doc["status"] == "none_found" for doc in docs))
        self.assertTrue(all(doc["catalog_year"] == "2025-2026" for doc in docs))
        self.assertEqual(stats["none_found_rows"], 3)

    def test_source_record_rejects_non_pinned_year(self):
        with self.assertRaisesRegex(ValueError, "2025-2026"):
            importer.validate_source_record(Path("002.json"), sample_payload("2026-2027"))

    def test_compile_uses_major_scoped_id_and_resolved_course(self):
        payload = sample_payload()
        docs, stats = importer.compile_records(
            [(Path("scripts/data/example.json"), payload)],
            {(2, "BIOL", "1"): 9001},
            {},
            {9001: "bio_cell_molec"},
            {2},
            dt.datetime(2026, 7, 23, tzinfo=dt.timezone.utc),
        )
        self.assertEqual(len(docs), 1)
        doc = docs[0]
        self.assertEqual(doc["_id"], "as_degree:2:bio:ast")
        self.assertEqual(doc["legacy_id"], "2:bio:ast")
        self.assertEqual(doc["catalog_year"], "2025-2026")
        self.assertEqual(doc["covered_concepts"], ["bio_cell_molec"])
        option = doc["requirement_groups"][0]["sections"][0]["receivers"][0]["options"][0]
        self.assertEqual(option["course_ids"], [9001])
        self.assertEqual(option["course_keys"], ["cc:9001"])
        self.assertEqual(stats["by_slot"]["ast"], 1)

    def test_duplicate_slot_is_rejected(self):
        payload = sample_payload()
        payload["degrees"].append(dict(payload["degrees"][0]))
        with self.assertRaisesRegex(ValueError, "multiple degrees"):
            importer.validate_source_record(Path("002.json"), payload)

    def test_reimport_skips_any_human_saved_draft(self):
        incoming = {"_id": "as_degree:2:bio:ast"}
        existing = {
            "_id": incoming["_id"],
            "curated_by": "reviewer@example.edu",
            "verification": {"verified": False},
        }
        merged, verified, human_saved, curated = importer.merge_for_publish(
            incoming, existing
        )
        self.assertIsNone(merged)
        self.assertFalse(verified)
        self.assertTrue(human_saved)
        self.assertFalse(curated)


if __name__ == "__main__":
    unittest.main()
