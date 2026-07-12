"""Share of colleges missing an articulation in each curated course category."""

import argparse

import matplotlib.pyplot as plt
import numpy as np
from matplotlib.colors import LinearSegmentedColormap

from ._data import compute, shorten_school
from ._publish import Variant, add_delivery_arguments, deliver
from ._style import apply_style


def render(rows, major_filter):
    schools = sorted(
        {(str(row["school_id"]), row.get("school") or str(row["school_id"])) for row in rows},
        key=lambda pair: pair[1].casefold(),
    )
    categories = sorted(
        {row.get("category") or "Untagged" for row in rows},
        key=lambda value: (value == "Untagged", value.casefold()),
    )
    values = {(row.get("category") or "Untagged", str(row["school_id"])): row.get("pct_missing") for row in rows}
    matrix = np.full((len(categories), len(schools)), np.nan)
    for i, category in enumerate(categories):
        for j, (school_id, _) in enumerate(schools):
            try:
                matrix[i, j] = float(values[(category, school_id)])
            except (KeyError, TypeError, ValueError):
                pass

    means = np.nanmean(matrix, axis=1)
    display = np.column_stack([matrix, means])
    fig, ax = plt.subplots(figsize=(max(9, len(schools) * 0.85 + 3), max(4, len(categories) * 0.55 + 2.5)))
    cmap = LinearSegmentedColormap.from_list("missing", ["#fef2f2", "#991b1b"]).copy()
    cmap.set_bad("#f2f4f7")
    image = ax.imshow(display, cmap=cmap, vmin=0, vmax=100, aspect="auto")
    ax.set_xticks(range(display.shape[1]), [*[shorten_school(name) for _, name in schools], "Average"], rotation=90)
    ax.set_yticks(range(len(categories)), categories)
    ax.tick_params(length=0, labelsize=7)
    for i in range(display.shape[0]):
        for j in range(display.shape[1]):
            value = display[i, j]
            if np.isfinite(value):
                ax.text(j, i, f"{value:.0f}%", ha="center", va="center", fontsize=6,
                        color="white" if value > 60 else "#17202a")
    ax.set_xticks(np.arange(-0.5, display.shape[1], 1), minor=True)
    ax.set_yticks(np.arange(-0.5, display.shape[0], 1), minor=True)
    ax.grid(which="minor", color="white", linewidth=0.6)
    ax.tick_params(which="minor", bottom=False, left=False)
    ax.set_title(f"Colleges missing articulation by course category\nMajor contains: {major_filter}", loc="left")
    colorbar = fig.colorbar(image, ax=ax, fraction=0.025, pad=0.02)
    colorbar.set_label("Colleges missing an articulated equivalent")
    fig.tight_layout()
    return fig


def main(argv=None):
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    parser.add_argument("--major", default="computer science", help="case-insensitive major-name filter")
    parser.add_argument("--allow-untagged", action="store_true",
                        help="render the uninformative Untagged-only state")
    add_delivery_arguments(parser)
    args = parser.parse_args(argv)
    apply_style()

    rows = compute("category-gaps", majorContains=args.major)
    tagged = [row for row in rows if row.get("category")]
    if not tagged and not args.allow_untagged:
        raise SystemExit(
            "Category gaps is not publishable yet: curated course categories are empty. "
            "Add mappings first, or use --allow-untagged only for diagnostics."
        )
    deliver(
        args=args,
        slug="category-gaps",
        title="Course-category gaps",
        caption=(
            "Share of colleges with a required receiver in each category that lack "
            "an articulated equivalent."
        ),
        variants=[Variant("current", "Current data", {}, render(rows, args.major))],
    )


if __name__ == "__main__":
    main()
