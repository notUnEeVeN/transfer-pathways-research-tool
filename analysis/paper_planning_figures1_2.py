"""Reproduce the Figure 1/2 paper-planning summaries from a frozen CA export.

Run: analysis/.venv/bin/python analysis/paper_planning_figures1_2.py
Capture corrected audit exports first with --capture-dir /tmp (optional).
This is descriptive analysis of modeled pathways, not observed student outcomes.
"""
import argparse
import gzip
import hashlib
import json
from pathlib import Path

import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt
import numpy as np
import pandas as pd

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "analysis/results/paper_planning"
INPUT = OUT / "figure1_2_ca_input.json.gz"
MAJORS = {"cs": "Computer science", "bio": "Biology", "econ": "Economics"}
AXES = {
    "cs": [["computing"], ["math"], ["science"], ["non_stem"]],
    "bio": [["bio_series"], ["calculus", "statistics", "computing"],
            ["gen_chem", "organic_chem", "physics"], ["non_stem"]],
    "econ": [["econ_principles", "econ_theory"], ["calculus", "statistics", "computing"],
             ["other_social"], ["non_stem"]],
}
ROLES = ["Own discipline", "Quantitative", "Supporting discipline", "Non-STEM"]
METRICS = {
    "courses_no_ge": ("named_requirement_courses_articulated", "named_requirement_courses_total"),
    "courses_with_ge": ("named_requirement_courses_with_ge_articulated", "named_requirement_courses_with_ge_total"),
    "requirement_units_with_ge": ("degree_units_named_covered", "degree_units_named_total"),
    "graduation_budget_with_ge": ("degree_units_with_equivalent", "degree_units_modeled_total"),
}
MA_PLOTTED = [
    [30, 58, 5, 11, 20, 25, 9, 22, 29, 11, 18],
    [65, 97, 13, 40, 83, 98, 47, 52, 52, 53, 63],
    [100, 100, 100, 93, 100, 100, 100, 53, 78, 97, 100],
    [67, 100, 100, 67, 47],
]


def capture(directory):
    keys = {"school_id", "school", "community_college_id", "community_college",
            "degree_units_named_covered", "degree_units_named_total", "degree_units_ge_total",
            "degree_units_ge_with_equivalent", "degree_unit_system", "degree_transfer_cap",
            "degree_template_catalog_year", "degree_template_verified",
            "degree_requirements_by_course_type", "degree_groups_not_modelable"}
    keys.update(k for pair in METRICS.values() for k in pair)
    inputs, provenance = {}, {}
    for major in MAJORS:
        path = directory / f"transfer-audit-{major}-coverage-after.json"
        data = path.read_bytes()
        rows = json.loads(data)
        inputs[major] = [{key: row.get(key) for key in sorted(keys)} for row in rows]
        provenance[major] = {"source": path.name, "sha256": hashlib.sha256(data).hexdigest(), "rows": len(rows)}
    INPUT.write_bytes(gzip.compress(json.dumps(inputs, sort_keys=True).encode(), mtime=0))
    (OUT / "figure1_2_provenance.json").write_text(json.dumps({
        "captured_from": "Corrected read-only audit exports, 2026-09-07; no new database import",
        "source_exports": provenance,
        "compact_input_sha256": hashlib.sha256(INPUT.read_bytes()).hexdigest(),
        "ma_figure2": "../final_ma_paper/CIC-CC-Paper/course_distribution.ipynb, first code cell: explicit rounded plotting constants; anonymous observations",
        "definitions": {
            "course_observations": "Canonical named requirement observations; opaque unit-only blocks may use estimated course counts",
            "requirement_units": "Template requirement rollup, subtracting GE fields for no-GE; not necessarily identical to named-course observation scope",
            "graduation_budget": "Transfer cap and elective slack applied against stated graduation minimum",
            "lower_scope": "UI lower-division scope: model classification, not independently adjudicated course level",
            "means": "Equal pathway weighting; complete 115-college by 9-university grids make equal university means equivalent",
        },
    }, indent=2) + "\n")


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--capture-dir", type=Path)
    args = parser.parse_args()
    OUT.mkdir(parents=True, exist_ok=True)
    if args.capture_dir:
        capture(args.capture_dir)
    inputs = json.loads(gzip.decompress(INPUT.read_bytes()))
    cells, typed = [], []
    for major, rows in inputs.items():
        pairs = {(r["school_id"], r["community_college_id"]) for r in rows}
        assert len(rows) == len(pairs) == 1035
        assert all(r["degree_template_verified"] is True for r in rows)
        for row in rows:
            ident = {"major": major, "university": row["school"], "college": row["community_college"]}
            for metric, (num_key, den_key) in METRICS.items():
                numerator, denominator = row[num_key], row[den_key]
                assert denominator > 0
                cells.append({**ident, "metric": metric, "numerator": numerator,
                              "denominator": denominator, "pct": 100 * numerator / denominator})
            numerator = max(0, row["degree_units_named_covered"] - row["degree_units_ge_with_equivalent"])
            denominator = row["degree_units_named_total"] - row["degree_units_ge_total"]
            assert denominator > 0
            cells.append({**ident, "metric": "requirement_units_no_ge", "numerator": numerator,
                          "denominator": denominator, "pct": min(100, 100 * numerator / denominator)})
            counts = row["degree_requirements_by_course_type"]
            # The faithful categories partition the Figure 1 no-GE course observations.
            assert sum(c["total"] for c in counts.values()) == row["named_requirement_courses_total"]
            assert sum(c["covered"] for c in counts.values()) == row["named_requirement_courses_articulated"]
            for scope in ["whole_degree", "modeled_lower_division"]:
                prefix = "" if scope == "whole_degree" else "lower_division_"
                for role, categories in zip(ROLES, AXES[major]):
                    total = sum(counts.get(c, {}).get(prefix + "total", 0) for c in categories)
                    covered = sum(counts.get(c, {}).get(prefix + "covered", 0) for c in categories)
                    if total:
                        typed.append({**ident, "scope": scope, "role": role,
                                      "total": total, "covered": covered, "pct": covered / total * 100})
    cells = pd.DataFrame(cells)
    typed = pd.DataFrame(typed)
    cells.to_csv(OUT / "figure1_ca_cells.csv", index=False)
    campus = cells.groupby(["major", "metric", "university"])["pct"].agg(["mean", "min", "max", "std"]).reset_index()
    campus.to_csv(OUT / "figure1_ca_campuses.csv", index=False)
    summary = cells.groupby(["major", "metric"])["pct"].agg(["count", "mean", "median", "min", "max", "std"]).reset_index()
    summary.to_csv(OUT / "figure1_ca_summary.csv", index=False)
    types = typed.groupby(["major", "scope", "role", "university"])["pct"].mean().reset_index()
    types.to_csv(OUT / "figure2_ca_campuses.csv", index=False)
    type_summary = types.groupby(["major", "scope", "role"])["pct"].agg(["count", "mean", "min", "max"]).reset_index()
    type_summary.to_csv(OUT / "figure2_ca_summary.csv", index=False)
    piv = cells.pivot(index=["metric", "university", "college"], columns="major", values="pct")
    comparisons = []
    for metric in cells.metric.unique():
        sub = piv.loc[metric]
        for first, second in [("bio", "cs"), ("econ", "cs"), ("bio", "econ")]:
            diff = sub[first] - sub[second]
            comparisons.append({"metric": metric, "difference": first + " minus " + second,
                                "pairs": len(diff), "mean_pp": diff.mean(),
                                "positive_pairs": int((diff > 1e-9).sum()),
                                "negative_pairs": int((diff < -1e-9).sum()),
                                "tied_pairs": int((abs(diff) <= 1e-9).sum())})
    pd.DataFrame(comparisons).to_csv(OUT / "figure1_ca_paired_major_differences.csv", index=False)
    plt.rcParams.update({"font.family": "DejaVu Sans", "font.size": 10, "axes.spines.top": False, "axes.spines.right": False})
    fig, axes = plt.subplots(1, 2, figsize=(12, 5), sharey=True)
    colors = {"cs": "#27658C", "bio": "#5B7C32", "econ": "#A44652"}
    panels = [(["courses_no_ge", "courses_with_ge"], "Named requirement course observations"),
              (["requirement_units_no_ge", "requirement_units_with_ge"], "Template requirement units")]
    for ax, (metrics, title) in zip(axes, panels):
        for major, label in MAJORS.items():
            values = [float(summary[(summary.major == major) & (summary.metric == metric)]["mean"].iloc[0]) for metric in metrics]
            ax.plot([0, 1], values, marker="o", color=colors[major], label=label, linewidth=2)
            for x, y in enumerate(values):
                dy = -12 if (title == "Template requirement units" and major == "bio") or (title.startswith("Named") and major == "cs" and x == 1) else 6
                ax.annotate(f"{y:.1f}%", (x, y), xytext=(-9 if x == 0 else 9, dy), textcoords="offset points",
                            ha="right" if x == 0 else "left", color=colors[major])
        ax.set_xticks([0, 1], ["GE excluded", "GE included"])
        ax.set_xlim(-.35, 1.35)
        ax.set_ylim(0, 80)
        ax.set_title(title, fontsize=11)
        ax.grid(axis="y", alpha=.2)
    axes[0].set_ylabel("Mean modeled coverage (%)")
    axes[1].legend(loc="lower right", frameon=False)
    fig.suptitle("California major comparisons depend on the measurement definition", fontsize=14)
    fig.text(.5, .02, "1,035 college–university pairs per major. Descriptive model outputs; counts may include estimated blocks.\nThe unit panel uses requirement rollups. The separate capped graduation-budget measure is omitted.", ha="center", fontsize=9)
    fig.tight_layout(rect=(0, .10, 1, .94))
    for ext in ["png", "pdf"]:
        fig.savefig(OUT / f"figure1_ca_measure_sensitivity.{ext}", dpi=180)
    plt.close(fig)
    fig, axes = plt.subplots(1, 4, figsize=(13, 4.5), sharey=True)
    for i, (ax, role, ma) in enumerate(zip(axes, ROLES, MA_PLOTTED)):
        ca = types[(types.major == "cs") & (types.scope == "whole_degree") & (types.role == role)].pct.to_numpy()
        for x, values, color in [(0, ca, "#27658C"), (1, np.array(ma), "#AA5C31")]:
            offsets = np.linspace(-.12, .12, len(values))
            ax.scatter(x + offsets, np.sort(values), color=color, alpha=.8, s=32)
            ax.plot([x - .25, x + .25], [np.mean(values)] * 2, color=color, linewidth=2)
            ax.text(x, -4, f"Mean {np.mean(values):.1f}%\nn={len(values)}", ha="center", va="top", fontsize=9)
        ax.set_title(role, fontsize=11)
        ax.set_xticks([0, 1], ["CA", "MA"])
        ax.set_xlim(-.55, 1.55)
        ax.set_ylim(-24, 105)
        ax.set_yticks([0, 25, 50, 75, 100])
        ax.grid(axis="y", alpha=.2)
    axes[0].set_ylabel("Whole-degree course-type coverage (%)")
    fig.suptitle("Computing aligns less well than mathematics or science in both samples", fontsize=14)
    fig.text(.5, .015, "Exploratory source comparison: CA 115 colleges, MA 15. MA uses rounded, anonymous notebook values.\nMA category tallies need reconciliation with Figure 1. Non-STEM is a residual requirement category, not GE.", ha="center", fontsize=9)
    fig.tight_layout(rect=(0, .10, 1, .94))
    for ext in ["png", "pdf"]:
        fig.savefig(OUT / f"figure2_ca_ma_course_types.{ext}", dpi=180)
    plt.close(fig)
    fig, ax = plt.subplots(figsize=(8, 5))
    for major, label in MAJORS.items():
        vals = [float(type_summary[(type_summary.major == major) & (type_summary.scope == scope) &
                                   (type_summary.role == "Own discipline")]["mean"].iloc[0])
                for scope in ["whole_degree", "modeled_lower_division"]]
        ax.plot([0, 1], vals, marker="o", color=colors[major], linewidth=2, label=label)
        for x, value in enumerate(vals):
            dy = -13 if major == "cs" and x == 0 else 6
            ax.annotate(f"{value:.1f}%", (x, value), xytext=(-9 if x == 0 else 9, dy),
                        textcoords="offset points", ha="right" if x == 0 else "left", color=colors[major])
    ax.set_xticks([0, 1], ["Whole degree", "Modeled lower-division scope"])
    ax.set_xlim(-.35, 1.35)
    ax.set_ylim(0, 105)
    ax.set_ylabel("Own-discipline course-type coverage (%)")
    ax.set_title("California's computing gap persists after narrowing the requirement scope", fontsize=12)
    ax.legend(loc="upper left", frameon=False)
    ax.grid(axis="y", alpha=.2)
    fig.text(.5, .02, "Equal means across nine university campuses and 115 sending colleges. GE excluded.\nLower-division scope follows model transfer-tier classifications; it still needs source-level adjudication.", ha="center", fontsize=9)
    fig.tight_layout(rect=(0, .1, 1, 1))
    for ext in ["png", "pdf"]:
        fig.savefig(OUT / f"figure2_ca_scope_sensitivity.{ext}", dpi=180)
    plt.close(fig)
    print(summary.to_string(index=False))
    print(type_summary.to_string(index=False))


if __name__ == "__main__":
    main()
