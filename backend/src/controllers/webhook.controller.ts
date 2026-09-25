import { Response, NextFunction } from "express";
import { webhookService } from "../services/webhook.service";
import { actionService } from "../services/action.service";
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

      if (result.isSkipped) {
        res.status(200).json({
          success: true,
          message: "Event skipped by policy (not tracked in database).",
        });
        return;
      }

      if (result.isDuplicate) {
        res.status(200).json({
          success: true,
          message: "Duplicate webhook delivery ignored (Idempotency active).",
          deliveryId: result.eventLog?.deliveryId,
        });
        return;
      }

      res.status(200).json({
        success: true,
        message: "Webhook event successfully processed and recorded.",
        data: {
          id: result.eventLog!.id,
          deliveryId: result.eventLog!.deliveryId,
          eventType: result.eventLog!.eventType,
          action: result.eventLog!.action,
          sender: result.eventLog!.sender,
          createdAt: result.eventLog!.createdAt,
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

  /**
   * POST /api/actions/:id/retry
   * Re-executes a failed action for observability recovery
   */
  async retryAction(
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const actionLogId = req.params.id;
      if (!actionLogId) {
        res.status(400).json({
          success: false,
          error: { code: "BAD_REQUEST", message: "Action log ID is required." },
        });
        return;
      }

      const result = await actionService.retryAction(actionLogId);

      res.status(200).json({
        success: result.success,
        data: result.actionLog,
        error: result.error,
      });
    } catch (error) {
      next(error);
    }
  }
}

export const webhookController = new WebhookController();
