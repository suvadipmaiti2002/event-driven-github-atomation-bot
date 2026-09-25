import { eventLogRepository, EventLogWithActions } from "../repositories/event-log.repository";
import { repositoryRepository } from "../repositories/repository.repository";
import { actionService } from "./action.service";
import { EventLog } from "../db/schema";
import { createChildLogger } from "../utils/logger";

const log = createChildLogger("WebhookService");

export interface ProcessWebhookResult {
  isDuplicate: boolean;
  isSkipped?: boolean;
  eventLog?: EventLog;
}

export class WebhookService {
  /**
   * Processes an incoming GitHub webhook:
   * 1. Skips unwanted events (e.g. push) to prevent database log bloat
   * 2. Idempotency Check: Verifies deliveryId against event_logs
   * 3. Finds associated repository in Supabase
   * 4. Stores metadata and raw payload to guarantee zero data loss
   * 5. Dispatches automated actions (comment, label, Slack) if applicable
   */
  async processWebhook(
    headers: Record<string, any>,
    payload: any
  ): Promise<ProcessWebhookResult> {
    const deliveryId = headers["x-github-delivery"] as string;
    const eventType = (headers["x-github-event"] as string) || "unknown";

    if (!deliveryId) {
      throw new Error("Missing X-GitHub-Delivery header.");
    }

    const action = payload.action || null;

    // Filter to primary lifecycle events only: opened, closed, reopened for issues and pull requests
    const isPrimaryLifecycle =
      (eventType === "issues" || eventType === "pull_request") &&
      action !== null &&
      ["opened", "closed", "reopened"].includes(action);

    if (!isPrimaryLifecycle) {
      log.debug(
        { eventType, action, deliveryId },
        `Skipping non-lifecycle event [${eventType}] action [${action || "none"}]`
      );
      return {
        isDuplicate: false,
        isSkipped: true,
      };
    }

    // 1. Idempotency Check: Check if this delivery was already processed
    const existingEvent = await eventLogRepository.findByDeliveryId(deliveryId);

    if (existingEvent) {
      log.info(
        { deliveryId },
        `Idempotency triggered: delivery ${deliveryId} already recorded. Skipping side effects.`
      );
      return {
        isDuplicate: true,
        eventLog: existingEvent,
      };
    }

    // 2. Locate the connected repository in Supabase
    const githubRepoId = payload.repository?.id ? String(payload.repository.id) : null;
    const repoFullName = payload.repository?.full_name || null;
    let repositoryId: string | null = null;

    if (githubRepoId) {
      const repo = await repositoryRepository.findByGithubRepoId(githubRepoId);
      if (repo && repo.isActive) {
        repositoryId = repo.id;
      }
    }

    // 3. Extract event metadata
    const sender = payload.sender?.login || null;

    // 4. Persist to Supabase (Resilience: stores raw JSON payload + repo full name)
    const eventLog = await eventLogRepository.createEventLog({
      deliveryId,
      repositoryId,
      repoFullName,
      eventType,
      action,
      sender,
      payload,
    });

    log.info(
      { repo: repoFullName, eventType, action, deliveryId, eventLogId: eventLog.id },
      `Event recorded for [${repoFullName || "unknown repo"}]: [${eventType}] action: [${action || "none"}]`
    );

    // 5. Trigger automated outbound actions (GitHub comment, label, Slack)
    try {
      await actionService.handleEvent(eventLog);
    } catch (actionErr: any) {
      log.error(
        { err: actionErr, deliveryId, repo: repoFullName },
        "Action execution encountered an unexpected error"
      );
    }

    return {
      isDuplicate: false,
      eventLog,
    };
  }

  /**
   * Retrieve recent event logs with their associated action execution logs
   */
  async getRecentEvents(limit: number = 50): Promise<EventLogWithActions[]> {
    return eventLogRepository.getRecentEvents(limit);
  }
}

export const webhookService = new WebhookService();
