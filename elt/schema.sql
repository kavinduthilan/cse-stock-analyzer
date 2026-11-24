CREATE TABLE IF NOT EXISTS financials (
  symbol        TEXT NOT NULL,
  period_end    TEXT NOT NULL,       -- 2026-03-31
  period_months INTEGER NOT NULL,    -- 3,6,9,12 cumulative from 1 April
  metric        TEXT NOT NULL,       -- total_assets, profit_after_tax, eps ...
  value         REAL NOT NULL,
  audited       INTEGER NOT NULL,    -- 1 annual audited, 0 interim
  source_id     INTEGER NOT NULL,    -- id from the CSE JSON
  page          INTEGER,
  PRIMARY KEY (symbol, period_end, period_months, metric)
);