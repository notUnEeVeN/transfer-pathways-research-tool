"""Paper Figure 1 credit-loss bars, current replications, and comparisons.

The expensive optimization remains in analysis/paper_credit_loss.py. This file
has one responsibility: turn its audited results into the exact meaningful
visual states and publish only finished files.
"""

import argparse
import json
import subprocess
import sys
from pathlib import Path

import matplotlib.pyplot as plt
import numpy as np
from matplotlib.colors import TwoSlopeNorm
from matplotlib.patches import Patch

from paper_credit_loss import CAMPUSES, PAPER_CHOICES, PAPER_GOLD
from major_pins import (
    canonical_cs_scope_fingerprint,
    canonical_cs_scope_metadata,
    canonical_json_fingerprint,
)

from ._publish import Variant, add_delivery_arguments, deliver
from ._style import GAIN, LOSS, apply_style


ANALYSIS_ROOT = Path(__file__).resolve().parents[1]
RESULTS = ANALYSIS_ROOT / "results"
WEBSITE_RESULT = RESULTS / "paper-credit-loss.ours.json"
ASSIST_RESULT = RESULTS / "paper-credit-loss.assist.json"

COLORS = {
    "requirement": "#ffd700",
    "quarter": "#fff8dc",
    "choices": ["#08306b", "#1764ab", "#4a98c9", "#94c4df"],
}
CAMPUS_NAMES = {
    "UCD": "UC Davis", "UCM": "UC Merced", "UCSD": "UC San Diego",
    "UCSB": "UC Santa Barbara", "UCLA": "UC Los Angeles", "UCB": "UC Berkeley",
    "UCSC": "UC Santa Cruz", "UCI": "UC Irvine", "UCR": "UC Riverside",
}
VERSION_LABELS = {
    "paper": "Paper baseline",
    "website": "Hand-curated minimums",
    "assist": "ASSIST minimums",
}


def _recompute(workers):
    commands = [
        [sys.executable, str(ANALYSIS_ROOT / "paper_credit_loss.py"), "--workers", str(workers)],
        [sys.executable, str(ANALYSIS_ROOT / "paper_credit_loss.py"),
         "--requirements", "assist", "--workers", str(workers)],
    ]
    for command in commands:
        subprocess.run(command, cwd=ANALYSIS_ROOT, check=True)


def _paper_result():
    return {
        "campuses": [{
            "code": campus["code"],
            "id": campus["id"],
            "requirement": {
                "semester_equiv": PAPER_GOLD[campus["code"]][0],
                "quarter_count": PAPER_GOLD[campus["code"]][1],
            },
            "choices": [
                {"order": index + 1, "transferable_average": value}
                for index, value in enumerate(PAPER_CHOICES[campus["code"]])
            ],
        } for campus in CAMPUSES],
    }


def _read_canonical_result(path):
    result = json.loads(path.read_text())
    scope = result.get("major_scope")
    if (scope != canonical_cs_scope_metadata()
            or result.get("major_scope_fingerprint") != canonical_cs_scope_fingerprint()):
        raise RuntimeError(
            f"{path.name} predates the canonical-nine CS scope. Rebuild both artifacts with "
            "`python -m visuals.paper_credit_loss --recompute --workers 8 "
            "--output-dir results/previews` before rendering or publishing."
        )
    payload = {key: value for key, value in result.items()
               if key not in {"generated_at", "artifact_fingerprint"}}
    if result.get("artifact_fingerprint") != canonical_json_fingerprint(payload):
        raise RuntimeError(f"{path.name} failed its artifact fingerprint check")
    return result


def _load_results(recompute, workers):
    if recompute or not WEBSITE_RESULT.is_file() or not ASSIST_RESULT.is_file():
        _recompute(workers)
    return {
        "paper": _paper_result(),
        "website": _read_canonical_result(WEBSITE_RESULT),
        "assist": _read_canonical_result(ASSIST_RESULT),
    }


def _bars(result):
    by_code = {row["code"]: row for row in result["campuses"]}
    out = []
    for campus in CAMPUSES:
        row = by_code[campus["code"]]
        requirement = row["requirement"]
        out.append({
            "code": campus["code"],
            "id": campus["id"],
            "semester": float(requirement["semester_equiv"]),
            "quarter": (float(requirement["quarter_count"])
                        if requirement.get("quarter_count") is not None else None),
            "choices": [float(choice["transferable_average"]) for choice in row["choices"]],
        })
    return out


def _top(row):
    return row["quarter"] if row["quarter"] is not None else row["semester"]


def _difference_matrix(live, baseline):
    values = []
    for current, prior in zip(live, baseline):
        values.append([
            _top(current) - _top(prior),
            *[value - old for value, old in zip(current["choices"], prior["choices"])],
        ])
    return np.array(values)


def render(live, *, baseline=None, labels="names", details=False):
    differences = baseline is not None
    fig = plt.figure(figsize=(16, 10.5 if details else 7.2), layout="constrained")
    grid = fig.add_gridspec(2 if details else 1, 1, height_ratios=[3.4, 1.5] if details else [1], hspace=0.38)
    ax = fig.add_subplot(grid[0])

    x = np.arange(len(live))
    width = 0.16
    offsets = np.array([-2, -1, 0, 1, 2]) * width
    all_tops = [_top(row) for row in live] + [value for row in live for value in row["choices"]]
    if baseline:
        all_tops += [_top(row) for row in baseline] + [value for row in baseline for value in row["choices"]]
    y_max = max(all_tops) * 1.22

    for index, row in enumerate(live):
        requirement_x = x[index] + offsets[0]
        ax.bar(requirement_x, row["semester"], width, color=COLORS["requirement"])
        if row["quarter"] is not None:
            cap = row["quarter"] - row["semester"]
            ax.bar(requirement_x, cap, width, bottom=row["semester"],
                   color=COLORS["quarter"], edgecolor="#111111", hatch="//", linewidth=0.5)
        values = [_top(row), *row["choices"]]
        for choice_index, value in enumerate(row["choices"]):
            ax.bar(x[index] + offsets[choice_index + 1], value, width,
                   color=COLORS["choices"][choice_index])

        for slot, value in enumerate(values):
            position = x[index] + offsets[slot]
            if differences:
                prior = [_top(baseline[index]), *baseline[index]["choices"]][slot]
                ax.bar(position, prior, width, fill=False, edgecolor="#111111",
                       linewidth=1.0, linestyle="--")
                delta = value - prior
                ax.text(position, max(value, prior) + y_max * 0.012, f"{delta:+.2f}",
                        rotation=90, ha="center", va="bottom", fontsize=6,
                        color=GAIN if delta < 0 else LOSS if delta > 0 else "#98a2b3")
            else:
                ax.text(position, value + y_max * 0.012, f"{value:.2f}", rotation=90,
                        ha="center", va="bottom", fontsize=6)

    x_labels = [
        row["id"] if labels == "paper" else CAMPUS_NAMES[row["code"]].replace("UC ", "")
        for row in live
    ]
    ax.set_xticks(x, x_labels)
    ax.set_ylabel("Number of courses")
    ax.set_xlabel("University of California")
    ax.set_ylim(0, y_max)
    ax.spines[["top", "right"]].set_visible(False)
    ax.grid(axis="y", color="#d0d5dd", linewidth=0.5)
    legend = [
        Patch(facecolor=COLORS["requirement"], label="CS/Math requirement"),
        *[Patch(facecolor=color, label=f"{index + 1}{'st' if index == 0 else 'nd' if index == 1 else 'rd' if index == 2 else 'th'} choice")
          for index, color in enumerate(COLORS["choices"])],
    ]
    if differences:
        legend.append(Patch(facecolor="none", edgecolor="#111111", linestyle="--", label="comparison level"))
    ax.legend(handles=legend, title="Choices / requirements", ncol=3,
              loc="upper right", fontsize=7, title_fontsize=8, frameon=True)

    if details:
        delta = _difference_matrix(live, baseline)
        detail_ax = fig.add_subplot(grid[1])
        maximum = max(0.01, float(np.max(np.abs(delta))))
        image = detail_ax.imshow(delta, cmap="RdBu_r", norm=TwoSlopeNorm(vmin=-maximum, vcenter=0, vmax=maximum),
                                 aspect="auto")
        detail_ax.set_xticks(range(5), ["Requirement", "1st", "2nd", "3rd", "4th"])
        detail_ax.set_yticks(range(len(live)), x_labels)
        detail_ax.set_title("Every difference in courses", loc="left", fontsize=9)
        for i in range(delta.shape[0]):
            for j in range(delta.shape[1]):
                detail_ax.text(j, i, f"{delta[i, j]:+.2f}", ha="center", va="center", fontsize=6)
        colorbar = fig.colorbar(image, ax=detail_ax, fraction=0.018, pad=0.015)
        colorbar.set_label("Courses vs comparison")

    return fig


def main(argv=None):
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    parser.add_argument("--recompute", action="store_true", help="rerun both audited optimizations")
    parser.add_argument("--workers", type=int, default=6, help="optimizer worker processes")
    add_delivery_arguments(parser)
    args = parser.parse_args(argv)
    apply_style()

    results = _load_results(args.recompute, args.workers)
    bars = {key: _bars(value) for key, value in results.items()}
    variants = []
    for labels in ("names", "paper"):
        for version in ("paper", "website", "assist"):
            variants.append(Variant(
                key=f"{version}-{labels}",
                label=VERSION_LABELS[version],
                state={"version": version, "differences": False, "details": False, "labels": labels},
                figure=render(bars[version], labels=labels),
            ))
            if version == "paper":
                continue
            baseline_key = "paper" if version == "website" else "website"
            variants.append(Variant(
                key=f"{version}-diff-{labels}",
                label=f"{VERSION_LABELS[version]} differences",
                state={"version": version, "differences": True, "details": False, "labels": labels},
                figure=render(bars[version], baseline=bars[baseline_key], labels=labels),
            ))
            variants.append(Variant(
                key=f"{version}-diff-details-{labels}",
                label=f"{VERSION_LABELS[version]} differences with matrix",
                state={"version": version, "differences": True, "details": True, "labels": labels},
                figure=render(bars[version], baseline=bars[baseline_key], labels=labels, details=True),
            ))

    controls = [
        {
            "key": "version", "label": "Version", "type": "select", "default": "paper",
            "options": [{"value": key, "label": label} for key, label in VERSION_LABELS.items()],
        },
        {"key": "differences", "label": "Show differences", "type": "toggle", "default": False},
        {"key": "details", "label": "Difference matrix", "type": "toggle", "default": False},
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
        slug="paper-credit-loss",
        title="Paper-style credit loss (Figure 1)",
        caption=(
            "CS/Math incoming-transfer requirements and average CCC courses needed at "
            "first through fourth choice, with paper, hand-curated, ASSIST, and difference states."
        ),
        variants=variants,
        controls=controls,
        default_variant="paper-names",
    )


if __name__ == "__main__":
    main()
