import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { createPaymentSchema } from "@postago/shared";
import { createPayment, handlePaymentWebhook } from "../services/payment";
import { requireAuth } from "../middleware/auth";
import { db } from "../lib/db";

export const paymentRouter = new Hono();

// Client: create payment
paymentRouter.post(
  "/",
  requireAuth,
  zValidator("json", createPaymentSchema),
  async (c) => {
    const userId = c.get("user").sub;
    const input = c.req.valid("json");
    const result = await createPayment(userId, input);
    return c.json(result, 201);
  },
);

// Client: list my payments
paymentRouter.get("/", requireAuth, async (c) => {
  const userId = c.get("user").sub;
  const payments = await db.payment.findMany({
    where: { userId },
    include: { parcel: { select: { trackingCode: true, description: true } } },
    orderBy: { createdAt: "desc" },
  });
  return c.json({ payments });
});

// Webhook: payment callback (Click/Payme stub)
paymentRouter.post("/webhook/:provider", async (c) => {
  const body = await c.req.json();
  const { paymentId, externalId, success } = body;
  await handlePaymentWebhook(paymentId, externalId, success);
  return c.json({ received: true });
});
