"""Shared small-multiple histogram used by two pathway visuals."""

from collections import Counter, defaultdict

import matplotlib.pyplot as plt
import numpy as np

from ._data import shorten_school
from ._style import BORDER, MUTED, PRIMARY


def render_histogram(rows, *, field, bin_step, unit, title):
    grouped = defaultdict(list)
    names = {}
    for row in rows:
        try:
            value = float(row[field])
        except (KeyError, TypeError, ValueError):
            continue
        key = str(row.get("school_id"))
        names[key] = row.get("school") or key
        grouped[key].append(value)
    if not grouped:
        raise RuntimeError(f"no numeric {field} values to plot")

    keys = sorted(grouped, key=lambda key: str(names[key]).casefold())
    bins = [round(value / bin_step) for values in grouped.values() for value in values]
    max_slot = max(bins) + 1
    max_count = max(
        Counter(round(value / bin_step) for value in grouped[key].copy()).most_common(1)[0][1]
        for key in keys
    )

    fig, ax = plt.subplots(figsize=(12, max(5, 1.15 + len(keys) * 0.72)))
    for index, key in enumerate(keys):
        values = grouped[key]
        counts = Counter(round(value / bin_step) for value in values)
        for slot, count in counts.items():
            height = max(0.06, (count / max_count) * 0.58)
            ax.bar(slot * bin_step, height, width=bin_step * 0.78, bottom=index,
                   color=PRIMARY, align="center")
        mean = float(np.mean(values))
        ax.vlines(mean, index, index + 0.64, color="#17202a", linewidth=0.9)
        ax.text(max_slot * bin_step + bin_step * 0.35, index + 0.28,
                f"n={len(values)}", va="center", fontsize=7, color=MUTED)
        ax.axhline(index, color=BORDER, linewidth=0.5)

    ax.set_yticks(np.arange(len(keys)) + 0.28, [shorten_school(names[key]) for key in keys])
    ax.set_ylim(-0.05, len(keys) - 0.05)
    ax.set_xlim(-bin_step, max_slot * bin_step + bin_step * 1.4)
    ax.set_xlabel(unit)
    ax.set_title(title, loc="left", fontsize=10, pad=10)
    ax.spines[["top", "right", "left"]].set_visible(False)
    ax.tick_params(axis="y", length=0)
    ax.grid(axis="x", color=BORDER, linewidth=0.5, alpha=0.7)
    fig.tight_layout()
    return fig
