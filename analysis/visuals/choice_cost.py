"""Incremental CC courses required as additional UC choices are kept open.

Pass --order more than once to publish several intentional application orders
as named states. Arbitrary ordering remains a local run parameter instead of
creating thousands of precomputed website states.
"""

import argparse

import matplotlib.pyplot as plt
import numpy as np

from ._data import compute, institutions, shorten_school
from ._publish import Variant, add_delivery_arguments, deliver
from ._style import BORDER, MUTED, apply_style


STEP_COLORS = ["#2746ab", "#3366ef", "#6189fb", "#94b2ff"]
ORDINALS = ["1st", "2nd", "3rd", "4th"]


def _parse_order(value):
    ids = [int(part.strip()) for part in value.split(",") if part.strip()]
    if not 1 <= len(ids) <= 4 or len(ids) != len(set(ids)):
        raise argparse.ArgumentTypeError("an order needs 1-4 distinct comma-separated school ids")
    return ids


def render(rows, order, names, major_filter):
    means = []
    counts = []
    for index, school_id in enumerate(order):
        values = [
            float(row["steps"][index]["additional_courses"])
            for row in rows
            if len(row.get("steps") or []) > index
            and row["steps"][index].get("school_id") == school_id
            and row["steps"][index].get("has_agreement")
            and row["steps"][index].get("additional_courses") is not None
        ]
        means.append(float(np.mean(values)) if values else 0)
        counts.append(len(values))

    sorted_rows = sorted(
        rows,
        key=lambda row: (-float(row.get("total_courses") or 0), str(row.get("community_college") or "")),
    )
    fig = plt.figure(figsize=(13, max(8, 4.2 + len(sorted_rows) * 0.16)), layout="constrained")
    grid = fig.add_gridspec(2, 1, height_ratios=[2.2, max(4, len(sorted_rows) * 0.16)], hspace=0.35)
    top = fig.add_subplot(grid[0])
    bottom = fig.add_subplot(grid[1])

    x = np.arange(len(order))
    bars = top.bar(x, means, color=STEP_COLORS[:len(order)], width=0.62)
    top.set_xticks(x, [f"{ORDINALS[i]}\n{shorten_school(names.get(sid, sid))}" for i, sid in enumerate(order)])
    top.set_ylabel("Mean additional CC courses")
    top.set_title(f"Mean course cost of each added campus | Major: {major_filter}", loc="left")
    top.spines[["top", "right"]].set_visible(False)
    top.grid(axis="y", color=BORDER, linewidth=0.5)
    for bar, mean, count in zip(bars, means, counts):
        top.text(bar.get_x() + bar.get_width() / 2, bar.get_height(), f"{mean:.1f}\nn={count}",
                 ha="center", va="bottom", fontsize=7, color=MUTED)

    y = np.arange(len(sorted_rows))
    left = np.zeros(len(sorted_rows))
    for index, school_id in enumerate(order):
        values = []
        for row in sorted_rows:
            step = (row.get("steps") or [{}] * len(order))[index]
            values.append(float(step.get("additional_courses") or 0) if step.get("has_agreement") else 0)
        bottom.barh(y, values, left=left, color=STEP_COLORS[index], height=0.72,
                    label=f"{ORDINALS[index]}: {shorten_school(names.get(school_id, school_id))}")
        left += np.array(values)

    bottom.set_yticks(y, [row.get("community_college") for row in sorted_rows], fontsize=5)
    bottom.invert_yaxis()
    bottom.set_xlabel("Cheapest-path courses, stacked by application order")
    bottom.spines[["top", "right", "left"]].set_visible(False)
    bottom.tick_params(axis="y", length=0)
    bottom.grid(axis="x", color=BORDER, linewidth=0.5)
    bottom.legend(loc="lower right", fontsize=7, frameon=False)
    return fig


def main(argv=None):
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    parser.add_argument("--major", default="cs", help="configured major slug (default: cs)")
    parser.add_argument("--order", action="append", type=_parse_order,
                        help="comma-separated school ids in application order; may be repeated")
    add_delivery_arguments(parser)
    args = parser.parse_args(argv)
    apply_style()

    universities = institutions("university")
    names = {int(row["source_id"]): row["name"] for row in universities}
    orders = args.order or [[int(row["source_id"]) for row in universities[:2]]]
    unknown = sorted({school_id for order in orders for school_id in order if school_id not in names})
    if unknown:
        raise RuntimeError(f"unknown university school ids: {unknown}")

    variants = []
    for order in orders:
        rows = compute("choice-cost", majorSlug=args.major, schoolIds=order)
        key = "order-" + "-".join(map(str, order))
        label = " -> ".join(shorten_school(names[school_id]) for school_id in order)
        variants.append(Variant(
            key=key,
            label=label,
            state={"order": key},
            figure=render(rows, order, names, args.major),
        ))

    controls = []
    if len(variants) > 1:
        controls = [{
            "key": "order", "label": "Application order", "type": "select",
            "default": variants[0].key,
            "options": [{"value": variant.key, "label": variant.label} for variant in variants],
        }]
    deliver(
        args=args,
        slug="choice-cost",
        title="Cost of keeping choices open",
        caption=(
            "Incremental CC courses required by each additional UC campus. "
            "Run the local file again with --order to publish another intentional comparison."
        ),
        variants=variants,
        controls=controls,
        default_variant=variants[0].key,
    )


if __name__ == "__main__":
    main()
