import json, pathlib, sys, requests

if len(sys.argv) < 2:
    sys.exit("usage: python download.py SYMBOL   e.g. COCR.N0000")
SYMBOL = sys.argv[1]

API = "https://www.cse.lk/api/financials"
CDN = "https://cdn.cse.lk/"
WEBSITE = "https://www.cse.lk/"

ROOT = pathlib.Path(__file__).resolve().parents[1] / "data"
PDF_DIR = ROOT / "pdfs"
PDF_DIR.mkdir(parents=True, exist_ok=True)
reports_file = ROOT / f"{SYMBOL}.reports.json"

session = requests.Session()
session.headers.update({
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/130.0.0.0 Safari/537.36",
    "Referer": WEBSITE,
})
session.get(WEBSITE, timeout=30)          # pick up CSE cookies

# 1. refresh the report list
r = session.post(
    API, data={"symbol": SYMBOL}, timeout=60,
    headers={
        "Accept": "application/json, text/plain, */*",
        "Origin": "https://www.cse.lk",
        "Referer": f"https://www.cse.lk/company-profile?symbol={SYMBOL}",
        "Content-Type": "application/x-www-form-urlencoded",
    },
)
r.raise_for_status()
data = r.json()
for k in ("infoAnnualData", "infoQuarterlyData"):
    if k not in data:
        raise RuntimeError(f"Missing {k}; got keys {list(data)}")
reports_file.write_text(json.dumps(data, indent=2), encoding="utf-8")
print(f"{SYMBOL}: annual {len(data['infoAnnualData'])}, quarterly {len(data['infoQuarterlyData'])}")

# 2. choose reports
def wanted(item, annual):
    t = item.get("fileText", "").lower()
    if "errata" in t:
        return False
    if annual:
        return "audited" in t or "annual report" in t
    return "interim" in t or "quarter" in t or "financial statement" in t

items = [i for i in data["infoAnnualData"] if wanted(i, True)] + \
        [i for i in data["infoQuarterlyData"] if wanted(i, False)]
print("Selected:", len(items))

# 3. download (existing files must be real PDFs)
def is_pdf(p):
    return p.exists() and p.stat().st_size > 0 and p.read_bytes()[:4] == b"%PDF"

for item in items:
    rid = item["id"]
    path = item["path"].strip().lstrip("/")
    out = PDF_DIR / f"{rid}.pdf"
    if is_pdf(out):
        print("SKIP:", rid)
        continue
    urls = [CDN + path] + ([CDN + "cmt/" + path] if not path.startswith("cmt/") else [])
    for url in urls:
        try:
            resp = session.get(url, timeout=60)
            if resp.ok and resp.content[:4] == b"%PDF":
                out.write_bytes(resp.content)
                print("OK:", rid, item.get("fileText"))
                break
        except requests.RequestException as e:
            print("ERR:", rid, e)
    else:
        print("FAIL:", rid, item.get("fileText"), urls[0])

print("download done")