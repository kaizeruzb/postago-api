import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { z } from "zod";
import { createRouteSchema, updateRouteSchema } from "@postago/shared";
import { calculateCost } from "../services/tariff";
import { requireAuth, requireRole } from "../middleware/auth";
import { db } from "../lib/db";

export const tariffRouter = new Hono();

// Query params version: strings → numbers via coerce
const calculateQuerySchema = z.object({
  originCountry: z.string().length(2),
  destinationCountry: z.string().length(2),
  weightKg: z.coerce.number().positive().max(1000),
  transportType: z.enum(["air", "rail", "sea", "combined"]).optional(),
});

// Public: calculate shipping cost (GET with query params)
tariffRouter.get(
  "/calculate",
  zValidator("query", calculateQuerySchema),
  async (c) => {
    const input = c.req.valid("query");
    const estimates = await calculateCost(input);
    return c.json({ estimates });
  },
);

// Public: list active routes
tariffRouter.get("/routes", async (c) => {
  const routes = await db.route.findMany({
    where: { isActive: true },
    orderBy: [{ originCountry: "asc" }, { ratePerKg: "asc" }],
  });
  return c.json({ routes });
});

// Admin: create route
tariffRouter.post(
  "/routes",
  requireAuth,
  requireRole("admin"),
  zValidator("json", createRouteSchema),
  async (c) => {
    const data = c.req.valid("json");
    const route = await db.route.create({ data });
    return c.json(route, 201);
  },
);

// Admin: update route
tariffRouter.patch(
  "/routes/:id",
  requireAuth,
  requireRole("admin"),
  zValidator("json", updateRouteSchema),
  async (c) => {
    const id = c.req.param("id");
    const data = c.req.valid("json");
    const route = await db.route.update({ where: { id }, data });
    return c.json(route);
  },
);

// Admin: delete route
tariffRouter.delete(
  "/routes/:id",
  requireAuth,
  requireRole("admin"),
  async (c) => {
    const id = c.req.param("id");
    await db.route.delete({ where: { id } });
    return c.json({ deleted: true });
  },
);
