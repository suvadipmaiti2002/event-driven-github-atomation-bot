# AI Collaboration Notes (AI_NOTES.md)

Hi! This document explains how I built this project using AI tools, the key decisions I made myself, the biggest bug where the AI got confused, and what I would build next if I had more time. I wrote this in simple terms to explain my thought process as a student developer.

---

## 1. AI Tools Used & How We Split the Work

### What tools I used:
- **AI Coding Assistant (Claude / Gemini)**: Used as my pair programmer to help write code, generate boilerplate, and brainstorm ideas.
- **Google Gemini API**: Integrated directly into my backend bot to read GitHub issue descriptions, summarize them, and suggest labels.
- **Context File ([`AGENTS.md`](./AGENTS.md))**: A simple rulebook I kept in the project root so the AI always followed my architecture rules (like using Drizzle ORM instead of Prisma).

### How I split the work:
- **What the AI did (The "Fast Typist")**:
  - Wrote repetitive boilerplate code (like Express route definitions and TypeScript types).
  - Helped write Tailwind CSS classes to make the dashboard look clean and modern.
  - Gave me initial templates for the Octokit (GitHub) and Slack API calls.
- **What I did myself (The "Architect & Driver")**:
  - Figured out how GitHub login, JWT tokens, and LocalStorage should work across two different websites (Vercel and Render).
  - Decided to use simple 3-second polling instead of complex WebSockets so the app never crashes on free hosting.
  - Made sure each repository has its own private Slack webhook so team alerts never leak to the wrong people.
  - Solved the hardest bugs where the AI was completely stuck (like broken webhook signatures and hanging network requests).

---

## 2. Key Decisions I Made Myself

### Decision 1: Hybrid Auth Strategy (HttpOnly Cookie + Bearer Token Fallback)
- **The Problem**: My frontend is on Vercel (`.vercel.app`) and my backend is on Render (`.onrender.com`). They run on different domains.
- **Why I made this choice**: If you rely *only* on cookies, privacy features in browsers like Safari (ITP) and Chrome Incognito will block third-party cookies across different domains, causing users to get logged out when they refresh. But if you rely *only* on localStorage, you miss the built-in security of `HttpOnly` cookies.
- **My Solution**: I built a **dual/hybrid auth system**:
  1. The backend sets a secure `HttpOnly` cookie (`SameSite=None`, `Secure=true`).
  2. The backend also provides the token via the `/api/auth/me` JSON response, which the frontend stores in `localStorage` and passes as `Authorization: Bearer <token>`.
  3. The backend authentication middleware checks: *"Did a cookie arrive? If yes, use it. If the browser blocked the cookie, did an Authorization Bearer header arrive? Use that instead."*
  This gives the best of both worlds: secure cookies whenever possible, and an automatic fallback so users never get logged out.

### Decision 2: Simple 3-Second Polling Instead of WebSockets
- **The Problem**: I needed the dashboard to show new GitHub events and actions in real-time.
- **Why I made this choice**: The AI wanted me to use WebSockets or Server-Sent Events (SSE). While fancy, free cloud servers like Render spin down when idle, and cloud proxies frequently drop long-lived open connections. That means WebSockets would randomly disconnect and show error banners unless I wrote complex reconnection logic.
- **My Solution**: I set up a simple **3-second polling timer** on the dashboard. Every 3 seconds, the browser quickly asks the backend: *"Any new events?"*. It is lightweight, never crashes, and if the user's internet hiccups, it just tries again 3 seconds later without any broken connections.

### Decision 3: Private Slack Webhook Per Repository (No Global Channel)
- **The Problem**: How to notify teams on Slack when something happens on GitHub.
- **Why I made this choice**: The AI originally suggested putting one single `SLACK_WEBHOOK_URL` in the backend `.env` file for the whole application. I realized that if this app is deployed for multiple people, Person A's private repository alerts would be sent directly into Person B's Slack channel!
- **My Solution**: I removed the global Slack setting. Instead, I added a `slack_webhook_url` column to the database for each repository. On the frontend, I added an **`+ Add Slack`** button where the user pastes their channel's webhook and can click **`🧪 Send Test Ping`** to verify it works before saving.

### Decision 4: Bot Transparency Banner on Comments
- **The Problem**: With GitHub OAuth Apps, comments are posted using the repo owner's personal account (`@owner`).
- **Why I made this choice**: If someone opens an issue and gets an immediate comment from the owner 1 second later, it looks confusing.
- **My Solution**: I added a clear, friendly header to every comment:
  ```markdown
  > 🤖 **GitHub Automation Bot** [automated]
  > *Dispatched on behalf of @owner*
  ```
  This makes it crystal clear to contributors that an automated helper answered them.

---

## 3. The Hardest Bug & Wrong Turn the AI Led Me Into

### The Bug: Webhook Verification Kept Failing (Error 401 Unauthorized)
Whenever GitHub sent an event (like opening an issue), my backend rejected it with `401 Unauthorized`, saying the secret signature was invalid.

### What the AI got wrong (The Modified Message Problem):
To make sure a webhook really comes from GitHub and not an imposter, GitHub calculates a cryptographic signature based on the **exact text** it sends over the internet. To verify it, our server must check that signature against that exact same text.

Here is where the AI got confused:
1. Normally, Express's `express.json()` middleware reads the incoming network text, converts it into a convenient JavaScript object (`req.body`), and **discards the original text**.
2. When the AI needed to verify GitHub's signature, the original text was already gone!
3. So the AI tried to turn the JavaScript object back into text using `JSON.stringify(req.body)`:
   ```typescript
   // ❌ What the AI wrote:
   // Trying to verify a re-created string whose formatting was altered:
   const signature = crypto.createHmac("sha256", secret).update(JSON.stringify(req.body)).digest("hex");
   ```
4. **Why this failed**: Turning an object back into text changes small details like whitespace, indentation, and key order. Because the text was no longer a 100% identical match to what GitHub originally transmitted, the signature calculation failed every single time.

### How I noticed & fixed it (Saving a copy of the original):
I realized that re-creating the text with `JSON.stringify` was altering the data. We needed the original, untouched text exactly as it arrived off the wire.

To fix it, I configured Express to **keep a copy of the untouched incoming raw data** in `req.rawBody` *before* parsing it into an object:
```typescript
// ✅ How I fixed it:
// Tell Express: keep a copy of the untouched raw data before parsing it
app.use(express.json({
  verify: (req: any, _res, buf) => {
    req.rawBody = buf; // Preserves the exact bytes as sent by GitHub
  }
}));
```

Now the application has both:
- **`req.body`**: The parsed object so our code can easily read `req.body.issue.title`.
- **`req.rawBody`**: The original, untouched copy of what GitHub sent over the wire.

I updated the verification code to check the signature against `req.rawBody`. Immediately, the signatures matched and all GitHub webhooks succeeded with `200 OK`!

---

## 4. What I Would Improve With More Time

If I had expand this project, here is what I would build:

1. **Migrate to a Native GitHub App**:
   Right now, the bot uses GitHub OAuth, which posts comments on behalf of the logged-in user (`@username`). Converting it into a true GitHub App would give the bot its own dedicated robot avatar and `bot[bot]` badge on GitHub, clearer per-repository permissions, and would prevent automated comments from cluttering the developer's personal contribution history.

2. **Better Dashboard Experience (Search, Filters & Pagination)**:
   For repositories with dozens of daily events, the Live Activity feed can get long. I would add:
   - **Search bar**: To quickly search events by issue title, author etc.
   - **Status filters**: Tabs to filter events by `All`, `Failed`, `Success`, or `Slack Not Configured`.
   - **Pagination**: Breaking the activity list into clean pages (e.g., 10 events per page) to keep the UI fast and easy to navigate.

3. **Background Job Queue (Redis + BullMQ)**:
   Currently, webhook events are processed in memory as they arrive. If a popular open-source project received a burst of 50 issues at the same second, an asynchronous Redis queue would process them safely in the background, smoothing out GitHub API rate limits.