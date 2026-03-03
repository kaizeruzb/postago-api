import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import type { ParcelStatus } from "@prisma/client";
import {
  createParcelSchema,
  updateParcelWeightSchema,
  updateParcelStatusSchema,
} from "@postago/shared";
import { createParcel, updateParcelStatus } from "../services/parcel";
import { requireAuth, requireRole } from "../middleware/auth";
import { db } from "../lib/db";

export const parcelRouter = new Hono();

// Client: create parcel
parcelRouter.post(
  "/",
  requireAuth,
  zValidator("json", createParcelSchema),
  async (c) => {
    const user = c.get("user");
    const input = c.req.valid("json");
    const parcel = await createParcel(user.sub, input);
    return c.json(parcel, 201);
  },
);

// Client: list my parcels
parcelRouter.get("/", requireAuth, async (c) => {
  const user = c.get("user");
  const status = c.req.query("status") as ParcelStatus | undefined;

  const parcels = await db.parcel.findMany({
    where: {
      userId: user.sub,
      ...(status ? { status } : {}),
    },
    include: { route: true },
    orderBy: { createdAt: "desc" },
  });

  return c.json({ parcels });
});

// Anyone: get parcel by tracking code (public tracking) — must be before /:id
parcelRouter.get("/track/:code", async (c) => {
  const code = c.req.param("code");
  const parcel = await db.parcel.findUnique({
    where: { trackingCode: code },
    include: {
      route: true,
      events: { orderBy: { timestamp: "desc" } },
      photos: true,
    },
  });

  if (!parcel) return c.json({ error: "Посылка не найдена" }, 404);
  return c.json(parcel);
});

// Operator: list all parcels for warehouse — must be before /:id
parcelRouter.get(
  "/warehouse/all",
  requireAuth,
  requireRole("operator_origin", "operator_destination", "admin"),
  async (c) => {
    const status = c.req.query("status") as ParcelStatus | undefined;
    const parcels = await db.parcel.findMany({
      where: status ? { status } : {},
      include: {
        route: true,
        user: { select: { name: true, clientCode: true, phone: true } },
      },
      orderBy: { createdAt: "desc" },
      take: 100,
    });
    return c.json({ parcels });
  },
);

// Client: get parcel details
parcelRouter.get("/:id", requireAuth, async (c) => {
  const id = c.req.param("id");
  const user = c.get("user");

  const parcel = await db.parcel.findFirst({
    where: { id, userId: user.sub },
    include: {
      route: true,
      events: { orderBy: { timestamp: "desc" } },
      photos: true,
      payments: true,
    },
  });

  if (!parcel) return c.json({ error: "Посылка не найдена" }, 404);
  return c.json(parcel);
});

// Operator: update weight after weighing
parcelRouter.patch(
  "/:id/weight",
  requireAuth,
  requireRole("operator_origin", "admin"),
  zValidator("json", updateParcelWeightSchema),
  async (c) => {
    const id = c.req.param("id");
    const data = c.req.valid("json");

    const parcel = await db.parcel.findUnique({
      where: { id },
      include: { route: true },
    });
    if (!parcel) return c.json({ error: "Посылка не найдена" }, 404);

    const finalCost = Number(parcel.route.ratePerKg) * data.weightKg;

    const updated = await db.parcel.update({
      where: { id },
      data: {
        weightKg: data.weightKg,
        lengthCm: data.lengthCm,
        widthCm: data.widthCm,
        heightCm: data.heightCm,
        finalCost,
        status: "weighed",
      },
      include: { route: true },
    });

    await db.parcelEvent.create({
      data: {
        parcelId: id,
        status: "weighed",
        operatorId: c.get("user").sub,
        note: `Вес: ${data.weightKg} кг. Стоимость: $${finalCost.toFixed(2)}`,
      },
    });

    return c.json(updated);
  },
);

// Operator: update status
parcelRouter.patch(
  "/:id/status",
  requireAuth,
  requireRole("operator_origin", "operator_destination", "courier", "admin"),
  zValidator("json", updateParcelStatusSchema),
  async (c) => {
    const id = c.req.param("id");
    const { status, location, note } = c.req.valid("json");
    const operatorId = c.get("user").sub;

    const parcel = await updateParcelStatus(
      id,
      status as ParcelStatus,
      operatorId,
      location,
      note,
    );
    return c.json(parcel);
  },
);
