/**
 * The pmt.py client, served at GET /client/pmt.py with the API base URL baked
 * in — partners never receive files out-of-band; the console is the only
 * distribution channel. The API tab renders this same text with Copy /
 * Download buttons (single source: this template).
 */
const pmtPy = (baseUrl) => `"""PMT Research API — starter client.

    fetch(path)               -> pandas DataFrame from any endpoint
    publish(fig, slug, title) -> share a matplotlib figure to Visuals

Set TOKEN below (or the PMT_TOKEN env var). The Endpoints tab lists the paths.
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

# dataset_version of the last fetch(); publish() stamps figures with it.
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
    """GET an endpoint -> DataFrame (list responses) or JSON (else).

    Keyword args become query params:
        fetch("/export/receivers", majorContains="computer science")
    List DataFrames carry df.attrs["dataset_version"].
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
    """Publish a matplotlib figure to the Visuals gallery.

    Renders SVG + 300-dpi PNG + PDF, stamped with the last fetch's
    dataset_version. Re-publishing the same slug replaces it.
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
# Runs on execute/paste, not on import. Read-only.

if __name__ == "__main__":
    schools = fetch("/schools")
    print("Connected. UC campuses:", [s["name"] for s in schools["uc"]])
`;

module.exports = { pmtPy };
