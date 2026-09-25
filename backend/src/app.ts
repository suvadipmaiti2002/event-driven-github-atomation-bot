import express, { Request, Response } from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import passport from "passport";
import { env } from "./config/env";
import { configurePassport } from "./config/passport";
import { authRouter } from "./routes/auth.routes";
import { repositoryRouter } from "./routes/repository.routes";
import { webhookRouter } from "./routes/webhook.routes";
import { ruleRouter } from "./routes/rule.routes";
import { httpLogger } from "./middleware/logger.middleware";
import { logger } from "./utils/logger";

export const app = express();

// Attach structured HTTP access logging
app.use(httpLogger);

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

// Configurable automation rules routes
app.use("/api", ruleRouter);

// Global centralized error handling middleware
app.use((err: any, req: Request, res: Response, _next: express.NextFunction) => {
  const statusCode = err.status || err.statusCode || 500;
  logger.error(
    {
      err,
      reqId: (req as any).id,
      method: req.method,
      path: req.path,
      statusCode,
    },
    `[ErrorHandler] ${err.name || "Error"}: ${err.message}`
  );
  res.status(statusCode).json({
    success: false,
    error: {
      message: err.message || "An unexpected error occurred.",
      code: err.code || "INTERNAL_SERVER_ERROR",
    },
  });
});

export default app;
