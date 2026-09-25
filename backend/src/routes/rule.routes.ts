import { Router } from "express";
import { ruleController } from "../controllers/rule.controller";
import { authenticate } from "../middleware/auth.middleware";

export const ruleRouter = Router();

// 1. Fetch all rules for a repository (Protected)
ruleRouter.get(
  "/repositories/:repoId/rules",
  authenticate,
  (req, res, next) => ruleController.getRules(req as any, res, next)
);

// 2. Toggle a rule active/inactive (Protected)
ruleRouter.patch(
  "/rules/:ruleId/toggle",
  authenticate,
  (req, res, next) => ruleController.toggleRule(req as any, res, next)
);

// 3. Create a custom rule (Protected)
ruleRouter.post(
  "/repositories/:repoId/rules",
  authenticate,
  (req, res, next) => ruleController.createRule(req as any, res, next)
);

// 4. Delete a custom rule (Protected)
ruleRouter.delete(
  "/rules/:ruleId",
  authenticate,
  (req, res, next) => ruleController.deleteRule(req as any, res, next)
);
