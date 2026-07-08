"""load_canonical_majors reads the settings selection and falls back to PAPER_MAJORS."""
import paper_credit_loss as pcl


class FakeColl:
    def __init__(self, doc):
        self._doc = doc

    def find_one(self, _query):
        return self._doc


class FakeDB:
    def __init__(self, doc):
        self.dataset_config = FakeColl(doc)


# The live selection: exactly one CS major per campus.
LIVE_PAIRS = [
    {"school_id": 7, "major": "CSE: Computer Science B.S."},
    {"school_id": 46, "major": "Computer Science, B.S."},
    {"school_id": 79, "major": "Computer Science, B.A."},
    {"school_id": 89, "major": "Computer Science B.S."},
    {"school_id": 117, "major": "Computer Science/B.S."},
    {"school_id": 120, "major": "Computer Science, B.S."},
    {"school_id": 128, "major": "Computer Science, B.S."},
    {"school_id": 132, "major": "Computer Science B.S."},
    {"school_id": 144, "major": "COMPUTER SCIENCE AND ENGINEERING, B.S. "},
]


def test_reads_visible_pairs_one_per_campus():
    canon = pcl.load_canonical_majors(FakeDB({"_id": "partner_access", "visible_pairs": LIVE_PAIRS}))
    assert set(canon) == pcl.CAMPUS_SCHOOL_IDS
    assert canon[7] == ["CSE: Computer Science B.S."]
    assert canon[144] == ["COMPUTER SCIENCE AND ENGINEERING, B.S. "]
    assert all(len(v) == 1 for v in canon.values())


def test_supports_multiple_majors_per_campus():
    pairs = LIVE_PAIRS + [{"school_id": 7, "major": "Mathematics/Computer Science B.S."}]
    canon = pcl.load_canonical_majors(FakeDB({"_id": "partner_access", "visible_pairs": pairs}))
    assert set(canon[7]) == {"CSE: Computer Science B.S.", "Mathematics/Computer Science B.S."}


def test_fallback_to_paper_majors_when_absent():
    canon = pcl.load_canonical_majors(FakeDB(None))
    assert canon == {sid: list(m) for sid, m in pcl.PAPER_MAJORS.items()}


def test_missing_campus_falls_back_per_campus():
    partial = [p for p in LIVE_PAIRS if p["school_id"] != 79]  # drop UCB
    canon = pcl.load_canonical_majors(FakeDB({"_id": "partner_access", "visible_pairs": partial}))
    assert canon[79] == list(pcl.PAPER_MAJORS[79])
    assert canon[7] == ["CSE: Computer Science B.S."]


def test_canonical_major_query_shape():
    q = pcl.canonical_major_query({7: ["CSE: Computer Science B.S."]})
    assert q == {"$or": [{"uc_school_id": 7, "major": {"$in": ["CSE: Computer Science B.S."]}}]}
