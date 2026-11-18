"""Read-only count check for the imported 2026 workbook records."""

import json
import urllib.parse
import urllib.request
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
values = {}
for line in (ROOT / ".env").read_text(encoding="utf-8").splitlines():
    if "=" in line and not line.lstrip().startswith("#"):
        name, value = line.split("=", 1)
        values[name.strip()] = value.strip().strip('"')
url = values["VITE_SUPABASE_URL"].rstrip("/")
key = values["VITE_SUPABASE_ANON_KEY"]
headers = {"apikey": key, "Authorization": f"Bearer {key}"}


def query(table, *, method="GET", params=None, count=False):
    query_string = urllib.parse.urlencode(params or {}, safe="(),.*:")
    request = urllib.request.Request(
        f"{url}/rest/v1/{table}?{query_string}", method=method,
        headers={**headers, **({"Prefer": "count=exact"} if count else {})},
    )
    with urllib.request.urlopen(request, timeout=30) as response:
        if count:
            return int(response.headers["Content-Range"].rsplit("/", 1)[1])
        return json.load(response)


batches = query("import_batches", params={"select": "source_file_name,state,counts_json",
                                             "source_file_name": "in.(NEW 2026.xlsx,일본 수배.xlsx)"})
print("batches", [(row["source_file_name"], row["state"], row["counts_json"]) for row in batches])
for table in ("source_sheets", "source_rows", "source_cells", "source_style_regions",
              "reservations", "reservation_sources", "voucher_sheet_entries",
              "cash_transactions", "itinerary_items"):
    column = "reservation_id" if table == "reservation_sources" else "id"
    print(table, query(table, method="HEAD", params={"select": column, "limit": "1"}, count=True))
print("cells_with_comments", query("source_cells", method="HEAD",
                                   params={"select": "id", "comment_text": "not.is.null", "limit": "1"}, count=True))
