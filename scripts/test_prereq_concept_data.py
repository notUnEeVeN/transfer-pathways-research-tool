import json
import unittest
from pathlib import Path

from scripts import import_course_concepts as importer


HERE = Path(__file__).resolve().parent
CONCEPTS_PATH = HERE / "data" / "prereq_concepts.json"
MAPPING_PATH = HERE / "data" / "course_concepts.json"
EXPANSION_FLAG = "bio_econ_expansion_v1"


class PrerequisiteConceptDataTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.concepts_doc = json.loads(CONCEPTS_PATH.read_text(encoding="utf-8"))
        cls.mapping_doc = json.loads(MAPPING_PATH.read_text(encoding="utf-8"))
        cls.concepts = cls.concepts_doc["concepts"]
        cls.rows = cls.mapping_doc["rows"]

    def test_committed_artifacts_pass_import_validation(self):
        graph = importer.validate_concepts(self.concepts)
        importer.validate_mapping(self.rows, graph)

    def test_expansion_counts_and_metadata_reconcile(self):
        mapped = sum(row.get("concept") is not None for row in self.rows)
        examined_null = len(self.rows) - mapped
        expansion = [
            row for row in self.rows
            if EXPANSION_FLAG in (row.get("flags") or [])
        ]
        flagged = [
            row for row in expansion
            if "needs_review" in (row.get("flags") or [])
        ]

        self.assertEqual(len(self.concepts), 57)
        self.assertEqual((len(self.rows), mapped, examined_null), (6696, 5732, 964))
        self.assertEqual((len(expansion), len(flagged)), (1966, 76))
        self.assertEqual(self.mapping_doc["meta"]["totals"], {
            "rows": len(self.rows),
            "mapped": mapped,
            "examined_null": examined_null,
        })
        self.assertEqual(self.mapping_doc["meta"]["expansion"]["added_catalog_rows"], 1966)
        self.assertEqual(self.mapping_doc["meta"]["expansion"]["omitted_phantom_ids"], 34)

    def test_every_course_id_is_unique_and_generated_rows_are_traceable(self):
        ids = [int(row["course_id"]) for row in self.rows]
        self.assertEqual(len(ids), len(set(ids)))
        for row in self.rows:
            self.assertRegex(row["institution_id"], r"^cc:\d+$")
        for row in self.rows:
            if EXPANSION_FLAG in (row.get("flags") or []):
                self.assertTrue(row.get("title_seen"))
                self.assertIn("confidence", row)

    def test_new_normative_rules_are_locked_in_the_dag(self):
        by_slug = {concept["slug"]: concept for concept in self.concepts}
        self.assertEqual(by_slug["bio_genetics"]["requires"], ["bio_cell_molec"])
        self.assertEqual(by_slug["biochemistry"]["requires"], ["gen_chem_2"])
        self.assertEqual(by_slug["molecular_biology"]["requires"], ["bio_genetics"])
        self.assertEqual(by_slug["organic_chem_survey_2"]["requires"], ["organic_chem_survey_1"])
        self.assertEqual(
            by_slug["econ_intro_combined"]["satisfies"],
            ["econ_micro", "econ_macro"],
        )
        self.assertEqual(by_slug["precalc_2"]["requires"], ["precalc_1"])
        self.assertEqual(
            by_slug["precalc_combined"]["satisfies"],
            ["precalc_1", "precalc_2"],
        )
        self.assertEqual(by_slug["acct_managerial"]["requires"], ["acct_financial"])

    def test_mapping_validation_rejects_duplicate_ids_and_bad_college_keys(self):
        graph = {"intro_stats": []}
        valid = {
            "course_id": 1,
            "institution_id": "cc:2",
            "concept": "intro_stats",
            "confidence": 1,
        }
        with self.assertRaises(SystemExit):
            importer.validate_mapping([valid, dict(valid)], graph)
        with self.assertRaises(SystemExit):
            importer.validate_mapping([{**valid, "institution_id": "va:2"}], graph)


if __name__ == "__main__":
    unittest.main()
