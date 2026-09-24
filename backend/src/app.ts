import express, { Request, Response } from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import passport from "passport";
import { env } from "./config/env";
import { configurePassport } from "./config/passport";
import { authRouter } from "./routes/auth.routes";
import { repositoryRouter } from "./routes/repository.routes";
import { webhookRouter } from "./routes/webhook.routes";

export const app = express();

// Initialize Passport GitHub OAuth Strategy
configurePassport();
app.use(passport.initialize());

// CORS configuration supporting cookies and headers from frontend
app.use(
  cors({
    origin: env.FRONTEND_URL,
    credentials: true,
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization", "X-GitHub-Delivery", "X-Hub-Signature-256", "X-GitHub-Event"],
  })
);

// Capture raw body for GitHub webhook HMAC verification before standard JSON parsing
app.use(
  express.json({
    verify: (req: Request & { rawBody?: Buffer }, _res, buf) => {
      req.rawBody = buf;
    },
  })
);

app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

// Health check endpoint
app.get("/api/health", (_req: Request, res: Response) => {
  res.status(200).json({ status: "healthy", timestamp: new Date().toISOString() });
});

// Authentication routes
app.use("/api/auth", authRouter);

// Repository management routes
app.use("/api", repositoryRouter);

// Webhook ingestion and audit event routes
app.use("/api", webhookRouter);

export default app;
