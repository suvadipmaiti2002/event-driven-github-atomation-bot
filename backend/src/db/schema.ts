import { pgTable, uuid, varchar, text, timestamp } from "drizzle-orm/pg-core";

// ---------------------------------------------------------------------------
// Users Table (Only table required for Feature 1: Authentication)
// ---------------------------------------------------------------------------
export const users = pgTable("users", {
  id: uuid("id").primaryKey().defaultRandom(),
  githubId: varchar("github_id", { length: 64 }).notNull().unique(),
  username: varchar("username", { length: 255 }).notNull(),
  email: varchar("email", { length: 255 }),
  avatarUrl: text("avatar_url"),
  accessToken: text("access_token").notNull(), // GitHub OAuth user token
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

// Inferred TypeScript types
export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;
