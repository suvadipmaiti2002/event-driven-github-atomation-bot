import { Response, NextFunction } from "express";
import { webhookService } from "../services/webhook.service";
import { RequestWithRawBody } from "../middleware/hmac.middleware";
import { AuthenticatedRequest } from "../middleware/auth.middleware";

export class WebhookController {
  /**
   * POST /api/webhooks/github
   * Ingests, verifies, and idempotently records GitHub webhook events
   */
  async handleWebhook(
    req: RequestWithRawBody,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const result = await webhookService.processWebhook(req.headers, req.body);

      if (result.isDuplicate) {
        res.status(200).json({
          success: true,
          message: "Duplicate webhook delivery ignored (Idempotency active).",
          deliveryId: result.eventLog.deliveryId,
        });
        return;
      }

      res.status(200).json({
        success: true,
        message: "Webhook event successfully processed and recorded.",
        data: {
          id: result.eventLog.id,
          deliveryId: result.eventLog.deliveryId,
          eventType: result.eventLog.eventType,
          action: result.eventLog.action,
          sender: result.eventLog.sender,
          createdAt: result.eventLog.createdAt,
        },
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /api/events
   * Fetch recent event logs for authenticated users
   */
  async getEvents(
    _req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const events = await webhookService.getRecentEvents(50);

      res.status(200).json({
        success: true,
        data: events,
      });
    } catch (error) {
      next(error);
    }
  }
}

export const webhookController = new WebhookController();
