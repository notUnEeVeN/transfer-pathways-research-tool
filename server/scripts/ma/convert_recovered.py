#!/usr/bin/env python
"""Convert the vendored Massachusetts workbooks into deterministic raw JSON.

Reads only server/data/ma/recovered/; writes server/data/ma/raw/. Every
judgment a later stage depends on is made loudly here: the lower/upper column
boundary is solved against the tab's own ratio columns, community-college name
variants are mapped to one canonical spelling, and the counts the recon
established are asserted so silent upstream drift cannot pass.

Run: pmt-env/bin/python server/scripts/ma/convert_recovered.py
"""
import json
import math
import re
from pathlib import Path

import pandas as pd

BASE = Path(__file__).resolve().parents[2] / "data" / "ma"
RECOVERED = BASE / "recovered"
RAW = BASE / "raw"

UNIVERSITIES = [
    "Bridgewater", "Fitchburg", "Framingham", "MCLA", "Salem",
    "UMass Amherst", "UMass Boston", "UMass Dartmouth", "UMass Lowell",
    "Westfield", "Worcester",
]

# Canonical community-college names follow the Mass Heatmap row spelling; the
# AS workbook and baseline sheets abbreviate three of them.
CC_CANONICAL = [
    "Berkshire", "Bristol", "Bunker Hill", "Cape Cod", "Greenfield",
    "Holyoke", "Massasoit", "MassBay", "Middlesex", "Mount Wachusett",
    "North Shore", "Northern Essex", "Quinsigamond", "Roxbury",
    "Springfield Technical",
]
CC_ALIASES = {
    "Mass Bay": "MassBay",
    "Springfield": "Springfield Technical",
    "Wachusett": "Mount Wachusett",
    "M. Wachusett": "Mount Wachusett",
    "Mt. Wachusett": "Mount Wachusett",
}

# Pathway workbooks carry revision noise: "(REAL) X" supersedes a plain "X"
# sheet, "(FAKE) X" is a discarded draft, and Worcester holds one scratch
# sheet ("no clue lol") whose own metadata identifies no community college.
SKIP_SHEETS = {"no clue lol"}


def canon_cc(name):
    name = str(name).strip()
    if name in CC_ALIASES:
        return CC_ALIASES[name]
    assert name in CC_CANONICAL, f"unknown community college name: {name!r}"
    return name


CODE_RE = re.compile(r"\(([A-Za-z&/ ]+?)\s*(\d+[A-Za-z]*)")


def parse_code(header, column_index):
    """Course header -> (prefix, number). "Linear Algebra (MATH 120 or MATH
    202)" takes the first code; a header with no code (elective slots) gets a
    deterministic synthetic code so receivers stay distinct."""
    match = CODE_RE.search(str(header))
    if match:
        return match.group(1).strip().upper(), match.group(2).upper()
    return "SLOT", str(column_index)


def parse_heatmap():
    out = []
    for uni in UNIVERSITIES:
        df = pd.read_excel(RECOVERED / "Mass Heatmap.xlsx", uni, header=None)
        headers = df.iloc[0].tolist()
        assert headers[1] == "Lower" and headers[2] == "Upper" and headers[3] == "MT", uni
        course_cols = []
        for ci in range(4, df.shape[1]):
            if isinstance(headers[ci], str) and headers[ci].strip():
                course_cols.append(ci)
        rows = {}
        lower_ratio = {}
        all_ratio = {}
        mt = {}
        for ri in range(1, df.shape[0]):
            name = df.iat[ri, 0]
            if not isinstance(name, str) or name.strip() in ("", "Total"):
                break
            cc = canon_cc(name)
            rows[cc] = [bool(df.iat[ri, ci]) for ci in course_cols]
            lower_ratio[cc] = float(df.iat[ri, 1])
            all_ratio[cc] = float(df.iat[ri, 2])
            mt[cc] = str(df.iat[ri, 3]).strip() == "MT"
        assert set(rows) == set(CC_CANONICAL), f"{uni}: CC rows {sorted(rows)}"

        # Solve the lower/upper boundary against the tab's own Lower column.
        n = len(course_cols)
        boundary = None
        for L in range(1, n + 1):
            ok = all(
                math.isclose(sum(rows[cc][:L]) / L, lower_ratio[cc], abs_tol=1e-6)
                for cc in rows
            )
            if ok:
                boundary = L
                break
        assert boundary is not None, f"{uni}: no lower/upper boundary reproduces the Lower column"
        for cc in rows:
            assert math.isclose(sum(rows[cc]) / n, all_ratio[cc], abs_tol=1e-6), (
                f"{uni}/{cc}: all-levels ratio does not reproduce")

        courses = []
        for idx, ci in enumerate(course_cols):
            prefix, number = parse_code(headers[ci], ci)
            courses.append({
                "header": str(headers[ci]).strip(),
                "prefix": prefix,
                "number": number,
                "upper": idx >= boundary,
            })
        out.append({
            "name": uni,
            "lower_count": boundary,
            "courses": courses,
            "matrix": rows,
            "lower_ratio": lower_ratio,
            "all_ratio": all_ratio,
            "mt": mt,
        })
    return out


def parse_course_table(df):
    """Curricular Analytics table starting at the 'Course ID' header row."""
    header_row = None
    for ri in range(df.shape[0]):
        if str(df.iat[ri, 0]).strip() == "Course ID":
            header_row = ri
            break
    assert header_row is not None, "no Course ID header row"
    courses = []
    next_id = 1
    for ri in range(header_row + 1, df.shape[0]):
        cid = df.iat[ri, 0]
        name_cell = df.iat[ri, 1]
        has_name = not pd.isna(name_cell) and str(name_cell).strip()
        # Pathway tabs separate blocks with blank rows; skip separators.
        # Roxbury's AS sheet leaves the whole id column blank, so a row with
        # a name but no id is a real course and gets a sequential id.
        if pd.isna(cid) or not str(cid).strip():
            if not has_name:
                continue
            cid = next_id
        elif not str(cid).strip().replace(".", "").isdigit():
            continue  # stray footnote text in the id column
        def id_list(value):
            if pd.isna(value):
                return []
            return [int(float(x)) for x in re.split(r"[;,]", str(value)) if str(x).strip()]
        credits = df.iat[ri, 7]
        parsed_id = int(float(cid))
        next_id = max(next_id, parsed_id + 1)
        courses.append({
            "id": parsed_id,
            "name": str(df.iat[ri, 1]).strip(),
            "prefix": str(df.iat[ri, 2]).strip().upper() if not pd.isna(df.iat[ri, 2]) else "",
            "number": str(df.iat[ri, 3]).strip() if not pd.isna(df.iat[ri, 3]) else "",
            "prereqs": id_list(df.iat[ri, 4]),
            "coreqs": id_list(df.iat[ri, 5]) + id_list(df.iat[ri, 6]),
            "credits": float(credits) if not pd.isna(credits) else None,
        })
    return courses


def parse_as_degrees():
    xl = pd.ExcelFile(RECOVERED / "All CC AS.xlsx")
    out = {}
    for sheet in xl.sheet_names:
        df = pd.read_excel(RECOVERED / "All CC AS.xlsx", sheet, header=None)
        cc = canon_cc(sheet)
        meta = {str(df.iat[ri, 0]).strip(): df.iat[ri, 1] for ri in range(6)}
        out[cc] = {
            "system": str(meta.get("System Type", "semester")).strip(),
            "cip": str(meta.get("CIP", "")).strip(),
            "courses": parse_course_table(df),
        }
    assert set(out) == set(CC_CANONICAL), sorted(out)
    return out


def parse_pathways():
    out = {}
    pair_count = 0
    skipped = []
    for uni in UNIVERSITIES:
        path = RECOVERED / "All Pathways" / f"{uni}.xlsx"
        xl = pd.ExcelFile(path)
        resident_sheet = xl.sheet_names[0]
        resident = parse_course_table(pd.read_excel(path, resident_sheet, header=None))
        pairs = {}
        real = set()
        for sheet in xl.sheet_names[1:]:
            name = sheet.strip()
            if name in SKIP_SHEETS or name.upper().startswith("(FAKE)"):
                skipped.append(f"{uni}/{sheet}")
                continue
            is_real = bool(re.match(r"^\(?REAL\)?\s+", name, re.IGNORECASE))
            cc = canon_cc(re.sub(r"^\(?REAL\)?\s+", "", name, flags=re.IGNORECASE))
            if cc in pairs and not is_real:
                skipped.append(f"{uni}/{sheet} (superseded)")
                continue
            if cc in pairs and is_real and cc not in real:
                skipped.append(f"{uni}/{cc} plain sheet (superseded by REAL)")
            pairs[cc] = parse_course_table(pd.read_excel(path, sheet, header=None))
            if is_real:
                real.add(cc)
        pair_count += len(pairs)
        out[uni] = {"resident": resident, "pairs": pairs}
    print("skipped pathway sheets:", skipped)
    assert pair_count == 61, f"expected 61 deduped pairs, found {pair_count}"
    return out


def parse_baselines():
    measures = {
        "% Credit Hours": "pct_as",
        "Credit Hours": "credit_hours",
        "Curricular Complexity": "complexity",
        "Cost": "cost",
    }
    out = {}
    for sheet, key in measures.items():
        df = pd.read_excel(RECOVERED / "CurrComp Master.xlsx", sheet, header=None)
        unis = []
        for ci in range(1, df.shape[1]):
            name = df.iat[0, ci]
            if isinstance(name, str) and name.strip() in UNIVERSITIES:
                unis.append((ci, name.strip()))
        resident = {}
        cells = {}
        for ri in range(1, df.shape[0]):
            row_name = df.iat[ri, 0]
            if not isinstance(row_name, str) or not row_name.strip():
                continue
            row_name = row_name.strip()
            values = {}
            for ci, uni in unis:
                value = df.iat[ri, ci]
                if not pd.isna(value):
                    values[uni] = float(value)
            if row_name == "Resident":
                resident = values
            else:
                try:
                    cells[canon_cc(row_name)] = values
                except AssertionError:
                    continue  # footnote rows below the matrix
        out[key] = {"resident": resident, "cells": cells}
    return out


def main():
    RAW.mkdir(parents=True, exist_ok=True)
    heatmap = parse_heatmap()
    as_degrees = parse_as_degrees()
    pathways = parse_pathways()
    baselines = parse_baselines()

    # Recon anchors: silent upstream drift must fail here, not downstream.
    berkshire_total = sum(c["credits"] or 0 for c in as_degrees["Berkshire"]["courses"])
    assert berkshire_total == 65, berkshire_total
    bh_bw = sum(c["credits"] or 0 for c in pathways["Bridgewater"]["pairs"]["Bunker Hill"])
    assert bh_bw == 149, bh_bw
    assert len(heatmap) == 11 and len(as_degrees) == 15

    for name, payload in [
        ("heatmap.json", {"universities": heatmap}),
        ("as_degrees.json", as_degrees),
        ("pathways.json", pathways),
        ("baselines.json", baselines),
    ]:
        (RAW / name).write_text(json.dumps(payload, indent=1, sort_keys=True))
        print(f"wrote raw/{name}")
    print("boundaries:", {u["name"]: (u["lower_count"], len(u["courses"])) for u in heatmap})


if __name__ == "__main__":
    main()
