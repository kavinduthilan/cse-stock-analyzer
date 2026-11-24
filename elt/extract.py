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

db.execute("""CREATE TABLE IF NOT EXISTS cashflow_lines (
  symbol TEXT NOT NULL, period_end TEXT NOT NULL, seq INTEGER NOT NULL,
  section TEXT NOT NULL, label TEXT NOT NULL, is_total INTEGER NOT NULL,
  value REAL NOT NULL, source_id INTEGER NOT NULL, page INTEGER,
  PRIMARY KEY (symbol, period_end, seq))""")
db.execute("DELETE FROM cashflow_lines WHERE symbol=?", (SYMBOL,))

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
    g = re.search(r"\b(group|consolidated)\b", head, re.I)
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

# ---------- full cash flow statement ----------
CF_PAGE = re.compile(
    r"cash flows? (from|used in|generated from)|net cash.*(operating|investing|financing)"
    r"|^\s*(operating|investing|financing) activities", re.I | re.M)
NUMTOK = re.compile(r"^\(?-?\d[\d,]*(?:\.\d+)?\)?$")
DASHES = {"-", "–", "—"}
YEAR_TOK = re.compile(r"^(?:19|20)\d\d$")
NOTE_TAIL = re.compile(r"(?:\s+\d+(?:[./]\d+)*(?:\s*\([ivx]+\))?)+\s*$", re.I)
TOTAL_LABEL = re.compile(
    r"^(net cash|net increase|net decrease|net \(decrease|net \(increase|cash and cash equivalents at the end"
    r"|cash generated from operations|operating profit before working)", re.I)


def is_num(tok):
    return tok in DASHES or bool(NUMTOK.match(tok))


def cf_val(tok):
    return 0.0 if tok in DASHES else parse(tok)


def cf_columns(lines):
    """Number of value columns: count the years in the header, else the most common row width."""
    head = " ".join(l for l in lines[:12] if re.search(r"ended|note|\(rs", l, re.I))
    years = re.findall(r"\b(?:19|20)\d{2}\b", head)
    if len(years) in (2, 4):
        return len(years)
    counts = []
    for l in lines:
        t = [x for x in l.split() if "," in x and NUMTOK.match(x)]
        if len(t) >= 2:
            counts.append(len(t))
    return max(set(counts), key=counts.count) if counts else 0


def cf_section(text):
    t = text.lower()
    if t.startswith("analysis of cash"):
        return "analysis"
    if "net cash" in t:
        return None
    for key, word in (("operating", "operating activities"),
                      ("investing", "investing activities"),
                      ("financing", "financing activities")):
        if word in t:
            return key
    return None


def parse_cf_lines(lines, ncols):
    rows, pending, section = [], "", "operating"
    for raw in lines:
        line = re.sub(r"\(\s+", "(", raw.strip())
        if not line:
            continue
        parts = line.split()
        n_numeric = sum(is_num(p) for p in parts)
        toks = []
        while parts and len(toks) < ncols and is_num(parts[-1]):
            toks.insert(0, parts.pop())            # last N values; notes stay in the label part

        if len(toks) < ncols or n_numeric > ncols + 3:     # heading, wrapped label, or a number dump
            sec = cf_section(line)
            if sec:
                section = sec
            if len(toks) < ncols:
                pending = (pending + " " + line) if (pending and line[:1].islower()) else line
            continue
        if all(YEAR_TOK.match(t) for t in toks):           # "2026 2025 2026 2025" header row
            pending = ""
            continue

        label = NOTE_TAIL.sub("", " ".join(parts)).strip()
        if not label:
            label = pending or "Subtotal"                   # label wrapped on the lines above
        elif pending and label[:1].islower():
            label = f"{pending} {label}"
        pending = ""

        low = label.lower()
        kind = None
        if low.startswith("net cash") and "before" not in low:
            for k, w in (("cfo", "operating"), ("cfi", "investing"), ("cff", "financing")):
                if w in low:
                    kind = k
        if low.startswith(("net increase", "net decrease", "net (decrease", "net (increase")) and section != "analysis":
            section = "summary"
        rows.append({
            "label": label, "section": section, "nums": [cf_val(t) for t in toks], "kind": kind,
            "total": bool(kind) or bool(TOTAL_LABEL.match(low)) or label == "Subtotal",
        })
        if kind == "cff":
            section = "summary"
    return rows


def real(rows):
    return sum(r["label"] != "Subtotal" for r in rows)


def extract_cashflow(path, sid):
    """First cash flow statement in the file -> (rows, unit, column order)."""
    rows, unit, order_seen, run_order, pages = [], 1, "single", None, 0
    with pdfplumber.open(path) as pdf:
        for n, page in enumerate(pdf.pages, 1):
            text = page.extract_text() or ""
            o = detect_order(text)
            if o != "single":
                order_seen = o
            if not CF_PAGE.search(text):
                if rows:
                    break                    # the statement has ended
                continue
            best, best_order = [], o
            for lines in (text.splitlines(), lines_from_words(page)):
                ncols = cf_columns(lines)
                got = parse_cf_lines(lines, ncols) if ncols else []
                if real(got) > real(best):
                    oo = detect_order("\n".join(lines))
                    best, best_order = got, (oo if oo != "single" else o)
                if real(best) >= 6:
                    break
            if real(best) < 4:
                if rows:
                    break
                continue
            if unit == 1:
                unit = unit_of(text)
            if run_order is None and best_order != "single":
                run_order = best_order
            for r in best:
                r["page"] = n
            rows += best
            pages += 1
            if pages >= 3:
                break
    order = run_order or order_seen
    for r in rows:
        r["value"] = col(r["nums"], order, sid)
    return rows, unit, order


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
    cf_ok = False
    if audited:                               # annual sources only
        cf, cf_unit, cf_order = extract_cashflow(pdf, sid)
        if cf:
            cf_ok = True
            db.execute("DELETE FROM cashflow_lines WHERE symbol=? AND period_end=?", (SYMBOL, end))
            for seq, r in enumerate(cf):
                v = r["value"] * cf_unit
                db.execute("INSERT INTO cashflow_lines VALUES (?,?,?,?,?,?,?,?,?)",
                           (SYMBOL, end, seq, r["section"], r["label"], int(r["total"]), v, sid, r["page"]))
                if r["kind"]:
                    db.execute("INSERT OR REPLACE INTO financials VALUES (?,?,?,?,?,?,?,?)",
                               (SYMBOL, end, 12, r["kind"], v, audited, sid, r["page"]))
            print(f"{sid} {end} cash flow: {len(cf)} lines, order={cf_order}, columns={len(cf[0]['nums'])}")
            if cf_order == "single" and len(cf[0]["nums"]) >= 4:
                print("   WARNING: Group/Company header not found, check FORCE_COL for", sid)
            tot = {r["kind"]: r["value"] for r in cf if r["kind"]}
            net = next((r["value"] for r in cf if r["label"].lower().startswith("net increase")), None)
            if net is not None and len(tot) == 3 and abs(sum(tot.values()) - net) > max(1, abs(net) * 0.001):
                print("   CHECK: operating + investing + financing != net change", sum(tot.values()), net)
        else:
            print(f"{sid} {end} NO CASH FLOW FOUND")
    cands, unit = extract(pdf, long_doc=long_doc)
    found = pick(cands)
    if cf_ok:
        for k in ("cfo", "cfi", "cff"):
            found.pop(k, None)

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