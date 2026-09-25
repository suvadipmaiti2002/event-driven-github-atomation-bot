import { pgTable, uuid, varchar, boolean, timestamp, index } from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { users } from "./users";
import { eventLogs } from "./event_logs";
import { rules } from "./rules";

// ---------------------------------------------------------------------------
// Repositories Table (Connected Repositories)
// ---------------------------------------------------------------------------
export const repositories = pgTable(
  "repositories",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    githubRepoId: varchar("github_repo_id", { length: 64 }).notNull().unique(),
    repoOwner: varchar("repo_owner", { length: 255 }).notNull(),
    repoName: varchar("repo_name", { length: 255 }).notNull(),
    repoFullName: varchar("repo_fullname", { length: 255 }).notNull(),
    webhookId: varchar("webhook_id", { length: 64 }), // GitHub webhook ID to enable deletion on disconnect
    isActive: boolean("is_active").default(true).notNull(), // Soft-delete / passive toggle
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    userIdIdx: index("repos_user_id_idx").on(table.userId),
  })
);

// Repository Relations
export const repositoriesRelations = relations(repositories, ({ one, many }) => ({
  user: one(users, {
    fields: [repositories.userId],
    references: [users.id],
  }),
  eventLogs: many(eventLogs),
  rules: many(rules),
}));

// Inferred TypeScript types
export type Repository = typeof repositories.$inferSelect;
export type NewRepository = typeof repositories.$inferInsert;
