# Event-Driven GitHub Automation Bot

A full-stack, event-driven web application and bot that reacts to GitHub repository events (issues, pull requests, etc.), executes configurable automation rules, writes back to GitHub (via Octokit), and dispatches structured notifications to Slack (with optional AI triage).

---

## 🏗️ Architecture

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

## 🔒 Reliability & Quality Bar

- **HMAC Signature Verification**: Every webhook request is verified against `X-Hub-Signature-256` using `crypto.timingSafeEqual`.
- **Idempotency & Replay Protection**: Each GitHub delivery GUID (`X-GitHub-Delivery`) is checked against the database to guarantee side effects (Slack alerts, GitHub comments/labels) run exactly once.
- **Resilience**: Webhook payloads are immediately saved to Supabase PostgreSQL upon arrival; downstream API failures are logged in `ActionLog` without crashing the service.
- **Zero Secret Exposure**: Tokens, OAuth secrets, database credentials, and webhook secrets are kept strictly server-side.

---

## 📁 Repository Structure

```text
/
├── frontend/             # React + Vite + TypeScript + Tailwind CSS (Vercel)
│   ├── src/
│   │   ├── api/          # Centralized API fetcher
│   │   ├── components/   # UI components
│   │   ├── hooks/        # React custom hooks
│   │   ├── pages/        # Dashboard, Rules, Logs
│   │   ├── types/        # TypeScript interfaces
│   │   └── main.tsx
│   └── package.json
│
├── backend/              # Node.js + Express + TypeScript (Render)
│   ├── src/
│   │   ├── config/       # Validated environment configuration (fail-fast)
│   │   ├── db/           # Drizzle schema and database client
│   │   │   ├── schema.ts
│   │   │   └── index.ts
│   │   ├── controllers/  # Thin HTTP controllers
│   │   ├── routes/       # Endpoint definitions
│   │   ├── services/     # Webhook handler, Rule Engine, Auth
│   │   ├── repositories/ # Drizzle database access layer
│   │   ├── middleware/   # HMAC, Auth, Error handling
│   │   ├── integrations/ # GitHub Octokit, Slack Webhook, AI Triage
│   │   ├── app.ts        # Express app
│   │   └── server.ts     # Server bootstrap
│   ├── drizzle.config.ts # Drizzle Kit config
│   └── package.json
│
├── .env.example          # Environment variables template
├── AGENTS.md             # AI Agent conventions & architecture instructions
└── README.md
```

---

## 🚀 Local Development Setup

### Prerequisites
- Node.js (v18+ recommended)
- PostgreSQL database (free Supabase project)
- GitHub OAuth App & Webhook Secret
- Slack Incoming Webhook URL

### 1. Clone & Configure Environment
```bash
cp .env.example backend/.env
```
Fill in the values in `backend/.env`.

### 2. Backend Setup
```bash
cd backend
npm install
npm run db:push
npm run dev
```
Backend runs on `http://localhost:5000`.

### 3. Frontend Setup
```bash
cd frontend
npm install
npm run dev
```
Frontend runs on `http://localhost:5173`.
