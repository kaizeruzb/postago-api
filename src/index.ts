import { serve } from "@hono/node-server";
import { createApp } from "./app";

const app = createApp();
const port = Number(process.env.PORT ?? process.env.API_PORT ?? 4000);

serve({ fetch: app.fetch, port }, (info) => {
  console.log(`PostaGo API running on http://localhost:${info.port}`);
});

export { app };
export default app;
