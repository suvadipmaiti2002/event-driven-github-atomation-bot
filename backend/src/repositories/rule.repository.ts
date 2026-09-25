import { eq, and, desc, asc } from "drizzle-orm";
import { db } from "../db";
import { rules, Rule, NewRule } from "../db/schema";

export class RuleRepository {
  /**
   * Fetch all rules configured for a repository
   */
  async findByRepositoryId(repositoryId: string): Promise<Rule[]> {
    return db
      .select()
      .from(rules)
      .where(eq(rules.repositoryId, repositoryId))
      .orderBy(desc(rules.isDefault), asc(rules.createdAt));
  }

  /**
   * Fetch only active rules for evaluation during incoming webhook
   */
  async findActiveByRepositoryId(repositoryId: string): Promise<Rule[]> {
    return db
      .select()
      .from(rules)
      .where(and(eq(rules.repositoryId, repositoryId), eq(rules.isActive, true)))
      .orderBy(desc(rules.isDefault), asc(rules.createdAt));
  }

  /**
   * Find a specific rule by ID
   */
  async findById(id: string): Promise<Rule | undefined> {
    const [rule] = await db
      .select()
      .from(rules)
      .where(eq(rules.id, id))
      .limit(1);

    return rule;
  }

  /**
   * Create a new rule
   */
  async createRule(data: NewRule): Promise<Rule> {
    const [created] = await db
      .insert(rules)
      .values(data)
      .returning();

    return created;
  }

  /**
   * Toggle a rule's active state
   */
  async toggleRule(id: string, isActive: boolean): Promise<Rule | undefined> {
    const [updated] = await db
      .update(rules)
      .set({
        isActive,
        updatedAt: new Date(),
      })
      .where(eq(rules.id, id))
      .returning();

    return updated;
  }

  /**
   * Delete a custom rule (Default system rules cannot be deleted)
   */
  async deleteRule(id: string): Promise<boolean> {
    const deleted = await db
      .delete(rules)
      .where(and(eq(rules.id, id), eq(rules.isDefault, false)))
      .returning();

    return deleted.length > 0;
  }

  /**
   * Seeds the 4 standard system rules for a repository if none exist
   */
  async seedDefaultRules(repositoryId: string): Promise<Rule[]> {
    const existing = await this.findByRepositoryId(repositoryId);
    if (existing.length > 0) {
      return existing;
    }

    const defaultRulesToInsert: NewRule[] = [
      {
        repositoryId,
        name: "AI Triage & Analysis (Gemini)",
        eventType: "all",
        matchField: "always",
        matchValue: null,
        actionLabel: null,
        actionSlack: false,
        actionComment: null,
        actionAiTriage: true,
        isActive: true,
        isDefault: true,
      },
      {
        repositoryId,
        name: "Automated Welcome Comment",
        eventType: "all",
        matchField: "always",
        matchValue: null,
        actionLabel: null,
        actionSlack: false,
        actionComment: null,
        actionAiTriage: false,
        isActive: true,
        isDefault: true,
      },
      {
        repositoryId,
        name: "Lifecycle Label Sync",
        eventType: "all",
        matchField: "always",
        matchValue: null,
        actionLabel: null,
        actionSlack: false,
        actionComment: null,
        actionAiTriage: false,
        isActive: true,
        isDefault: true,
      },
      {
        repositoryId,
        name: "Slack Team Notifications",
        eventType: "all",
        matchField: "always",
        matchValue: null,
        actionLabel: null,
        actionSlack: true,
        actionComment: null,
        actionAiTriage: false,
        isActive: true,
        isDefault: true,
      },
    ];

    return db
      .insert(rules)
      .values(defaultRulesToInsert)
      .returning();
  }
}

export const ruleRepository = new RuleRepository();
