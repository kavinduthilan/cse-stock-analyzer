import json, re, sqlite3, pathlib, datetime as dt
import pdfplumber

import sys
if len(sys.argv) < 2:
    sys.exit("usage: python extract.py SYMBOL   e.g. COCR.N0000")
SYMBOL = sys.argv[1]


BASIS = "company"            # "company" or "group": which set of columns you want
HERE = pathlib.Path(__file__).resolve().parent
ROOT = HERE.parent / "data"

# Files whose header can't be read: source_id -> index of the wanted column in the row
# (check the "eps_nums=" printout, then add entries here). Example: {52232: 2}
FORCE_COL = {}

db = sqlite3.connect(ROOT / "cse.db")
db.execute("""CREATE TABLE IF NOT EXISTS financials (
  symbol TEXT NOT NULL, period_end TEXT NOT NULL, period_months INTEGER NOT NULL,
  metric TEXT NOT NULL, value REAL NOT NULL, audited INTEGER NOT NULL,
  source_id INTEGER NOT NULL, page INTEGER,
  PRIMARY KEY (symbol, period_end, period_months, metric))""")
db.execute("DELETE FROM financials WHERE symbol=?", (SYMBOL,))   # safe to re-run

BALANCE = {
    "total_assets":      r"^total assets",
    "total_liabilities": r"^total liabilities(?!\s*(&|and))",
    "total_equity":      r"^total (equity|shareholders)",
    "deposits":          r"^(deposits?( from customers)?|due to customers)",
    "borrowings":        r"^(borrowings|debt issued)",
    "loans":             r"^(loans and (advances|receivables)|lease rentals)",
    "nav_per_share":     r"^net\s+assets?(\s+value)?\s+per\s+(ordinary\s+)?share|^nav\s+per\s+share",
}
FLOW = {
    "interest_income":        r"^interest income",
    "interest_expense":       r"^interest expense",
    "net_interest_income":    r"^net interest income",
    "total_operating_income": r"^(profit before operating expenses|total operating income|net operating income)",
    "operating_expenses":     r"^total operating expenses",
    "impairment":             r"^(provision for (loan|credit) losses|impairment)",
    "profit_before_tax":      r"^profit before (income )?tax",
    "profit_after_tax":       r"^profit for the (period|year)",
    "eps":                    r"^(basic\s*)?(/?\s*diluted\s*)?earnings?\s+per\s+(ordinary\s+)?share",
    "cfo":                    r"net cash.*operating",
    "cfi":                    r"net cash.*investing",
    "cff":                    r"net cash.*financing",
}
PER_SHARE = {"eps", "nav_per_share"}
CASHFLOW = {"cfo", "cfi", "cff"}
ALL = {**BALANCE, **FLOW}
LIMITS = {"eps": 100, "nav_per_share": 1000}

STATEMENT_TITLE = re.compile(
    r"profit or loss|income statement|financial position|balance sheet|cash flow", re.I)

# titles that mark a primary statement page inside a long annual report
# (the loose "st\w+ent" also accepts typos such as "STATMENET")
TITLES = re.compile(
    r"st\w{2,6}ent\s+of\s+(profit|comprehensive|financial position|cash)"
    r"|income statement|balance sheet", re.I)

# "5 97,080,001" -> "597,080,001", "2 ,699,264,371" -> "2,699,264,371", "2 .32" -> "2.32"
SPLIT = re.compile(r"(?<![\d,.])(\d) (?=\d{0,2},\d{3}|\.\d)")
TOKEN = re.compile(r"\(?-?\d[\d,]*\.?\d*\)?")
TWO_DEC = re.compile(r"^\(?-?\d+\.\d{2}\)?$")     # 7.34 yes, 44.1 (note ref) no


def clean(line):
    return SPLIT.sub(r"\1", re.sub(r"\(\s+", "(", line))


def parse(tok):
    neg = tok.startswith("(")
    v = float(tok.strip("()").replace(",", ""))
    return -abs(v) if neg else v


def numbers(line, per_share):
    out = []
    for t in TOKEN.findall(line):
        if per_share:
            if TWO_DEC.match(t):
                out.append(parse(t))
        elif "," in t:                 # money has thousands separators; drops notes and %
            out.append(parse(t))
    return out


def unit_of(text):
    if re.search(r"(rs\.?|lkr)\s*['’`]?\s*000|in thousands", text, re.I): return 1_000
    if re.search(r"rs\.?\s*(million|mn)", text, re.I): return 1_000_000
    return 1


def detect_order(text):
    """Which entity comes first in the column header?"""
    head = "\n".join(text.splitlines()[:20])
    g = re.search(r"\bgroup\b", head, re.I)
    c = re.search(r"\bcompany\b", head, re.I)
    if g and c:
        return "company_first" if c.start() < g.start() else "group_first"
    return "single"


def col(nums, order, source_id):
    """Pick the wanted entity's current-period value from a row."""
    if source_id in FORCE_COL:
        i = FORCE_COL[source_id]
        return nums[i] if i < len(nums) else nums[0]
    n = len(nums)
    if order == "single" or n < 4 or n % 2:
        return nums[0]
    want_first = (BASIS == "company") == (order == "company_first")
    return nums[0] if want_first else nums[n // 2]


def is_statement_page(text):
    head = " ".join(text.splitlines()[:6])
    return bool(TITLES.search(head)) and not re.match(r"\s*notes?\s+to\b", head, re.I)


def lines_from_words(page):
    """Rebuild visual rows from word positions (for pages where text comes out label-then-numbers)."""
    words = sorted(page.extract_words(), key=lambda w: (w["top"], w["x0"]))
    rows, cur, last = [], [], None
    for w in words:
        if last is not None and abs(w["top"] - last) > 3:
            rows.append(cur); cur = []
        cur.append(w); last = w["top"]
    if cur:
        rows.append(cur)
    return [" ".join(w["text"] for w in sorted(r, key=lambda w: w["x0"])) for r in rows]


def scan(lines, page_no, order, cands):
    hits = 0
    for raw in lines:
        line = clean(raw.strip())
        for key, pat in ALL.items():
            if not re.search(pat, line, re.I):
                continue
            nums = numbers(line, key in PER_SHARE)
            if nums:
                cands.setdefault(key, []).append((nums, page_no, order))
                hits += 1
    return hits


def extract(path, long_doc=False):
    """Returns ({key: [(nums, page, order), ...]}, unit).
    long_doc=True (annual reports): only scan primary statement pages."""
    cands, head = {}, ""
    with pdfplumber.open(path) as pdf:
        for n, page in enumerate(pdf.pages, 1):
            text = page.extract_text() or ""
            if n <= 3:
                head += text
            if long_doc:
                if not is_statement_page(text):
                    continue
                head += "\n".join(text.splitlines()[:8])      # units are stated in the statement header
            order = detect_order(text)
            hits = scan(text.splitlines(), n, order, cands)
            if hits < 3 and STATEMENT_TITLE.search(text):      # second pass for broken layouts
                scan(lines_from_words(page), n, order, cands)
    return cands, unit_of(head)


def pick(cands):
    """First match per key; per-share values prefer the page that has profit for the period."""
    found = {k: v[0] for k, v in cands.items()}
    pat = found.get("profit_after_tax")
    for k in PER_SHARE:
        if k in cands:
            same = [c for c in cands[k] if pat and c[1] == pat[1]]
            found[k] = same[0] if same else cands[k][0]
    return found


def period(ms):
    d = dt.datetime.fromtimestamp(ms / 1000, tz=dt.timezone(dt.timedelta(hours=5.5))).date()
    return d.isoformat(), {6: 3, 9: 6, 12: 9, 3: 12}[d.month]    # FY ends 31 March


def values(key, nums, order, months, interim, source_id):
    """Returns [(period_months, value)]."""
    # balance sheet, cash flow and annual files: one value, entity chosen by header
    if not interim or key in BALANCE or key in CASHFLOW:
        return [(months, col(nums, order, source_id))]
    if months == 3:
        return [(3, nums[0])]
    n = len(nums)
    if n < 4:
        return [(months, nums[0])]
    # interim income statement: [3m cur, 3m prev, 9m cur, 9m prev (, variance)]
    # or with a variance in each block: [cur, prev, var, cum cur, cum prev, var, ...]
    if key in PER_SHARE or n in (4, 5):
        cum = 2
    elif n in (6, 7):
        cum = 3
    else:
        cum = 4
    return [(3, nums[0]), (months, nums[cum])]


def is_ar(i):  return "annual report" in i["fileText"].lower()
def is_afs(i): return "audited" in i["fileText"].lower()


def pdf_path(sid):
    """Prefer the OCR copy (data/pdfs_ocr) when one exists."""
    p = ROOT / "pdfs_ocr" / f"{sid}.pdf"
    return p if p.exists() else ROOT / "pdfs" / f"{sid}.pdf"


data = json.load(open(ROOT / f"{SYMBOL}.reports.json"))

# Order matters (later rows overwrite earlier ones for the same period):
# interim -> annual reports -> audited statements
rows = [(i, 0) for i in data["infoQuarterlyData"]] + \
       [(i, 1) for i in data["infoAnnualData"] if is_ar(i) and not is_afs(i)] + \
       [(i, 1) for i in data["infoAnnualData"] if is_afs(i)]

for item, audited in rows:
    sid = item["id"]
    pdf = pdf_path(sid)
    if not pdf.exists():
        continue
    long_doc = bool(audited) and is_ar(item) and not is_afs(item)
    end, months = period(item["manualDate"])
    cands, unit = extract(pdf, long_doc=long_doc)
    found = pick(cands)

    # equity = assets - liabilities when there is no explicit equity line
    if "total_equity" not in found and "total_assets" in found and "total_liabilities" in found:
        ta, tl = found["total_assets"], found["total_liabilities"]
        eq = col(ta[0], ta[2], sid) - col(tl[0], tl[2], sid)
        found["total_equity"] = ([eq], None, "single")

    if len(found) < 8:
        print("LOW YIELD:", sid, item["fileText"].strip(), len(found))
        if long_doc and len(found) < 4:
            continue            # don't let a failed annual report overwrite good interim values

    if "eps" in found:
        n, pg, order = found["eps"]
        print(f"{sid} {end} audited={audited} order={order} page={pg} eps_nums={n}")
        if len(n) >= 4 and n[0] != n[len(n) // 2] and audited:
            print("   group/company EPS differ:", n[0], "vs", n[len(n) // 2])
    else:
        print(f"{sid} {end} NO EPS FOUND  {item['fileText'].strip()}")

    for key, (nums, page, order) in found.items():
        for m, v in values(key, nums, order, months, not audited, sid):
            if key in PER_SHARE:
                if abs(v) > LIMITS[key]:
                    print("SKIP implausible", key, v, sid, item["fileText"].strip())
                    continue
            else:
                v = v * unit            # money in full rupees; per-share stays as is
            db.execute("INSERT OR REPLACE INTO financials VALUES (?,?,?,?,?,?,?,?)",
                       (SYMBOL, end, m, key, v, audited, sid, page))

    pat, pbt = found.get("profit_after_tax"), found.get("profit_before_tax")
    if pat and pbt and pat[0][0] > pbt[0][0]:
        print("CHECK PAT > PBT:", sid, item["fileText"].strip())
    db.commit()

print("done")