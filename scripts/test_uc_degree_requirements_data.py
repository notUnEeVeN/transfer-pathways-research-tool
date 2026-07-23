import json
import unittest
from pathlib import Path
from urllib.parse import urlparse

from scripts import import_uc_degree_requirements as importer


HERE = Path(__file__).resolve().parent
FILES = {
    "bio": HERE / "data" / "uc_degree_requirements_bio.json",
    "econ": HERE / "data" / "uc_degree_requirements_econ.json",
}
CS_FILE = HERE / "data" / "uc_degree_requirements.json"
CS_EXPECTED = {
    "UCB": (79, "Electrical Engineering & Computer Sciences, B.S."),
    "UCD": (89, "Computer Science B.S."),
    "UCI": (120, "Computer Science, B.S."),
    "UCLA": (117, "Computer Science/B.S."),
    "UCM": (144, "COMPUTER SCIENCE AND ENGINEERING, B.S. "),
    "UCR": (46, "Computer Science, B.S."),
    "UCSD": (7, "CSE: Computer Science B.S."),
    "UCSB": (128, "Computer Science, B.S."),
    "UCSC": (132, "Computer Science B.S."),
}

EXPECTED = {
    "bio": {
        "UCB": (79, "Molecular and Cell Biology, B.A."),
        "UCD": (89, "Biological Sciences B.S."),
        "UCI": (120, "Biological Sciences, B.S."),
        "UCLA": (117, "Biology/B.S."),
        "UCM": (144, "BIOLOGICAL SCIENCES, General Biology Emphasis, B.S."),
        "UCR": (46, "Biology, B.A. or B.S."),
        "UCSD": (7, "Biology: General Biology B.S."),
        "UCSB": (128, "Biological Sciences, B.A. & B.S."),
        "UCSC": (132, "Biology B.S."),
    },
    "econ": {
        "UCB": (79, "Economics, B.A."),
        "UCD": (89, "Economics A.B."),
        "UCI": (120, "Economics, B.A."),
        "UCLA": (117, "Economics/B.A."),
        "UCM": (144, "ECONOMICS, B.A."),
        "UCR": (46, "Economics, B.A."),
        "UCSD": (7, "Economics B.A."),
        "UCSB": (128, "Economics, B.A."),
        "UCSC": (132, "Economics B.A."),
    },
}


def load(slug):
    return json.loads(FILES[slug].read_text(encoding="utf-8"))


def campuses(data):
    return {key: value for key, value in data.items() if not key.startswith("_")}


class DegreeRequirementResearchDataTests(unittest.TestCase):
    def test_cs_source_uses_scoped_identity_and_exact_program_pins(self):
        data = json.loads(CS_FILE.read_text(encoding="utf-8"))
        rows = campuses(data)
        self.assertEqual(data["_meta"]["major_slug"], "cs")
        self.assertEqual(set(rows), set(CS_EXPECTED))
        for key, row in rows.items():
            self.assertEqual((row["school_id"], row["program"]), CS_EXPECTED[key])
            slug, scoped = importer.source_identity(data, row)
            self.assertEqual((slug, scoped), ("cs", True))
            self.assertEqual(
                f"degree:{row['school_id']}:{slug}",
                f"degree:{CS_EXPECTED[key][0]}:cs",
            )

    def test_exact_nine_program_pins_and_major_scoped_ids(self):
        for slug, expected in EXPECTED.items():
            data = load(slug)
            rows = campuses(data)
            self.assertEqual(data["_meta"]["major_slug"], slug)
            self.assertEqual(set(rows), set(expected))
            self.assertEqual(len({row["school_id"] for row in rows.values()}), 9)
            for key, row in rows.items():
                self.assertEqual((row["school_id"], row["program"]), expected[key])
                self.assertEqual(importer.source_identity(data, row), (slug, True))
                self.assertEqual(f"degree:{row['school_id']}:{slug}",
                                 f"degree:{expected[key][0]}:{slug}")

    def test_every_template_has_official_human_verification_sources(self):
        for slug in FILES:
            for key, row in campuses(load(slug)).items():
                with self.subTest(slug=slug, campus=key):
                    sources = row.get("sources", [])
                    self.assertGreaterEqual(len(sources), 3)
                    ids = [source.get("id") for source in sources]
                    self.assertEqual(len(ids), len(set(ids)))
                    self.assertTrue(all(ids))
                    urls = []
                    for source in sources:
                        parsed = urlparse(source.get("url", ""))
                        self.assertEqual(parsed.scheme, "https")
                        self.assertTrue(parsed.netloc.endswith(".edu"))
                        self.assertTrue(source.get("kind"))
                        self.assertTrue(source.get("label"))
                        urls.append(source["url"])
                    self.assertIn(row["source_url"], urls)

    def test_source_refs_resolve_and_requirement_schema_is_safe(self):
        for slug in FILES:
            for key, row in campuses(load(slug)).items():
                source_ids = {source["id"] for source in row["sources"]}
                for group in row["groups"]:
                    with self.subTest(slug=slug, campus=key, group=group["title"]):
                        self.assertIn(group["tier"], {
                            "transferable", "breadth", "nontransferable",
                        })
                        self.assertTrue(group.get("source_refs"))
                        self.assertLessEqual(set(group["source_refs"]), source_ids)
                        self.assertIn("course_level", group)
                        self.assertIn("cc_articulable", group)
                        self.assertTrue(group.get("requirements"))
                        for req in group["requirements"]:
                            self.assertGreater(req.get("select", 0), 0)
                            self.assertGreaterEqual(req.get("units", 0), 0)
                            self.assertTrue(req.get("source_refs"))
                            self.assertLessEqual(set(req["source_refs"]), source_ids)
                            frm = req.get("from")
                            if frm is None:
                                self.assertEqual(group["tier"], "nontransferable")
                            elif isinstance(frm, list):
                                self.assertTrue(frm)
                                self.assertTrue(all(isinstance(code, str) and code for code in frm))
                            elif isinstance(frm, dict) and "series" in frm:
                                self.assertTrue(frm["series"])
                                self.assertTrue(all(series for series in frm["series"]))
                            elif isinstance(frm, dict) and frm.get("assume"):
                                self.assertEqual(group["tier"], "breadth")
                                self.assertIn(frm.get("credit_role"), {
                                    "ge_certification", "elective_capacity",
                                    "zero_unit_requirement",
                                })
                            else:
                                self.fail(f"unsupported from shape: {frm!r}")

    def test_canonical_unit_budgets_close_to_published_degree_minimum(self):
        for slug in FILES:
            for key, row in campuses(load(slug)).items():
                with self.subTest(slug=slug, campus=key):
                    authored = sum(
                        req["units"]
                        for group in row["groups"]
                        for req in group["requirements"]
                    )
                    self.assertEqual(authored, row["total_units"])
                    self.assertEqual(row["unit_audit"]["graduation_minimum"],
                                     row["total_units"])
                    self.assertEqual(row["unit_audit"]["modeled_units"], authored)
                    self.assertIn(row["unit_system"], {"semester", "quarter"})
                    self.assertEqual(
                        row["research_status"],
                        "ai_researched_needs_human_verification",
                    )
                    self.assertTrue(row.get("modeling_notes"))

    def test_known_cross_cutting_edge_cases_are_explicit(self):
        bio = load("bio")
        econ = load("econ")
        self.assertIn("8 variants", bio["UCSD"]["ge_authority"])
        self.assertEqual(len(bio["UCSD"]["ge_variants"]), 8)
        self.assertEqual(len(econ["UCSD"]["ge_variants"]), 8)
        self.assertEqual(bio["UCSB"]["degree_variant"], "B.S.")
        self.assertTrue(any(
            "CHEM 109" in group["title"] and group["tier"] == "nontransferable"
            for group in bio["UCSB"]["groups"]
        ))
        self.assertTrue(any(
            "BIO 110" in group["title"] and group["tier"] == "nontransferable"
            for group in bio["UCM"]["groups"]
        ))
        self.assertTrue(any(
            "BCH 100" in group["title"] and group["tier"] == "nontransferable"
            for group in bio["UCR"]["groups"]
        ))
        self.assertTrue(any(
            "ECON 15" in group["title"]
            and group["course_level"] == "lower_division"
            and group["cc_articulable"] is False
            for group in econ["UCI"]["groups"]
        ))


if __name__ == "__main__":
    unittest.main()
