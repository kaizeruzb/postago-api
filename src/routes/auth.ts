import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { sendOtpSchema, verifyOtpSchema, registerSchema } from "@postago/shared";
import { requestOtp, verifyOtp, register } from "../services/auth";
import { requireAuth } from "../middleware/auth";
import { db } from "../lib/db";

export const authRouter = new Hono();

authRouter.post("/otp/send", zValidator("json", sendOtpSchema), async (c) => {
  const { phone } = c.req.valid("json");
  const result = await requestOtp(phone);
  return c.json(result);
});

authRouter.post("/otp/verify", zValidator("json", verifyOtpSchema), async (c) => {
  const { phone, code } = c.req.valid("json");
  const result = await verifyOtp(phone, code);
  return c.json(result);
});

authRouter.post("/register", zValidator("json", registerSchema), async (c) => {
  const { phone, name, city } = c.req.valid("json");
  const result = await register(phone, name, city);
  return c.json(result, 201);
});

authRouter.get("/me", requireAuth, async (c) => {
  const { sub } = c.get("user");
  const user = await db.user.findUnique({
    where: { id: sub },
    select: {
      id: true,
      phone: true,
      name: true,
      role: true,
      city: true,
      clientCode: true,
      telegramId: true,
      createdAt: true,
      warehouseId: true,
      warehouse: { select: { id: true, country: true, city: true, type: true } },
    },
  });
  if (!user) return c.json({ error: "Пользователь не найден" }, 404);
  return c.json(user);
});
