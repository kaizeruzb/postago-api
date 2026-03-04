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
import { notifyParcelStatusChange } from "../services/notification";

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
      user: { select: { name: true, clientCode: true, phone: true } },
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
  requireRole("operator", "courier", "admin"),
  async (c) => {
    const user = c.get("user");
    const status = c.req.query("status") as ParcelStatus | undefined;

    // Operators see parcels related to their warehouse; admins see all
    let warehouseFilter: object = {};

    if (user.role !== "admin" && user.warehouseId) {
      warehouseFilter = {
        OR: [
          // Parcels assigned to this warehouse
          { warehouseId: user.warehouseId },
          // Unassigned new parcels
          { warehouseId: null, status: "created" as ParcelStatus },
          // Incoming: parcels in batches destined for this warehouse
          {
            batchParcels: {
              some: {
                batch: { destinationWarehouseId: user.warehouseId },
              },
            },
          },
        ],
      };
    }

    const parcels = await db.parcel.findMany({
      where: {
        ...(status ? { status } : {}),
        ...warehouseFilter,
      },
      include: {
        route: true,
        user: { select: { name: true, clientCode: true, phone: true, city: true } },
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
  requireRole("operator", "admin"),
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

    const user = c.get("user");
    const updated = await db.parcel.update({
      where: { id },
      data: {
        weightKg: data.weightKg,
        lengthCm: data.lengthCm,
        widthCm: data.widthCm,
        heightCm: data.heightCm,
        finalCost,
        status: "weighed",
        warehouseId: user.warehouseId || undefined,
      },
      include: { route: true },
    });

    await db.parcelEvent.create({
      data: {
        parcelId: id,
        status: "weighed",
        operatorId: user.sub,
        note: `Вес: ${data.weightKg} кг. Стоимость: $${finalCost.toFixed(2)}`,
      },
    });

    // Notify client about weighing
    notifyParcelStatusChange(id, "weighed").catch(console.error);

    return c.json(updated);
  },
);

// Operator: confirm cash payment (weighed → paid)
parcelRouter.patch(
  "/:id/confirm-payment",
  requireAuth,
  requireRole("operator", "admin"),
  async (c) => {
    const id = c.req.param("id");
    const user = c.get("user");

    const parcel = await db.parcel.findUnique({ where: { id } });
    if (!parcel) return c.json({ error: "Посылка не найдена" }, 404);
    if (parcel.status !== "weighed") {
      return c.json({ error: "Посылка должна быть в статусе 'взвешена'" }, 400);
    }

    const updated = await db.parcel.update({
      where: { id },
      data: { status: "paid" },
      include: { route: true },
    });

    await db.parcelEvent.create({
      data: {
        parcelId: id,
        status: "paid",
        operatorId: user.sub,
        note: "Оплата подтверждена оператором (наличные/перевод)",
      },
    });

    await db.payment.create({
      data: {
        parcelId: id,
        userId: parcel.userId,
        amount: parcel.finalCost ?? 0,
        currency: "USD",
        provider: "cash",
        status: "completed",
        paidAt: new Date(),
      },
    });

    notifyParcelStatusChange(id, "paid").catch(console.error);

    return c.json(updated);
  },
);

// Operator: accept parcel to warehouse (paid → received_at_origin)
parcelRouter.patch(
  "/:id/accept",
  requireAuth,
  requireRole("operator", "admin"),
  async (c) => {
    const id = c.req.param("id");
    const user = c.get("user");

    const parcel = await db.parcel.findUnique({ where: { id } });
    if (!parcel) return c.json({ error: "Посылка не найдена" }, 404);
    if (parcel.status !== "paid") {
      return c.json({ error: "Посылка должна быть оплачена" }, 400);
    }

    const updated = await db.parcel.update({
      where: { id },
      data: { status: "received_at_origin" },
      include: { route: true },
    });

    await db.parcelEvent.create({
      data: {
        parcelId: id,
        status: "received_at_origin",
        operatorId: user.sub,
        note: "Принято на склад",
      },
    });

    notifyParcelStatusChange(id, "received_at_origin").catch(console.error);

    return c.json(updated);
  },
);

// Operator: update status
parcelRouter.patch(
  "/:id/status",
  requireAuth,
  requireRole("operator", "courier", "admin"),
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
