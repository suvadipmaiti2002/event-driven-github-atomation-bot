import { Response, NextFunction } from "express";
import { z } from "zod";
import { env } from "../config/env";
import { repositoryService } from "../services/repository.service";
import { AuthenticatedRequest } from "../middleware/auth.middleware";

// Validation schema for connecting a repository
const connectRepositorySchema = z.object({
  githubRepoId: z.string().min(1, "GitHub repository ID is required"),
  repoOwner: z.string().min(1, "Repository owner is required"),
  repoName: z.string().min(1, "Repository name is required"),
  repoFullName: z.string().min(1, "Repository full name is required"),
});

export class RepositoryController {
  /**
   * GET /api/github/available-repositories
   * List repositories from the user's GitHub account
   */
  async getAvailableRepos(
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const user = req.user!;
      const repos = await repositoryService.getAvailableGithubRepos(user);

      res.status(200).json({
        success: true,
        data: repos,
      });
    } catch (error: any) {
      if (error?.status === 401 || error?.message?.includes("Bad credentials")) {
        const isProduction = env.NODE_ENV === "production";
        res.clearCookie("token", {
          httpOnly: true,
          secure: isProduction,
          sameSite: isProduction ? "none" : "lax",
        });

        res.status(401).json({
          success: false,
          error: {
            code: "GITHUB_TOKEN_EXPIRED",
            message: "Your GitHub session has expired.",
          },
        });
        return;
      }
      next(error);
    }
  }

  /**
   * GET /api/repositories/connected
   * List all actively connected repositories from Supabase
   */
  async getConnectedRepos(
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const user = req.user!;
      const repos = await repositoryService.getConnectedRepositories(user.id);

      res.status(200).json({
        success: true,
        data: repos,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * POST /api/repositories/connect
   * Connect a repository and register its webhook
   */
  async connectRepo(
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const user = req.user!;
      const validatedInput = connectRepositorySchema.parse(req.body);

      const repo = await repositoryService.connectRepository(user, validatedInput);

      res.status(201).json({
        success: true,
        message: "Repository connected successfully",
        data: repo,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * POST /api/repositories/:id/disconnect
   * Soft-delete/passive disconnect of a repository and remove webhook
   */
  async disconnectRepo(
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const user = req.user!;
      const repoId = req.params.id;

      const repo = await repositoryService.disconnectRepository(user, repoId);

      res.status(200).json({
        success: true,
        message: "Repository disconnected successfully",
        data: repo,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * PATCH /api/repositories/:id/slack-webhook
   * Update or remove Slack webhook URL for a repository
   */
  async updateSlackWebhook(
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const user = req.user!;
      const repoId = req.params.id;
      const { slackWebhookUrl } = req.body || {};

      const cleanUrl = typeof slackWebhookUrl === "string" ? slackWebhookUrl.trim() : null;
      if (cleanUrl && !cleanUrl.startsWith("https://hooks.slack.com/services/")) {
        res.status(400).json({
          success: false,
          error: "Invalid URL. Slack Webhook must start with https://hooks.slack.com/services/",
        });
        return;
      }

      const repo = await repositoryService.updateSlackWebhook(
        user,
        repoId,
        cleanUrl || null
      );

      res.status(200).json({
        success: true,
        message: cleanUrl
          ? "Slack webhook URL updated successfully."
          : "Slack webhook URL removed.",
        data: repo,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * POST /api/repositories/:id/slack-test
   * Dispatches a test ping to verify the Slack webhook URL
   */
  async testSlackWebhook(
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const user = req.user!;
      const repoId = req.params.id;
      const { webhookUrl } = req.body || {};

      const result = await repositoryService.testSlackWebhook(user, repoId, webhookUrl);

      if (!result.success) {
        res.status(400).json({
          success: false,
          error: result.error || "Failed to send test Slack ping.",
        });
        return;
      }

      res.status(200).json({
        success: true,
        message: "Test notification sent to Slack successfully!",
      });
    } catch (error) {
      next(error);
    }
  }
}

export const repositoryController = new RepositoryController();
