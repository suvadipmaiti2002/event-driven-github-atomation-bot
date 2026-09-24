# AGENTS.md — Event-Driven GitHub Automation Bot

## 1. Project Overview & Architecture

Full-stack event-driven bot reacting to GitHub repository events (issues, PRs), executing configurable rules, posting back to GitHub via Octokit, and dispatching notifications to Slack (with optional AI triage).

```text
┌─────────────────────────────────────────────────────┐
│                 FRONTEND (Vercel)                   │
│        React + Vite + TypeScript + Tailwind         │
└──────────────────────────┬──────────────────────────┘
                           │ HTTP (CORS + Bearer / Cookie)
┌──────────────────────────▼──────────────────────────┐
│                  BACKEND (Render)                   │
│            Node + Express + TypeScript              │
│       Passport OAuth │ JWT │ HMAC Verification      │
└────────┬─────────────────┬─────────────────┬────────┘
         │                 │                 │
    ┌────▼────┐      ┌─────▼──────┐    ┌─────▼──────┐
    │PostgreSQL│      │ GitHub API │    │   Slack    │
    │ + Drizzle│      │ (Octokit)  │    │  Webhook   │
    │ ORM      │      └────────────┘    └────────────┘
    └─────────┘
```

---

## 2. Repository Layout

```text
/
├── frontend/             # React + Vite + Tailwind (Vercel)
│   ├── src/
│   │   ├── api/          # Centralized fetch / API client
│   │   ├── components/   # UI components
│   │   ├── hooks/        # Custom hooks
│   │   ├── pages/        # Dashboard, Login, Rules, Logs
│   │   ├── types/        # Shared frontend interfaces
│   │   └── main.tsx
│   ├── package.json
│   └── vite.config.ts
│
├── backend/              # Express + TypeScript (Render)
│   ├── src/
│   │   ├── config/       # Validated env vars (fail-fast on startup)
│   │   ├── db/           # Drizzle ORM schema, migrations & client connection
│   │   │   ├── schema.ts
│   │   │   └── index.ts
│   │   ├── controllers/  # Thin HTTP controllers
│   │   ├── routes/       # Endpoint definitions + middlewares
│   │   ├── services/     # Business logic: webhook, rule engine, auth
│   │   ├── repositories/ # Drizzle database access layer
│   │   ├── middleware/   # HMAC verify, JWT auth, error handler
│   │   ├── integrations/ # External APIs
│   │   │   ├── github/   # Octokit client (comments, labels, webhooks)
│   │   │   ├── slack/    # Slack incoming webhook dispatcher
│   │   │   └── ai/       # Optional Gemini/Groq triage & auto-summary
│   │   ├── types/        # Domain types & DTOs
│   │   ├── app.ts        # Express app configuration
│   │   └── server.ts     # HTTP server bootstrap
│   ├── drizzle.config.ts # Drizzle Kit configuration
│   └── package.json
│
├── .env.example          # Template with zero real secrets
├── AGENTS.md
└── README.md
```

---

## 3. Core Quality & Reliability Standards (Non-Negotiable)

1. **HMAC Signature Verification**:
   - Every GitHub webhook request MUST be verified against `X-Hub-Signature-256` using `crypto.timingSafeEqual`.
   - Read the raw request body before JSON parsing to compute the signature. Reject invalid signatures with `401 Unauthorized`.
2. **Idempotency & Replay Protection**:
   - Extract GitHub delivery GUID (`X-GitHub-Delivery`).
   - Check against `event_logs` table. If already recorded/processed, return `200 OK` immediately without repeating actions (no duplicate comments or Slack messages).
3. **Resilience & Graceful Degradation**:
   - Never lose webhook payloads. Store event metadata and raw payload in PostgreSQL upon arrival.
   - Downstream failures (GitHub API or Slack webhook) must be logged with status `FAILED` in `action_logs` and should not crash the server.
4. **Zero Secret Exposure**:
   - Never commit `.env` or log OAuth tokens, JWT secrets, database connection strings, or webhook URLs.
   - Frontend `VITE_*` variables must never contain private backend secrets.

---

## 4. Backend Rules & Database (Drizzle ORM)

- **Layered Pattern**: `Route` → `Controller` → `Service` → `Repository` / `Integration`.
  - Controllers only parse requests, invoke services, and return responses.
  - Never put Drizzle queries or external API calls inside route controllers.
- **Database & ORM**:
  - Use PostgreSQL with Drizzle ORM only. Do not add or reintroduce Prisma in this project.
  - Always use the shared `db` client instance from `backend/src/db/index.ts`.
  - Wrap multi-table updates in `db.transaction()`.
  - Record execution status (`PENDING`, `SUCCESS`, `FAILED`) and error messages in `action_logs` for observability.
- **Cross-Origin Auth (Vercel ↔ Render)**:
  - Frontend and backend reside on different domains.
  - Configure CORS with `credentials: true` and explicit `origin: process.env.FRONTEND_URL`.
  - Support `Authorization: Bearer <token>` in addition to or alongside `SameSite: 'none'`, `Secure: true` cookies to avoid third-party cookie blocking.

---

## 5. External Integrations

- **GitHub (Octokit)**:
  - All GitHub API calls live exclusively under `backend/src/integrations/github/`.
  - Never call GitHub APIs directly from the frontend.
- **Slack**:
  - Webhook dispatch lives under `backend/src/integrations/slack/`.
  - Notification failures must not fail the entire webhook transaction unless explicitly required.
- **AI Triage (Optional Stretch)**:
  - Use Google Gemini free tier (`@google/genai`) or Groq to summarize issue/PR text or suggest labels. Handle rate limits and timeouts gracefully.

---

## 6. Frontend Rules

- **Separation of Concerns**: Keep components presentational. Extract API calls to `frontend/src/api/` and state logic to custom hooks.
- **Error & Loading States**: Every async action (repo connect, rule creation, log fetch) must present visual loading indicators and user-friendly error banners.
- **Live Logs**: Provide clear status indicators (Success/Failed badges, timestamps, event type, action taken).

---

## 7. AI Agent Working Protocol

1. **Inspect First**: Check existing code, types, and dependencies before creating new files.
2. **Type Safety**: Strict TypeScript only. No `any`, no unhandled promises, no non-null assertions (`!`) unless justified.
3. **Smallest Clean Change**: Do not rewrite existing working modules unnecessarily.
4. **Validation**: Validate incoming request bodies and query params before processing.
5. **No Hallucinated Packages**: Verify whether an existing utility or standard library can solve the issue before adding new npm packages.
