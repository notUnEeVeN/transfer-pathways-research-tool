import unittest

from scripts import import_uc_degree_requirements as importer


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
        "research_status": "ai_researched_needs_human_verification",
        "unit_audit": {"graduation_minimum": 120},
        "modeling_notes": ["Upper-division slot count needs human review."],
        "groups": [{
            "title": "Upper division",
            "tier": "nontransferable",
            "source_refs": ["major"],
            "note": "Catalog-stated major block.",
            "requirements": [{
                "select": 1,
                "from": None,
                "units": 4,
                "source_refs": ["major"],
                "note": "One upper-division course.",
            }],
        }],
    }
    row.update(overrides)
    return row


class MajorScopedDegreeIdentityTests(unittest.TestCase):
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
        self.assertEqual(doc["unit_audit"], {"graduation_minimum": 120})
        self.assertEqual(doc["requirement_groups"][0]["source_refs"], ["major"])
        self.assertEqual(doc["requirement_groups"][0]["sections"][0]["source_refs"], ["major"])

    def test_historical_source_preserves_cs_legacy_identity(self):
        row = campus(program="Electrical Engineering & Computer Sciences, B.S.")

        slug, scoped = importer.source_identity({"_meta": {}}, row)
        doc = importer.build_doc(
            "UCB", row, {}, {}, empty_report(),
            major_slug=slug, major_scoped_id=scoped,
        )

        self.assertEqual((slug, scoped), ("cs", False))
        self.assertEqual(doc["_id"], "degree:79")
        self.assertEqual(doc["legacy_id"], "79")
        self.assertEqual(doc["major_slug"], "cs")

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
