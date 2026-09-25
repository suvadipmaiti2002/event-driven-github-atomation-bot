import { eq, and } from "drizzle-orm";
import { db } from "../db";
import { repositories, Repository, NewRepository } from "../db/schema";

export class RepositoryRepository {
  /**
   * Find all active connected repositories for a given user
   */
  async findActiveByUserId(userId: string): Promise<Repository[]> {
    return db
      .select()
      .from(repositories)
      .where(
        and(
          eq(repositories.userId, userId),
          eq(repositories.isActive, true)
        )
      );
  }

  /**
   * Find a repository by internal UUID
   */
  async findById(id: string): Promise<Repository | undefined> {
    const results = await db
      .select()
      .from(repositories)
      .where(eq(repositories.id, id))
      .limit(1);

    return results[0];
  }

  /**
   * Find a repository by GitHub's unique repository ID
   */
  async findByGithubRepoId(githubRepoId: string): Promise<Repository | undefined> {
    const results = await db
      .select()
      .from(repositories)
      .where(eq(repositories.githubRepoId, githubRepoId))
      .limit(1);

    return results[0];
  }

  /**
   * Save a newly connected repository or re-activate an existing one
   */
  async upsertRepository(data: {
    githubRepoId: string;
    repoOwner: string;
    repoName: string;
    repoFullName: string;
    webhookId: string | null;
    userId: string;
  }): Promise<Repository> {
    const existing = await this.findByGithubRepoId(data.githubRepoId);

    if (existing) {
      const [updated] = await db
        .update(repositories)
        .set({
          repoOwner: data.repoOwner,
          repoName: data.repoName,
          repoFullName: data.repoFullName,
          webhookId: data.webhookId,
          isActive: true, // Reactivate if it was soft-deleted
          updatedAt: new Date(),
        })
        .where(eq(repositories.id, existing.id))
        .returning();

      return updated;
    }

    const [created] = await db
      .insert(repositories)
      .values({
        githubRepoId: data.githubRepoId,
        repoOwner: data.repoOwner,
        repoName: data.repoName,
        repoFullName: data.repoFullName,
        webhookId: data.webhookId,
        userId: data.userId,
        isActive: true,
      })
      .returning();

    return created;
  }

  /**
   * Soft-delete: Mark repository as inactive
   */
  async setInactive(id: string): Promise<Repository | undefined> {
    const [updated] = await db
      .update(repositories)
      .set({
        isActive: false,
        webhookId: null,
        updatedAt: new Date(),
      })
      .where(eq(repositories.id, id))
      .returning();

    return updated;
  }

  /**
   * Update Slack incoming webhook URL for a repository
   */
  async updateSlackWebhook(id: string, slackWebhookUrl: string | null): Promise<Repository | undefined> {
    const [updated] = await db
      .update(repositories)
      .set({
        slackWebhookUrl,
        updatedAt: new Date(),
      })
      .where(eq(repositories.id, id))
      .returning();

    return updated;
  }
}

export const repositoryRepository = new RepositoryRepository();
