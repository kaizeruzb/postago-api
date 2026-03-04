import { Hono } from "hono";
import { cors } from "hono/cors";
import { logger } from "hono/logger";
import { errorHandler } from "./middleware/error-handler";
import { authRouter } from "./routes/auth";
import { tariffRouter } from "./routes/tariffs";
import { parcelRouter } from "./routes/parcels";
import { batchRouter } from "./routes/batches";
import { paymentRouter } from "./routes/payments";
import { adminRouter } from "./routes/admin";
import { db } from "./lib/db";

export function createApp(): Hono {
  const app = new Hono();

  app.use("*", logger());
  app.use(
    "*",
    cors({
      origin: (process.env.CORS_ORIGINS ?? "http://localhost:3000").split(","),
      credentials: true,
    })
  );

  app.onError(errorHandler);

  app.get("/health", (c) =>
    c.json({ status: "ok", timestamp: new Date().toISOString() })
  );

  app.route("/api/auth", authRouter);
  app.route("/api/tariffs", tariffRouter);
  app.route("/api/parcels", parcelRouter);
  app.route("/api/batches", batchRouter);
  app.route("/api/payments", paymentRouter);
  app.route("/api/admin", adminRouter);

  // Public: list warehouses
  app.get("/api/warehouses", async (c) => {
    const warehouses = await db.warehouse.findMany({
      orderBy: { country: "asc" },
    });
    return c.json({ warehouses });
  });

  return app;
}
