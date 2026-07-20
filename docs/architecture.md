# FinTrack architecture

FinTrack is a Next.js 16 App Router application backed by Supabase, with optional n8n integrations. The repository keeps framework conventions at the root and application code under `src/`.

## Repository layout

```text
src/
  app/                         Route handlers, layouts, metadata, and pages
  components/                  Shared React components and UI primitives
  config/                      Pure configuration parsing and security headers
  infrastructure/supabase/     Browser and server Supabase adapters
  lib/                         Pure domain rules and application calculations
  server/                      Server-only HTTP and request helpers
  types/                       Global application declarations
public/                        Public static assets only
supabase/                      Schema and ordered database migrations
n8n/                           Sanitized, inactive workflow templates
e2e/                           Playwright tests and fixtures
```

## Dependency rules

1. `src/app` is the delivery layer. Pages compose UI; route handlers validate HTTP input and delegate infrastructure work.
2. `src/components` may use browser-safe infrastructure but must not import from `src/server` or server-only adapters.
3. `src/lib` contains deterministic business rules. It should not depend on React, Next.js request APIs, environment variables, or Supabase clients.
4. `src/config` parses configuration without performing network work. Public configuration is safe to bundle only when explicitly prefixed with `NEXT_PUBLIC_`.
5. `src/infrastructure/supabase/browser-client.ts` is the single browser client boundary. `server-client.ts` is marked `server-only` and owns authenticated server clients.
6. `src/server` contains reusable server-only transport helpers. Client components must never import it.

## Request flow

```text
Browser page
  -> Next.js route handler
  -> input and origin validation
  -> server-only Supabase authentication
  -> ownership/RLS check
  -> optional external provider or n8n workflow
  -> no-store JSON response
```

Every API route must validate runtime input, authenticate independently, enforce ownership, return generic errors, and disable caching for financial responses.

## Configuration boundaries

- `.env.example` documents required variables and contains placeholders only.
- Real `.env*` files are ignored and belong in the deployment platform's secret store.
- `NEXT_PUBLIC_*` values are browser-visible by design and must never contain service-role keys or provider secrets.
- n8n workflow files are templates. Credentials and instance exports belong in ignored private files.

## Public repository hygiene

Generated audits, AI-tool state, local databases, exports, receipts, uploads, and private working notes are excluded by `.gitignore`. Public assets under `public/` must be intentionally distributable. Database migrations and workflow templates must be reviewed for embedded credentials before each push.
