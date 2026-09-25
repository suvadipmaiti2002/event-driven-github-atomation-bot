import { Response, NextFunction } from "express";
import { z } from "zod";
import { ruleService } from "../services/rule.service";
import { AuthenticatedRequest } from "../middleware/auth.middleware";

// Validation schema for creating a custom rule
const createRuleSchema = z.object({
  name: z.string().min(1, "Rule name is required").max(120),
  eventType: z.enum(["issues", "pull_request", "all"]).default("all"),
  matchField: z.enum(["always", "title_contains", "body_contains", "author_is"]),
  matchValue: z.string().nullable().optional(),
  actionLabel: z.string().nullable().optional(),
  actionSlack: z.boolean().default(false),
  actionComment: z.string().nullable().optional(),
  actionAiTriage: z.boolean().default(false),
});

const toggleRuleSchema = z.object({
  isActive: z.boolean(),
});

export class RuleController {
  /**
   * GET /api/repositories/:repoId/rules
   * Fetch all rules for a repository (auto-seeds defaults if first time)
   */
  async getRules(
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const { repoId } = req.params;
      const rules = await ruleService.getRulesForRepository(repoId);

      res.status(200).json({
        success: true,
        data: rules,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * PATCH /api/rules/:ruleId/toggle
   * Toggle a rule active/inactive
   */
  async toggleRule(
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const { ruleId } = req.params;
      const validation = toggleRuleSchema.safeParse(req.body);

      if (!validation.success) {
        res.status(400).json({
          success: false,
          error: {
            code: "VALIDATION_ERROR",
            message: "isActive boolean is required.",
          },
        });
        return;
      }

      const updated = await ruleService.toggleRule(ruleId, validation.data.isActive);

      res.status(200).json({
        success: true,
        data: updated,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * POST /api/repositories/:repoId/rules
   * Create a new custom rule
   */
  async createRule(
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const { repoId } = req.params;
      const validation = createRuleSchema.safeParse(req.body);

      if (!validation.success) {
        res.status(400).json({
          success: false,
          error: {
            code: "VALIDATION_ERROR",
            message: validation.error.errors[0]?.message || "Invalid rule configuration.",
          },
        });
        return;
      }

      const created = await ruleService.createCustomRule({
        repositoryId: repoId,
        ...validation.data,
      });

      res.status(201).json({
        success: true,
        data: created,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * DELETE /api/rules/:ruleId
   * Delete a custom rule
   */
  async deleteRule(
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const { ruleId } = req.params;
      await ruleService.deleteRule(ruleId);

      res.status(200).json({
        success: true,
        message: "Rule deleted successfully.",
      });
    } catch (error: any) {
      if (error?.message?.includes("Cannot delete a default system rule")) {
        res.status(400).json({
          success: false,
          error: {
            code: "SYSTEM_RULE_PROTECTED",
            message: error.message,
          },
        });
        return;
      }
      next(error);
    }
  }
}

export const ruleController = new RuleController();
