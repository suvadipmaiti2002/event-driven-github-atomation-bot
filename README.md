# Event-Driven GitHub Automation Bot

A production-grade, event-driven web application and bot that reacts to GitHub repository events (issues, pull requests, pushes), executes customizable automation rules, writes back to GitHub (via Octokit), dispatches rich Slack notifications, and performs AI-driven triage (via Google Gemini).

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

## ✨ Features & Capabilities

- **Secure Webhook Ingestion**: Every webhook request is verified against `X-Hub-Signature-256` using `crypto.timingSafeEqual`.
- **Idempotency & Replay Protection**: Webhook deliveries are keyed by `X-GitHub-Delivery`. If a delivery GUID was already recorded, duplicate actions (comments, Slack notifications) are safely prevented.
- **Configurable Rules Engine**: Build dynamic automation triggers per repository with granular conditions:
  - Event types (`issues`, `pull_request`, `push`)
  - Filter criteria (e.g. title contains `[BUG]`, branch matches `main`)
  - Configurable actions: Post Comment, Auto-Label, Dispatch Slack Alert, Trigger AI Triage.
- **AI Triage (Google Gemini)**: Automatic categorization, severity assessment (`CRITICAL`, `HIGH`, `MEDIUM`, `LOW`), and suggested label recommendations with multi-model fallback and strict execution timeouts.
- **Two-Tier Observability & Resilience**:
  - **Tier 1 (Transient Auto-Retry)**: Built-in exponential backoff utility for transient network glitches or 5xx third-party downtime.
  - **Tier 2 (Manual Dead-Letter Recovery)**: Operators can review failed executions in the Live Activity stream, filter by failures, and trigger instant 1-click re-runs directly from the UI.
- **Multi-Repository Management**: Connect and disconnect webhooks automatically across any public or private repository with OAuth access.

---

## 📁 Repository Structure

```text
/
├── frontend/             # React + Vite + TypeScript + Tailwind CSS (Vercel)
│   ├── src/
│   │   ├── api/          # Centralized API fetcher with abort timeouts
│   │   ├── components/   # UI components & rules manager
│   │   ├── hooks/        # React custom hooks (auth, repos, live events)
│   │   ├── pages/        # Dashboard, Login, Rules
│   │   ├── types/        # TypeScript domain models
│   │   └── main.tsx
│   ├── vercel.json       # SPA route rewrite configuration
│   └── package.json
│
├── backend/              # Node.js + Express + TypeScript (Render)
│   ├── src/
│   │   ├── config/       # Validated environment configuration (Zod fail-fast)
│   │   ├── db/           # Drizzle ORM schema, migrations, and PostgreSQL client
│   │   ├── controllers/  # Thin HTTP controllers
│   │   ├── routes/       # Express route definitions
│   │   ├── services/     # Webhook handler, Action service, Rule engine, Auth
│   │   ├── repositories/ # Drizzle database access layer
│   │   ├── middleware/   # HMAC verification, JWT auth, request logger
│   │   ├── integrations/ # GitHub Octokit, Slack Webhook, Google Gemini AI
│   │   ├── utils/        # Clean zero-dependency logger and retry helpers
│   │   ├── app.ts        # Express app configuration
│   │   └── server.ts     # Server bootstrap & crash handling
│   ├── drizzle.config.ts # Drizzle Kit configuration
│   └── package.json
│
├── .env.example          # Environment variables template (zero secrets)
├── AGENTS.md             # Coding conventions & architecture specification
└── README.md
```

---

## ⚙️ Environment Variables Reference

### Backend (`backend/.env`)

| Variable | Description | Example / Default |
| :--- | :--- | :--- |
| `PORT` | HTTP Server port | `5000` |
| `NODE_ENV` | Runtime environment | `development` or `production` |
| `FRONTEND_URL` | Allowed CORS origin and OAuth redirect target | `http://localhost:5173` (dev) / `https://your-app.vercel.app` (prod) |
| `DATABASE_URL` | PostgreSQL connection string (Supabase pooler) | `postgresql://postgres.[REF]:[PASS]@[HOST]:5432/postgres` |
| `JWT_SECRET` | Secret key for signing user session tokens (min 32 chars) | `your_secure_random_jwt_secret_key` |
| `GITHUB_CLIENT_ID` | GitHub OAuth App Client ID | From GitHub Developer Settings |
| `GITHUB_CLIENT_SECRET`| GitHub OAuth App Client Secret | From GitHub Developer Settings |
| `GITHUB_CALLBACK_URL` | OAuth redirect callback URL | `http://localhost:5000/api/auth/github/callback` (dev) |
| `GITHUB_WEBHOOK_SECRET` | Shared secret for HMAC-SHA256 signature verification | Your custom secret string |
| `GITHUB_WEBHOOK_URL` | Target URL registered on GitHub repositories | `https://smee.io/your_channel` (dev) or Render backend URL (prod) |
| `SLACK_WEBHOOK_URL` | Slack Incoming Webhook URL for notifications | `https://hooks.slack.com/services/...` |
| `GEMINI_API_KEY` | Google Gemini API Key for issue/PR triage | Your Gemini API key |
| `GEMINI_MODEL` | *(Optional)* Candidate models to try in order | `gemini-2.5-flash, gemini-2.0-flash` |

### Frontend (`frontend/.env`)

| Variable | Description | Example |
| :--- | :--- | :--- |
| `VITE_API_URL` | Backend API base URL | `http://localhost:5000` (dev) / `https://your-api.onrender.com` (prod) |

---

## 🚀 Getting Started (Local Development)

### Prerequisites
- Node.js (v18 or higher)
- Free Supabase PostgreSQL project
- GitHub Account (to create an OAuth App)
- Slack Workspace (to create an Incoming Webhook)

### 1. Database Setup (Supabase)
1. Create a project at [supabase.com](https://supabase.com).
2. Go to **Project Settings** → **Database** and copy your **Connection String** (Transaction pooler or Session mode).

### 2. GitHub OAuth App Setup
1. In GitHub, go to **Settings** → **Developer settings** → **OAuth Apps** → **New OAuth App**.
2. Set **Application name**: `GitHub Automation Bot (Local)`.
3. Set **Homepage URL**: `http://localhost:5173`.
4. Set **Authorization callback URL**: `http://localhost:5000/api/auth/github/callback`.
5. Save and copy your `Client ID` and generate a `Client Secret`.

### 3. Local Webhook Forwarding (Smee.io)
GitHub cannot send webhooks directly to `localhost`. Use [smee.io](https://smee.io):
1. Visit `https://smee.io/new` to generate a proxy channel (e.g. `https://smee.io/abc123xyz`).
2. Run the Smee client in a separate terminal:
   ```bash
   npx smee -u https://smee.io/abc123xyz -t http://localhost:5000/api/webhooks/github
   ```
3. Set `GITHUB_WEBHOOK_URL=https://smee.io/abc123xyz` in `backend/.env`.

### 4. Backend Installation & Run
```bash
cd backend
cp ../.env.example .env # and fill in your secrets
npm install
npm run dev
```

### 5. Frontend Installation & Run
```bash
cd frontend
npm install
npm run dev
```
Open `http://localhost:5173` in your browser.

---

## 🚢 Production Deployment

### Backend Deployment (Render)

1. Push your repository to GitHub.
2. Log in to [Render](https://render.com) and click **New +** → **Web Service**.
3. Connect your repository and configure:
   - **Root Directory**: `backend`
   - **Environment**: `Node`
   - **Build Command**: `npm install && npm run build`
   - **Start Command**: `npm run start`
4. Add all environment variables from `backend/.env` under the **Environment** tab:
   - Make sure `FRONTEND_URL` is set to your Vercel URL (e.g. `https://your-app.vercel.app`).
   - Set `GITHUB_CALLBACK_URL` to `https://your-api.onrender.com/api/auth/github/callback`.
   - Set `GITHUB_WEBHOOK_URL` to `https://your-api.onrender.com/api/webhooks/github`.
5. Deploy the service.

### Frontend Deployment (Vercel)

1. Log in to [Vercel](https://vercel.com) and click **Add New...** → **Project**.
2. Select your GitHub repository.
3. Configure the project settings:
   - **Framework Preset**: `Vite`
   - **Root Directory**: `frontend`
4. Add Environment Variable:
   - `VITE_API_URL` = `https://your-api.onrender.com` (Render Backend URL)
5. Click **Deploy**.
6. Note: `frontend/vercel.json` already contains the SPA fallback rewrite to guarantee page reloads work seamlessly.

### Post-Deployment: Update GitHub OAuth App
Once deployed, update your GitHub OAuth App settings in GitHub Developer Settings:
- **Homepage URL**: `https://your-app.vercel.app`
- **Authorization callback URL**: `https://your-api.onrender.com/api/auth/github/callback`

---

## 🛡️ Reliability & Security Checklist

- [x] Timing-safe HMAC signature verification on all incoming webhook payloads
- [x] Unique delivery idempotency enforcement (`X-GitHub-Delivery`)
- [x] Zero credential exposure (strict server-side secrets)
- [x] Circuit-breaking 8s timeout on external AI models with automatic candidate fallback
- [x] Client-side 12s abort timeouts preventing stuck UI states
- [x] Non-blocking operator toast notifications with sanitized user-friendly error messages
- [x] Complete Drizzle ORM transaction safety and database migration scripts
