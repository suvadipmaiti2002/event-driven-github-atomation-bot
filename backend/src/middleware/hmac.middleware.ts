import { Request, Response, NextFunction } from "express";
import crypto from "crypto";
import { env } from "../config/env";

export interface RequestWithRawBody extends Request {
  rawBody?: Buffer;
}

/**
 * Middleware that strictly verifies GitHub Webhook HMAC SHA-256 signatures.
 * Adheres strictly to the project Quality Bar:
 * 1. Checks X-Hub-Signature-256 header.
 * 2. Uses the raw buffer body to compute expected signature.
 * 3. Compares signatures using crypto.timingSafeEqual to prevent timing attacks.
 * 4. Rejects forged/invalid requests with 401 Unauthorized.
 */
export function verifyHmacSignature(
  req: RequestWithRawBody,
  res: Response,
  next: NextFunction
): void {
  const signatureHeader = req.headers["x-hub-signature-256"] as string | undefined;

  // 1. Missing signature header
  if (!signatureHeader) {
    console.warn("⚠️ Webhook request rejected: Missing X-Hub-Signature-256 header");
    res.status(401).json({
      success: false,
      error: {
        code: "UNAUTHORIZED",
        message: "Missing webhook signature header (X-Hub-Signature-256).",
      },
    });
    return;
  }

  // 2. Missing raw body buffer
  if (!req.rawBody) {
    console.error("❌ Webhook error: Raw request body buffer was not captured.");
    res.status(500).json({
      success: false,
      error: {
        code: "INTERNAL_SERVER_ERROR",
        message: "Failed to verify signature: raw request body missing.",
      },
    });
    return;
  }

  // 3. Compute expected signature using shared secret
  const hmac = crypto.createHmac("sha256", env.GITHUB_WEBHOOK_SECRET);
  const expectedSignature = `sha256=${hmac.update(req.rawBody).digest("hex")}`;

  const signatureBuffer = Buffer.from(signatureHeader, "utf8");
  const expectedBuffer = Buffer.from(expectedSignature, "utf8");

  // 4. Compare lengths safely before timingSafeEqual to avoid RangeError exceptions
  if (signatureBuffer.length !== expectedBuffer.length) {
    console.warn("⚠️ Webhook request rejected: Signature length mismatch");
    res.status(401).json({
      success: false,
      error: {
        code: "UNAUTHORIZED",
        message: "Invalid webhook signature.",
      },
    });
    return;
  }

  // 5. Timing-safe comparison to prevent side-channel timing attacks
  const isValid = crypto.timingSafeEqual(signatureBuffer, expectedBuffer);

  if (!isValid) {
    console.warn("⚠️ Webhook request rejected: Invalid HMAC signature");
    res.status(401).json({
      success: false,
      error: {
        code: "UNAUTHORIZED",
        message: "Invalid webhook signature.",
      },
    });
    return;
  }

  // Signature valid! Proceed to webhook processing
  next();
}
