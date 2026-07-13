# Personal Finance Operating System — Design

## Purpose

Evolve FinTrack from an expense tracker into a long-term personal financial operating system. The application must track daily cash flow, money held across accounts, investments, forex trading, and the resulting net worth without double-counting transfers or capital movements.

## Scope and delivery order

### Phase 1: Financial foundation

1. Accounts and balances for bank accounts, e-wallets, brokers, and trading accounts.
2. Transactions, including income, expense, and transfers between accounts.
3. Net-worth dashboard with cash-flow and account summaries.
4. Manual investment and broker balance updates.

### Phase 2: Investment and trading journal

1. Stock positions and buy/sell activity.
2. Forex trades with execution details, risk, setup, media, and P&L.
3. Portfolio and trading-performance analytics.

### Phase 3: AI-assisted workflow

1. Draft transactions from Telegram text or receipts.
2. Trade review after each completed trade.
3. Weekly and monthly financial and trading summaries.

External broker integrations are out of scope for the first version. All financial and trading input is manual or submitted through Telegram.

## Information architecture

```text
Dashboard
├─ Net worth
│  ├─ Cash and bank balances
│  ├─ Investment value
│  └─ Liabilities (optional)
├─ Cash flow
│  ├─ Income and expenses
│  ├─ Categories and purchases
│  └─ Recurring bills (future)
└─ Investment and trading
   ├─ Stock portfolio
   ├─ Forex trading accounts
   ├─ Trading journal
   └─ AI review
```

Pages:

- **Dashboard:** net worth, monthly cash flow, investment value, trading P&L, and primary-account balances.
- **Accounts:** account list, balance/value updates, and account type configuration.
- **Transactions:** income, expenses, transfers, broker deposits, and withdrawals in a single timeline.
- **Investments:** stock positions, manual valuations, and buy/sell records.
- **Trading Journal:** trade list and detail with plan, outcome, screenshots, and AI review.
- **Review AI:** weekly and monthly insights.
- **Settings:** categories, currencies, defaults, and Telegram/n8n setup.

## Financial model

### Accounts

Every monetary balance is held in an account. Initial account types are:

- Bank: Jago, BRI, Mandiri.
- E-wallet: user-defined.
- Securities broker: Stockbit.
- Forex broker/trading account: HFM and Exness.

Each account stores a name, institution, type, currency, opening balance, current balance/value, and active state.

### Transaction semantics

| Activity | Financial interpretation |
| --- | --- |
| Grocery purchase from Jago | Expense; Jago balance decreases. |
| Salary paid to BRI | Income; BRI balance increases. |
| BRI to Jago | Transfer; one balance decreases and the other increases; not income or expense. |
| Mandiri to HFM | Broker deposit; transfer of cash to trading capital; not expense. |
| Exness to BRI | Broker withdrawal; transfer; not new income. |
| Stock purchase | Conversion of broker cash into a stock position; no immediate net-worth change. |
| Stock sale or closed forex trade | Realised P&L is recorded; balances and position quantities update. |

Every transaction has a date, amount, currency, source account, optional destination account, category when applicable, note, source, and optional receipt attachment. A transfer must have both source and destination accounts. An expense or income must have one account.

## Investment and trade model

### Stocks

Record ticker, side, quantity/lot, price, fee, trade date, broker account, and notes. Maintain derived position quantity, cost basis, and realised P&L. Current market value is entered manually in the initial release.

### Forex

Record broker account, instrument/pair, long or short side, lot size, entry/exit timestamps and prices, stop-loss, take-profit, commission, swap, realised P&L, setup/tag, thesis, risk plan, emotional state, mistakes, and before/after screenshots.

Derived metrics include win rate, average R multiple, expectancy, profit factor, P&L by setup, instrument, session, and account.

## AI boundaries

AI is advisory only. It must never create, modify, or delete confirmed financial records without user confirmation.

- Telegram text and receipt OCR produce a transaction draft with confidence.
- Low-confidence drafts require approval.
- Completed trades can receive an AI review against the stated setup and risk plan.
- Weekly/monthly reports summarize cash flow, net worth movement, allocation, risk discipline, emotional patterns, and recurring mistakes.

## Data flow

```text
Manual dashboard entry or Telegram message
  → validated draft
  → user confirmation when required
  → Supabase records
  → derived balances, positions, and metrics
  → dashboard and AI summaries
```

Supabase remains the source of truth. n8n is an optional ingestion and AI-orchestration layer, not part of the dashboard runtime.

## Error handling and safety

- Reject transfers that use the same source and destination account or non-positive amounts.
- Reject sell/close actions that exceed available stock quantity or open forex volume unless explicitly marked as a correction.
- Store monetary amounts as numeric values and preserve a currency code.
- Soft-delete financial records and recalculate derived summaries.
- Display clear reconciliation warnings when a manually updated account value differs from transaction-derived balance.
- Restrict every record with Supabase RLS to its owner.

## Testing strategy

- Unit-test calculation and validation helpers for transfers, net worth, positions, P&L, and metrics.
- Integration-test Supabase-backed account and transaction flows with RLS.
- End-to-end-test the critical workflows: add expense, transfer between accounts, record stock purchase, close forex trade, and approve an AI-generated draft.

## Success criteria

1. The user can see correct cash flow, net worth, and investment/trading summaries from the same dashboard.
2. Transfers, deposits, withdrawals, and purchases do not double-count income, expenses, or net worth.
3. The user can keep a complete manual history across Jago, BRI, Mandiri, e-wallets, Stockbit, HFM, and Exness.
4. Every completed forex trade can be reviewed against plan, execution, and outcome.
5. AI suggestions are always reviewable and never silently alter confirmed records.
