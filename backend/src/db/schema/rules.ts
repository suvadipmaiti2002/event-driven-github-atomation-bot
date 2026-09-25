import { pgTable, uuid, varchar, text, boolean, timestamp, index } from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { repositories } from "./repositories";

// ---------------------------------------------------------------------------
// Rules Table (Configurable Automation Rules)
// ---------------------------------------------------------------------------
export const rules = pgTable(
  "rules",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    repositoryId: uuid("repository_id")
      .notNull()
      .references(() => repositories.id, { onDelete: "cascade" }),
    name: varchar("name", { length: 120 }).notNull(),
    eventType: varchar("event_type", { length: 50 }).default("all").notNull(), // 'issues' | 'pull_request' | 'all'
    
    // Condition (IF)
    matchField: varchar("match_field", { length: 50 }).notNull(), // 'always' | 'title_contains' | 'body_contains' | 'author_is'
    matchValue: varchar("match_value", { length: 255 }), // e.g. 'bug', 'breaking', null if 'always'

    // Actions (THEN)
    actionLabel: varchar("action_label", { length: 100 }), // e.g. 'bug', 'breaking-change'
    actionSlack: boolean("action_slack").default(false).notNull(), // send slack notification?
    actionComment: text("action_comment"), // custom comment or template
    actionAiTriage: boolean("action_ai_triage").default(false).notNull(), // run Gemini AI?

    // Controls
    isActive: boolean("is_active").default(true).notNull(), // Master ON/OFF toggle switch
    isDefault: boolean("is_default").default(false).notNull(), // System preset rule vs user custom rule
    
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    repoIdIdx: index("rules_repo_id_idx").on(table.repositoryId),
  })
);

// Relations
export const rulesRelations = relations(rules, ({ one }) => ({
  repository: one(repositories, {
    fields: [rules.repositoryId],
    references: [repositories.id],
  }),
}));

// Inferred TypeScript types
export type Rule = typeof rules.$inferSelect;
export type NewRule = typeof rules.$inferInsert;
