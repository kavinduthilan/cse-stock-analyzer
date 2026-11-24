
import requests
import json
import pathlib

SYMBOL = "COCR.N0000"
ROOT = pathlib.Path(__file__).resolve().parents[1] / "data"

with open(ROOT / f"{SYMBOL}.reports.json", encoding="utf-8") as f:
    data = json.load(f)

item = data["infoAnnualData"][0]

pdf_path = item["path"].strip()

if pdf_path.startswith("upload_report_file/"):
    pdf_path = "cmt/" + pdf_path

url = "https://cdn.cse.lk/" + pdf_path.lstrip("/")

session = requests.Session()

# Establish a session with CSE first
session.get(
    "https://www.cse.lk/",
    headers={"User-Agent": "Mozilla/5.0"},
    timeout=30
)

headers = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/130.0.0.0 Safari/537.36",
    "Referer": "https://www.cse.lk/",
    "Accept": "application/pdf,*/*",
}

response = session.get(url, headers=headers, timeout=60)

print("Report ID:", item["id"])
print("PDF URL:", url)
print("Status:", response.status_code)
print("Content Type:", response.headers.get("Content-Type"))
print("Response:", response.text[:300] if response.status_code != 200 else "PDF received")

if response.status_code == 200 and response.content.startswith(b"%PDF"):
    output = ROOT / "pdfs" / "test.pdf"
    output.parent.mkdir(exist_ok=True)
    output.write_bytes(response.content)
    print("SUCCESS:", output)
