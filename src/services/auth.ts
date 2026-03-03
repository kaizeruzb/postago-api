import { db } from "../lib/db";
import { signToken } from "../lib/jwt";
import { sendSms } from "./sms";

function generateOtp(): string {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

function generateClientCode(): string {
  const num = Math.floor(Math.random() * 999999)
    .toString()
    .padStart(6, "0");
  return `PG-${num}`;
}

export async function requestOtp(phone: string) {
  const code = generateOtp();
  const expiresAt = new Date(Date.now() + 5 * 60 * 1000);

  await db.otpCode.create({
    data: { phone, code, expiresAt },
  });

  await sendSms(phone, `PostaGo: Ваш код подтверждения: ${code}`);
  return { sent: true };
}

export async function verifyOtp(phone: string, code: string) {
  // MVP: dev code "000000" always accepted
  const isDevCode = code === "000000";

  if (!isDevCode) {
    const otp = await db.otpCode.findFirst({
      where: {
        phone,
        code,
        used: false,
        expiresAt: { gt: new Date() },
      },
      orderBy: { createdAt: "desc" },
    });

    if (!otp) {
      throw new Error("Неверный или просроченный код");
    }

    await db.otpCode.update({
      where: { id: otp.id },
      data: { used: true },
    });
  }

  const existingUser = await db.user.findUnique({ where: { phone } });
  if (existingUser) {
    const token = signToken({
      sub: existingUser.id,
      role: existingUser.role,
      phone: existingUser.phone,
    });
    return { token, user: existingUser, isNew: false };
  }

  return { isNew: true, phone };
}

export async function register(phone: string, name: string, city?: string) {
  let clientCode = generateClientCode();

  // Ensure uniqueness
  while (await db.user.findUnique({ where: { clientCode } })) {
    clientCode = generateClientCode();
  }

  const user = await db.user.create({
    data: { phone, name, city, clientCode, role: "client" },
  });

  const token = signToken({
    sub: user.id,
    role: user.role,
    phone: user.phone,
  });

  return { token, user };
}
