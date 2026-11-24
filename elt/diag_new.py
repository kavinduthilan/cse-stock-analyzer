import pathlib, re, sqlite3, pdfplumber

ROOT = pathlib.Path(__file__).resolve().parent.parent / "data"
db = sqlite3.connect(ROOT / "cse.db")

for sid in (40927, 43575, 45952, 48375, 51926):
    f = ROOT / "pdfs" / f"{sid}.pdf"
    rows = db.execute("select count(*) from financials where source_id=?", (sid,)).fetchone()[0]
    print("\n=====", sid, "| rows in DB:", rows, "| size KB:", f.stat().st_size // 1024)
    with pdfplumber.open(f) as p:
        chars = [len(pg.extract_text() or "") for pg in p.pages]
        print("pages:", len(chars), "| text chars, first 12 pages:", chars[:12])
        for n, pg in enumerate(p.pages, 1):
            for line in (pg.extract_text() or "").splitlines():
                if re.search(r"earnings?\s+per\s+share|total assets|profit for the (year|period)", line, re.I):
                    print(f"  p{n}: {line.strip()[:160]}")