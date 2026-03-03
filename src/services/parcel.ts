import { db } from "../lib/db";
import type { ParcelStatus } from "@prisma/client";
import type { CreateParcelInput } from "@postago/shared";
import { notifyParcelStatusChange } from "./notification";

function generateTrackingCode(originCountry: string): string {
  const num = Math.floor(Math.random() * 999999)
    .toString()
    .padStart(6, "0");
  const year = new Date().getFullYear();
  return `PG-${originCountry.toUpperCase()}-${year}-${num}`;
}

export async function createParcel(userId: string, input: CreateParcelInput) {
  const route = await db.route.findUnique({ where: { id: input.routeId } });
  if (!route) throw new Error("Маршрут не найден");

  let trackingCode = generateTrackingCode(route.originCountry);
  while (await db.parcel.findUnique({ where: { trackingCode } })) {
    trackingCode = generateTrackingCode(route.originCountry);
  }

  const calculatedCost =
    input.weightKg != null
      ? Number(route.ratePerKg) * input.weightKg
      : undefined;

  const parcel = await db.parcel.create({
    data: {
      trackingCode,
      userId,
      routeId: input.routeId,
      description: input.description,
      declaredValue: input.declaredValue,
      weightKg: input.weightKg,
      lengthCm: input.lengthCm,
      widthCm: input.widthCm,
      heightCm: input.heightCm,
      calculatedCost,
    },
    include: { route: true },
  });

  await db.parcelEvent.create({
    data: {
      parcelId: parcel.id,
      status: "created",
      note: "Заказ создан",
    },
  });

  // Notify client about new parcel
  notifyParcelStatusChange(parcel.id, "created").catch(console.error);

  return parcel;
}

export async function updateParcelStatus(
  parcelId: string,
  status: ParcelStatus,
  operatorId: string,
  location?: string,
  note?: string,
) {
  const parcel = await db.parcel.update({
    where: { id: parcelId },
    data: { status },
  });

  await db.parcelEvent.create({
    data: { parcelId, status, operatorId, location, note },
  });

  // Notify client about status change
  notifyParcelStatusChange(parcel.id, status).catch(console.error);

  return parcel;
}
