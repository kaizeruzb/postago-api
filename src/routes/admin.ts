import { Hono } from "hono";
import type { UserRole } from "@prisma/client";
import { requireAuth, requireRole } from "../middleware/auth";
import { db } from "../lib/db";

export const adminRouter = new Hono();

adminRouter.use("*", requireAuth, requireRole("admin"));

// List users with pagination
adminRouter.get("/users", async (c) => {
  const page = Math.max(1, Number(c.req.query("page") ?? 1));
  const limit = Math.min(100, Math.max(1, Number(c.req.query("limit") ?? 50)));
  const role = c.req.query("role") as UserRole | undefined;

  const where = role ? { role } : {};
  const [users, total] = await Promise.all([
    db.user.findMany({
      where,
      select: {
        id: true,
        phone: true,
        name: true,
        role: true,
        city: true,
        clientCode: true,
        createdAt: true,
        warehouseId: true,
        warehouse: { select: { id: true, country: true, city: true, type: true } },
        _count: { select: { parcels: true } },
      },
      skip: (page - 1) * limit,
      take: limit,
      orderBy: { createdAt: "desc" },
    }),
    db.user.count({ where }),
  ]);

  return c.json({ users, total, page, limit });
});

// Update user role
adminRouter.patch("/users/:id/role", async (c) => {
  const id = c.req.param("id");
  const { role } = await c.req.json() as { role: UserRole };
  const user = await db.user.update({
    where: { id },
    data: { role },
    select: { id: true, phone: true, name: true, role: true },
  });
  return c.json(user);
});

// Assign operator to warehouse
adminRouter.patch("/users/:id/warehouse", async (c) => {
  const id = c.req.param("id");
  const { warehouseId } = await c.req.json() as { warehouseId: string | null };

  const user = await db.user.update({
    where: { id },
    data: { warehouseId },
    select: {
      id: true, phone: true, name: true, role: true, warehouseId: true,
      warehouse: { select: { id: true, country: true, city: true, type: true } },
    },
  });
  return c.json(user);
});

// Analytics: dashboard stats
adminRouter.get("/analytics", async (c) => {
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

  const [
    totalUsers,
    totalParcels,
    parcelsThisMonth,
    totalRevenue,
    parcelsByStatus,
  ] = await Promise.all([
    db.user.count({ where: { role: "client" } }),
    db.parcel.count(),
    db.parcel.count({ where: { createdAt: { gte: thirtyDaysAgo } } }),
    db.payment.aggregate({
      where: { status: "completed" },
      _sum: { amount: true },
    }),
    db.parcel.groupBy({ by: ["status"], _count: true }),
  ]);

  return c.json({
    totalUsers,
    totalParcels,
    parcelsThisMonth,
    totalRevenue: totalRevenue._sum.amount ?? 0,
    parcelsByStatus,
  });
});

// Warehouses
adminRouter.get("/warehouses", async (c) => {
  const warehouses = await db.warehouse.findMany();
  return c.json({ warehouses });
});

adminRouter.post("/warehouses", async (c) => {
  const data = await c.req.json();
  const warehouse = await db.warehouse.create({ data });
  return c.json(warehouse, 201);
});
