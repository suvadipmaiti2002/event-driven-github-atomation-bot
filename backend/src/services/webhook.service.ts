import { eventLogRepository } from "../repositories/event-log.repository";
import { repositoryRepository } from "../repositories/repository.repository";
import { EventLog } from "../db/schema";

export interface ProcessWebhookResult {
  isDuplicate: boolean;
  eventLog: EventLog;
}

export class WebhookService {
  /**
   * Processes an incoming GitHub webhook:
   * 1. Idempotency Check: Verifies deliveryId against event_logs
   * 2. Finds associated repository in Supabase
   * 3. Stores metadata and raw payload to guarantee zero data loss
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

    // 1. Idempotency Check: Check if this delivery was already processed
    const existingEvent = await eventLogRepository.findByDeliveryId(deliveryId);

    if (existingEvent) {
      console.log(
        `[WebhookService] 🔁 Idempotency triggered: Delivery ${deliveryId} already recorded. Skipping side effects.`
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
    const action = payload.action || null;
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

    console.log(
      `[WebhookService] ✅ Event recorded for [${repoFullName || "unknown repo"}]: [${eventType}] action: [${action || "none"}] delivery: [${deliveryId}]`
    );

    return {
      isDuplicate: false,
      eventLog,
    };
  }

  /**
   * Retrieve recent event logs for the dashboard
   */
  async getRecentEvents(limit: number = 50): Promise<EventLog[]> {
    return eventLogRepository.getRecentEvents(limit);
  }
}

export const webhookService = new WebhookService();
