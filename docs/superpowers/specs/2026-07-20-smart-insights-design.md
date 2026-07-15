# FinTrack Smart Insights Design

## Goal

Turn `/insights` from a redirect into a calm decision-support workspace that explains the user's recent financial position and suggests a small number of useful next actions. Insights use real FinTrack data, but remain advisory and can never create, modify, approve, or delete financial records.

The feature uses Groq with `openai/gpt-oss-20b` through a server-only API route. FinTrack calculates every amount and comparison deterministically before calling the model. Groq receives a compact, anonymized aggregate and returns structured Indonesian narrative. No database migration is required.

## Chosen approach

Use a hybrid privacy-first architecture.

1. FinTrack loads the authenticated user's transactions and account summaries through existing Supabase RLS.
2. Pure local helpers calculate the financial snapshot, comparisons, signals, and deterministic fallback insights.
3. The browser sends only the aggregate snapshot to a same-origin server route.
4. The server validates and minimizes the payload, calls Groq using a server-only API key, validates the strict JSON response, and returns advisory content.
5. The UI combines verified figures with the model's explanation and action suggestions.

Alternatives rejected:

- **Raw transaction analysis by an external model:** richer context but unnecessarily exposes merchant names, notes, record IDs, and transaction-level history.
- **AI-only calculations:** creates unacceptable risk that the model invents totals, percentages, or trends.
- **Gemini free tier:** technically suitable, but its free-tier data terms are less appropriate for personal financial aggregates than Groq's default inference-retention posture and available Zero Data Retention controls.

## Product experience

### Page hierarchy

The new `/insights` page uses the existing Navbar and premium mint, white, navy, and emerald system.

1. **Header:** `Smart Insights`, selected month, refresh action, and a concise statement that AI is advisory.
2. **Financial pulse:** verified income, expense, net cash flow, savings rate, and movement versus the previous comparable period.
3. **Primary insight:** one AI-written summary grounded only in the supplied metrics, labeled `Dibantu AI` and timestamped.
4. **Priority actions:** up to three ranked actions with a reason, impact label, and relevant internal destination such as Transactions, Categories, Accounts, or Dashboard.
5. **Pattern details:** deterministic category concentration, unusual movement, and data-quality observations that remain visible if Groq is unavailable.
6. **Method and privacy disclosure:** a compact expandable explanation of what is and is not sent to Groq.

The page avoids chat UI, open-ended prompting, decorative AI gradients, animated orbs, neon treatments, and fake certainty. The product behaves like a financial review, not a chatbot.

### Responsive behavior

- Desktop uses a two-column review layout: primary narrative and pulse on the left, priority actions and patterns on the right.
- Mobile uses one column with the same reading order and no hidden information.
- Actions remain at least 44 pixels high.
- All charts or indicators have visible text equivalents.
- Safe-area padding protects the last action in installed PWA mode.
- No horizontal overflow at Pixel 7 dimensions.

### Empty and partial data states

- No confirmed transactions: explain that at least one confirmed income or expense is needed and link to Transactions.
- Current month only: show current totals and omit unsupported previous-period claims.
- Expense-only data: do not calculate a savings rate; explain why.
- Pending or review transactions: exclude them from verified metrics and show a data-quality note.
- AI unavailable: keep every deterministic metric and pattern visible, then show a restrained retry action.

## Deterministic analytics contract

`lib/insights.ts` owns pure calculations and no network, React, or browser behavior.

Input:

- confirmed income and expense transactions for the selected and previous month;
- counts of pending/review transactions;
- active account count and reporting-value coverage;
- selected period boundaries.

Output:

- total income, expense, and net cash flow;
- savings rate when mathematically valid;
- expense and income change when a comparable baseline exists;
- top expense categories with amount and share;
- category concentration signal;
- largest absolute category change;
- transaction frequency and average expense size;
- deterministic fallback summary and action candidates;
- a privacy-safe external-AI payload.

Rules:

- Only `confirmed` transactions affect financial metrics.
- Percent changes with a zero baseline are `null`, not infinity.
- The payload contains rounded totals, ratios, counts, month labels, and normalized category names.
- The payload never contains user ID, email, account ID/name, transaction ID, merchant, note, receipt URL, or exact transaction dates.
- Categories are limited to the top five and labels are trimmed to a conservative length.
- The server recalculates no money and treats supplied metrics as untrusted display input that must pass schema validation and size limits.

## AI contract

### Internal route

Add `POST /api/insights/generate`.

The request contains:

- schema version;
- selected period label;
- sanitized current and previous aggregate metrics;
- deterministic signals and candidate actions.

The route:

1. rejects missing or invalid JSON;
2. enforces a strict maximum request size;
3. validates every number, enum, string length, and array length with Zod;
4. rejects non-same-origin browser requests using the existing security pattern;
5. applies best-effort in-memory throttling suitable for the current single-instance personal deployment;
6. reads `GROQ_API_KEY` and optional `GROQ_INSIGHTS_MODEL` only on the server;
7. calls `https://api.groq.com/openai/v1/chat/completions` with a short timeout;
8. requests strict JSON Schema output from `openai/gpt-oss-20b`;
9. validates the returned JSON again before responding;
10. returns `Cache-Control: no-store` and safe error messages.

The server prompt explicitly states:

- use only supplied figures;
- never calculate or invent new monetary values;
- never provide investment, tax, legal, or debt-product recommendations;
- never claim certainty about future finances;
- respond in concise, calm Indonesian;
- prioritize at most three actions already present in the deterministic candidate list.

### Response schema

- `headline`: short factual title;
- `summary`: two or three concise sentences;
- `tone`: `positive`, `neutral`, or `attention`;
- `actions`: zero to three items containing candidate ID, title, reason, and impact (`high`, `medium`, or `low`);
- `observations`: zero to three concise pattern explanations;
- `generatedAt`: server timestamp added after model validation;
- `model`: public model identifier, never the API key or provider response metadata.

The model may rephrase approved candidate actions but cannot create external links or mutation instructions.

## Client data flow

1. Resolve the authenticated Supabase user through the existing application boundary.
2. Load the selected and previous month in parallel, plus account-coverage and pending-review counts.
3. Calculate the verified snapshot locally with `lib/insights.ts`.
4. Render deterministic figures immediately.
5. Request the AI explanation only when the snapshot has enough confirmed data.
6. Replace the narrative skeleton with validated AI content.
7. On refresh or period change, cancel stale requests and ignore late responses.

AI output is session UI state only. It is not written to Supabase or local storage, preventing stale financial advice from persisting after underlying data changes.

## Security and privacy

- `GROQ_API_KEY` is server-only and documented in `.env.example`; it is never prefixed with `NEXT_PUBLIC_`.
- The browser never calls Groq directly.
- The internal route accepts only the documented aggregate schema.
- Prompt-injection-bearing fields such as notes and merchant text never enter the prompt.
- Category labels are treated as untrusted data, length-limited, and serialized as data rather than instructions.
- Responses are schema-validated and rendered as text, never HTML.
- Financial records remain protected by Supabase RLS; the AI route has no Supabase service-role key and cannot mutate data.
- Errors and logs exclude payload contents and provider response bodies.
- The privacy disclosure states that anonymized aggregates are sent to Groq only when generating the review.

## Configuration behavior

Required for AI narrative:

```text
GROQ_API_KEY=
```

Optional:

```text
GROQ_INSIGHTS_MODEL=openai/gpt-oss-20b
```

If the key is absent, the optimized build still succeeds. The Insights page displays deterministic analysis and a configuration-neutral message that AI explanation is not active. It does not expose environment variable names to normal end users.

## Error handling

- `400`: invalid or oversized aggregate; client shows deterministic fallback without retry loop.
- `403`: origin check failed; generic rejection only.
- `429`: local or Groq rate limit; respect `Retry-After` when available and show `Coba lagi nanti`.
- `502`: invalid provider output; show deterministic fallback.
- `503`: missing configuration or provider unavailable; show deterministic fallback.
- `504`: provider timeout; show deterministic fallback and manual retry.

Only one automatic retry is permitted for a transient provider failure, with a short randomized backoff. User-triggered refresh is disabled while a request is active.

## Testing strategy

### Unit tests

- confirmed-only transaction filtering;
- current and previous summary calculations;
- zero-baseline percentage handling;
- savings-rate boundaries;
- top-category ranking and concentration;
- largest category movement;
- fallback insight prioritization;
- privacy payload excludes all prohibited fields;
- request and response schema validation;
- safe provider-error mapping;
- rate-limit behavior and stale-result guards where pure extraction is practical.

### API tests

- missing key fallback;
- invalid origin, content type, body, schema, and oversized request rejection;
- Groq success with strict structured output;
- malformed and schema-invalid provider output;
- timeout, 429, and upstream failure mapping;
- response security and no-store headers;
- assertions that errors do not leak keys, prompts, or provider bodies.

### Browser E2E

All Supabase and Groq-related internal API traffic is mocked.

- populated review renders verified metrics before AI narrative;
- AI success renders only validated content;
- missing configuration and upstream failure retain useful fallback insights;
- month switching cancels or ignores stale narrative;
- empty and partial-data states are accurate;
- internal action links navigate correctly;
- desktop Chromium and Pixel 7 have no horizontal overflow;
- no hydration mismatch, page error, or unexpected console error.

### Release gates

- full unit suite with at least 80 percent coverage;
- ESLint and TypeScript pass;
- optimized Next.js build passes without a Groq key;
- production dependency audit has no unresolved vulnerability;
- complete desktop/mobile E2E regression passes;
- no real Supabase writes or real Groq requests occur during automated tests.

## Success criteria

- A user can understand the selected month's financial direction within one screen.
- Every displayed amount is traceable to deterministic FinTrack calculations.
- AI adds explanation and prioritization without receiving raw transaction history.
- The page remains useful when Groq is missing, limited, slow, or unavailable.
- No AI response can mutate financial data or bypass existing application security.
- The result feels like the approved FinTrack visual system rather than a separate AI product.

## Out of scope

- Chat, free-form financial questions, or conversational memory.
- Forecasting account balances or predicting market returns.
- Automated transaction, budget, investment, or trading actions.
- Persisting AI-generated reports in Supabase.
- New database tables, migrations, service-role keys, vector databases, or embeddings.
- Sending receipts, notes, merchants, account identifiers, or transaction-level history to Groq.
