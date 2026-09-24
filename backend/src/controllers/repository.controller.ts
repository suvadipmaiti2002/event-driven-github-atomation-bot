import { Response, NextFunction } from "express";
import { z } from "zod";
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
    } catch (error) {
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
}

export const repositoryController = new RepositoryController();
