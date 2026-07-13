-- Manual IDR valuation makes multi-currency net worth explicit and avoids
-- silently mixing USD, IDR, and other currencies in one total.
alter table financial_accounts
  add column if not exists reporting_balance_idr numeric check (reporting_balance_idr >= 0);
