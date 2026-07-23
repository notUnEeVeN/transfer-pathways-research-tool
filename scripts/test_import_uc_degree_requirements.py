import unittest

from scripts import import_uc_degree_requirements as importer


class FakeCollection:
    def __init__(self, rows):
        self.rows = rows

    def find(self, query):
        wanted = set(query["_id"]["$in"])
        return [row for row in self.rows if row.get("_id") in wanted]


def empty_report():
    return {
        "resolved": [], "unresolved": [], "required_slots": 0,
        "transferable_slots": 0, "breadth_slots": 0,
        "nontransferable_slots": 0, "breadth_courses": 0,
    }


def campus(**overrides):
    row = {
        "school_id": 79,
        "school": "UC Berkeley",
        "program": "Molecular and Cell Biology, B.A.",
        "total_units": 120,
        "source_url": "https://catalog.berkeley.edu/program",
        "sources": [{
            "kind": "major",
            "label": "Major requirements",
            "url": "https://catalog.berkeley.edu/program",
        }],
        "catalog_year": "2026-27",
        "college": "College of Letters and Science",
        "academic_unit": "Department of Molecular and Cell Biology",
        "ge_authority": "College of Letters and Science",
        "unit_system": "semester",
        "ge_model": "college_owned",
        "ge_variants": [],
        "research_status": "ai_researched_needs_human_verification",
        "unit_audit": {"graduation_minimum": 120},
        "modeling_notes": ["Upper-division slot count needs human review."],
        "data_quality_flags": [{"code": "needs_review"}],
        "groups": [{
            "title": "Upper division",
            "tier": "nontransferable",
            "source_refs": ["major"],
            "note": "Catalog-stated major block.",
            "course_level": "upper_division",
            "cc_articulable": False,
            "requirements": [{
                "select": 1,
                "from": None,
                "units": 4,
                "source_refs": ["major"],
                "note": "One upper-division course.",
                "course_level": "upper_division",
                "cc_articulable": False,
            }],
        }],
    }
    row.update(overrides)
    return row


class MajorScopedDegreeIdentityTests(unittest.TestCase):
    def test_course_normalization_ignores_catalog_zero_padding(self):
        self.assertEqual(importer.normalize_code("CHEM 001A"), "CHEM 1A")
        self.assertEqual(importer.normalize_code("CHEM 01LA"), "CHEM 1LA")
        self.assertEqual(importer.normalize_code("ECON 010"), "ECON 10")

    def test_explicit_source_major_uses_major_scoped_identity(self):
        data = {"_meta": {"major_slug": "bio"}}
        row = campus()

        slug, scoped = importer.source_identity(data, row)
        doc = importer.build_doc(
            "UCB", row, {}, {}, empty_report(),
            major_slug=slug, major_scoped_id=scoped,
        )

        self.assertEqual(doc["_id"], "degree:79:bio")
        self.assertEqual(doc["legacy_id"], "79:bio")
        self.assertEqual(doc["major_slug"], "bio")
        self.assertEqual(doc["sources"], row["sources"])
        self.assertEqual(doc["college"], "College of Letters and Science")
        self.assertEqual(doc["academic_unit"], "Department of Molecular and Cell Biology")
        self.assertEqual(doc["ge_authority"], "College of Letters and Science")
        self.assertEqual(doc["unit_system"], "semester")
        self.assertEqual(doc["ge_model"], "college_owned")
        self.assertEqual(doc["source_method"], "ai_web_research")
        self.assertEqual(doc["source"], "ai_researched_degree")
        self.assertEqual(doc["data_quality_flags"], [{"code": "needs_review"}])
        self.assertEqual(doc["unit_audit"], {"graduation_minimum": 120})
        self.assertEqual(doc["requirement_groups"][0]["source_refs"], ["major"])
        self.assertEqual(doc["requirement_groups"][0]["course_level"], "upper_division")
        self.assertFalse(doc["requirement_groups"][0]["cc_articulable"])
        self.assertEqual(doc["requirement_groups"][0]["sections"][0]["source_refs"], ["major"])
        self.assertEqual(doc["requirement_groups"][0]["sections"][0]["course_level"], "upper_division")

    def test_source_without_slug_defaults_to_scoped_cs_identity(self):
        row = campus(program="Electrical Engineering & Computer Sciences, B.S.")
        row.pop("research_status")

        slug, scoped = importer.source_identity({"_meta": {}}, row)
        doc = importer.build_doc(
            "UCB", row, {}, {}, empty_report(),
            major_slug=slug, major_scoped_id=scoped,
        )

        self.assertEqual((slug, scoped), ("cs", True))
        self.assertEqual(doc["_id"], "degree:79:cs")
        self.assertEqual(doc["legacy_id"], "79:cs")
        self.assertEqual(doc["major_slug"], "cs")
        self.assertEqual(doc["research_status"], "hand_verified")
        self.assertEqual(doc["source_method"], "hand_curated")
        self.assertEqual(doc["source"], "hand_curated_degree")

    def test_cs_id_migration_preserves_database_only_curation_fields(self):
        authored = {
            "_id": "degree:79:cs", "legacy_id": "79:cs",
            "major_slug": "cs", "program": "Current program",
        }
        legacy = {
            "_id": "degree:79", "legacy_id": "79",
            "program": "Old program", "verification_notes": ["keep me"],
            "curated_by": "curator", "updated_at": "old timestamp",
        }

        migrated = importer.merge_legacy_fields(authored, legacy, {})

        self.assertEqual(migrated["_id"], "degree:79:cs")
        self.assertEqual(migrated["legacy_id"], "79:cs")
        self.assertEqual(migrated["program"], "Current program")
        self.assertEqual(migrated["verification_notes"], ["keep me"])
        self.assertEqual(migrated["curated_by"], "curator")
        self.assertNotIn("updated_at", migrated)

    def test_existing_modern_curation_wins_over_legacy(self):
        migrated = importer.merge_legacy_fields(
            {"_id": "degree:79:cs", "major_slug": "cs"},
            {"_id": "degree:79", "verification_notes": ["old"]},
            {"_id": "degree:79:cs", "verification_notes": ["new"]},
        )
        self.assertNotIn("verification_notes", migrated)

    def test_cs_migration_preflight_rejects_old_and_new_collision(self):
        authored = {"_id": "degree:79:cs", "school_id": 79, "major_slug": "cs"}
        collection = FakeCollection([
            {"_id": "degree:79", "kind": "degree", "school_id": 79},
            {"_id": "degree:79:cs", "kind": "degree", "school_id": 79,
             "major_slug": "cs"},
        ])
        with self.assertRaisesRegex(ValueError, "both degree:79 and degree:79:cs"):
            importer.preflight_legacy_cs_migration(collection, [authored])

    def test_cs_migration_preflight_rejects_mismatched_legacy_row(self):
        authored = {"_id": "degree:79:cs", "school_id": 79, "major_slug": "cs"}
        collection = FakeCollection([
            {"_id": "degree:79", "kind": "degree", "school_id": 89},
        ])
        with self.assertRaisesRegex(ValueError, "expected 79"):
            importer.preflight_legacy_cs_migration(collection, [authored])

    def test_campus_major_can_override_file_default(self):
        self.assertEqual(
            importer.source_identity(
                {"_meta": {"major_slug": "bio"}},
                campus(major_slug="econ"),
            ),
            ("econ", True),
        )

    def test_rejects_unsafe_major_slug(self):
        with self.assertRaisesRegex(ValueError, "major_slug must match"):
            importer.source_identity(
                {"_meta": {"major_slug": "Bio / Sciences"}}, campus()
            )


if __name__ == "__main__":
    unittest.main()
