import { db } from "../lib/db";
import { sendSms } from "./sms";
import { sendTelegramMessage } from "../lib/telegram";

const STATUS_MESSAGES: Record<string, string> = {
  created: "Заказ создан. Ожидаем поступления на склад.",
  paid: "Оплата получена. Ожидаем посылку на складе.",
  received_at_origin: "Посылка принята на складе.",
  weighed: "Посылка взвешена.",
  in_batch: "Посылка включена в партию для отправки.",
  shipped: "Посылка отправлена!",
  in_transit: "Посылка в пути.",
  customs: "Посылка на таможне.",
  received_at_destination: "Посылка прибыла в страну назначения.",
  sorting: "Посылка сортируется для доставки.",
  out_for_delivery: "Посылка передана курьеру. Ожидайте доставку!",
  delivered: "Посылка доставлена! Спасибо за использование PostaGo.",
};

export async function notifyParcelStatusChange(
  parcelId: string,
  status: string,
) {
  const parcel = await db.parcel.findUnique({
    where: { id: parcelId },
    include: { user: true },
  });

  if (!parcel) return;

  const statusMessage = STATUS_MESSAGES[status] ?? `Статус посылки изменен: ${status}`;
  const message = `📦 PostaGo: ${parcel.trackingCode}
${statusMessage}`;

  // 1. Send SMS (always for MVP status changes)
  try {
    await sendSms(parcel.user.phone, message);
    
    await db.notification.create({
      data: {
        userId: parcel.userId,
        channel: "sms",
        message: statusMessage,
        status: "sent",
        sentAt: new Date(),
      },
    });
  } catch (error) {
    console.error(`Failed to send SMS to ${parcel.user.phone}:`, error);
  }

  // 2. Send Telegram (if linked)
  if (parcel.user.telegramId) {
    try {
      const sent = await sendTelegramMessage(parcel.user.telegramId, message);

      await db.notification.create({
        data: {
          userId: parcel.userId,
          channel: "telegram",
          message,
          status: sent ? "sent" : "failed",
          sentAt: new Date(),
        },
      });
    } catch (error) {
      console.error(`Failed to send Telegram to ${parcel.user.telegramId}:`, error);
    }
  }
}
