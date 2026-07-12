"""Load exact visual datasets through the local canonical calculation layer."""

import json
import subprocess
from functools import lru_cache
from pathlib import Path


ROOT = Path(__file__).resolve().parents[2]
RUNNER = ROOT / "server" / "scripts" / "computeVisualData.js"


@lru_cache(maxsize=32)
def _compute(command, encoded_params):
    process = subprocess.run(
        ["node", str(RUNNER), command, encoded_params],
        cwd=ROOT,
        text=True,
        capture_output=True,
        check=False,
    )
    if process.returncode:
        detail = process.stderr.strip() or process.stdout.strip() or "unknown error"
        raise RuntimeError(f"visual data calculation failed for {command}: {detail}")
    return json.loads(process.stdout)


def compute(command, **params):
    """Return one visual's rows using a stable, cacheable parameter encoding."""
    encoded = json.dumps(params, sort_keys=True, separators=(",", ":"))
    return _compute(command, encoded)


def institutions(kind=None):
    rows = compute("institutions")
    return [row for row in rows if kind is None or row.get("kind") == kind]


def shorten_school(name):
    text = str(name or "")
    for prefix in ("University of California, ", "UC "):
        if text.lower().startswith(prefix.lower()):
            text = text[len(prefix):]
            break
    return text.strip()
