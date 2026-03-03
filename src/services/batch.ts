import { db } from "../lib/db";

export async function createBatch(
  routeId: string,
  operatorId: string,
  parcelIds: string[],
) {
  const batch = await db.batch.create({
    data: {
      routeId,
      operatorId,
      totalParcels: parcelIds.length,
      batchParcels: {
        create: parcelIds.map((parcelId) => ({ parcelId })),
      },
    },
    include: { batchParcels: { include: { parcel: true } }, route: true },
  });

  await db.parcel.updateMany({
    where: { id: { in: parcelIds } },
    data: { status: "in_batch" },
  });

  await db.parcelEvent.createMany({
    data: parcelIds.map((parcelId) => ({
      parcelId,
      status: "in_batch",
      operatorId,
      note: `Добавлена в партию ${batch.id}`,
    })),
  });

  return batch;
}

export async function shipBatch(
  batchId: string,
  operatorId: string,
  trackingNumber?: string,
) {
  const batch = await db.batch.update({
    where: { id: batchId },
    data: { status: "shipped", trackingNumber, shippedAt: new Date() },
    include: { batchParcels: true },
  });

  const parcelIds = batch.batchParcels.map((bp) => bp.parcelId);

  await db.parcel.updateMany({
    where: { id: { in: parcelIds } },
    data: { status: "shipped" },
  });

  await db.parcelEvent.createMany({
    data: parcelIds.map((parcelId) => ({
      parcelId,
      status: "shipped",
      operatorId,
      note: `Отправлена в партии ${batchId}`,
    })),
  });

  return batch;
}

export async function receiveBatch(batchId: string, operatorId: string) {
  const batch = await db.batch.update({
    where: { id: batchId },
    data: { status: "received", receivedAt: new Date() },
    include: { batchParcels: true },
  });

  const parcelIds = batch.batchParcels.map((bp) => bp.parcelId);

  await db.parcel.updateMany({
    where: { id: { in: parcelIds } },
    data: { status: "received_at_destination" },
  });

  await db.parcelEvent.createMany({
    data: parcelIds.map((parcelId) => ({
      parcelId,
      status: "received_at_destination",
      operatorId,
      note: `Партия ${batchId} принята на складе`,
    })),
  });

  return batch;
}
