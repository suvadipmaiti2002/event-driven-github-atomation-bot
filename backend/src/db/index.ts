import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";
import { env } from "../config/env";

// Reusable PostgreSQL client connection
const connectionString = env.DATABASE_URL || "postgresql://postgres:postgres@localhost:5432/test";

// Limit connection pool size appropriately
export const client = postgres(connectionString, {
  max: env.NODE_ENV === "production" ? 10 : 1,
});

// Type-safe Drizzle ORM instance with full schema relations
export const db = drizzle(client, { schema });
export { schema };
