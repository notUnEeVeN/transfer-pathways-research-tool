#!/usr/bin/env python
"""Re-extract the Figure 3 tally tab's typed fractions from the FINAL workbook.

Every Figure 3 cell is a formula over literal numbers — `=62/65` — with no
reference to any other tab. The numerator is a hand COUNT of transferred
credits, the denominator a hand-typed associate-degree total. Recording them
verbatim is what lets `pdfReconciliation.js` separate three different failures:
a numerator that drifted from its own pathway tab, a denominator that disagrees
with the associate-degree sheet, and a printed value that matches neither.

The artifact was previously produced from `recovered/CurrComp Master.xlsx` and
went stale the moment `final/` arrived: Massasoit x UMass Dartmouth is `=35/65`
in the old workbook and `=62/65` in the final one, so every verdict on that row
was drawn against a superseded numerator.

Run: pmt-env/bin/python server/scripts/ma/dump_pct_fractions.py
"""
import json
import re
from pathlib import Path

import openpyxl

BASE = Path(__file__).resolve().parents[2] / "data" / "ma"
BOOK = BASE / "final" / "Pathways Master.xlsx"
OUT = BASE / "pct-as-fractions.json"

FRACTION = re.compile(r"^=\s*(\d+(?:\.\d+)?)\s*/\s*(\d+(?:\.\d+)?)\s*$")


def main():
    formulas = openpyxl.load_workbook(BOOK, data_only=False)["% Credit Hours"]
    values = openpyxl.load_workbook(BOOK, data_only=True)["% Credit Hours"]
    cols = {str(formulas.cell(1, c).value).strip(): c
            for c in range(2, 13) if formulas.cell(1, c).value}
    out = {}
    typed = fractions = 0
    for r in range(2, 18):
        label = formulas.cell(r, 1).value
        if not isinstance(label, str):
            continue
        row = {}
        for uni, c in cols.items():
            raw = formulas.cell(r, c).value
            if raw is None:
                continue
            match = FRACTION.match(str(raw)) if isinstance(raw, str) else None
            if match:
                fractions += 1
                # Keys are `n`/`d` because pdfReconciliation.js reads them by
                # those names; renaming them silently emptied its denominator
                # audit rather than failing.
                row[uni] = {"n": float(match.group(1)), "d": float(match.group(2))}
            else:
                typed += 1
                row[uni] = {"literal": values.cell(r, c).value}
        if row:
            out[label.strip()] = row
    OUT.write_text(json.dumps(out, indent=1, sort_keys=True) + "\n")
    print(f"wrote {OUT.name}: {fractions} typed fractions, {typed} plain values")


if __name__ == "__main__":
    main()
