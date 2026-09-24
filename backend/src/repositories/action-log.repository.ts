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
}

export const actionLogRepository = new ActionLogRepository();
