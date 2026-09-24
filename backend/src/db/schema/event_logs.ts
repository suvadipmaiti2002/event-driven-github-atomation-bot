import { pgTable, uuid, varchar, timestamp, jsonb, index } from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { repositories } from "./repositories";
import { actionLogs } from "./action_logs";

// ---------------------------------------------------------------------------
// Event Logs Table (Webhook Event Storage + Idempotency)
// ---------------------------------------------------------------------------
export const eventLogs = pgTable(
  "event_logs",
  {
    id: uuid("id").primaryKey().defaultRandom(),

    // GitHub's X-GitHub-Delivery GUID (UNIQUE constraint guarantees idempotency)
    deliveryId: varchar("delivery_id", { length: 128 }).notNull().unique(),

    // Associated repository in our database
    repositoryId: uuid("repository_id").references(() => repositories.id, {
      onDelete: "set null",
    }),

    // Repository full name for instant UI visibility (e.g. "owner/repo-name")
    repoFullName: varchar("repo_fullname", { length: 255 }),

    // GitHub's official event type: e.g. "issues", "pull_request", "push", "ping"
    eventType: varchar("event_type", { length: 64 }).notNull(),

    // Specific action: e.g. "opened", "closed", "created" (null for some events like push)
    action: varchar("action", { length: 64 }),

    // GitHub username of who initiated the event
    sender: varchar("sender", { length: 255 }),

    // Raw JSON payload from GitHub (Guarantees zero data loss / resilience)
    payload: jsonb("payload").notNull(),

    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    deliveryIdIdx: index("events_delivery_id_idx").on(table.deliveryId),
    repoIdIdx: index("events_repo_id_idx").on(table.repositoryId),
  })
);

// EventLog Relations
export const eventLogsRelations = relations(eventLogs, ({ one, many }) => ({
  repository: one(repositories, {
    fields: [eventLogs.repositoryId],
    references: [repositories.id],
  }),
  actionLogs: many(actionLogs),
}));

// Inferred TypeScript types
export type EventLog = typeof eventLogs.$inferSelect;
export type NewEventLog = typeof eventLogs.$inferInsert;
