import { app } from "./app";
import { env } from "./config/env";

const PORT = env.PORT || 5000;

app.listen(PORT, () => {
  console.log(`🚀 Backend server listening on port ${PORT}`);
  console.log(`📡 Accepting requests from frontend origin: ${env.FRONTEND_URL}`);
});
