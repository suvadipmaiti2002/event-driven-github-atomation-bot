import { Router } from "express";
import { webhookController } from "../controllers/webhook.controller";
import { verifyHmacSignature } from "../middleware/hmac.middleware";
import { authenticate } from "../middleware/auth.middleware";

export const webhookRouter = Router();

// 1. GitHub Webhook Ingestion Endpoint (Supports both plural /webhooks and singular /webhook)
webhookRouter.post(
  "/webhook/github",
  verifyHmacSignature,
  webhookController.handleWebhook
);

// 2. Fetch logged webhook events (Protected, for dashboard display)
webhookRouter.get(
  "/events",
  authenticate,
  webhookController.getEvents
);

// 3. Retry a failed action execution (Protected, observability retry)
webhookRouter.post(
  "/actions/:id/retry",
  authenticate,
  webhookController.retryAction
);
