"""Distribution of each agreement's exact cheapest complete CC pathway."""

import argparse

from ._data import compute
from ._histogram import render_histogram
from ._publish import Variant, add_delivery_arguments, deliver
from ._style import apply_style


METRICS = {
    "courses": {"field": "min_cc_courses", "step": 1, "unit": "CC courses"},
    "units": {"field": "min_cc_units", "step": 2, "unit": "CC units"},
}


def main(argv=None):
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    parser.add_argument("--major", default="cs", help="configured major slug (default: cs)")
    add_delivery_arguments(parser)
    args = parser.parse_args(argv)
    apply_style()

    rows = compute("credit-loss", majorSlug=args.major)
    variants = []
    for key, metric in METRICS.items():
        variants.append(Variant(
            key=key,
            label=metric["unit"],
            state={"metric": key},
            figure=render_histogram(
                rows,
                field=metric["field"],
                bin_step=metric["step"],
                unit=metric["unit"],
                title=(
                    f"Agreements by cheapest-path {metric['unit'].lower()}, per campus\n"
                    f"Major: {args.major}"
                ),
            ),
        ))

    controls = [{
        "key": "metric", "label": "Metric", "type": "select", "default": "courses",
        "options": [
            {"value": "courses", "label": "Courses"},
            {"value": "units", "label": "Units"},
        ],
    }]
    deliver(
        args=args,
        slug="credit-loss",
        title="Cheapest-path credit load",
        caption=(
            "Distribution of the exact minimum CC courses or units needed to satisfy each "
            f"agreement for the configured '{args.major}' major."
        ),
        variants=variants,
        controls=controls,
        default_variant="courses",
    )


if __name__ == "__main__":
    main()
