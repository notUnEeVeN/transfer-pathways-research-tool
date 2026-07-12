"""Paper-style district by UC complete-transfer matrix and comparisons.

The paper baseline is frozen. Hand-curated and ASSIST states are recomputed by
the same canonical coverage functions the former website component used.
"""

import argparse
import re
import unicodedata

import matplotlib.pyplot as plt
import numpy as np
from matplotlib.colors import BoundaryNorm, ListedColormap
from matplotlib.patches import Patch

from paper_district_heatmap import DISTRICTS, UC_ROWS

from ._data import compute
from ._publish import Variant, add_delivery_arguments, deliver
from ._style import GAIN, LOSS, NAVY, apply_style


def _normalize(value):
    text = "".join(
        char for char in unicodedata.normalize("NFKD", str(value or ""))
        if not unicodedata.combining(char)
    ).replace("&", " and ")
    return re.sub(r"\s+", " ", re.sub(r"[^a-z0-9]+", " ", text.lower())).strip()


SCHOOL_TO_ROW = {school_id: index for index, (_, _, school_id, _) in enumerate(UC_ROWS)}
DISTRICT_TO_COLUMN = {_normalize(name): index for index, name in enumerate(DISTRICTS)}


def _paper_matrix():
    return np.array([[int(bit) for bit in bits] for _, _, _, bits in UC_ROWS], dtype=int)


def _live_matrix(rows):
    matrix = np.zeros((len(UC_ROWS), len(DISTRICTS)), dtype=int)
    for row in rows:
        row_index = SCHOOL_TO_ROW.get(int(row.get("school_id") or -1))
        column = DISTRICT_TO_COLUMN.get(_normalize(
            row.get("row_group_label") or row.get("community_college_district")
        ))
        if row_index is not None and column is not None and row.get("fully_articulated") is True:
            matrix[row_index, column] = 1
    return matrix


def render(*, live, version, differences, labels):
    paper = _paper_matrix()
    if version == "paper":
        display = paper
        cmap = ListedColormap(["#ffffff", NAVY])
        norm = BoundaryNorm([-0.5, 0.5, 1.5], cmap.N)
    elif differences:
        # 0 same missing, 1 same complete, 2 gained, 3 lost.
        display = np.where((paper == 1) & (live == 1), 1,
                           np.where((paper == 0) & (live == 1), 2,
                                    np.where((paper == 1) & (live == 0), 3, 0)))
        cmap = ListedColormap(["#ffffff", NAVY, GAIN, LOSS])
        norm = BoundaryNorm([-0.5, 0.5, 1.5, 2.5, 3.5], cmap.N)
    else:
        display = live
        cmap = ListedColormap(["#ffffff", NAVY])
        norm = BoundaryNorm([-0.5, 0.5, 1.5], cmap.N)

    fig, ax = plt.subplots(figsize=(14.5, 3.25))
    ax.imshow(display, cmap=cmap, norm=norm, aspect="equal")
    row_labels = [
        row_id if labels == "paper" else campus.replace("UC ", "") + ("*" if row_id.endswith("*") else "")
        for row_id, campus, _, _ in UC_ROWS
    ]
    ax.set_yticks(range(len(UC_ROWS)), row_labels, fontsize=7)
    ax.set_xticks(range(len(DISTRICTS)), [str(index) for index in range(len(DISTRICTS))],
                  fontsize=4.5, rotation=90)
    ax.set_xlabel("Community college district index")
    ax.set_ylabel("UC campus")
    ax.set_xticks(np.arange(-0.5, len(DISTRICTS), 1), minor=True)
    ax.set_yticks(np.arange(-0.5, len(UC_ROWS), 1), minor=True)
    ax.grid(which="minor", color="#111111", linewidth=0.35)
    ax.tick_params(which="both", length=0)

    if version == "paper":
        subtitle = f"Paper baseline | {int(paper.sum())} complete cells"
    else:
        changed = int(np.count_nonzero(live != paper))
        subtitle = (
            f"{'ASSIST' if version == 'assist' else 'Hand-curated'} minimums | "
            f"{int(live.sum())} complete cells | {changed} changed vs paper"
        )
    ax.set_title(subtitle, loc="left", fontsize=9, pad=7)
    if differences:
        ax.legend(handles=[
            Patch(facecolor=NAVY, edgecolor="#111111", label="same complete"),
            Patch(facecolor="#ffffff", edgecolor="#111111", label="same missing"),
            Patch(facecolor=GAIN, edgecolor="#111111", label="gained"),
            Patch(facecolor=LOSS, edgecolor="#111111", label="lost"),
        ], loc="upper center", bbox_to_anchor=(0.5, -0.32), ncol=4, frameon=False, fontsize=7)
    fig.tight_layout()
    return fig


def main(argv=None):
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    add_delivery_arguments(parser)
    args = parser.parse_args(argv)
    apply_style()

    website = _live_matrix(compute(
        "coverage", majorContains="computer science", groupBy="district",
        requirements="paper", pin="paper",
    ))
    assist = _live_matrix(compute(
        "coverage", majorContains="computer science", groupBy="district",
        requirements="assist", pin="settings",
    ))
    live_by_version = {"paper": _paper_matrix(), "website": website, "assist": assist}
    version_labels = {
        "paper": "Paper baseline",
        "website": "Hand-curated minimums",
        "assist": "ASSIST minimums",
    }

    variants = []
    for labels in ("names", "paper"):
        for version in ("paper", "website", "assist"):
            diff_states = (False,) if version == "paper" else (False, True)
            for differences in diff_states:
                key = f"{version}{'-diff' if differences else ''}-{labels}"
                variants.append(Variant(
                    key=key,
                    label=f"{version_labels[version]}{' differences' if differences else ''}",
                    state={"version": version, "differences": differences, "labels": labels},
                    figure=render(
                        live=live_by_version[version], version=version,
                        differences=differences, labels=labels,
                    ),
                ))

    controls = [
        {
            "key": "version", "label": "Version", "type": "select", "default": "website",
            "options": [{"value": key, "label": label} for key, label in version_labels.items()],
        },
        {"key": "differences", "label": "Show differences", "type": "toggle", "default": False},
        {
            "key": "labels", "label": "Campus labels", "type": "select", "default": "names",
            "options": [
                {"value": "names", "label": "Campus names"},
                {"value": "paper", "label": "UC1-UC9 ids"},
            ],
        },
    ]
    deliver(
        args=args,
        slug="paper-district-heatmap",
        title="Paper-style district transfer heatmap",
        caption=(
            "District by UC complete-transfer matrix with the frozen paper baseline, "
            "hand-curated website minimums, ASSIST minimums, and signed comparisons."
        ),
        variants=variants,
        controls=controls,
        default_variant="website-names",
    )


if __name__ == "__main__":
    main()
