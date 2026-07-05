/**
 * The pmt.py client, served at GET /client/pmt.py with the API base URL baked
 * in — partners never receive files out-of-band; the console is the only
 * distribution channel. The API tab renders this same text with Copy /
 * Download buttons (single source: this template).
 */
const pmtPy = (baseUrl) => `"""Transfer Pathways Research API — starter client.

    get(path)                            -> pandas DataFrame from any endpoint
    publish("fig.py", slug=..., title=...) -> publish one LIVE figure

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


# dataset_version of the last get(); captured figures are stamped with it.
_last_dataset_version = None


def get(path, **params):
    """Read any endpoint into pandas.

        receivers = get("/export/receivers")
        cs_only = get("/export/receivers", majorContains="computer science")
    """
    global _last_dataset_version
    if not TOKEN or TOKEN == "pmtr_...":
        raise RuntimeError(
            "Set your API token: paste it into TOKEN at the top of this file, "
            "or set the PMT_TOKEN environment variable. Create one in the "
            "console under API -> Tokens."
        )
    r = requests.get(
        f"{API}{path}",
        headers={"Authorization": f"Bearer {TOKEN}"},
        params=params,
        timeout=120,
    )
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


fetch = get  # old scripts used fetch(); new scripts should use get().


def publish(file, slug, title, caption=None, source_url=None, enabled=True):
    """Publish one LIVE figure.

    Recommended use:
        pmt.publish("my_figure.py", slug="my-figure", title="My figure")

    The script should run top-to-bottom and leave one matplotlib Figure named
    fig. The server dry-runs it immediately, then re-runs it whenever the
    dataset changes.
    """
    if not TOKEN or TOKEN == "pmtr_...":
        raise RuntimeError(
            "Set your API token: paste it into TOKEN at the top of this file, "
            "or set the PMT_TOKEN environment variable. Create one in the "
            "console under API -> Tokens."
        )

    # The server sets PMT_CAPTURE while test-running your script. In that one
    # case, publish(fig, ...) renders the figure instead of uploading a file.
    capture = os.environ.get("PMT_CAPTURE")
    if capture:
        fig = file
        if not hasattr(fig, "savefig"):
            raise TypeError("publish() takes a matplotlib Figure inside the figure runner.")
        if os.path.exists(capture):
            raise RuntimeError("publish() was called more than once; a live script publishes exactly one figure.")
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
        with open(capture, "w") as f:
            json.dump(payload, f)
        print(f"captured '{slug}' for the figure runner")
        return {"ok": True, "slug": slug,
                "dataset_version": payload["dataset_version"], "captured": True}

    if not isinstance(file, (str, os.PathLike)):
        raise TypeError("publish() expects a .py file path, e.g. publish('my_fig.py', slug='my-fig', title='My figure').")
    if not slug or not title:
        raise TypeError("publish(path, ...) requires slug= and title=")

    with open(file, encoding="utf-8") as f:
        code = f.read()
    code += (
        "\\n\\n# Added by pmt.publish(...) so the server can capture this live figure.\\n"
        "import pmt as _pmt_live\\n"
        "_pmt_live.publish(fig, "
        f"slug={repr(slug)}, title={repr(title)}, "
        f"caption={repr(caption)}, source_url={repr(source_url)})\\n"
    )

    r = requests.post(
        f"{API}/figure-scripts",
        headers={"Authorization": f"Bearer {TOKEN}"},
        json={"code": code, "enabled": bool(enabled)},
        timeout=300,
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
        print(f"publish failed ({r.status_code}): {body.get('error') or r.text[:300]}")
        if body.get("log"):
            print("--- run log ---")
            print(body["log"])
    return body


# ── A first call, so you can confirm it works ────────────────────────────────
# Runs on execute/paste, not on import. Read-only.

if __name__ == "__main__":
    schools = get("/schools")
    print("Connected. UC campuses:", [s["name"] for s in schools["uc"]])
`;

module.exports = { pmtPy };
