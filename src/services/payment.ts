import { db } from "../lib/db";
import type { CreatePaymentInput } from "@postago/shared";

export async function createPayment(userId: string, input: CreatePaymentInput) {
  const parcel = await db.parcel.findFirst({
    where: { id: input.parcelId, userId },
  });
  if (!parcel) throw new Error("Посылка не найдена");
  if (!parcel.finalCost && !parcel.calculatedCost) {
    throw new Error("Стоимость ещё не рассчитана");
  }

  const amount = parcel.finalCost ?? parcel.calculatedCost!;

  const payment = await db.payment.create({
    data: {
      parcelId: input.parcelId,
      userId,
      amount,
      currency: input.currency,
      provider: input.provider,
    },
  });

  // MVP: auto-complete cash payments
  if (input.provider === "cash") {
    return completeCashPayment(payment.id);
  }

  // Click/Payme: stub payment URL
  return { payment, paymentUrl: `https://pay.postago.uz/${payment.id}` };
}

async function completeCashPayment(paymentId: string) {
  const payment = await db.payment.update({
    where: { id: paymentId },
    data: { status: "completed", paidAt: new Date() },
    include: { parcel: true },
  });

  await db.parcel.update({
    where: { id: payment.parcelId },
    data: { status: "paid" },
  });

  await db.parcelEvent.create({
    data: {
      parcelId: payment.parcelId,
      status: "paid",
      note: "Оплата наличными принята",
    },
  });

  return { payment };
}

export async function handlePaymentWebhook(
  paymentId: string,
  externalId: string,
  success: boolean,
) {
  if (!success) {
    await db.payment.update({
      where: { id: paymentId },
      data: { status: "failed", externalId },
    });
    return;
  }

  const payment = await db.payment.update({
    where: { id: paymentId },
    data: { status: "completed", externalId, paidAt: new Date() },
  });

  await db.parcel.update({
    where: { id: payment.parcelId },
    data: { status: "paid" },
  });

  await db.parcelEvent.create({
    data: {
      parcelId: payment.parcelId,
      status: "paid",
      note: `Оплата через ${payment.provider} подтверждена`,
    },
  });
}
