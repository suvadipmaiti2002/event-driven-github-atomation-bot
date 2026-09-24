import { pgTable, uuid, varchar, text, timestamp, jsonb, index } from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { eventLogs } from "./event_logs";

// ---------------------------------------------------------------------------
// Action Logs Table (Observability for actions taken by the bot)
// ---------------------------------------------------------------------------
export const actionLogs = pgTable(
  "action_logs",
  {
    id: uuid("id").primaryKey().defaultRandom(),

    // Linked to the specific event that triggered this action
    eventLogId: uuid("event_log_id")
      .notNull()
      .references(() => eventLogs.id, { onDelete: "cascade" }),

    // Type of action executed: e.g. "github_comment", "github_label", "slack_alert"
    actionType: varchar("action_type", { length: 64 }).notNull(),

    // Execution status: "SUCCESS" or "FAILED"
    status: varchar("status", { length: 32 }).default("PENDING").notNull(),

    // Detailed metadata (e.g. comment posted, Slack payload)
    details: jsonb("details"),

    // Recorded error message if status is FAILED (observability standard)
    errorMessage: text("error_message"),

    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    eventLogIdIdx: index("actions_event_log_id_idx").on(table.eventLogId),
    statusIdx: index("actions_status_idx").on(table.status),
  })
);

// ActionLog Relations
export const actionLogsRelations = relations(actionLogs, ({ one }) => ({
  eventLog: one(eventLogs, {
    fields: [actionLogs.eventLogId],
    references: [eventLogs.id],
  }),
}));

// Inferred TypeScript types
export type ActionLog = typeof actionLogs.$inferSelect;
export type NewActionLog = typeof actionLogs.$inferInsert;
