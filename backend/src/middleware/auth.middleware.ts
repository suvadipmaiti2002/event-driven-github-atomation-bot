import { Request, Response, NextFunction } from "express";
import { authService } from "../services/auth.service";
import { User } from "../db/schema";

// Extend Express Request type to include user
export interface AuthenticatedRequest extends Request {
  user?: User;
}

export async function authenticate(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    // 1. Check for token in cookie OR Authorization Bearer header
    let token = req.cookies?.token;

    if (!token && req.headers.authorization?.startsWith("Bearer ")) {
      token = req.headers.authorization.split(" ")[1];
    }

    if (!token) {
      res.status(401).json({
        success: false,
        error: {
          code: "UNAUTHORIZED",
          message: "Authentication required. Please log in.",
        },
      });
      return;
    }

    // 2. Verify token
    const decoded = authService.verifyToken(token);

    // 3. Fetch user from database
    const user = await authService.getUserById(decoded.userId);

    if (!user) {
      res.status(401).json({
        success: false,
        error: {
          code: "USER_NOT_FOUND",
          message: "User session is invalid or user no longer exists.",
        },
      });
      return;
    }

    // 4. Attach user to request
    req.user = user;
    next();
  } catch (error) {
    res.status(401).json({
      success: false,
      error: {
        code: "INVALID_TOKEN",
        message: "Session token is invalid or expired.",
      },
    });
  }
}
