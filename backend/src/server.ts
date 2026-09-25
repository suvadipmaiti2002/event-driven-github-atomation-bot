import { app } from "./app";
import { env } from "./config/env";
import { logger } from "./utils/logger";

const PORT = env.PORT || 5000;

// Catch unhandled promise rejections
process.on("unhandledRejection", (reason: any) => {
  logger.fatal({ err: reason }, "💥 Unhandled Promise Rejection encountered");
});

// Catch uncaught exceptions
process.on("uncaughtException", (error: Error) => {
  logger.fatal({ err: error }, "💥 Uncaught Exception thrown");
  // Give logger time to flush before exit in production
  process.exit(1);
});

app.listen(PORT, () => {
  logger.info(
    { port: PORT, frontendOrigin: env.FRONTEND_URL, nodeEnv: env.NODE_ENV },
    `🚀 Backend server listening on port ${PORT}`
  );
});
