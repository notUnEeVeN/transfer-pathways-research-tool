/**
 * The small Python client served from GET /api/client.py.
 *
 * Research happens on the caller's machine: get() reads the shared datasets,
 * and publish() renders a completed matplotlib Figure locally before uploading
 * only its SVG/PNG/PDF files. No partner code is sent to or run by the server.
 */
const pmtPy = (apiBaseUrl) => `"""Transfer Pathways research client.

    get(path, **params)                    -> pandas DataFrame or JSON
    publish(fig, slug=..., title=...)      -> publish finished figure files

Set TOKEN below (or the PMT_TOKEN environment variable). Figure rendering
happens on this machine; the server receives only SVG, PNG, and PDF output.
"""
import base64
import io
import os

import pandas as pd
import requests


API = (os.environ.get("PMT_API_URL") or "${apiBaseUrl}").rstrip("/")
TOKEN = os.environ.get("PMT_TOKEN") or "pmtr_..."


def get(path, **params):
    """Read an API dataset into pandas when the response contains rows."""
    if not TOKEN or TOKEN == "pmtr_...":
        raise RuntimeError(
            "Set PMT_TOKEN or paste a token into TOKEN. Create one in the "
            "website under API -> Tokens."
        )
    url = f"{API}/{str(path).lstrip('/')}"
    response = requests.get(
        url,
        headers={"Authorization": f"Bearer {TOKEN}"},
        params=params,
        timeout=120,
    )
    response.raise_for_status()
    data = response.json()
    if isinstance(data, dict) and "rows" in data:
        return pd.DataFrame(data["rows"])
    if isinstance(data, list):
        return pd.DataFrame(data)
    return data


fetch = get  # compatibility for the earliest research notebooks


def publish(fig, slug, title, caption=None, source_url=None):
    """Render a matplotlib Figure locally and publish the finished files."""
    if not TOKEN or TOKEN == "pmtr_...":
        raise RuntimeError(
            "Set PMT_TOKEN or paste a token into TOKEN. Create one in the "
            "website under API -> Tokens."
        )
    if not hasattr(fig, "savefig"):
        raise TypeError("publish() expects a matplotlib Figure")
    if not slug or not title:
        raise TypeError("publish(fig, ...) requires slug= and title=")

    formats = {}
    for fmt in ("svg", "png", "pdf"):
        buffer = io.BytesIO()
        fig.savefig(
            buffer,
            format=fmt,
            bbox_inches="tight",
            **({"dpi": 300} if fmt == "png" else {}),
        )
        formats[fmt] = base64.b64encode(buffer.getvalue()).decode("ascii")

    response = requests.post(
        f"{API}/publish",
        headers={"Authorization": f"Bearer {TOKEN}"},
        json={
            "slug": slug,
            "title": title,
            "caption": caption,
            "source_url": source_url,
            "formats": formats,
        },
        timeout=180,
    )
    try:
        body = response.json()
    except ValueError:
        body = {}
    if not response.ok:
        raise RuntimeError(
            f"publish failed ({response.status_code}): "
            f"{body.get('error') or response.text[:300]}"
        )
    print(f"published '{body.get('slug', slug)}'")
    return body


if __name__ == "__main__":
    import matplotlib.pyplot as plt

    fig, ax = plt.subplots()
    ax.plot([1, 2, 3])
    ax.set_title("Hello figure")
    fig.tight_layout()
    publish(fig, slug="hello-figure", title="Hello figure")
`;

module.exports = { pmtPy };
