import { logger } from "./logger";

export interface RetryOptions {
  maxRetries?: number;
  delayMs?: number;
  label?: string;
}

/**
 * Executes an async operation with automatic exponential/linear retry on transient failures.
 * Used across GitHub Octokit, Slack, and AI APIs to absorb network blips.
 */
export async function withRetry<T>(
  fn: () => Promise<T>,
  options: RetryOptions = {}
): Promise<T> {
  const maxRetries = options.maxRetries ?? 2;
  const baseDelay = options.delayMs ?? 800;
  const label = options.label || "Operation";

  let lastError: any;

  for (let attempt = 1; attempt <= maxRetries + 1; attempt++) {
    try {
      return await fn();
    } catch (err: any) {
      lastError = err;

      // Check if we still have retries remaining
      if (attempt <= maxRetries) {
        const nextDelay = baseDelay * attempt;
        logger.warn(
          `[Retry] ⚠️ ${label} failed (attempt ${attempt}/${maxRetries + 1}): ${err?.message || err}. Retrying in ${nextDelay}ms...`
        );
        await new Promise((resolve) => setTimeout(resolve, nextDelay));
      }
    }
  }

  throw lastError;
}
