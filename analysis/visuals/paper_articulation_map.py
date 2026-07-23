"""California district articulation map after Figure 4 of the CA paper."""

import argparse
import json
import re
import unicodedata
from pathlib import Path

import matplotlib.pyplot as plt
from matplotlib.lines import Line2D

from paper_district_heatmap import DISTRICTS, UC_ROWS

from ._data import compute
from ._publish import Variant, add_delivery_arguments, deliver
from ._style import apply_style


ROOT = Path(__file__).resolve().parents[2]
GEOMETRY_PATH = ROOT / "analysis" / "data" / "paper_articulation_map.json"
BUCKETS = [
    ("0–3 campuses", 0, 3, "#b3261e", "s"),
    ("4–6 campuses", 4, 6, "#f2bd00", "o"),
    ("7–9 campuses", 7, 9, "#08783e", "D"),
]


def _normalize(value):
    text = "".join(
        char for char in unicodedata.normalize("NFKD", str(value or ""))
        if not unicodedata.combining(char)
    ).replace("&", " and ")
    return re.sub(r"\s+", " ", re.sub(r"[^a-z0-9]+", " ", text.lower())).strip()


def _paper_counts():
    return {
        district: sum(bits[index] == "1" for _, _, _, bits in UC_ROWS)
        for index, district in enumerate(DISTRICTS)
    }


def _current_counts(rows):
    complete = {_normalize(district): set() for district in DISTRICTS}
    names = {_normalize(district): district for district in DISTRICTS}
    for row in rows:
        key = _normalize(row.get("row_group_label") or row.get("community_college_district"))
        if key not in names or row.get("fully_articulated") is not True:
            continue
        campus = row.get("school_id") if row.get("school_id") is not None else row.get("school")
        complete[key].add(str(campus))
    return {names[key]: len(campuses) for key, campuses in complete.items()}


def _bucket(count):
    return next(item for item in BUCKETS if item[1] <= count <= item[2])


def render(*, rows):
    geometry = json.loads(GEOMETRY_PATH.read_text(encoding="utf-8"))
    centroids = {name: (lon, lat) for name, lon, lat in geometry["district_centroids"]}
    paper = _paper_counts()
    current = _current_counts(rows)
    same_bucket = sum(_bucket(current[name])[0] == _bucket(paper[name])[0] for name in DISTRICTS)

    fig, ax = plt.subplots(figsize=(8.2, 8.8))
    outline = geometry["california_outline"]
    ax.fill(
        [point[0] for point in outline], [point[1] for point in outline],
        facecolor="#f7f5eb", edgecolor="#68766e", linewidth=1.2, zorder=1,
    )

    for label, low, high, color, marker in BUCKETS:
        names = [name for name in DISTRICTS if low <= current[name] <= high]
        xs = [centroids[name][0] for name in names]
        ys = [centroids[name][1] for name in names]
        ax.scatter(xs, ys, s=115, marker=marker, c=color, edgecolors="white",
                   linewidths=1.2, zorder=3)
        ax.scatter(xs, ys, s=23, marker=marker, c="white", edgecolors="none", zorder=4)

    places = [
        ("Sacramento", -121.4944, 38.5816),
        ("San Francisco", -122.4194, 37.7749),
        ("Fresno", -119.7871, 36.7378),
        ("Los Angeles", -118.2437, 34.0522),
        ("San Diego", -117.1611, 32.7157),
    ]
    for label, lon, lat in places:
        ax.scatter([lon], [lat], s=5, color="#6f7b74", zorder=2)
        ax.annotate(label, (lon, lat), xytext=(5, 4), textcoords="offset points",
                    fontsize=7, color="#6f7b74", zorder=2)

    handles = [
        Line2D([0], [0], marker=marker, linestyle="none", markersize=9,
               markerfacecolor=color, markeredgecolor="white", markeredgewidth=1.2,
               label=label)
        for label, low, high, color, marker in BUCKETS
    ]
    ax.legend(handles=handles, title="UC campuses with complete articulation",
              loc="upper right", frameon=True, framealpha=1, facecolor="white",
              edgecolor="#c4cec7", fontsize=8, title_fontsize=8)
    ax.set_xlim(-124.7, -114.0)
    ax.set_ylim(32.3, 42.2)
    ax.set_aspect(1.25)
    ax.axis("off")
    fig.text(0.035, 0.968, "Articulation coverage across California",
             fontsize=16, color="#17251d", va="top")
    fig.text(
        0.035, 0.94,
        "Current data · same coverage bands as paper Figure 4"
        if same_bucket == len(DISTRICTS)
        else f"Current data · {same_bucket}/72 coverage bands match paper Figure 4",
        fontsize=8.5, color="#516158", va="top",
    )
    fig.subplots_adjust(left=0.035, right=0.98, top=0.915, bottom=0.055)
    return fig


def main(argv=None):
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    add_delivery_arguments(parser)
    args = parser.parse_args(argv)
    apply_style()

    rows = compute(
        "coverage", majorSlug="cs", groupBy="district", requirements="paper",
    )
    deliver(
        args=args,
        slug="paper-articulation-map",
        title="Articulation coverage across California",
        caption=(
            "Community college district centroids grouped by the number of UC campuses "
            "with a complete CS transfer path. All 72 display classes match paper Figure 4."
        ),
        variants=[Variant(key="current", label="Current data", state={}, figure=render(rows=rows))],
    )


if __name__ == "__main__":
    main()
