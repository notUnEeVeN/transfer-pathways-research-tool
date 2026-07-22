"""Per-course articulation gaps after Figure 5 of the CA paper.

Mirrors the paper's own renderer
(`question_2-3/district-level/course_analysis.create_all_course_graphs`):
one panel per course category, one bar per UC campus, bar height = share of
community college districts with no articulated equivalent for that course.
Gray = the campus does not require the course for transfer admission.

The paper baseline is TRANSCRIBED from the published figure; the current view
recomputes the same operation on the console's paper-matched coverage rows.
"""

import argparse

import matplotlib.pyplot as plt
from matplotlib.patches import Patch

from ._data import compute
from ._publish import Variant, add_delivery_arguments, deliver
from ._style import GAIN, LOSS, apply_style


PAPER_DISTRICT_COUNT = 72
NOT_REQUIRED_FACE = "#DDDDDD"

# (key, label, color, group-id patterns) — order and patterns are the paper's
# COURSE_GROUPS; first pattern match wins, so do not reorder.
CATEGORIES = [
    ("calculus", "Calculus", "#EC2424", ("calc",)),
    ("intro-programming", "Intro Programming", "#25ADA7", ("intro", "program")),
    ("data-structures", "Data Structures", "#8F35B3", ("data", "struct")),
    ("advanced-math", "Advanced Math", "#0B7C3C", ("linear", "differential")),
    ("computer-organization", "Computer Organization", "#0C5382", ("organ", "system", "computer")),
    ("discrete-math", "Discrete Math", "#FF9F1C", ("discrete",)),
]

# Campus order is the paper's (most requirements first); * marks quarter terms.
CAMPUSES = [
    ("UC1*", 89), ("UC2", 144), ("UC3*", 7), ("UC4*", 128), ("UC5*", 117),
    ("UC6", 79), ("UC7*", 132), ("UC8*", 120), ("UC9*", 46),
]

# Percentages exactly as printed in Figure 5; None = gray "not required" bar.
PAPER_MISSING_PCT = {
    "calculus": [5.6, 2.8, 4.2, 1.4, 4.2, 2.8, 1.4, 1.4, 1.4],
    "intro-programming": [31.9, 6.9, 34.7, 19.4, 34.7, None, 23.6, 45.8, 20.8],
    "data-structures": [52.8, 9.7, 40.3, 27.8, None, None, None, None, None],
    "advanced-math": [None, 4.2, 5.6, 4.2, 6.9, 4.2, None, None, None],
    "computer-organization": [25.0, None, None, None, None, None, 23.6, None, None],
    "discrete-math": [20.8, None, 31.9, 8.3, None, None, 19.4, None, None],
}


def category_of(group_id):
    text = str(group_id or "").strip().lower()
    for key, _, _, patterns in CATEGORIES:
        if any(pattern in text for pattern in patterns):
            return key
    return None


def paper_percentages():
    return {key: list(PAPER_MISSING_PCT[key]) for key, _, _, _ in CATEGORIES}


def current_percentages(rows):
    """Share of districts missing each course category, per campus."""
    campus_by_id = {school_id: label for label, school_id in CAMPUSES}
    districts = set()
    required = set()
    missing = {}

    for row in rows:
        campus = campus_by_id.get(row.get("school_id"))
        district = row.get("row_group_label") or row.get("community_college_district")
        if campus is None or not district:
            continue
        districts.add(district)
        for group in row.get("requirement_groups") or []:
            key = category_of(group.get("group_id"))
            if key is None:
                continue
            required.add((key, campus))
            if not group.get("satisfied"):
                missing.setdefault((key, campus), set()).add(district)

    total = len(districts) or PAPER_DISTRICT_COUNT
    return {
        key: [
            round(len(missing.get((key, campus), ())) / total * 100, 1)
            if (key, campus) in required else None
            for campus, _ in CAMPUSES
        ]
        for key, _, _, _ in CATEGORIES
    }, len(districts)


def render(*, rows, version="current", differences=False):
    paper = paper_percentages()
    current, district_count = current_percentages(rows)
    values = paper if version == "paper" else current
    differences = differences and version == "current"
    labels = [label for label, _ in CAMPUSES]

    fig, axes2d = plt.subplots(2, 3, figsize=(15, 8.6), sharey=True)
    for index, (ax, (key, title, color, _)) in enumerate(zip(axes2d.flatten(), CATEGORIES)):
        for position, percent in enumerate(values[key]):
            if percent is None:
                ax.bar(position, 60, width=0.8, color=NOT_REQUIRED_FACE, edgecolor="k")
                continue
            baseline = paper[key][position]
            delta = round(percent - baseline, 1) if differences and baseline is not None else 0
            if percent == 0:
                ax.bar(position, 60, width=0.8, color="white", edgecolor=color, hatch="///")
                label_y, label = 30, "0.0%"
            else:
                ax.bar(position, percent, width=0.8, color=color, edgecolor="k")
                label_y, label = max(percent, baseline or 0) + 1.4, f"{percent:.1f}%"
            if delta:
                low, high = sorted((percent, baseline))
                ax.bar(position, high - low, bottom=low, width=0.8,
                       color=LOSS if delta > 0 else GAIN)
                label = f"{label} ({delta:+.1f})"
            ax.text(position, label_y, label, ha="center",
                    va="center" if percent == 0 else "bottom", fontsize=9,
                    color=(LOSS if delta > 0 else GAIN) if delta else "#17251d")

        ax.set_ylim(0, 60)
        ax.set_xlim(-0.6, len(CAMPUSES) - 0.4)
        ax.set_title(title, fontsize=13)
        ax.set_xticks(range(len(CAMPUSES)))
        ax.set_xticklabels(labels, rotation=20, ha="right", fontsize=9)
        if index % 3 == 0:
            ax.set_ylabel("% of CC Districts", fontsize=11)

    handles = [
        Patch(facecolor="black", edgecolor="k", label="Colored = % missing"),
        Patch(facecolor=NOT_REQUIRED_FACE, edgecolor="k", label="Gray = not required"),
    ]
    if differences:
        handles += [
            Patch(facecolor=GAIN, label="Fewer districts missing"),
            Patch(facecolor=LOSS, label="More districts missing"),
        ]
    fig.legend(handles=handles, loc="lower center", ncol=len(handles), frameon=False, fontsize=10)

    fig.text(0.055, 0.975, "Districts missing course articulation",
             fontsize=15, color="#17251d", va="top")
    if version == "paper":
        subtitle = "Paper baseline · 72 community college districts · Figure 5 method"
    elif differences:
        subtitle = (f"Current data · point changes from the paper Figure 5 percentages · "
                    f"{district_count} districts")
    else:
        subtitle = (f"Current data · {district_count} community college districts · "
                    "paper Figure 5 method")
    fig.text(0.055, 0.94, subtitle, fontsize=9, color="#516158", va="top")
    fig.subplots_adjust(left=0.07, right=0.98, top=0.86, bottom=0.13, hspace=0.42)
    return fig


def main(argv=None):
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    add_delivery_arguments(parser)
    args = parser.parse_args(argv)
    apply_style()

    rows = compute(
        "coverage", majorContains="computer science", groupBy="district",
        requirements="paper", pin="paper",
    )
    variants = [
        Variant(
            key="paper", label="Paper baseline",
            state={"version": "paper", "differences": False},
            figure=render(rows=rows, version="paper", differences=False),
        ),
        Variant(
            key="current", label="Current data",
            state={"version": "current", "differences": False},
            figure=render(rows=rows, version="current", differences=False),
        ),
        Variant(
            key="current-diff", label="Current differences",
            state={"version": "current", "differences": True},
            figure=render(rows=rows, version="current", differences=True),
        ),
    ]
    controls = [
        {
            "key": "version", "label": "Version", "type": "select", "default": "current",
            "options": [
                {"value": "paper", "label": "Paper baseline"},
                {"value": "current", "label": "Current data"},
            ],
        },
        {"key": "differences", "label": "Show differences", "type": "toggle", "default": False},
    ]
    deliver(
        args=args,
        slug="paper-course-barriers",
        title="Course gaps by campus",
        caption=(
            "Percentage of California community college districts with no articulated "
            "equivalent for each math and CS course required for UC transfer admission, "
            "with paper and current-data states plus signed changes."
        ),
        variants=variants,
        controls=controls,
        default_variant="current",
    )


if __name__ == "__main__":
    main()
