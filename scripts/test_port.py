import argparse
import datetime as dt
import unittest

from scripts import port


def matches(row, query):
    if "$or" in query:
        return any(matches(row, clause) for clause in query["$or"])
    for key, expected in query.items():
        actual = row.get(key)
        if isinstance(expected, dict) and "$in" in expected:
            if actual not in expected["$in"]:
                return False
        elif actual != expected:
            return False
    return True


class FakeCollection:
    def __init__(self, rows):
        self.rows = rows

    def estimated_document_count(self):
        return len(self.rows)

    def find(self, query=None, projection=None):
        query = query or {}
        return [row.copy() for row in self.rows if matches(row, query)]

    def count_documents(self, query):
        return sum(matches(row, query) for row in self.rows)

    def create_index(self, keys):
        return "test_index"

    def insert_one(self, row):
        self.rows.append(row.copy())

    def insert_many(self, rows, ordered=True):
        self.rows.extend(row.copy() for row in rows)

    def update_one(self, query, update):
        for row in self.rows:
            if matches(row, query):
                row.update(update.get("$set", {}))
                return FakeUpdateResult(1)
        return FakeUpdateResult(0)


class FakeUpdateResult:
    def __init__(self, matched_count):
        self.matched_count = matched_count


class FakeDb:
    def __init__(self, collections):
        self.collections = {
            name: FakeCollection(rows) for name, rows in collections.items()
        }

    def __getitem__(self, name):
        return self.collections.setdefault(name, FakeCollection([]))


class PairRemovalTests(unittest.TestCase):
    def test_parses_exact_pair_without_normalizing_major(self):
        self.assertEqual(
            port.parse_school_major_pair("144=COMPUTER SCIENCE, B.S. "),
            (144, "COMPUTER SCIENCE, B.S. "),
        )

    def test_rejects_malformed_pair(self):
        for value in ("", "79", "abc=Computer Science", "0=Computer Science"):
            with self.subTest(value=value):
                with self.assertRaises(argparse.ArgumentTypeError):
                    port.parse_school_major_pair(value)

    def test_builds_pair_aware_filter_and_deduplicates(self):
        query = port.exact_pair_filter([
            (79, "Computer Science, B.A."),
            (79, "Computer Science, B.A."),
            (117, "Computer Science and Engineering/B.S."),
        ])
        self.assertEqual(query, {"$or": [
            {"uc_school_id": 79, "major": "Computer Science, B.A."},
            {"uc_school_id": 117, "major": "Computer Science and Engineering/B.S."},
        ]})

    def test_preview_reads_canonical_exact_pairs_without_creating_stage(self):
        db = FakeDb({
            "assist_agreements": [
                {"uc_school_id": 79, "major": "Computer Science, B.A."},
                {"uc_school_id": 79, "major": "Electrical Engineering & Computer Sciences, B.S."},
                {"uc_school_id": 117, "major": "Computer Science, B.A."},
            ],
            "admissions": [
                {"uc_school_id": 79, "major": "Computer Science, B.A."},
            ],
            "assist_institutions": [
                {"_id": "uc:79", "kind": "university", "source_id": 79, "name": "UC Berkeley"},
            ],
        })

        preview = port.pair_removal_preview(db, [(79, "Computer Science, B.A.")])

        self.assertEqual(preview, [{
            "school_id": 79,
            "school": "UC Berkeley",
            "major": "Computer Science, B.A.",
            "agreements": 1,
            "admissions": 1,
        }])
        self.assertEqual(db["uc_agreements"].rows, [])
        self.assertEqual(db["uc_major_admissions"].rows, [])

    def test_creates_verified_timestamped_backup_before_removal(self):
        agreement = {
            "_id": "agreement-1", "uc_school_id": 79,
            "major": "Computer Science, B.A.", "requirement_groups": [],
        }
        admission = {
            "_id": "admission-1", "uc_school_id": 79,
            "major": "Computer Science, B.A.",
        }
        app_settings = {"_id": "app", "visible_pairs": [], "canonical_dirty": False}
        cohort_settings = {"_id": "as_degree_validation", "college_ids": ["10"]}
        db = FakeDb({
            "assist_agreements": [agreement],
            "admissions": [admission],
            "settings": [app_settings, cohort_settings],
        })
        now = dt.datetime(2026, 7, 23, 1, 2, 3, tzinfo=dt.timezone.utc)

        backup_id = port.create_removal_backup(
            db,
            [(79, "Computer Science, B.A.")],
            [{"agreements": 1, "admissions": 1}],
            now=now,
            token="deadbeef",
        )

        self.assertEqual(
            backup_id,
            "major-pair-removal-20260723T010203000000Z-deadbeef",
        )
        manifest = db[port.REMOVAL_BACKUPS].rows[0]
        self.assertEqual(manifest["status"], "ready")
        self.assertEqual(manifest["document_count"], 4)
        self.assertEqual(manifest["counts"], {
            "assist_agreements": 1, "admissions": 1, "settings": 2,
        })
        records = db[port.REMOVAL_BACKUP_DOCUMENTS].rows
        self.assertEqual(
            {row["collection"] for row in records},
            {"assist_agreements", "admissions", "settings"},
        )
        self.assertIn(cohort_settings, [row["document"] for row in records])
        # Creating the recovery point never changes the live source rows.
        self.assertEqual(db["assist_agreements"].rows, [agreement])
        self.assertEqual(db["admissions"].rows, [admission])
        self.assertEqual(db["settings"].rows, [app_settings, cohort_settings])

    def test_refuses_backup_when_preview_counts_are_stale(self):
        db = FakeDb({
            "assist_agreements": [{
                "_id": "agreement-1", "uc_school_id": 79,
                "major": "Computer Science, B.A.",
            }],
            "settings": [{"_id": "app"}],
        })

        with self.assertRaises(SystemExit):
            port.create_removal_backup(
                db,
                [(79, "Computer Science, B.A.")],
                [{"agreements": 2, "admissions": 0}],
            )

        self.assertEqual(db[port.REMOVAL_BACKUPS].rows, [])
        self.assertEqual(db[port.REMOVAL_BACKUP_DOCUMENTS].rows, [])


if __name__ == "__main__":
    unittest.main()
