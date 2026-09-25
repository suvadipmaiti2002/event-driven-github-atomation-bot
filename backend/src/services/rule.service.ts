import { ruleRepository } from "../repositories/rule.repository";
import { Rule, NewRule } from "../db/schema";

export class RuleService {
  /**
   * Get all rules for a repository.
   * If this repository has never had rules seeded, automatically seeds the 4 default rules.
   */
  async getRulesForRepository(repositoryId: string): Promise<Rule[]> {
    return ruleRepository.seedDefaultRules(repositoryId);
  }

  /**
   * Toggle a rule ON or OFF
   */
  async toggleRule(ruleId: string, isActive: boolean): Promise<Rule> {
    const updated = await ruleRepository.toggleRule(ruleId, isActive);
    if (!updated) {
      throw new Error(`Rule with ID ${ruleId} not found.`);
    }
    return updated;
  }

  /**
   * Create a new custom automation rule
   */
  async createCustomRule(data: {
    repositoryId: string;
    name: string;
    eventType?: string;
    matchField: string;
    matchValue?: string | null;
    actionLabel?: string | null;
    actionSlack?: boolean;
    actionComment?: string | null;
    actionAiTriage?: boolean;
  }): Promise<Rule> {
    const newRule: NewRule = {
      repositoryId: data.repositoryId,
      name: data.name.trim(),
      eventType: data.eventType || "all",
      matchField: data.matchField,
      matchValue: data.matchValue ? data.matchValue.trim() : null,
      actionLabel: data.actionLabel ? data.actionLabel.trim().toLowerCase() : null,
      actionSlack: Boolean(data.actionSlack),
      actionComment: data.actionComment ? data.actionComment.trim() : null,
      actionAiTriage: Boolean(data.actionAiTriage),
      isActive: true,
      isDefault: false, // User custom rule
    };

    return ruleRepository.createRule(newRule);
  }

  /**
   * Delete a custom rule (System preset rules are protected)
   */
  async deleteRule(ruleId: string): Promise<void> {
    const rule = await ruleRepository.findById(ruleId);
    if (!rule) {
      throw new Error("Rule not found.");
    }

    if (rule.isDefault) {
      throw new Error("Cannot delete a default system rule. You can toggle it OFF instead.");
    }

    const success = await ruleRepository.deleteRule(ruleId);
    if (!success) {
      throw new Error("Failed to delete rule.");
    }
  }
}

export const ruleService = new RuleService();
