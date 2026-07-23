"""Curricular complexity of each exact cheapest pathway's prerequisite graph."""

import argparse

from ._data import compute
from ._histogram import render_histogram
from ._publish import Variant, add_delivery_arguments, deliver
from ._style import apply_style


def _nice_step(maximum):
    for step in (1, 2, 5, 10, 20, 50, 100):
        if maximum / step <= 24:
            return step
    return 200


def main(argv=None):
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    parser.add_argument("--major", default="cs", help="configured major slug (default: cs)")
    add_delivery_arguments(parser)
    args = parser.parse_args(argv)
    apply_style()

    rows = compute("complexity", majorSlug=args.major)
    specs = {
        "complexity": ("complexity", "Complexity score"),
        "delay": ("max_delay", "Longest prerequisite chain"),
    }
    variants = []
    for key, (field, unit) in specs.items():
        maximum = max((float(row.get(field) or 0) for row in rows), default=1)
        variants.append(Variant(
            key=key,
            label=unit,
            state={"metric": key},
            figure=render_histogram(
                rows,
                field=field,
                bin_step=_nice_step(maximum),
                unit=unit,
                title=f"Agreements by pathway {unit.lower()}, per campus\nMajor: {args.major}",
            ),
        ))

    controls = [{
        "key": "metric", "label": "Metric", "type": "select", "default": "complexity",
        "options": [
            {"value": "complexity", "label": "Complexity"},
            {"value": "delay", "label": "Max delay"},
        ],
    }]
    deliver(
        args=args,
        slug="complexity",
        title="Pathway complexity",
        caption=(
            "Curricular Analytics-style delay and blocking scores over the curated "
            f"prerequisite graph for the configured '{args.major}' major."
        ),
        variants=variants,
        controls=controls,
        default_variant="complexity",
    )


if __name__ == "__main__":
    main()
