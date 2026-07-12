"""Small visual conventions shared by the local Matplotlib figures."""

import matplotlib as mpl


INK = "#17202a"
MUTED = "#667085"
BORDER = "#d0d5dd"
PRIMARY = "#3366ef"
PRIMARY_LIGHT = "#dbe5ff"
NAVY = "#1a237e"
GAIN = "#0d7964"
LOSS = "#cb1d51"


def apply_style():
    mpl.rcParams.update({
        "axes.edgecolor": BORDER,
        "axes.labelcolor": INK,
        "axes.titlecolor": INK,
        "font.family": "DejaVu Sans",
        "font.size": 9,
        "text.color": INK,
        "xtick.color": MUTED,
        "ytick.color": MUTED,
        "figure.facecolor": "white",
        "axes.facecolor": "white",
        "savefig.facecolor": "white",
    })
