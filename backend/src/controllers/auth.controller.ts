import { Request, Response, NextFunction } from "express";
import { authService } from "../services/auth.service";
import { env } from "../config/env";
import { AuthenticatedRequest } from "../middleware/auth.middleware";
import { User } from "../db/schema";

export class AuthController {
  /**
   * Handle OAuth Callback:
   * Sets secure cookie and redirects cleanly to /dashboard with ZERO tokens in URL
   */
  async githubCallback(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const user = req.user as User;

      if (!user) {
        res.redirect(`${env.FRONTEND_URL}/login?error=authentication_failed`);
        return;
      }

      const token = authService.generateToken(user.id);

      const isProduction = env.NODE_ENV === "production";
      res.cookie("token", token, {
        httpOnly: true,
        secure: isProduction,
        sameSite: isProduction ? "none" : "lax",
        maxAge: 7 * 24 * 60 * 60 * 1000,
      });

      // Redirect cleanly to the protected dashboard
      res.redirect(`${env.FRONTEND_URL}/dashboard`);
    } catch (error) {
      next(error);
    }
  }

  /**
   * Get currently authenticated user profile
   * Returns user info and token in the JSON body so frontend can store it safely
   */
  async getMe(req: AuthenticatedRequest, res: Response): Promise<void> {
    const user = req.user;

    if (!user) {
      res.status(401).json({
        success: false,
        error: { code: "UNAUTHORIZED", message: "Not authenticated" },
      });
      return;
    }

    const token = authService.generateToken(user.id);

    res.status(200).json({
      success: true,
      data: {
        user: {
          id: user.id,
          githubId: user.githubId,
          username: user.username,
          email: user.email,
          avatarUrl: user.avatarUrl,
          createdAt: user.createdAt,
        },
        token,
      },
    });
  }

  /**
   * Logout user and clear session cookie
   */
  async logout(_req: Request, res: Response): Promise<void> {
    const isProduction = env.NODE_ENV === "production";
    res.clearCookie("token", {
      httpOnly: true,
      secure: isProduction,
      sameSite: isProduction ? "none" : "lax",
    });
    res.status(200).json({
      success: true,
      message: "Successfully logged out",
    });
  }
}

export const authController = new AuthController();
