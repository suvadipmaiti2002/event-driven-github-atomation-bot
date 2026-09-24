import { eq } from "drizzle-orm";
import { db } from "../db";
import { users, User, NewUser } from "../db/schema";

export class UserRepository {
  /**
   * Find a user by their unique GitHub ID
   */
  async findByGithubId(githubId: string): Promise<User | undefined> {
    const result = await db
      .select()
      .from(users)
      .where(eq(users.githubId, githubId))
      .limit(1);

    return result[0];
  }

  /**
   * Find a user by their internal UUID
   */
  async findById(id: string): Promise<User | undefined> {
    const result = await db
      .select()
      .from(users)
      .where(eq(users.id, id))
      .limit(1);

    return result[0];
  }

  /**
   * Insert a new user or update their access token and profile info on login
   */
  async upsertUser(userData: {
    githubId: string;
    username: string;
    email?: string;
    avatarUrl?: string;
    accessToken: string;
  }): Promise<User> {
    const existing = await this.findByGithubId(userData.githubId);

    if (existing) {
      const [updated] = await db
        .update(users)
        .set({
          username: userData.username,
          email: userData.email,
          avatarUrl: userData.avatarUrl,
          accessToken: userData.accessToken,
          updatedAt: new Date(),
        })
        .where(eq(users.id, existing.id))
        .returning();

      return updated;
    }

    const [created] = await db
      .insert(users)
      .values(userData)
      .returning();

    return created;
  }
}

export const userRepository = new UserRepository();
