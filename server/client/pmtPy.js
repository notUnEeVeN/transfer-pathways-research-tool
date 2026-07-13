/**
 * The small Python client served from GET /api/client.py.
 *
 * Research happens on the caller's machine: get() reads the shared datasets,
 * and publish() either uploads locally rendered SVG/PNG/PDF files or names an
 * allowlisted interactive renderer already shipped with the website. No
 * partner code is sent to or run by the server.
 */
const pmtPy = (apiBaseUrl) => `"""Transfer Pathways research client.

    get(path, **params)                    -> pandas DataFrame or JSON
    publish(fig, slug=..., title=...)      -> publish one finished figure
    publish(variants=[...], ...)           -> publish named static states
    publish(visual="...", ...)             -> publish a supported interactive visual

Set TOKEN below (or the PMT_TOKEN environment variable). Static figure
rendering happens on this machine. Interactive publications send only a
validated renderer name and configuration, never executable research code.
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


def _render_formats(fig):
    """Render one matplotlib Figure into the three gallery file formats."""
    if not hasattr(fig, "savefig"):
        raise TypeError("publish() expects matplotlib Figures")
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
    return formats


def publish(fig=None, slug=None, title=None, caption=None, source_url=None,
            variants=None, controls=None, default_variant=None,
            visual=None, options=None):
    """Publish a local figure, named static states, or a supported visual.

    A variant entry is a plain dict with key, label, state, and figure fields.
    Controls describe how the website switches among those already
    rendered states; no analysis code is uploaded or executed by the server.

    A visual name selects a renderer already shipped with the website. This is
    the exact interactive path: the publication stores only its name and safe
    configuration, then the gallery mounts the same component as the built-in.

    Example state:
        {"key": "assist", "label": "ASSIST minimums",
         "state": {"minimums": "assist"}, "figure": assist_fig}

    Example interactive publication:
        publish(visual="paper-credit-loss", slug="paper-credit-loss-copy",
                title="Paper-style credit loss (published copy)")
    """
    if not TOKEN or TOKEN == "pmtr_...":
        raise RuntimeError(
            "Set PMT_TOKEN or paste a token into TOKEN. Create one in the "
            "website under API -> Tokens."
        )
    if not slug or not title:
        raise TypeError("publish(fig, ...) requires slug= and title=")

    payload = {
        "slug": slug,
        "title": title,
        "caption": caption,
        "source_url": source_url,
    }
    if visual is not None:
        if fig is not None or variants is not None:
            raise TypeError("pass visual, fig, or variants - not more than one")
        if controls is not None or default_variant is not None:
            raise TypeError("interactive visuals own their controls")
        if options is not None and not isinstance(options, dict):
            raise TypeError("options must be a dict")
        payload["visual"] = str(visual)
        if options:
            payload["options"] = options
    elif variants is None:
        if options is not None:
            raise TypeError("options is only used with visual=")
        payload["formats"] = _render_formats(fig)
    else:
        if fig is not None:
            raise TypeError("pass fig or variants, not both")
        if not isinstance(variants, (list, tuple)) or len(variants) < 2:
            raise TypeError("variants must contain at least two figure states")
        rendered = []
        for variant in variants:
            if not isinstance(variant, dict):
                raise TypeError("each variant must be a dict")
            figure = variant.get("figure")
            rendered.append({
                "key": variant.get("key"),
                "label": variant.get("label"),
                "state": variant.get("state") or {},
                "formats": _render_formats(figure),
            })
        if options is not None:
            raise TypeError("options is only used with visual=")
        payload.update({
            "variants": rendered,
            "controls": controls or [],
            "default_variant": default_variant or rendered[0]["key"],
        })

    response = requests.post(
        f"{API}/publish",
        headers={"Authorization": f"Bearer {TOKEN}"},
        json=payload,
        timeout=300,
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
    # Read-only connection check: a successful run prints the UC institutions
    # visible through the research API and never creates a gallery item.
    universities = get("assist/institutions", kind="university")
    print(universities[["institution_id", "name"]].to_string(index=False))
`;

module.exports = { pmtPy };
