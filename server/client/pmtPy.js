/**
 * The pmt.py client, served at GET /client/pmt.py with the API base URL baked
 * in — partners never receive files out-of-band; the console is the only
 * distribution channel. The API tab renders this same text with Copy /
 * Download buttons (single source: this template).
 */
const pmtPy = (baseUrl) => `"""PMT Research API — starter client.

Everything you need to work with the research data from your own notebook or
script. Two functions:

    fetch(path)                     -> pandas DataFrame from any endpoint
    publish(fig, slug, title)       -> share a matplotlib figure with the team

Quick start
-----------
1.  Create a token in the console: API -> Tokens.
2.  Paste it into TOKEN below (or set the PMT_TOKEN environment variable).
3.  Use it two ways, whichever you prefer:
        - keep this file next to your notebook, "import pmt", then call
          pmt.fetch(...) / pmt.publish(...)
        - or paste this whole file into a cell and call fetch(...) / publish(...)

    df = fetch("/export/receivers")                 # one row per requirement
    df = fetch("/export/receivers", majorContains="computer science")
    # ... ordinary pandas + matplotlib ...
    publish(fig, slug="coverage-by-campus", title="Coverage by campus")

The Endpoints tab lists every path you can pass to fetch().
"""
import base64
import io
import os

import pandas as pd
import requests

# ── Configuration ────────────────────────────────────────────────────────────

API = "${baseUrl}"

# Paste your token here (console -> API -> Tokens), or set the PMT_TOKEN env var.
TOKEN = os.environ.get("PMT_TOKEN") or "pmtr_..."


# ── Reading data ─────────────────────────────────────────────────────────────

_session = requests.Session()

# dataset_version of the most recent fetch(); publish() stamps figures with it
# so the gallery knows which snapshot of the data a figure was built from.
_last_dataset_version = None


def _auth_headers():
    if not TOKEN or TOKEN == "pmtr_...":
        raise RuntimeError(
            "Set your API token: paste it into TOKEN at the top of this file, "
            "or set the PMT_TOKEN environment variable. Create one in the "
            "console under API -> Tokens."
        )
    return {"Authorization": f"Bearer {TOKEN}"}


def fetch(path, **params):
    """GET an endpoint and return a pandas DataFrame.

    The path is any endpoint from the Endpoints tab (e.g. "/export/receivers").
    Extra keyword arguments become query parameters:

        fetch("/export/receivers", majorContains="computer science")

    List responses come back as a DataFrame carrying df.attrs["dataset_version"];
    other shapes (e.g. /data/summary) are returned as plain JSON.
    """
    global _last_dataset_version
    r = _session.get(f"{API}{path}", headers=_auth_headers(), params=params, timeout=120)
    r.raise_for_status()
    data = r.json()

    if isinstance(data, dict) and "rows" in data:
        _last_dataset_version = data.get("dataset_version") or _last_dataset_version
        df = pd.DataFrame(data["rows"])
        df.attrs["dataset_version"] = data.get("dataset_version")
        return df
    if isinstance(data, list):
        return pd.DataFrame(data)
    return data


# ── Sharing a figure ─────────────────────────────────────────────────────────

def publish(fig, slug, title, caption=None, source_url=None):
    """Publish a matplotlib figure to the shared Visuals gallery.

    Renders SVG + 300-dpi PNG + PDF and uploads them; the whole team sees the
    figure within seconds, stamped with the dataset_version the data was
    fetched at. Re-publishing the same slug replaces the previous version.

        publish(fig, slug="coverage-by-campus", title="Coverage by campus")
    """
    if not hasattr(fig, "savefig"):
        raise TypeError("publish() takes a matplotlib Figure.")
    formats = {}
    for fmt in ("svg", "png", "pdf"):
        buf = io.BytesIO()
        fig.savefig(buf, format=fmt, bbox_inches="tight",
                    **({"dpi": 300} if fmt == "png" else {}))
        formats[fmt] = base64.b64encode(buf.getvalue()).decode("ascii")
    payload = {
        "slug": slug,
        "title": title,
        "caption": caption,
        "source_url": source_url,
        "dataset_version": _last_dataset_version,
        "formats": formats,
    }
    r = _session.post(f"{API}/figures", headers=_auth_headers(), json=payload, timeout=120)
    r.raise_for_status()
    out = r.json()
    print(f"published '{slug}' -> Visuals (dataset {out.get('dataset_version') or 'current'})")
    return out


# ── A first call, so you can confirm it works ────────────────────────────────
# Runs when you execute this file directly, or paste it into a cell — not when
# you "import pmt". It only reads data; it never publishes.

if __name__ == "__main__":
    schools = fetch("/schools")                 # -> {"uc": [{id, name}, ...]}
    print("Connected. UC campuses:", [s["name"] for s in schools["uc"]])

    # fetch() returns a DataFrame for list endpoints — try another:
    colleges = fetch("/community-colleges")     # -> DataFrame of { id, name }
    print(f"{len(colleges)} community colleges, e.g.:")
    print(colleges.head())
`;

module.exports = { pmtPy };
