import jwt from "jsonwebtoken";
import { env } from "../config/env";
import { userRepository } from "../repositories/user.repository";
import { User } from "../db/schema";

export interface JwtPayload {
  userId: string;
}

export class AuthService {
  /**
   * Issues a signed JWT access token for the authenticated user
   */
  generateToken(userId: string): string {
    return jwt.sign({ userId }, env.JWT_SECRET, {
      expiresIn: "7d",
    });
  }

  /**
   * Verifies and decodes a JWT token
   */
  verifyToken(token: string): JwtPayload {
    return jwt.verify(token, env.JWT_SECRET) as JwtPayload;
  }

  /**
   * Finds or creates a user from GitHub OAuth profile data
   */
  async handleGithubAuth(params: {
    githubId: string;
    username: string;
    email?: string;
    avatarUrl?: string;
    accessToken: string;
  }): Promise<User> {
    return userRepository.upsertUser({
      githubId: params.githubId,
      username: params.username,
      email: params.email,
      avatarUrl: params.avatarUrl,
      accessToken: params.accessToken,
    });
  }

  /**
   * Get user profile by ID
   */
  async getUserById(userId: string): Promise<User | undefined> {
    return userRepository.findById(userId);
  }
}

export const authService = new AuthService();
