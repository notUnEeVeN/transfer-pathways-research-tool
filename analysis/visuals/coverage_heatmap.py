"""Articulation coverage by college, district, or county and UC program.

This is the local replacement for the former CoverageHeatmap React component.
The major filter is a run parameter; row aggregation and requirement source are
published as named states so teammates can still switch them in the gallery.
"""

import argparse
import textwrap
from collections import defaultdict

import matplotlib.pyplot as plt
import numpy as np
from matplotlib.colors import LinearSegmentedColormap

from ._data import compute, shorten_school
from ._publish import Variant, add_delivery_arguments, deliver
from ._style import apply_style


ROW_MODES = {
    "college": "College",
    "district": "District",
    "county": "County",
}
MINIMUMS = {
    "assist": "ASSIST minimums",
    "paper": "Hand-curated minimums",
}


def _build_matrix(rows):
    row_names = {}
    columns = {}
    cells = defaultdict(list)
    full = 0
    for row in rows:
        row_key = str(row.get("row_group_key") or row.get("community_college_id"))
        col_key = f"{row.get('school_id')}|{row.get('major')}"
        row_names[row_key] = row.get("row_group_label") or row.get("community_college") or row_key
        columns[col_key] = (row.get("school") or "Unknown campus", row.get("major") or "Unknown major")
        try:
            value = float(row["pct_articulated"])
        except (KeyError, TypeError, ValueError):
            continue
        cells[(row_key, col_key)].append(value)
        full += int(row.get("fully_articulated") is True)

    row_keys = sorted(row_names, key=lambda key: row_names[key].casefold())
    col_keys = sorted(columns, key=lambda key: (columns[key][0].casefold(), columns[key][1].casefold()))
    matrix = np.full((len(row_keys), len(col_keys)), np.nan)
    for i, row_key in enumerate(row_keys):
        for j, col_key in enumerate(col_keys):
            values = cells.get((row_key, col_key), [])
            if values:
                matrix[i, j] = sum(values) / len(values)
    return row_keys, col_keys, row_names, columns, matrix, full


def render(rows, *, row_mode, minimums, major_filter):
    row_keys, col_keys, row_names, columns, matrix, full = _build_matrix(rows)
    if not row_keys or not col_keys:
        raise RuntimeError(f"no coverage rows for major filter {major_filter!r}")

    row_means = np.nanmean(matrix, axis=1)
    col_means = np.nanmean(matrix, axis=0)
    overall = float(np.nanmean(matrix))
    display = np.block([
        [matrix, row_means[:, None]],
        [np.append(col_means, overall)[None, :]],
    ])

    width = max(10, min(32, 3.2 + display.shape[1] * 0.85))
    height = max(5, min(34, 2.8 + display.shape[0] * 0.25))
    fig, ax = plt.subplots(figsize=(width, height))
    cmap = LinearSegmentedColormap.from_list(
        "coverage", ["#be1c32", "#e0ad2a", "#0d7964"]
    ).copy()
    cmap.set_bad("#f2f4f7")
    image = ax.imshow(display, cmap=cmap, vmin=0, vmax=100, aspect="auto")

    major_labels = []
    for key in col_keys:
        school, major = columns[key]
        clean_major = " ".join(str(major).split())
        major_labels.append(f"{shorten_school(school)}\n{textwrap.fill(clean_major, 22)}")
    ax.set_xticks(range(display.shape[1]), [*major_labels, "Average"], rotation=90)
    ax.set_yticks(range(display.shape[0]), [*[row_names[key] for key in row_keys], "Average"])
    ax.tick_params(axis="both", length=0, labelsize=5 if len(row_keys) > 70 else 7)

    text_size = 3.5 if display.size > 1800 else 5.5
    for i in range(display.shape[0]):
        for j in range(display.shape[1]):
            value = display[i, j]
            if np.isfinite(value):
                ax.text(j, i, f"{value:.0f}%", ha="center", va="center",
                        fontsize=text_size, color="white" if value < 28 or value > 78 else "#17202a")

    ax.set_xticks(np.arange(-0.5, display.shape[1], 1), minor=True)
    ax.set_yticks(np.arange(-0.5, display.shape[0], 1), minor=True)
    ax.grid(which="minor", color="white", linewidth=0.45)
    ax.tick_params(which="minor", bottom=False, left=False)
    ax.set_title(
        f"{ROW_MODES[row_mode]} articulation coverage | {MINIMUMS[minimums]}\n"
        f"Major contains: {major_filter} | {full} fully articulated source rows",
        loc="left",
        fontsize=10,
        pad=12,
    )
    colorbar = fig.colorbar(image, ax=ax, fraction=0.015, pad=0.015)
    colorbar.set_label("Required coursework articulated")
    fig.tight_layout()
    return fig


def main(argv=None):
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    parser.add_argument("--major", default="computer science", help="case-insensitive major-name filter")
    add_delivery_arguments(parser)
    args = parser.parse_args(argv)
    apply_style()

    variants = []
    for minimums in ("assist", "paper"):
        for row_mode in ROW_MODES:
            rows = compute(
                "coverage",
                majorContains=args.major,
                groupBy=row_mode,
                requirements=minimums,
            )
            variants.append(Variant(
                key=f"{minimums}-{row_mode}",
                label=f"{MINIMUMS[minimums]} - {ROW_MODES[row_mode]}",
                state={"minimums": minimums, "rows": row_mode},
                figure=render(rows, row_mode=row_mode, minimums=minimums, major_filter=args.major),
            ))

    controls = [
        {
            "key": "rows", "label": "Rows", "type": "select", "default": "college",
            "options": [{"value": key, "label": label} for key, label in ROW_MODES.items()],
        },
        {
            "key": "minimums", "label": "Minimums", "type": "select", "default": "assist",
            "options": [
                {"value": "assist", "label": MINIMUMS["assist"]},
                {"value": "paper", "label": MINIMUMS["paper"]},
            ],
        },
    ]
    deliver(
        args=args,
        slug="coverage-heatmap",
        title="Articulation coverage heatmap",
        caption=(
            f"Community-college coverage of UC requirements for majors containing "
            f"'{args.major}', with switchable geography and minimums source."
        ),
        variants=variants,
        controls=controls,
        default_variant="assist-college",
    )


if __name__ == "__main__":
    main()
