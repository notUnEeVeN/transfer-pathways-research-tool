"""Course-type coverage spread, after Figure 2 of the Massachusetts paper.

One point per UC campus per course type: the share of that campus's curated
computer science degree requirements of that type which have a community
college equivalent, averaged over every community college. The black diamond
is the mean of the points in the column.

This is a recreation on California data, not a port: the MA authors' code is
not available, and their numbers are not reproduced here.
"""

import argparse

import matplotlib.pyplot as plt
from matplotlib.lines import Line2D

from ._data import compute
from ._publish import Variant, add_delivery_arguments, deliver
from ._style import apply_style


COURSE_TYPES = [
    ("computing", "Computing", "#E8443A"),
    ("math", "Math", "#4C7FA0"),
    ("science", "Science", "#8FA23F"),
    ("non_stem", "Non-STEM", "#F0B537"),
]


def _short_campus(name):
    text = str(name or "")
    for prefix in ("University of California, ", "University of California ", "UC "):
        if text.lower().startswith(prefix.lower()):
            return text[len(prefix):].strip()
    return text.strip()


def campus_points(rows, scope="whole-degree"):
    """{course type: [(campus, percent), ...]} — one entry per campus.

    scope="whole-degree" counts every requirement; scope="lower-division"
    counts only requirements a community college could teach, dropping the
    upper-division and residency tiers.
    """
    whole = scope == "whole-degree"
    samples = {}
    for row in rows:
        types = row.get("degree_requirements_by_course_type") or {}
        campus = _short_campus(row.get("school"))
        for key, _, _ in COURSE_TYPES:
            slots = types.get(key) or {}
            total = slots.get("total") if whole else slots.get("lower_division_total")
            covered = slots.get("covered") if whole else slots.get("lower_division_covered")
            if not total:
                continue
            samples.setdefault(key, {}).setdefault(campus, []).append(covered / total * 100)
    return {
        key: sorted(
            ((campus, sum(values) / len(values)) for campus, values in (samples.get(key) or {}).items()),
            key=lambda item: item[1],
        )
        for key, _, _ in COURSE_TYPES
    }


def _offsets(values, span=0.055, gap=3.0):
    """Deterministic beeswarm offsets: nearest to centre first, alternating."""
    placed = []
    out = []
    for value in values:
        step, offset = 0, 0.0
        while any(abs(other_v - value) < gap and abs(other_o - offset) < span * 0.9
                  for other_v, other_o in placed):
            step += 1
            magnitude = ((step + 1) // 2) * span
            offset = magnitude if step % 2 else -magnitude
        placed.append((value, offset))
        out.append(offset)
    return out


def render(*, rows, scope="whole-degree"):
    points = campus_points(rows, scope)
    fig, ax = plt.subplots(figsize=(8.4, 5.8))

    for index, (key, label, color) in enumerate(COURSE_TYPES):
        column = points.get(key) or []
        values = [value for _, value in column]
        for offset, value in zip(_offsets(values), values):
            ax.plot(index + offset, value, "o", color=color, markersize=8, zorder=2)
        if values:
            ax.plot(index, sum(values) / len(values), "D", color="#12161b",
                    markersize=11, zorder=3)

    ax.set_xticks(range(len(COURSE_TYPES)))
    ax.set_xticklabels([label for _, label, _ in COURSE_TYPES], fontsize=12)
    ax.set_xlim(-0.6, len(COURSE_TYPES) - 0.4)
    # Past both gridlines, so the 0% and 100% rules sit clear of the frame.
    ax.set_ylim(-7, 108)
    ax.set_yticks(range(0, 101, 20))
    ax.set_yticklabels([f"{tick}%" for tick in range(0, 101, 20)], fontsize=11)
    ax.set_xlabel("Course Type", fontsize=12)
    ax.set_ylabel("Percent of Transferable Requirements", fontsize=12)
    ax.grid(axis="y", color="#d6d9dd", linestyle="--", linewidth=0.9)
    ax.set_axisbelow(True)
    for spine in ax.spines.values():
        spine.set_color("#2b3138")
    ax.legend(handles=[Line2D([0], [0], marker="D", color="w", label="Mean",
                              markerfacecolor="#12161b", markersize=11)],
              loc="upper left", fontsize=11, frameon=True, edgecolor="#2b3138")
    fig.tight_layout()
    return fig


def main(argv=None):
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    add_delivery_arguments(parser)
    args = parser.parse_args(argv)
    apply_style()

    rows = compute(
        "coverage", majorContains="computer science", groupBy="college",
        requirements="degree", pin="settings",
    )
    variants = [
        Variant(key="whole-degree", label="Whole degree",
                state={"scope": "whole-degree"},
                figure=render(rows=rows, scope="whole-degree")),
        Variant(key="lower-division", label="Lower-division only",
                state={"scope": "lower-division"},
                figure=render(rows=rows, scope="lower-division")),
    ]
    controls = [{
        "key": "scope", "label": "Requirements counted", "type": "select",
        "default": "whole-degree",
        "options": [
            {"value": "whole-degree", "label": "Whole degree"},
            {"value": "lower-division", "label": "Lower-division only"},
        ],
    }]
    deliver(
        args=args,
        slug="course-type-coverage",
        title="Transferable requirements by course type",
        caption=(
            "Share of each University of California computer science degree's "
            "requirements with a community college equivalent, by course type, "
            "one point per campus averaged across community colleges."
        ),
        variants=variants,
        controls=controls,
        default_variant="whole-degree",
    )


if __name__ == "__main__":
    main()
