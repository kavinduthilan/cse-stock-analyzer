import json
import pathlib
import requests

SYMBOL = "COCR.N0000"

API = "https://www.cse.lk/api/financials"
CDN = "https://cdn.cse.lk/"

root = pathlib.Path(__file__).resolve().parents[1] / "data"
pdf_dir = root / "pdfs"

root.mkdir(parents=True, exist_ok=True)
pdf_dir.mkdir(parents=True, exist_ok=True)

reports_file = root / f"{SYMBOL}.reports.json"

import json
import pathlib
import requests

SYMBOL = "COCR.N0000"

CDN = "https://cdn.cse.lk/"
WEBSITE = "https://www.cse.lk/"

ROOT = pathlib.Path(__file__).resolve().parents[1] / "data"
PDF_DIR = ROOT / "pdfs"

PDF_DIR.mkdir(parents=True, exist_ok=True)

reports_file = ROOT / f"{SYMBOL}.reports.json"

with open(reports_file, encoding="utf-8") as f:
    data = json.load(f)

# Create session and initialize CSE cookies
session = requests.Session()

session.headers.update({
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/130.0.0.0 Safari/537.36",
    "Referer": WEBSITE,
    "Accept": "application/pdf,*/*",
})

response = session.get(WEBSITE, timeout=30)
response.raise_for_status()

def wanted(item, annual):
    t = item.get("fileText", "").lower()
    if "errata" in t:
        return False
    if annual:
        return "audited" in t or "annual report" in t
    return "interim" in t or "quarter" in t


items = (
    [(i, True) for i in data["infoAnnualData"] if wanted(i, True)]
    +
    [(i, False) for i in data["infoQuarterlyData"] if wanted(i, False)]
)

print(f"Found {len(items)} reports")

for item, annual in items:

    report_id = item["id"]
    report_path = item["path"].strip().lstrip("/")

    # CSE PDF paths use the cmt directory
    if not report_path.startswith("cmt/"):
        report_path = "cmt/" + report_path

    url = CDN + report_path

    output = PDF_DIR / f"{report_id}.pdf"

    if output.exists() and output.stat().st_size > 0:
        print("SKIP:", report_id)
        continue

    try:
        r = session.get(url, timeout=60)
        r.raise_for_status()

        if not r.content.startswith(b"%PDF"):
            print("INVALID PDF:", report_id)
            continue

        output.write_bytes(r.content)

        print("OK:", report_id, item.get("fileText"))

    except requests.RequestException as e:
        print("FAIL:", report_id, e)

print("\nPDF download completed!")

headers = {
    "User-Agent": "Mozilla/5.0",
    "Accept": "application/json, text/plain, */*",
    "Origin": "https://www.cse.lk",
    "Referer": f"https://www.cse.lk/company-profile?symbol={SYMBOL}",
    "Content-Type": "application/x-www-form-urlencoded",
}

# ------------------------------------------------
# STEP 1: Download financial report metadata
# ------------------------------------------------

print(f"Fetching CSE financial reports for {SYMBOL}...")

try:
    response = requests.post(
        API,
        data={"symbol": SYMBOL},
        headers=headers,
        timeout=60
    )

    response.raise_for_status()
    data = response.json()

except requests.RequestException as e:
    raise RuntimeError(f"CSE API request failed: {e}")

except ValueError:
    raise RuntimeError(
        f"CSE API returned invalid JSON:\n{response.text[:1000]}"
    )

required_keys = ["infoAnnualData", "infoQuarterlyData"]

for key in required_keys:
    if key not in data:
        raise RuntimeError(
            f"Missing '{key}' in CSE API response. "
            f"Received keys: {list(data.keys())}"
        )

if not data["infoAnnualData"] and not data["infoQuarterlyData"]:
    raise RuntimeError("CSE returned no annual or quarterly reports.")

reports_file.write_text(
    json.dumps(data, indent=2),
    encoding="utf-8"
)

print("Metadata saved:", reports_file)
print("Annual reports:", len(data["infoAnnualData"]))
print("Quarterly reports:", len(data["infoQuarterlyData"]))


# ------------------------------------------------
# STEP 2: Select relevant reports
# ------------------------------------------------

def wanted(item, annual):
    text = item.get("fileText", "").lower()

    if annual:
        return "audited" in text

    return "interim" in text or "quarter" in text


items = (
    [(i, True) for i in data["infoAnnualData"] if wanted(i, True)]
    +
    [(i, False) for i in data["infoQuarterlyData"] if wanted(i, False)]
)

print("Reports selected for download:", len(items))


# ------------------------------------------------
# STEP 3: Download PDF files
# ------------------------------------------------

for item, annual in items:

    report_id = item["id"]
    report_path = item["path"].strip()

    out = pdf_dir / f"{report_id}.pdf"

    if out.exists() and out.stat().st_size > 0:
        print("Already exists:", report_id)
        continue

    url = CDN + report_path.lstrip("/")

    try:
        r = requests.get(
            url,
            headers={"User-Agent": "Mozilla/5.0"},
            timeout=60
        )

        r.raise_for_status()

        if not r.content.startswith(b"%PDF"):
            print("Invalid PDF:", report_id)
            continue

        out.write_bytes(r.content)

        print("Downloaded:", report_id, item["fileText"])

    except requests.RequestException as e:
        print("Download failed:", report_id, e)


print("\nCSE report download completed!")
