"""Idempotent, source-first import of the two DW Tour workbooks.

Run with SUPABASE_URL and SUPABASE_SECRET_KEY in the process environment.
Only rows in the 2026-and-later portions of the workbooks are imported. The
original files are never modified. A completed file hash is never reimported.
"""

import argparse
import datetime as dt
import hashlib
import json
import os
import re
import sys
import time
import urllib.error
import urllib.parse
import urllib.request
import uuid
from pathlib import Path

import openpyxl
from openpyxl.utils import get_column_letter


ROOT = Path(__file__).resolve().parents[1]
FILES = [ROOT / "seed-data" / "NEW 2026.xlsx", ROOT / "seed-data" / "일본 수배.xlsx"]
PARSER_VERSION = "dw-2026-source-v1"
NAMESPACE = uuid.UUID("ce521b90-7fa0-47e8-8844-e2bca3212a62")
URL = os.environ.get("SUPABASE_URL", "https://tzdfqghkcrdkywnpymtj.supabase.co").rstrip("/")
KEY = os.environ.get("SUPABASE_SECRET_KEY", "")


def request(table, *, method="GET", params=None, body=None, prefer=None):
    if not KEY:
        raise RuntimeError("SUPABASE_SECRET_KEY is required")
    suffix = urllib.parse.urlencode(params or {}, safe="(),.*:")
    url = f"{URL}/rest/v1/{table}" + (f"?{suffix}" if suffix else "")
    headers = {"apikey": KEY, "Authorization": f"Bearer {KEY}", "Accept": "application/json"}
    if body is not None:
        body = json.dumps(body, ensure_ascii=False, separators=(",", ":")).encode("utf-8")
        headers["Content-Type"] = "application/json"
    if prefer:
        headers["Prefer"] = prefer
    for attempt in range(5):
        try:
            with urllib.request.urlopen(urllib.request.Request(url, data=body, headers=headers, method=method), timeout=90) as response:
                raw = response.read()
                return json.loads(raw) if raw else []
        except urllib.error.HTTPError as exc:
            detail = exc.read().decode("utf-8", errors="replace")[:500]
            if exc.code in (429, 500, 502, 503, 504) and attempt < 4:
                time.sleep(2 ** attempt)
                continue
            raise RuntimeError(f"{table}: HTTP {exc.code}: {detail}") from None
        except (TimeoutError, urllib.error.URLError) as exc:
            if attempt < 4:
                time.sleep(2 ** attempt)
                continue
            raise RuntimeError(f"{table}: {exc}") from None


def batches(items, size):
    for start in range(0, len(items), size):
        yield items[start:start + size]


def upsert(table, rows, conflict, size=100, *, ignore=False):
    if not rows:
        return []
    result = []
    preference = f"resolution={'ignore' if ignore else 'merge'}-duplicates,return=representation"
    for part in batches(rows, size):
        result.extend(request(table, method="POST", params={"on_conflict": conflict}, body=part, prefer=preference))
    return result


def normalize(value):
    if value is None:
        return None
    if isinstance(value, (dt.datetime, dt.date, dt.time)):
        return value.isoformat()
    if isinstance(value, (int, float, bool, str)):
        return str(value) if not isinstance(value, str) else value
    return str(value)


def color_info(cell):
    fill = cell.fill
    if not fill or not fill.patternType:
        return None
    color = fill.fgColor
    return (fill.patternType, color.type, color.rgb if color.type == "rgb" else None,
            color.theme if color.type == "theme" else None,
            color.indexed if color.type == "indexed" else None, color.tint)


def selected_rows(book_name, sheet):
    name = sheet.title
    if book_name == "NEW 2026.xlsx":
        starts = {"9월 1일": 1, "2025 MAR": 679, "KDS": 1, "Monkey": 30,
                  "THE CLARK TOUR": 30, "CLARK GOGO": 1, "GOLDEN RIVER": 1, "취소": 1}
    else:
        starts = {"2025 0820 시작": 18, "cancle": 17}
    first = starts.get(name)
    if first is None:
        raise RuntimeError(f"Unrecognized sheet: {book_name} / {name}")
    result = {1, 2}  # column labels and workbook context
    substantive_rows = {
        cell.row for cell in sheet._cells.values()
        if (cell.value is not None and cell.data_type != "f") or cell.comment
    }
    for row_no in range(first, sheet.max_row + 1):
        if row_no in substantive_rows:
            result.add(row_no)
    return sorted(result)


def sheet_metadata(sheet, batch_id, index, book):
    conditional = []
    for item in sheet.conditional_formatting:
        conditional.append(str(item))
    return {
        "id": str(uuid.uuid5(NAMESPACE, f"{batch_id}/sheet/{index}")), "batch_id": batch_id,
        "sheet_index": index, "sheet_name": sheet.title, "dimensions": sheet.calculate_dimension(),
        "merges_json": [str(x) for x in sheet.merged_cells.ranges],
        "hidden_rows_json": [i for i, d in sheet.row_dimensions.items() if d.hidden],
        "hidden_cols_json": [i for i, d in sheet.column_dimensions.items() if d.hidden],
        "conditional_formats_json": conditional,
        "theme_json": {"source": book, "theme_xml": (sheet.parent.loaded_theme or b"").decode("utf-8", "replace")},
    }


def extract_sheet(sheet, cached, sheet_id, row_numbers):
    selected = set(row_numbers)
    # _cells is sparse and includes comments on blank cells.
    cells_by_row = {}
    for cell in sheet._cells.values():
        if cell.row in selected:
            cells_by_row.setdefault(cell.row, []).append(cell)
    source_rows, source_cells, styles = [], [], []
    max_column = sheet.max_column
    for row_no in row_numbers:
        row_id = str(uuid.uuid5(NAMESPACE, f"{sheet_id}/row/{row_no}"))
        row_cells = sorted(cells_by_row.get(row_no, []), key=lambda c: c.column)
        original = {}
        for cell in row_cells:
            if cell.value is None and not cell.comment:
                continue
            value = normalize(cell.value)
            cached_value = normalize(cached[cell.coordinate].value) if cell.data_type == "f" else None
            if value is not None:
                original[get_column_letter(cell.column)] = value if cell.data_type != "f" else (cached_value or value)
            source_cells.append({
                "id": str(uuid.uuid5(NAMESPACE, f"{row_id}/cell/{cell.coordinate}")),
                "row_id": row_id, "coordinate": cell.coordinate,
                "value_type": cell.data_type, "raw_value": None if cell.data_type == "f" else value,
                "formula": value if cell.data_type == "f" else None,
                "cached_value": cached_value,
                "comment_text": cell.comment.text if cell.comment else None,
                "comment_author": cell.comment.author if cell.comment else None,
                "style_ref": str(cell.style_id),
            })
        row_json = json.dumps(original, sort_keys=True, ensure_ascii=False)
        row_kind = "header" if row_no in (1, 2) else "data"
        if not original and any(cell.comment for cell in row_cells):
            row_kind = "comment_only"
        source_rows.append({"id": row_id, "sheet_id": sheet_id, "row_no": row_no,
                            "row_kind": row_kind, "original_json": original,
                            "row_hash": hashlib.sha256(row_json.encode()).hexdigest()})
        # Preserve direct fills, including filled empty cells, as compact runs.
        active = None
        for col in range(1, max_column + 2):
            info = color_info(sheet.cell(row_no, col)) if col <= max_column else None
            if info != active:
                if active is not None:
                    start = run_start
                    end = col - 1
                    styles.append({
                        "id": str(uuid.uuid5(NAMESPACE, f"{sheet_id}/fill/{row_no}/{start}/{end}/{active}")),
                        "sheet_id": sheet_id,
                        "range_ref": f"{get_column_letter(start)}{row_no}:{get_column_letter(end)}{row_no}",
                        "fill_pattern": active[0], "color_type": active[1], "rgb": active[2],
                        "theme": active[3], "indexed": active[4], "tint": active[5],
                        "source_order": row_no * 100 + start,
                    })
                active = info
                run_start = col
    return source_rows, source_cells, styles


CODE_DATE = re.compile(r"(?:^|[A-Z]+)(\d{2})(\d{2})-[A-Z0-9+]", re.I)


def reservation_date(code, year):
    match = CODE_DATE.search(code or "")
    if not match:
        return None
    try:
        return dt.date(year, int(match.group(1)), int(match.group(2))).isoformat()
    except ValueError:
        return None


def integer_or_none(value):
    if isinstance(value, (int, float)) and value >= 0 and int(value) == value:
        return int(value)
    return None


def add_business_rows(book_name, sheet, sheet_id, row_numbers, market_ids,
                      reservations, links, vouchers, cash, itinerary):
    for row_no in row_numbers:
        if row_no in (1, 2):
            continue
        row_id = str(uuid.uuid5(NAMESPACE, f"{sheet_id}/row/{row_no}"))
        title = sheet.title
        if book_name == "NEW 2026.xlsx" and title == "2025 MAR":
            code = str(sheet[f"F{row_no}"].value or "").strip()
            year = 2027 if row_no >= 1423 else 2026
            date = reservation_date(code, year)
            if not date:
                continue
            rid = str(uuid.uuid5(NAMESPACE, f"{row_id}/reservation"))
            reservations.append({"id": rid, "market_id": market_ids["PH"], "reservation_code": code,
                                 "original_code": code,
                                 "code_entry_mode": "imported", "start_date": date,
                                 "pax": integer_or_none(sheet[f"G{row_no}"].value),
                                 "review_state": "candidate"})
            links.append({"reservation_id": rid, "source_row_id": row_id, "link_state": "candidate",
                          "evidence_json": {"method": "source_row_and_code_date", "coordinate": f"F{row_no}"}})
            for col in ("O", "R", "U", "X", "AA"):
                cell = sheet[f"{col}{row_no}"]
                if cell.value is not None and cell.data_type != "f":
                    itinerary.append({"id": str(uuid.uuid5(NAMESPACE, f"{rid}/itinerary/{col}")),
                                      "reservation_id": rid, "item_type": "raw",
                                      "detail_raw": normalize(cell.value), "sort_order": len(itinerary)})
        elif book_name == "일본 수배.xlsx" and title == "2025 0820 시작":
            code = str(sheet[f"G{row_no}"].value or "").strip()
            year = 2027 if row_no >= 430 else 2026
            date = reservation_date(code, year)
            if not date:
                continue
            rid = str(uuid.uuid5(NAMESPACE, f"{row_id}/reservation"))
            reservations.append({"id": rid, "market_id": market_ids["JP"], "reservation_code": code,
                                 "original_code": code,
                                 "code_entry_mode": "imported", "start_date": date,
                                 "lead_name_raw": normalize(sheet[f"F{row_no}"].value),
                                 "pax": integer_or_none(sheet[f"H{row_no}"].value),
                                 "review_state": "candidate"})
            links.append({"reservation_id": rid, "source_row_id": row_id, "link_state": "candidate",
                          "evidence_json": {"method": "source_row_and_code_date", "coordinate": f"G{row_no}"}})
            for col in ("P", "Q", "R", "S"):
                cell = sheet[f"{col}{row_no}"]
                if cell.value is not None:
                    itinerary.append({"id": str(uuid.uuid5(NAMESPACE, f"{rid}/itinerary/{col}")),
                                      "reservation_id": rid, "item_type": "raw",
                                      "detail_raw": normalize(cell.value), "sort_order": len(itinerary)})
        elif book_name == "NEW 2026.xlsx" and title in ("KDS", "Monkey", "THE CLARK TOUR", "CLARK GOGO", "GOLDEN RIVER"):
            code = normalize(sheet[f"E{row_no}"].value)
            name = normalize(sheet[f"F{row_no}"].value)
            if code is None and name is None:
                continue
            vouchers.append({"id": str(uuid.uuid5(NAMESPACE, f"{row_id}/voucher")),
                             "source_row_id": row_id, "original_code": code,
                             "name_raw": name, "pax_raw": normalize(sheet[f"G{row_no}"].value),
                             "payment_raw": normalize(sheet[f"C{row_no}"].value),
                             "review_state": "candidate"})
        elif book_name == "NEW 2026.xlsx" and title == "9월 1일":
            for currency, first_col in (("PHP", 1), ("KRW", 8)):
                date_value = sheet.cell(row_no, first_col).value
                if not isinstance(date_value, (dt.date, dt.datetime)) or date_value.year < 2026:
                    continue
                inflow = sheet.cell(row_no, first_col + 2).value
                outflow = sheet.cell(row_no, first_col + 3).value
                cash.append({"id": str(uuid.uuid5(NAMESPACE, f"{row_id}/cash/{currency}")),
                             "market_id": market_ids["PH"], "currency": currency,
                             "source_row_id": row_id, "transacted_on": date_value.date().isoformat() if isinstance(date_value, dt.datetime) else date_value.isoformat(),
                             "description_raw": normalize(sheet.cell(row_no, first_col + 1).value),
                             "inflow": inflow if isinstance(inflow, (int, float)) else None,
                             "outflow": outflow if isinstance(outflow, (int, float)) else None,
                             "balance_raw": sheet.cell(row_no, first_col + 4).value if isinstance(sheet.cell(row_no, first_col + 4).value, (int, float)) else None,
                             "sort_order": row_no})


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--dry-run", action="store_true")
    args = parser.parse_args()
    if not args.dry_run and not KEY:
        parser.error("SUPABASE_SECRET_KEY is missing")
    markets = {x["code"]: x["id"] for x in request("markets", params={"select": "id,code"})} if not args.dry_run else {"PH": "dry", "JP": "dry"}
    for path in FILES:
        digest = hashlib.sha256(path.read_bytes()).hexdigest()
        batch_id = str(uuid.uuid5(NAMESPACE, f"{digest}/{PARSER_VERSION}"))
        if not args.dry_run:
            existing = request("import_batches", params={"select": "id,state", "id": f"eq.{batch_id}"})
            if existing and existing[0]["state"] == "complete":
                print(f"{path.name}: already complete, skipped", flush=True)
                continue
            upsert("import_batches", [{"id": batch_id, "source_file_name": path.name, "file_hash": digest,
                                       "parser_version": PARSER_VERSION, "state": "pending"}], "id")
        workbook = openpyxl.load_workbook(path, data_only=False)
        cached = openpyxl.load_workbook(path, data_only=True)
        all_reservations, all_links, all_vouchers, all_cash, all_itinerary = [], [], [], [], []
        totals = {"sheets": 0, "rows": 0, "cells": 0, "comments": 0, "style_regions": 0}
        for index, sheet in enumerate(workbook.worksheets):
            sheet_id = str(uuid.uuid5(NAMESPACE, f"{batch_id}/sheet/{index}"))
            row_numbers = selected_rows(path.name, sheet)
            source_rows, source_cells, styles = extract_sheet(sheet, cached[sheet.title], sheet_id, row_numbers)
            add_business_rows(path.name, sheet, sheet_id, row_numbers, markets,
                              all_reservations, all_links, all_vouchers, all_cash, all_itinerary)
            print(f"{path.name} / {sheet.title}: {len(source_rows)} rows, {len(source_cells)} cells, "
                  f"{sum(bool(c['comment_text']) for c in source_cells)} comments", flush=True)
            totals["sheets"] += 1
            totals["rows"] += len(source_rows)
            totals["cells"] += len(source_cells)
            totals["comments"] += sum(bool(c["comment_text"]) for c in source_cells)
            totals["style_regions"] += len(styles)
            if args.dry_run:
                continue
            upsert("source_sheets", [sheet_metadata(sheet, batch_id, index, path.name)], "id")
            upsert("source_rows", source_rows, "id")
            upsert("source_cells", source_cells, "id", size=100)
            # Styles have deterministic IDs; reruns cannot duplicate them.
            upsert("source_style_regions", styles, "id", size=100)
        totals.update({"reservations": len(all_reservations), "vouchers": len(all_vouchers),
                       "cash": len(all_cash), "itinerary": len(all_itinerary)})
        if not args.dry_run:
            upsert("reservations", all_reservations, "id", ignore=True)
            upsert("reservation_sources", all_links, "reservation_id,source_row_id", ignore=True)
            upsert("voucher_sheet_entries", all_vouchers, "id", ignore=True)
            upsert("cash_transactions", all_cash, "id", ignore=True)
            upsert("itinerary_items", all_itinerary, "id", ignore=True)
            request("import_batches", method="PATCH", params={"id": f"eq.{batch_id}"},
                    body={"state": "complete", "counts_json": totals}, prefer="return=minimal")
        print(f"{path.name}: {json.dumps(totals, ensure_ascii=False)}", flush=True)


if __name__ == "__main__":
    try:
        main()
    except Exception as exc:
        print(f"IMPORT FAILED: {exc}", file=sys.stderr)
        raise SystemExit(1)
