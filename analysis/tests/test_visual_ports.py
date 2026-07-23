"""Structural checks for the locally published replacements of old visuals."""

from pathlib import Path

import matplotlib
import numpy as np

matplotlib.use("Agg")

from visuals import coverage_heatmap
from visuals import paper_articulation_histogram
from visuals import paper_credit_loss
from visuals import paper_district_heatmap


VISUALS = {
    "paper_credit_loss.py",
    "paper_district_heatmap.py",
    "paper_articulation_histogram.py",
    "coverage_heatmap.py",
    "credit_loss.py",
    "choice_cost.py",
    "category_gaps.py",
    "complexity.py",
    "transfer_credit_rate.py",
}


def test_every_former_visual_has_a_separate_local_entrypoint():
    directory = Path(__file__).resolve().parents[1] / "visuals"
    assert VISUALS <= {path.name for path in directory.glob("*.py")}


def test_visual_data_calls_use_configured_major_slugs_not_title_filters():
    analysis = Path(__file__).resolve().parents[1]
    callers = [*sorted((analysis / "visuals").glob("*.py")), analysis / "income_access_stats.py"]
    for path in callers:
        source = path.read_text()
        assert "majorContains" not in source, path.name
        assert 'pin="paper"' not in source, path.name
        assert 'pin="settings"' not in source, path.name


def test_cs_paper_visuals_request_the_exact_configured_major_scope():
    directory = Path(__file__).resolve().parents[1] / "visuals"
    for name in (
        "paper_district_heatmap.py",
        "paper_articulation_histogram.py",
        "paper_articulation_map.py",
        "paper_course_barriers.py",
        "ma_course_type_spread.py",
    ):
        assert 'majorSlug="cs"' in (directory / name).read_text(), name


def test_coverage_matrix_preserves_rows_programs_and_duplicate_averaging():
    rows = [
        {
            "row_group_key": "district:a", "row_group_label": "District A",
            "school_id": 1, "school": "UC A", "major": "Computer Science",
            "pct_articulated": 50, "fully_articulated": False,
        },
        {
            "row_group_key": "district:a", "row_group_label": "District A",
            "school_id": 1, "school": "UC A", "major": "Computer Science",
            "pct_articulated": 100, "fully_articulated": True,
        },
    ]
    _, _, _, _, matrix, full = coverage_heatmap._build_matrix(rows)
    assert matrix.shape == (1, 1)
    assert matrix[0, 0] == 75
    assert full == 1


def test_district_port_keeps_the_papers_nine_by_seventy_two_frame():
    paper = paper_district_heatmap._paper_matrix()
    assert paper.shape == (9, 72)
    assert set(np.unique(paper)) == {0, 1}


def test_articulation_histogram_reconstructs_the_paper_distribution():
    frequency = paper_articulation_histogram.paper_distribution()
    assert frequency == [3, 2, 1, 7, 7, 10, 8, 4, 12, 18]
    assert sum(frequency) == 72


def test_credit_loss_port_builds_all_five_bars_for_each_campus():
    bars = paper_credit_loss._bars(paper_credit_loss._paper_result())
    assert len(bars) == 9
    assert all(len(row["choices"]) == 4 for row in bars)
    assert paper_credit_loss._difference_matrix(bars, bars).shape == (9, 5)


def test_committed_credit_loss_results_have_canonical_scope_and_valid_fingerprints():
    results = paper_credit_loss._load_results(recompute=False, workers=1)
    assert results["website"]["dataset_version"] == "2026-07-22-canonical-cs-v1"
    assert results["assist"]["dataset_version"] == "2026-07-23-canonical-cs-v2"
    assert results["assist"]["schema_version"] == 2
    assert (
        results["assist"]["method_version"]
        == "paper-choice-cost-assist-canonical-template-v2"
    )
    for key in ("website", "assist"):
        assert len(results[key]["major_scope"]["program_pins"]) == 9


def test_credit_loss_port_rejects_results_without_exact_pin_provenance(tmp_path):
    path = tmp_path / "legacy.json"
    path.write_text('{"major_filter":"computer science","campuses":[]}')
    with np.testing.assert_raises_regex(RuntimeError, "canonical-nine CS scope"):
        paper_credit_loss._read_canonical_result(path)
