import { Router } from "express";
import { repositoryController } from "../controllers/repository.controller";
import { authenticate } from "../middleware/auth.middleware";

export const repositoryRouter = Router();

// All repository operations require an authenticated session
repositoryRouter.use(authenticate);

// 1. Fetch available repositories from user's GitHub account
repositoryRouter.get(
  "/github/available-repositories",
  repositoryController.getAvailableRepos
);

// 2. Fetch connected repositories from Supabase
repositoryRouter.get(
  "/repositories/connected",
  repositoryController.getConnectedRepos
);

// 3. Connect a new repository (installs webhook & saves in Supabase)
repositoryRouter.post(
  "/repositories/connect",
  repositoryController.connectRepo
);

// 4. Soft-disconnect a repository (deactivates & deletes webhook)
repositoryRouter.post(
  "/repositories/:id/disconnect",
  repositoryController.disconnectRepo
);
