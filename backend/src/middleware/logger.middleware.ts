import { Request, Response, NextFunction } from "express";
import { logger } from "../utils/logger";

export function httpLogger(req: Request, res: Response, next: NextFunction) {
  const start = Date.now();

  res.on("finish", () => {
    const duration = Date.now() - start;
    const isError = res.statusCode >= 400;

    // Never skip any error or failure (4xx, 5xx) - even if on background endpoints!
    // Only silence healthy, successful (200/304) routine 3-second dashboard pings
    const isRoutineSuccess =
      !isError &&
      (req.method === "OPTIONS" ||
        req.url === "/api/health" ||
        req.url.startsWith("/api/events"));

    if (isRoutineSuccess) {
      return;
    }

    const logMsg = `${req.method} ${req.originalUrl || req.url} ${res.statusCode} (${duration}ms)`;

    if (res.statusCode >= 500) {
      logger.error(`[HTTP] ${logMsg}`, {
        status: res.statusCode,
        path: req.url,
        ip: req.ip,
      });
    } else if (res.statusCode >= 400) {
      logger.warn(`[HTTP] ${logMsg}`, {
        status: res.statusCode,
        path: req.url,
        ip: req.ip,
      });
    } else {
      logger.info(`[HTTP] ${logMsg}`);
    }
  });

  next();
}
