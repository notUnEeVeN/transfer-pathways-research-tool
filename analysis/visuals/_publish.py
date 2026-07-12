"""Shared delivery helpers; all rendering remains on the researcher's device."""

import importlib.util
import os
from dataclasses import dataclass
from pathlib import Path


@dataclass(frozen=True)
class Variant:
    key: str
    label: str
    state: dict
    figure: object


def _load_client(explicit_path=None):
    candidates = [explicit_path, os.environ.get("PMT_CLIENT")]
    candidates.extend([Path.cwd() / "starter.py", Path.cwd() / "pmt.py"])
    path = next((Path(item).expanduser() for item in candidates if item and Path(item).expanduser().is_file()), None)
    if path is None:
        raise RuntimeError(
            "Download the current client from the website's API tab, then pass "
            "--client PATH or set PMT_CLIENT."
        )
    spec = importlib.util.spec_from_file_location("pmt_publisher", path)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


def add_delivery_arguments(parser):
    parser.add_argument("--publish", action="store_true", help="publish finished files to the team gallery")
    parser.add_argument("--client", type=Path, help="downloaded current pmt.py/starter.py client")
    parser.add_argument("--output-dir", type=Path, help="also save one preview PNG per state")


def deliver(*, args, slug, title, caption, variants, controls=None, default_variant=None,
            source_url=None):
    """Save previews and/or publish an already-rendered set of figure states."""
    variants = list(variants)
    if not variants:
        raise ValueError("at least one rendered variant is required")

    if args.output_dir:
        args.output_dir.mkdir(parents=True, exist_ok=True)
        for variant in variants:
            variant.figure.savefig(
                args.output_dir / f"{slug}-{variant.key}.png",
                dpi=200,
                bbox_inches="tight",
            )

    if args.publish:
        client = _load_client(args.client)
        if len(variants) == 1:
            client.publish(
                variants[0].figure,
                slug=slug,
                title=title,
                caption=caption,
                source_url=source_url,
            )
        else:
            client.publish(
                slug=slug,
                title=title,
                caption=caption,
                source_url=source_url,
                variants=[{
                    "key": variant.key,
                    "label": variant.label,
                    "state": variant.state,
                    "figure": variant.figure,
                } for variant in variants],
                controls=controls or [],
                default_variant=default_variant or variants[0].key,
            )

    if not args.publish and not args.output_dir:
        raise RuntimeError("choose --publish, --output-dir, or both")
