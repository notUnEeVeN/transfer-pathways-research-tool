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
    results = paper_credit_loss._load_results(recompute=False, workers=1)
    bars = paper_credit_loss._bars(results["paper"])
    assert len(bars) == 9
    assert all(len(row["choices"]) == 4 for row in bars)
    assert paper_credit_loss._difference_matrix(bars, bars).shape == (9, 5)
