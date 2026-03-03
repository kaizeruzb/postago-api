import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import type { BatchStatus } from "@prisma/client";
import { createBatchSchema, shipBatchSchema } from "@postago/shared";
import { createBatch, shipBatch, receiveBatch } from "../services/batch";
import { requireAuth, requireRole } from "../middleware/auth";
import { db } from "../lib/db";

export const batchRouter = new Hono();

// Operator: create batch
batchRouter.post(
  "/",
  requireAuth,
  requireRole("operator", "admin"),
  zValidator("json", createBatchSchema),
  async (c) => {
    const { routeId, parcelIds } = c.req.valid("json");
    const operatorId = c.get("user").sub;
    const batch = await createBatch(routeId, operatorId, parcelIds);
    return c.json(batch, 201);
  },
);

// Operator: list batches
batchRouter.get(
  "/",
  requireAuth,
  requireRole("operator", "admin"),
  async (c) => {
    const status = c.req.query("status") as BatchStatus | undefined;
    const batches = await db.batch.findMany({
      where: status ? { status } : {},
      include: {
        route: true,
        operator: { select: { name: true } },
        _count: { select: { batchParcels: true } },
      },
      orderBy: { createdAt: "desc" },
    });
    return c.json({ batches });
  },
);

// Operator: get batch details
batchRouter.get(
  "/:id",
  requireAuth,
  requireRole("operator", "admin"),
  async (c) => {
    const id = c.req.param("id");
    const batch = await db.batch.findUnique({
      where: { id },
      include: {
        route: true,
        operator: { select: { name: true } },
        batchParcels: {
          include: {
            parcel: {
              include: {
                user: { select: { name: true, clientCode: true, phone: true } },
              },
            },
          },
        },
      },
    });
    if (!batch) return c.json({ error: "Партия не найдена" }, 404);
    return c.json(batch);
  },
);

// Operator: ship batch
batchRouter.post(
  "/:id/ship",
  requireAuth,
  requireRole("operator", "admin"),
  zValidator("json", shipBatchSchema),
  async (c) => {
    const id = c.req.param("id");
    const { trackingNumber } = c.req.valid("json");
    const operatorId = c.get("user").sub;
    const batch = await shipBatch(id, operatorId, trackingNumber);
    return c.json(batch);
  },
);

// Operator: receive batch at destination
batchRouter.post(
  "/:id/receive",
  requireAuth,
  requireRole("operator", "admin"),
  async (c) => {
    const id = c.req.param("id");
    const operatorId = c.get("user").sub;
    const batch = await receiveBatch(id, operatorId);
    return c.json(batch);
  },
);
