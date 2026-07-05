/**
 * The pmt.py client, served at GET /client/pmt.py with the API base URL baked
 * in — partners never receive files out-of-band; the console is the only
 * distribution channel. The API tab renders this same text with Copy /
 * Download buttons (single source: this template).
 */
const pmtPy = (baseUrl) => `"""Transfer Pathways Research API — starter client.

    fetch(path)               -> pandas DataFrame from any endpoint
    publish(fig, slug, title) -> share a matplotlib figure to Visuals
    publish_script("fig.py")  -> make that figure LIVE: the server re-runs the
                                 script whenever the dataset changes

Set TOKEN below (or the PMT_TOKEN env var). The Endpoints tab lists the paths.
"""
import base64
import io
import json
import os

import pandas as pd
import requests

# ── Configuration ────────────────────────────────────────────────────────────

# PMT_API_URL is set by the server's figure runner so published scripts talk to
# the local API; on your machine the baked-in URL is used.
API = os.environ.get("PMT_API_URL") or "${baseUrl}"

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

    # Inside the server's figure runner, publish() hands the rendered figure to
    # the runner instead of POSTing — same script, both environments.
    capture = os.environ.get("PMT_CAPTURE")
    if capture:
        if os.path.exists(capture):
            raise RuntimeError(
                "publish() was called more than once — a live script publishes "
                "exactly one figure. Split extra figures into their own scripts."
            )
        with open(capture, "w") as f:
            json.dump(payload, f)
        print(f"captured '{slug}' for the figure runner")
        # mirror the server response shape so code written against the
        # laptop path behaves identically in the sandbox
        return {"ok": True, "slug": slug,
                "dataset_version": payload["dataset_version"], "captured": True}

    r = _session.post(f"{API}/figures", headers=_auth_headers(), json=payload, timeout=120)
    r.raise_for_status()
    out = r.json()
    print(f"published '{slug}' -> Visuals (dataset {out.get('dataset_version') or 'current'})")
    return out


def publish_script(path, enabled=True):
    """Publish a script as a LIVE figure.

    The server dry-runs the file in its sandbox right now (against your data
    scope) and, if it works, publishes the figure it produced and re-runs the
    script automatically whenever the dataset changes. Requirements: the file
    must be self-contained (runs top-to-bottom), import pmt, take its token
    from the environment, and call pmt.publish() exactly once. Available
    packages: pandas, numpy, matplotlib, requests.
    """
    with open(path, encoding="utf-8") as f:
        code = f.read()
    r = _session.post(
        f"{API}/figure-scripts",
        headers=_auth_headers(),
        json={"code": code, "enabled": bool(enabled)},
        timeout=300,  # the dry-run happens synchronously
    )
    try:
        body = r.json()
    except ValueError:
        body = {}
    if r.ok and body.get("ok"):
        secs = (body.get("duration_ms") or 0) / 1000
        print(
            f"published '{body.get('slug')}' as LIVE (ran in {secs:.1f}s, "
            f"dataset {body.get('dataset_version') or 'current'})"
        )
    else:
        print(f"publish_script failed ({r.status_code}): {body.get('error') or r.text[:300]}")
        if body.get("log"):
            print("--- run log ---")
            print(body["log"])
    return body


# ── A first call, so you can confirm it works ────────────────────────────────
# Runs on execute/paste, not on import. Read-only.

if __name__ == "__main__":
    schools = fetch("/schools")
    print("Connected. UC campuses:", [s["name"] for s in schools["uc"]])
`;

module.exports = { pmtPy };
