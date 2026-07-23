"""Associate-degree units that count toward each agreement's cheapest path."""

import argparse

import matplotlib.pyplot as plt
import numpy as np

from ._data import compute, shorten_school
from ._publish import Variant, add_delivery_arguments, deliver
from ._style import BORDER, PRIMARY, PRIMARY_LIGHT, apply_style


def render(rows, major_filter):
    rows = sorted(rows, key=lambda row: float(row.get("transfer_credit_rate_pct") or 101))
    height = max(5, 2.4 + len(rows) * 0.28)
    fig, ax = plt.subplots(figsize=(13, height))
    y = np.arange(len(rows))
    rates = np.array([float(row.get("transfer_credit_rate_pct") or 0) for row in rows])
    ax.barh(y, np.full(len(rows), 100), color=PRIMARY_LIGHT, height=0.66)
    ax.barh(y, rates, color=PRIMARY, height=0.66)
    labels = [
        f"{row.get('community_college')} -> {shorten_school(row.get('school'))}\n{row.get('assoc_degree')}"
        for row in rows
    ]
    ax.set_yticks(y, labels, fontsize=6)
    ax.invert_yaxis()
    ax.set_xlim(0, 100)
    ax.set_xlabel("Associate-degree units counting toward the transfer pathway")
    ax.set_title(f"Transfer credit rate, lowest first | Major: {major_filter}", loc="left")
    ax.spines[["top", "right", "left"]].set_visible(False)
    ax.tick_params(axis="y", length=0)
    ax.grid(axis="x", color=BORDER, linewidth=0.5)
    for index, (rate, row) in enumerate(zip(rates, rows)):
        ax.text(101, index, f"{rate:.1f}% | {float(row.get('lost_units') or 0):.1f} units lost",
                va="center", fontsize=6)
    fig.tight_layout()
    return fig


def main(argv=None):
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    parser.add_argument("--major", default="cs", help="configured major slug (default: cs)")
    add_delivery_arguments(parser)
    args = parser.parse_args(argv)
    apply_style()

    rows = compute("transfer-credit-rate", majorSlug=args.major)
    if not rows:
        raise SystemExit(
            "Transfer credit rate is not publishable yet: no curated associate-degree "
            "course lists match the agreements. Tuition is also absent, so cost estimates "
            "would be unavailable even after degree rows are added."
        )
    deliver(
        args=args,
        slug="time-to-degree",
        title="Transfer credit rate",
        caption="Associate-degree units that count toward each agreement's exact cheapest pathway.",
        variants=[Variant("current", "Current data", {}, render(rows, args.major))],
    )


if __name__ == "__main__":
    main()
