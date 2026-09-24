import { Router } from "express";
import passport from "passport";
import { authController } from "../controllers/auth.controller";
import { authenticate } from "../middleware/auth.middleware";

export const authRouter = Router();

// 1. Initiate GitHub OAuth Login
authRouter.get(
  "/github",
  passport.authenticate("github", {
    scope: ["user:email", "repo", "admin:repo_hook"],
    session: false,
  })
);

// 2. GitHub OAuth Callback URL
authRouter.get(
  "/github/callback",
  passport.authenticate("github", {
    session: false,
    failureRedirect: "/api/auth/failure",
  }),
  authController.githubCallback
);

// Failure route
authRouter.get("/failure", (_req, res) => {
  res.status(401).json({
    success: false,
    error: {
      code: "AUTH_FAILED",
      message: "GitHub authentication was canceled or failed.",
    },
  });
});

// 3. Get currently logged in user profile (Protected)
authRouter.get("/me", authenticate, authController.getMe);

// 4. Logout
authRouter.post("/logout", authController.logout);
