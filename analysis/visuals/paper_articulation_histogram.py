"""District coverage histogram after Figure 3 of the California paper."""

import argparse

import matplotlib.pyplot as plt
from matplotlib.patches import Patch

from paper_district_heatmap import DISTRICTS

from ._data import compute
from ._publish import Variant, add_delivery_arguments, deliver
from ._style import GAIN, LOSS, apply_style
from .paper_articulation_map import _current_counts, _paper_counts


PAPER_BLUE = "#287fb8"


def distribution(rows):
    counts = _current_counts(rows)
    frequency = [0] * 10
    for district in DISTRICTS:
        frequency[counts[district]] += 1
    return frequency


def paper_distribution():
    counts = _paper_counts()
    frequency = [0] * 10
    for district in DISTRICTS:
        frequency[counts[district]] += 1
    return frequency


def render(*, rows, version="current", differences=False):
    paper = paper_distribution()
    current = distribution(rows)
    frequency = paper if version == "paper" else current
    differences = differences and version == "current"
    fig, ax = plt.subplots(figsize=(9.4, 5.3))
    bars = ax.bar(range(10), frequency, width=0.68, color=PAPER_BLUE)

    if differences:
        for index, (paper_value, current_value) in enumerate(zip(paper, current)):
            delta = current_value - paper_value
            if delta > 0:
                ax.bar(index, delta, width=0.68, bottom=paper_value, color=GAIN)
            elif delta < 0:
                ax.bar(index, -delta, width=0.68, bottom=current_value, color=LOSS)
        ax.legend(
            handles=[
                Patch(facecolor=PAPER_BLUE, label="Current"),
                Patch(facecolor=GAIN, label="Added since paper"),
                Patch(facecolor=LOSS, label="Paper-only"),
            ],
            loc="upper right", ncol=3, frameon=False, fontsize=8,
            bbox_to_anchor=(1, 1.08),
        )

    y_max = max(5, ((max(max(paper), max(current)) + 4) // 5) * 5)
    ax.set_ylim(0, y_max + 2.1)
    ax.set_xticks(range(10))
    ax.set_yticks(range(0, y_max + 1, 5))
    ax.set_xlabel("Number of UC campuses with complete articulation")
    ax.set_ylabel("Number of districts")
    ax.grid(axis="y", color="#dbe1dc", linewidth=0.7)
    ax.set_axisbelow(True)
    ax.spines[["top", "right"]].set_visible(False)
    ax.spines[["left", "bottom"]].set_color("#77847c")

    for index, (bar, value) in enumerate(zip(bars, frequency)):
        delta = current[index] - paper[index]
        label = f"{value} ({delta:+d})" if differences and delta else str(value)
        label_y = max(current[index], paper[index]) if differences else value
        color = GAIN if delta > 0 else LOSS if delta < 0 else "#26352c"
        ax.text(bar.get_x() + bar.get_width() / 2, label_y + 0.25, label,
                ha="center", va="bottom", fontsize=9,
                color=color if differences else "#26352c")

    fig.text(0.075, 0.965, "Distribution of complete campus articulation",
             fontsize=15, color="#17251d", va="top")
    if version == "paper":
        subtitle = "Paper baseline · 72 community college districts · Figure 3 method"
    elif differences:
        subtitle = "Current data · changes from the paper Figure 3 distribution"
    else:
        subtitle = "Current data · 72 community college districts · paper Figure 3 method"
    fig.text(0.075, 0.92, subtitle, fontsize=8.5, color="#516158", va="top")
    fig.subplots_adjust(left=0.11, right=0.98, top=0.84, bottom=0.15)
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
        slug="paper-articulation-histogram",
        title="Districts by complete campus coverage",
        caption=(
            "Distribution of California community college districts by the number of UC "
            "campuses for which they provide a complete CS transfer path, with paper and "
            "current-data states plus signed changes."
        ),
        variants=variants,
        controls=controls,
        default_variant="current",
    )


if __name__ == "__main__":
    main()
