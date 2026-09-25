# Event-Driven GitHub Automation Bot

[![TypeScript](https://img.shields.io/badge/TypeScript-007ACC?style=flat-square&logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![React](https://img.shields.io/badge/React-20232A?style=flat-square&logo=react&logoColor=61DAFB)](https://reactjs.org/)
[![Vite](https://img.shields.io/badge/Vite-646CFF?style=flat-square&logo=vite&logoColor=white)](https://vitejs.dev/)
[![TailwindCSS](https://img.shields.io/badge/TailwindCSS-38B2AC?style=flat-square&logo=tailwind-css&logoColor=white)](https://tailwindcss.com/)
[![Node.js](https://img.shields.io/badge/Node.js-339933?style=flat-square&logo=nodedotjs&logoColor=white)](https://nodejs.org/)
[![Express](https://img.shields.io/badge/Express-000000?style=flat-square&logo=express&logoColor=white)](https://expressjs.com/)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-316192?style=flat-square&logo=postgresql&logoColor=white)](https://www.postgresql.org/) 
[![Drizzle ORM](https://img.shields.io/badge/Drizzle_ORM-C5F74F?style=flat-square&logo=drizzle&logoColor=black)](https://orm.drizzle.team/)

A full-stack bot and dashboard that automates your GitHub workflow. When an issue or pull request is opened, the bot immediately acknowledges it, uses LLM model to analyze priority and suggest labels, sends notifications to your team's Slack channel, and executes custom automation rules you configure.

---

## 📑 Table of Contents
- [1. Problem Statement](#1-problem-statement)
- [2. The Solution](#2-the-solution)
- [3. Architecture & Tech Stack](#3-architecture--tech-stack)
- [4. Environment Variables Required](#4-environment-variables-required)
- [5. Step-by-Step Local Setup Guide](#5-step-by-step-local-setup-guide)
- [6. Production Deployment Guide (Vercel + Render)](#6-production-deployment-guide-vercel--render)
- [7. How to Use the Application (Local or Deployed)](#7-how-to-use-the-application-local-or-deployed)
- [8. Reliability & Security Highlights](#8-reliability--security-highlights)

---

## 1. Problem Statement

Modern software teams and open-source maintainers face everyday challenges:

- **Slow Responses & Overworked Maintainers**: Issues and PRs quickly pile up unread. Project owners waste hours manually reading every ticket, adding labels, and figuring out what's urgent instead of writing code.
- **Tool Disconnect**: Developers live in Slack or team chats, while work happens on GitHub. Critical bugs often sit unnoticed because teams lack immediate, formatted channel notifications.
- **Automation Friction**: Custom team workflows (e.g., *"If issue contains `[SECURITY]`, alert team immediately and label critical"*) usually require writing complex GitHub Actions YAML workflows.
- **Silent Failures & Lack of Observability**: Most webhook listeners operate as "fire-and-forget". If an API call fails due to rate limits or network drops, the event is lost with no audit trail or recovery mechanism.

---

## 2. The Solution

This application connects your GitHub repositories, Slack channels, and AI to automate daily triage through an intuitive web dashboard:

1. **Instant GitHub Responses**: 
   When someone opens an issue or pull request, the bot immediately posts a helpful acknowledgment comment (clearly labeled `> 🤖 GitHub Automation Bot [automated] Dispatched on behalf of @owner`) and applies initial triage labels so contributors feel heard right away.

2. **Smart AI Triage (Google Gemini)**: 
   The bot reads the issue/PR description using Google Gemini AI, assesses its urgency level (`CRITICAL`, `HIGH`, `MEDIUM`, or `LOW`), categorizes the task (`bug`, `feature`, `documentation`), and suggests relevant labels.

3. **Private Team Alerts on Slack**: 
   Each repository connects directly to its own Slack channel. The bot dispatches rich notification cards containing issue summaries, priority badges, and direct links—ensuring teams stay informed without leaking alerts across different workspaces.

4. **Visual No-Code Rules Engine**: 
   Easily customize how each repository behaves without writing YAML files or scripts. Set simple rules like:
   - *"If the issue title contains `[BUG]`, automatically apply the `bug` label."*
   - *"If the author is @dependabot, automatically apply the dependencies label."*

5. **Live Dashboard & 1-Click Recovery**: 
   A real-time dashboard tracks every incoming event and outbound action. If an external API call fails (such as a temporary Slack outage), operators can simply click **`[↻ Retry]`** to re-run the action without losing data.

6. **Reliable & Secure Under the Hood**: 
   Every incoming webhook is verified with cryptographic HMAC-SHA256 signatures, and every event delivery ID is checked against the database to guarantee that no notification or comment is ever sent twice.

---

## 3. Architecture & Tech Stack

### System Architecture

```text
┌────────────────────────────────────────────────────────┐
│                   FRONTEND (Vercel)                    │
│          React + Vite + TypeScript + Tailwind          │
└───────────────────────────┬────────────────────────────┘
                            │ HTTP (CORS + Bearer / Cookie)
┌───────────────────────────▼────────────────────────────┐
│                    BACKEND (Render)                    │
│              Node + Express + TypeScript               │
│        Passport OAuth │ JWT │ HMAC Verification        │
└─────────┬──────────────────┬──────────────────┬────────┘
          │                  │                  │
     ┌────▼─────┐       ┌────▼───────┐     ┌────▼───────┐
     │PostgreSQL│       │ GitHub API │     │   Slack    │
     │(Supabase)│       │ (Octokit)  │     │  Webhooks  │
     └──────────┘       └────────────┘     └────────────┘
                             │
                        ┌────▼───────┐
                        │Google Gemini│
                        │ (AI Triage)│
                        └────────────┘
```

### Tech Stack

| Layer | Technologies | Purpose |
| :--- | :--- | :--- |
| **Frontend** | React 18, Vite, TypeScript, Tailwind CSS, Lucide Icons | Responsive dashboard, real-time activity stream, modal managers |
| **Backend** | Node.js, Express, TypeScript | REST API, HMAC verification, webhook processor, rule evaluation engine |
| **Authentication** | Passport.js (`passport-github2`), JSON Web Tokens (JWT) | GitHub OAuth 2.0 flow, secure session tokens (Bearer & Cookie) |
| **Database & ORM** | PostgreSQL (Supabase), Drizzle ORM, Drizzle Kit | Relational schema, connection pooling, migrations, type-safe queries |
| **Integrations** | Octokit REST API, Slack Incoming Webhooks, Google Gemini SDK | GitHub comments/labels, Slack Block Kit messages, automated AI triage |
| **Observability** | Pino structured logger, Custom Request Timing Middleware | Secret redaction, structured error logs, manual action retry |
| **Local Tunneling** | ngrok / smee.io | Forwarding public GitHub webhooks to local Express server |

---

## 4. Environment Variables Required

A complete template with zero secrets is provided at [`.env.example`](.env.example).

### Backend (`backend/.env`)

These variables are defined and validated in `backend/src/config/env.ts`:

| Variable | Required | Description | Example / Default |
| :--- | :---: | :--- | :--- |
| `PORT` | Yes | Server listening port | `5000` |
| `NODE_ENV` | Yes | Runtime environment | `development` or `production` |
| `FRONTEND_URL` | Yes | Allowed CORS origin and OAuth redirect destination | `http://localhost:5173` (dev) / `https://your-app.vercel.app` (prod) |
| `DATABASE_URL` | Yes | PostgreSQL connection string (Supabase transaction pooler) | `postgresql://postgres.[REF]:[PASS]@[HOST]:5432/postgres` |
| `JWT_SECRET` | Yes | Secret key for signing user JWT tokens (min 16 chars) | `your_secure_random_jwt_secret_at_least_16_chars` |
| `GITHUB_CLIENT_ID` | Yes | GitHub OAuth App Client ID | Obtained from GitHub Developer Settings |
| `GITHUB_CLIENT_SECRET` | Yes | GitHub OAuth App Client Secret | Obtained from GitHub Developer Settings |
| `GITHUB_CALLBACK_URL` | Yes | OAuth callback endpoint | `http://localhost:5000/api/auth/github/callback` (dev) |
| `GITHUB_WEBHOOK_SECRET` | Yes | Shared secret for HMAC-SHA256 signature verification | Any secure random string (e.g. `my_secret_hmac_123`) |
| `GITHUB_WEBHOOK_URL` | Yes | Target URL registered on GitHub repositories | ngrok URL (dev) or Render URL (prod) |
| `GEMINI_API_KEY` | Yes | Google Gemini API key for automated issue/PR triage | Generated at [aistudio.google.com](https://aistudio.google.com) |
| `GEMINI_MODEL` | Yes | Comma-separated candidate models to try in order | `gemini-2.5-flash,gemini-2.0-flash,gemini-1.5-flash` |

### Frontend (`frontend/.env`)

| Variable | Required | Description | Example |
| :--- | :---: | :--- | :--- |
| `VITE_API_URL` | Yes | Backend API base URL | `http://localhost:5000` (dev) / `https://your-api.onrender.com` (prod) |

---

## 5. Step-by-Step Local Setup Guide

Follow this guide to run the complete stack on your local machine.

### Prerequisites
- [Node.js](https://nodejs.org/) (v18 or higher)
- [Git](https://git-scm.com/)
- [ngrok](https://ngrok.com/) (for forwarding GitHub webhooks to localhost)
- A free [Supabase](https://supabase.com) account
- A [GitHub](https://github.com) account

---

### Step 5.1: Database Setup (Supabase PostgreSQL)
1. Go to [supabase.com](https://supabase.com) and create a free project.
2. In your Supabase project dashboard, navigate to **Project Settings** $\rightarrow$ **Database**.
3. Click on **Connect**, then a modal opens and then select **Direct Connection String** ->  **URI** (Transaction pooler mode on port `5432` or `6543`).
4. Copy this URI—this is your `DATABASE_URL`.

---

### Step 5.2: Create a GitHub OAuth App
1. Go to GitHub $\rightarrow$ click your profile picture $\rightarrow$ **Settings**.
2. In the left sidebar, click **Developer settings** $\rightarrow$ **OAuth Apps** $\rightarrow$ **New OAuth App**.
3. Fill in the fields:
   - **Application name**: `GitHub Automation Bot (Local)`
   - **Homepage URL**: `http://localhost:5173`
   - **Authorization Redirect URL**: `http://localhost:5000/api/auth/github/callback`
4. Click **Register application**.
5. Copy your **Client ID**.
6. Click **Generate a new client secret** and copy your **Client Secret**.

---

### Step 5.3: Webhook Tunneling with ngrok
GitHub cannot deliver webhooks to `localhost`. Use **ngrok** to create a secure public tunnel:

1. Install ngrok (via `npm install -g ngrok` or download from [ngrok.com](https://ngrok.com)).
2. Start the tunnel to port 5000:
   ```bash
   ngrok http 5000
   ```
3. Copy the **Forwarding HTTPS URL** shown in the terminal (e.g. `https://a1b2-c3d4.ngrok-free.dev`).
4. Your `GITHUB_WEBHOOK_URL` will be:
   ```text
   https://a1b2-c3d4.ngrok-free.dev/api/webhook/github
   ```
   *(Keep this ngrok terminal running while testing).*

---

### Step 5.4: Get a Google Gemini API Key
1. Visit [Google AI Studio](https://aistudio.google.com).
2. Click **Get API key** $\rightarrow$ **Create API key**.
3. Copy your API key—this is your `GEMINI_API_KEY`.

---

### Step 5.5: Configure Backend Environment
1. Clone the repository and navigate into it:
   ```bash
   git clone https://github.com/suvadipmaiti2002/event-driven-github-atomation-bot.git
   cd event-driven-github-atomation-bot
   ```
2. Create `backend/.env`:
   ```bash
   cp .env.example backend/.env
   ```
3. Open `backend/.env` and insert your credentials:
   ```env
   PORT=5000
   NODE_ENV=development
   FRONTEND_URL=http://localhost:5173
   DATABASE_URL="postgresql://postgres.[REF]:[PASSWORD]@aws-0-[REGION].pooler.supabase.com:5432/postgres"
   JWT_SECRET="super_secret_jwt_key_at_least_16_characters"
   GITHUB_CLIENT_ID="your_github_client_id"
   GITHUB_CLIENT_SECRET="your_github_client_secret"
   GITHUB_CALLBACK_URL="http://localhost:5000/api/auth/github/callback"
   GITHUB_WEBHOOK_SECRET="my_local_webhook_secret_key"
   GITHUB_WEBHOOK_URL="https://your-ngrok-subdomain.ngrok-free.dev/api/webhook/github"
   GEMINI_API_KEY="your_gemini_api_key"
   GEMINI_MODEL="gemini-2.5-flash,gemini-2.0-flash,gemini-1.5-flash"
   ```

---

### Step 5.6: Install & Start the Backend
1. Install dependencies and push the database schema:
   ```bash
   cd backend
   npm install
   npm run db:push
   ```
2. Start the development server:
   ```bash
   npm run dev
   ```
   *The backend starts at `http://localhost:5000` with hot-reloading.*

---

### Step 5.7: Configure & Start the Frontend
1. In a new terminal window, navigate to `frontend`:
   ```bash
   cd frontend
   npm install
   ```
2. Create `frontend/.env`:
   ```env
   VITE_API_URL=http://localhost:5000
   ```
3. Start the Vite dev server:
   ```bash
   npm run dev
   ```
4. Open **`http://localhost:5173`** in your browser!

---

## 6. Production Deployment Guide (Vercel + Render)

### Backend Deployment (Render)

1. Push your repository to GitHub.
2. Sign in to [Render](https://render.com) and click **New +** $\rightarrow$ **Web Service**.
3. Select your GitHub repository and configure:
   - **Name**: `github-automation-backend`
   - **Root Directory**: `backend`
   - **Runtime**: `Node`
   - **Build Command**: `npm install && npm run build`
   - **Start Command**: `npm run start`
4. In the **Environment Variables** tab, add:
   - `NODE_ENV` = `production`
   - `PORT` = `5000`
   - `FRONTEND_URL` = `https://your-app.vercel.app` *(Your Vercel URL)*
   - `DATABASE_URL` = *(Your Supabase connection string)*
   - `JWT_SECRET` = *(Your random 32+ character string)*
   - `GITHUB_CLIENT_ID` = *(Your GitHub OAuth Client ID)*
   - `GITHUB_CLIENT_SECRET` = *(Your GitHub OAuth Client Secret)*
   - `GITHUB_CALLBACK_URL` = `https://your-api.onrender.com/api/auth/github/callback`
   - `GITHUB_WEBHOOK_SECRET` = *(Your HMAC secret)*
   - `GITHUB_WEBHOOK_URL` = `https://your-api.onrender.com/api/webhook/github`
   - `GEMINI_API_KEY` = *(Your Gemini API key)*
   - `GEMINI_MODEL` = `gemini-2.5-flash,gemini-2.0-flash,gemini-1.5-flash`
5. Click **Create Web Service**. Once built, note your Render URL (e.g. `https://your-api.onrender.com`).

---

### Frontend Deployment (Vercel)

1. Sign in to [Vercel](https://vercel.com) and click **Add New...** $\rightarrow$ **Project**.
2. Import your GitHub repository.
3. Configure project settings:
   - **Framework Preset**: `Vite`
   - **Root Directory**: `frontend`
   - **Build Command**: `npm run build`
   - **Output Directory**: `dist`
4. Add the Environment Variable:
   - `VITE_API_URL` = `https://your-api.onrender.com` *(Your Render backend URL)*
5. Click **Deploy**.
6. *Note*: [`frontend/vercel.json`](frontend/vercel.json) contains the rewrite rule `{ "rewrites": [{ "source": "/(.*)", "destination": "/" }] }` which ensures single-page application (SPA) routing works properly upon browser page reloads.

---

### Update GitHub OAuth App for Production
Once deployed, return to your GitHub OAuth App settings in GitHub:
- Change **Homepage URL** to your Vercel URL: `https://your-app.vercel.app`
- Change **Authorization callback URL** to your Render URL: `https://your-api.onrender.com/api/auth/github/callback`

---

## 7. How to Use the Application (Local or Deployed)

Whether running locally on `http://localhost:5173` or on your deployed production site (e.g. `https://your-app.vercel.app`), follow these steps to test the entire event-driven flow:

---

### Step 1: Open Application & Sign in with GitHub

| Environment | URL to Open |
| :--- | :--- |
| **Local Development** | `http://localhost:5173` |
| **Production Deployment** | `https://your-app.vercel.app` *(Your Vercel URL)* |

- **What to do**: Click the **"Sign in with GitHub"** button.
- **What happens**: GitHub prompts you to authorize the application with access to repositories and webhooks (`repo`, `admin:repo_hook`, `user:email`).
- **Where it reflects**: You are redirected to the Dashboard displaying your GitHub avatar, username, and a **"GitHub Verified"** badge.

---

### Step 2: Connect a Repository

- **What to do**: In the **Connect a Repository** section, select any repository you own or collaborate on from the dropdown and click **"Connect Repository"**.
- **What happens**: The backend calls GitHub's API to automatically register a webhook pointing to your ngrok or production backend URL with HMAC secret verification.
- **Where it reflects**:
  - **On the Dashboard**: The repository card appears under *Connected Repositories* with an emerald `Active Webhook` badge and a clickable link to GitHub.
  - **On GitHub**: Go to your repository $\rightarrow$ **Settings** $\rightarrow$ **Webhooks**. You will see the active webhook URL with a green checkmark!

---

### Step 3: Link Your Slack Channel (Optional)

- **What to do**:
  1. On your connected repository card, click **`+ Add Slack`**.
  2. In your Slack workspace, go to your target channel (e.g. `#github-alerts`).
  3. Click the channel header at top $\rightarrow$ **Agents & apps** (or **Integrations**) $\rightarrow$ Add **Incoming WebHooks** $\rightarrow$ choose channel.
  4. Copy the Webhook URL (starts with `https://hooks.slack.com/services/...`) and paste it into the dashboard modal.
  5. Click **`🧪 Send Test Ping`** to verify connectivity.
  6. Click **`💾 Save Webhook`**.
- **Where it reflects**:
  - **In Slack**: An immediate verification card arrives: `🎉 GitHub Automation Bot Connection Test — Verified successfully!`.
  - **On Dashboard**: The button updates to an emerald **`Slack Active`** badge.

---

### Step 4: Configure Automation Rules

- **What to do**:
  - In the **Automation Rules** manager, default lifecycle rules (Welcome comments, Triage labels, Slack alerts, AI triage) are already active.
  - To customize, click **`+ Add Custom Rule`** (e.g., Target Field: `Author username is`, Value: `dependabot`, Label to Apply: `dependencies`).
- **Where it reflects**: The custom rule appears in the rules list with an instant toggle switch (`ON`/`OFF`) and a delete button.

---

### Step 5: Test Trigger on GitHub

- **What to do**: Go to your connected repository on GitHub and open a new **Issue** (e.g. Title: `[BUG] Checkout page payment button is disabled`, Description: `The payment button cannot be clicked when selecting credit card payment.`).
- **Where things reflect within 2–3 seconds**:
  1. **On GitHub Issue Discussion**:
     The bot immediately posts an acknowledgment comment formatted with the bot identity banner and Gemini AI triage summary:
     ```markdown
     > 🤖 **GitHub Automation Bot** `[automated]`
     > *Dispatched on behalf of @your-username*

     👋 Hi @contributor! Thank you for reporting this issue. Our automated bot has logged this report and notified the team on Slack for triage.

     ---
     ### 🤖 Automated AI Triage
     - **Summary:** Payment button remains disabled during credit card checkout.
     - **Assessed Priority:** 🔴 `HIGH`
     - **Suggested Category:** `bug`
     ```
  2. **On GitHub Issue Sidebar ("Labels")**:
     Labels like `bug` and `triage` are automatically applied to the issue.
  3. **In Your Slack Channel**:
     A formatted Slack card arrives containing:
     - 📁 Repository link
     - 📋 Issue title & direct link
     - 📊 Status badge (`Open`)
     - 👤 Actor: `@contributor (Bot)`
     - 🤖 AI Summary & ⚡ Priority badge
     - 📝 Quoted issue description
     - ↗️ "View on GitHub" button

---

### Step 6: Real-Time Observability & Dead-Letter Recovery

- **Where it reflects on the Dashboard**:
  - In the **Live Activity** stream (which automatically polls every 3 seconds), a new entry appears showing the delivery ID, event type (`Issue OPENED`), issue title, direct GitHub link, and action status badges:
    $$\boxed{\text{AI: HIGH ✓}} \quad \boxed{\text{Comment ✓}} \quad \boxed{\text{Label ✓}} \quad \boxed{\text{Slack ✓}}$$
  - **If Slack was not configured**: Renders a clean neutral gray badge $\boxed{\text{🔔 Slack: Not Configured —}}$ with a helpful tooltip instead of an error.
  - **If an action failed (Dead-Letter Recovery)**:
    - Renders a red badge: $\boxed{\text{Slack ✗}}$
    - Displays an inline **`[↻ Retry]`** button next to the failure badge.
    - Click **`[↻ Retry]`**: The spinner activates, a non-blocking floating toast notifies you of the retry status, and the badge increments the retry count indicator (e.g. `1r`, `2r`).

---

## 8. Reliability & Security Highlights

Here is how the application protects your data and handles failures gracefully:

- 🔒 **Authentic GitHub Verification**: Verifies every incoming webhook using secret cryptographic signatures so only legitimate GitHub events are processed.
- ⚡ **No Duplicate Comments or Alerts**: If GitHub re-sends an event due to a network blip, the bot detects the duplicate delivery ID and ignores it—preventing spam.
- 🛡️ **Zero Secret Exposure**: Tokens, keys, and private Slack webhook URLs are stored and processed strictly on the backend—never visible in frontend code or logs.
- ⏱️ **No Frozen Tasks (30s Timeouts)**: All network calls to GitHub, Slack, and Gemini AI have strict 30-second safety limits so the server never hangs.
- 🔄 **One-Click Retries**: If GitHub or Slack experiences a temporary outage, failed tasks are safely saved so you can retry them with one click from the dashboard.
