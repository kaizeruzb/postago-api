import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { calculateCostSchema, createRouteSchema, updateRouteSchema } from "@postago/shared";
import { calculateCost } from "../services/tariff";
import { requireAuth, requireRole } from "../middleware/auth";
import { db } from "../lib/db";

export const tariffRouter = new Hono();

// Public: calculate shipping cost
tariffRouter.post(
  "/calculate",
  zValidator("json", calculateCostSchema),
  async (c) => {
    const input = c.req.valid("json");
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
