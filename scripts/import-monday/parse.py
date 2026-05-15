#!/usr/bin/env python3
"""
Parse monday.com xlsx board exports into a normalized JSON structure ready
for import into Donezo. One-shot helper for the sleepofmirrors workspace.

Output is written to scripts/import-monday/parsed.json (gitignored).
Run with: python3 scripts/import-monday/parse.py <file1.xlsx> [<file2.xlsx> ...]
"""
from __future__ import annotations
import json, re, sys
from pathlib import Path
from datetime import datetime, date
import pandas as pd

# Column name → donezo cell type. None = drop.
COLUMN_TYPE_MAP = {
    "Name":                     None,   # → task.title
    "Subitems":                 None,   # monday-internal count
    "Item ID (auto generated)": None,   # monday-internal
    "Last updated":             None,   # donezo writes updated_at automatically
    "Activity Log":             None,   # donezo activity is automatic (epic 09)
    "Publisher(s)":             "tags",
    "Platforms":                "tags",
    "Writers(s)":               "tags",
    "Release Date":             "date",
    "Date Shared":              "date",
    "Date":                     "date",
    "Budget":                   "currency",
    "Priority":                 "priority",
    "Creative":                 "status",
    "Status":                   "status",
    "Method":                   "status",
    "Creative Owner":           "text",  # per user choice — store name as text
    "Owner":                    "text",
    "Link to files":            "link",
    "Working Title(s)":         "text",
    "Key(s)":                   "text",
    "Duration":                 "text",  # no native duration cell
    "BPM(s)":                   "number",
    "Text":                     "long_text",
}

HEADER_FIRST_CELLS = {"Name", "Subitems"}


def is_blank(v) -> bool:
    if v is None: return True
    if isinstance(v, float) and pd.isna(v): return True
    if isinstance(v, str) and v.strip() == "": return True
    return False


def is_footer_row(row, header: list[str] | None) -> bool:
    """
    Footer: col 0 blank AND no item id AND name column blank.
    Distinguishes from subitem rows (which also have col 0 blank but have a Name + Item ID).
    """
    if not is_blank(row[0]):
        return False
    if not any(not is_blank(v) for v in row[1:]):
        return False
    if header is not None:
        try:
            name_idx = header.index("Name")
            if not is_blank(row[name_idx]):
                return False
        except ValueError:
            pass
        try:
            id_idx = header.index("Item ID (auto generated)")
            if not is_blank(row[id_idx]):
                return False
        except ValueError:
            pass
    return True


def parse_tags(s: str) -> list[str]:
    """Split 'SOM, NGP' or 'Socials(FB,Insta,Tok)' into a flat tag list."""
    # Replace parens with commas, strip, split on commas
    s = re.sub(r"[()]", ",", s)
    parts = [p.strip() for p in s.split(",")]
    return [p for p in parts if p]


def normalize_value(col_name: str, raw):
    """Coerce a raw cell into the JSON shape downstream import expects."""
    if is_blank(raw):
        return None
    cell_type = COLUMN_TYPE_MAP.get(col_name)
    if cell_type is None:
        return None
    s = str(raw).strip() if not isinstance(raw, (datetime, date)) else None

    if cell_type == "date":
        if isinstance(raw, (datetime, date)):
            d = raw if isinstance(raw, datetime) else datetime(raw.year, raw.month, raw.day)
            return {"type": "date", "iso": d.isoformat()}
        # Some footer rows accidentally land here; ignore range strings.
        if isinstance(raw, str) and " to " in raw:
            return None
        return {"type": "date", "iso": str(raw)}

    if cell_type == "currency":
        try:
            n = float(raw)
        except (TypeError, ValueError):
            return None
        if n == 0:
            return None  # monday exports zero-budget rows; treat as empty
        return {"type": "currency", "value": n}

    if cell_type == "number":
        try:
            return {"type": "number", "value": float(raw)}
        except (TypeError, ValueError):
            return None

    if cell_type == "tags":
        return {"type": "tags", "values": parse_tags(s)}

    if cell_type in ("status", "priority"):
        return {"type": cell_type, "label": s}

    if cell_type == "link":
        return {"type": "link", "url": s, "label": s}

    if cell_type == "long_text":
        return {"type": "long_text", "text": s}

    if cell_type == "text":
        return {"type": "text", "text": s}

    return None


def parse_sheet(df: pd.DataFrame) -> dict:
    """
    Parse a single board sheet. Returns:
      { board_name, groups: [{name, items: [{title, monday_id, fields:{col_name:value}, subitems:[...]}]}],
        columns_observed: [col_name, ...] }
    """
    board_name = str(df.iat[0, 0]).strip()
    groups: list[dict] = []
    cur_group: dict | None = None
    cur_top_header: list[str] | None = None      # parent-row header (most recent)
    cur_subitem_header: list[str] | None = None  # subitem header (scoped within a group)
    columns_observed_order: list[str] = []
    seen_cols: set[str] = set()
    last_parent_item: dict | None = None

    rows = df.values.tolist()
    n_cols = df.shape[1]

    for i, row in enumerate(rows):
        # pad row to n_cols
        row = list(row) + [None] * (n_cols - len(row))

        first = row[0]
        first_str = str(first).strip() if not is_blank(first) else ""

        # board title row (row 0) and description row (row 1) — skip
        if i <= 1:
            continue

        # blank row
        if all(is_blank(v) for v in row):
            cur_subitem_header = None
            continue

        # header row
        if first_str in HEADER_FIRST_CELLS:
            header = [str(v).strip() if not is_blank(v) else "" for v in row]
            if first_str == "Subitems":
                cur_subitem_header = header
            else:
                cur_top_header = header
                cur_subitem_header = None
            for h in header:
                if h and h not in seen_cols and COLUMN_TYPE_MAP.get(h) is not None:
                    columns_observed_order.append(h)
                    seen_cols.add(h)
            continue

        # group title: col 0 has content, all others blank, no items / mid-group activity
        if first_str and all(is_blank(v) for v in row[1:]):
            cur_group = {"name": first_str, "items": []}
            groups.append(cur_group)
            cur_top_header = None
            cur_subitem_header = None
            last_parent_item = None
            continue

        # decide which header applies: subitem rows have col 0 blank
        is_subitem_row = is_blank(row[0]) and cur_subitem_header is not None
        active_header = cur_subitem_header if is_subitem_row else cur_top_header

        # footer (only when not interpretable as a subitem row)
        if not is_subitem_row and is_footer_row(row, active_header):
            continue

        if active_header is None or cur_group is None:
            continue

        title_idx = active_header.index("Name") if "Name" in active_header else 0
        monday_id_idx = active_header.index("Item ID (auto generated)") if "Item ID (auto generated)" in active_header else (
            active_header.index("Item ID") if "Item ID" in active_header else None
        )

        title = str(row[title_idx]).strip() if not is_blank(row[title_idx]) else ""
        if not title:
            continue

        monday_id = None
        if monday_id_idx is not None and not is_blank(row[monday_id_idx]):
            try:
                monday_id = str(int(row[monday_id_idx]))
            except (TypeError, ValueError):
                monday_id = str(row[monday_id_idx])

        fields: dict = {}
        for h_idx, col_name in enumerate(active_header):
            if not col_name or col_name == "Name":
                continue
            v = normalize_value(col_name, row[h_idx])
            if v is not None:
                fields[col_name] = v

        item = {"title": title, "monday_id": monday_id, "fields": fields, "subitems": []}

        if is_subitem_row:
            parent = last_parent_item or (cur_group["items"][-1] if cur_group["items"] else None)
            if parent is None:
                cur_group["items"].append(item)
            else:
                parent["subitems"].append(item)
        else:
            cur_group["items"].append(item)
            last_parent_item = item

    return {
        "board_name": board_name,
        "groups": groups,
        "columns_observed": columns_observed_order,
    }


def parse_updates_sheet(df: pd.DataFrame) -> dict:
    """Returns {item_id: [{user, created_at, content}, ...]}"""
    out: dict[str, list] = {}
    if df.shape[0] < 2:
        return out
    # row 0 = sheet title; row 1 = header
    header = [str(v).strip() if not is_blank(v) else "" for v in df.iloc[1].tolist()]
    try:
        col_id = header.index("Item ID")
        col_user = header.index("User")
        col_at = header.index("Created At")
        col_text = header.index("Update Content")
    except ValueError:
        return out
    for _, r in df.iloc[2:].iterrows():
        row = r.tolist()
        if is_blank(row[col_id]) or is_blank(row[col_text]):
            continue
        try:
            item_id = str(int(row[col_id]))
        except (TypeError, ValueError):
            item_id = str(row[col_id]).strip()
        out.setdefault(item_id, []).append({
            "user": str(row[col_user]).strip() if not is_blank(row[col_user]) else "",
            "created_at": str(row[col_at]).strip() if not is_blank(row[col_at]) else "",
            "content": str(row[col_text]).strip(),
        })
    return out


def parse_file(path: Path) -> dict:
    sheets = pd.read_excel(path, sheet_name=None, header=None)
    main = None
    updates = {}
    for name, df in sheets.items():
        if name.lower() == "updates":
            updates = parse_updates_sheet(df)
        else:
            main = parse_sheet(df)
    return {"source_file": path.name, "board": main, "updates": updates}


def main():
    files = [Path(p) for p in sys.argv[1:]]
    if not files:
        print("usage: parse.py <xlsx> [<xlsx> ...]", file=sys.stderr)
        sys.exit(2)
    out = [parse_file(f) for f in files]
    out_path = Path(__file__).parent / "parsed.json"
    out_path.write_text(json.dumps(out, indent=2, default=str))
    # Summary to stderr for sanity
    for entry in out:
        b = entry["board"]
        print(f"{entry['source_file']}: board={b['board_name']!r}  groups={len(b['groups'])}  "
              f"items={sum(len(g['items']) + sum(len(it['subitems']) for it in g['items']) for g in b['groups'])}  "
              f"cols_observed={b['columns_observed']}  updates={sum(len(v) for v in entry['updates'].values())}",
              file=sys.stderr)
    print(f"\nWrote {out_path}", file=sys.stderr)


if __name__ == "__main__":
    main()
