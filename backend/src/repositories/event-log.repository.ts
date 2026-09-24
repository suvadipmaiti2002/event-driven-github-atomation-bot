import { eq, desc } from "drizzle-orm";
import { db } from "../db";
import { eventLogs, EventLog, NewEventLog, ActionLog } from "../db/schema";

export type EventLogWithActions = EventLog & {
  actionLogs: ActionLog[];
};

export class EventLogRepository {
  /**
   * Find an event by its GitHub Delivery GUID.
   * Used for Idempotency check.
   */
  async findByDeliveryId(deliveryId: string): Promise<EventLog | undefined> {
    const results = await db
      .select()
      .from(eventLogs)
      .where(eq(eventLogs.deliveryId, deliveryId))
      .limit(1);

    return results[0];
  }

  /**
   * Insert a new event log into Supabase.
   */
  async createEventLog(data: NewEventLog): Promise<EventLog> {
    const [created] = await db
      .insert(eventLogs)
      .values(data)
      .returning();

    return created;
  }

  /**
   * Fetch the most recent event logs across connected repos with associated action execution logs.
   */
  async getRecentEvents(limit: number = 50): Promise<EventLogWithActions[]> {
    return db.query.eventLogs.findMany({
      orderBy: [desc(eventLogs.createdAt)],
      limit,
      with: {
        actionLogs: {
          orderBy: (actionLogs, { desc }) => [desc(actionLogs.createdAt)],
        },
      },
    }) as Promise<EventLogWithActions[]>;
  }

  /**
   * Fetch event logs for a specific repository.
   */
  async getEventsByRepositoryId(
    repositoryId: string,
    limit: number = 50
  ): Promise<EventLog[]> {
    return db
      .select()
      .from(eventLogs)
      .where(eq(eventLogs.repositoryId, repositoryId))
      .orderBy(desc(eventLogs.createdAt))
      .limit(limit);
  }
}

export const eventLogRepository = new EventLogRepository();
