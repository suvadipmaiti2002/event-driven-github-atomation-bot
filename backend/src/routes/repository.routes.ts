import { Router } from "express";
import { repositoryController } from "../controllers/repository.controller";
import { authenticate } from "../middleware/auth.middleware";

export const repositoryRouter = Router();

// 1. Fetch available repositories from user's GitHub account (Protected)
repositoryRouter.get(
  "/github/available-repositories",
  authenticate,
  repositoryController.getAvailableRepos
);

// 2. Fetch connected repositories from Supabase (Protected)
repositoryRouter.get(
  "/repositories/connected",
  authenticate,
  repositoryController.getConnectedRepos
);

// 3. Connect a new repository (Protected)
repositoryRouter.post(
  "/repositories/connect",
  authenticate,
  repositoryController.connectRepo
);

// 4. Soft-disconnect a repository (Protected)
repositoryRouter.post(
  "/repositories/:id/disconnect",
  authenticate,
  repositoryController.disconnectRepo
);
