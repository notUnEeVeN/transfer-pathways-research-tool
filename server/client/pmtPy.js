/**
 * The pmt.py client, served at GET /client/pmt.py with the API base URL baked
 * in — partners never receive files out-of-band; the console is the only
 * distribution channel. The API tab renders this same text with Copy /
 * Download buttons (single source: this template).
 */
const pmtPy = (baseUrl) => `"""PMT Research API client.

Fetch the research data as pandas DataFrames and publish matplotlib figures
to the console's shared gallery (Data -> Analysis).

Setup (console -> API -> Tokens to create a token):

    export PMT_TOKEN=pmtr_...      # or in code:  pmt.TOKEN = "pmtr_..."

Usage:

    import pmt
    df = pmt.fetch("/analysis/coverage")             # -> DataFrame
    df = pmt.fetch("/export/receivers", majorContains="computer science")

    fig, ax = plt.subplots()
    ...
    pmt.publish(fig, slug="coverage-heatmap", title="Coverage heatmap")
"""
import base64
import io
import os

import pandas as pd
import requests

API = "${baseUrl}"
TOKEN = os.environ.get("PMT_TOKEN", "")

# The dataset version of the most recent fetch — publish() stamps figures
# with it so the gallery can tell which data a figure was computed from.
LAST_DATASET_VERSION = None

_session = requests.Session()


def _headers():
    if not TOKEN:
        raise RuntimeError(
            "No API token. Set the PMT_TOKEN environment variable or assign "
            "pmt.TOKEN = 'pmtr_...' (create one: console -> API -> Tokens)."
        )
    return {"Authorization": f"Bearer {TOKEN}"}


def fetch_json(path, **params):
    """GET an endpoint and return the raw JSON."""
    r = _session.get(f"{API}{path}", headers=_headers(), params=params, timeout=120)
    r.raise_for_status()
    return r.json()


def fetch(path, **params):
    """GET an endpoint; list responses come back as a pandas DataFrame.

    The DataFrame carries df.attrs["dataset_version"].
    """
    global LAST_DATASET_VERSION
    data = fetch_json(path, **params)
    if isinstance(data, dict) and "rows" in data:
        LAST_DATASET_VERSION = data.get("dataset_version") or LAST_DATASET_VERSION
        df = pd.DataFrame(data["rows"])
        df.attrs["dataset_version"] = data.get("dataset_version")
        return df
    if isinstance(data, list):
        return pd.DataFrame(data)
    if isinstance(data, dict):
        LAST_DATASET_VERSION = data.get("dataset_version") or LAST_DATASET_VERSION
    return data


def publish(fig, slug, title, caption=None, source_url=None):
    """Publish a matplotlib figure to the console's Analysis gallery.

    Renders SVG + 300-dpi PNG + PDF and uploads them. The whole team sees the
    figure seconds later, stamped with the dataset_version the data was
    fetched at. Re-publishing the same slug replaces the previous version.
    """
    if not hasattr(fig, "savefig"):
        raise TypeError(
            "publish() takes a matplotlib Figure. For other libraries, export "
            "an SVG/PNG yourself for now."
        )
    formats = {}
    for fmt in ("svg", "png", "pdf"):
        buf = io.BytesIO()
        kwargs = {"dpi": 300} if fmt == "png" else {}
        fig.savefig(buf, format=fmt, bbox_inches="tight", **kwargs)
        formats[fmt] = base64.b64encode(buf.getvalue()).decode("ascii")
    payload = {
        "slug": slug,
        "title": title,
        "caption": caption,
        "source_url": source_url,
        "dataset_version": LAST_DATASET_VERSION,
        "formats": formats,
    }
    r = _session.post(f"{API}/figures", headers=_headers(), json=payload, timeout=120)
    r.raise_for_status()
    out = r.json()
    version = out.get("dataset_version") or "current"
    print(f"published '{slug}' -> Data -> Analysis (dataset {version})")
    return out
`;

module.exports = { pmtPy };
