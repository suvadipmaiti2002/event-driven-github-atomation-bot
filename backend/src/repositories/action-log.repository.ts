import { eq, desc } from "drizzle-orm";
import { db } from "../db";
import { actionLogs, ActionLog, NewActionLog } from "../db/schema";

export class ActionLogRepository {
  /**
   * Persist a new action log (observability audit trail)
   */
  async createActionLog(data: NewActionLog): Promise<ActionLog> {
    const [created] = await db
      .insert(actionLogs)
      .values(data)
      .returning();

    return created;
  }

  /**
   * Fetch all actions executed for a specific webhook event
   */
  async findByEventLogId(eventLogId: string): Promise<ActionLog[]> {
    return db
      .select()
      .from(actionLogs)
      .where(eq(actionLogs.eventLogId, eventLogId))
      .orderBy(desc(actionLogs.createdAt));
  }

  /**
   * Find an action log by its primary key ID
   */
  async findById(id: string): Promise<ActionLog | null> {
    const [found] = await db
      .select()
      .from(actionLogs)
      .where(eq(actionLogs.id, id))
      .limit(1);

    return found || null;
  }

  /**
   * Update an existing action log status, error message, details, and retry count
   */
  async updateActionLog(
    id: string,
    updates: Partial<NewActionLog> & { retryCount?: number }
  ): Promise<ActionLog | null> {
    const [updated] = await db
      .update(actionLogs)
      .set(updates)
      .where(eq(actionLogs.id, id))
      .returning();

    return updated || null;
  }
}

export const actionLogRepository = new ActionLogRepository();
