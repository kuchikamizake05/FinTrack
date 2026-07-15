# Smart Insights Implementation Plan

## Objective

Implement the approved Groq-backed, privacy-first Smart Insights experience without database migrations or real external calls in automated tests.

## Work sequence

1. Add failing unit tests for deterministic insight calculations, fallback actions, payload minimization, API schemas, and error mapping.
2. Implement `lib/insights.ts` and make the focused unit tests pass.
3. Add failing API tests for request security, configuration, Groq structured output, timeouts, rate limits, and safe errors.
4. Implement `POST /api/insights/generate` with server-only configuration, strict validation, origin checks, throttling, timeout, and no-store responses.
5. Document server-only Groq configuration in `.env.example`.
6. Replace the `/insights` redirect with the responsive premium review page using existing FinTrack components and visual tokens.
7. Add mocked desktop/mobile E2E for populated, empty, fallback, refresh, navigation, and overflow states.
8. Run unit coverage, lint, TypeScript, optimized build, production dependency audit, and complete browser regression.

## Guardrails

- No database migration.
- No service-role Supabase key.
- No merchant, note, receipt, record identifier, email, account identity, or exact transaction date in the Groq payload.
- No AI-authored monetary calculations.
- No AI response persistence.
- No financial mutations from Insights.
- No real Supabase writes or Groq calls in tests.
- No commit unless explicitly requested by the user.
