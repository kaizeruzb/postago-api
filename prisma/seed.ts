import { PrismaClient, WarehouseType } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  console.log("Starting seed...");

  // 1. Routes
  const routes = [
    { originCountry: "KR", destinationCountry: "UZ", transportType: "air",      ratePerKg: 12.0, minDays: 7,  maxDays: 14 },
    { originCountry: "KR", destinationCountry: "UZ", transportType: "rail",     ratePerKg: 4.5,  minDays: 15, maxDays: 25 },
    { originCountry: "KR", destinationCountry: "UZ", transportType: "sea",      ratePerKg: 2.5,  minDays: 35, maxDays: 50 },
    { originCountry: "KR", destinationCountry: "KZ", transportType: "air",      ratePerKg: 11.0, minDays: 5,  maxDays: 10 },
    { originCountry: "KR", destinationCountry: "KZ", transportType: "rail",     ratePerKg: 4.0,  minDays: 12, maxDays: 20 },
    { originCountry: "CN", destinationCountry: "UZ", transportType: "air",      ratePerKg: 8.0,  minDays: 5,  maxDays: 10 },
    { originCountry: "CN", destinationCountry: "UZ", transportType: "rail",     ratePerKg: 3.0,  minDays: 10, maxDays: 18 },
    { originCountry: "CN", destinationCountry: "UZ", transportType: "sea",      ratePerKg: 2.0,  minDays: 30, maxDays: 45 },
    { originCountry: "CN", destinationCountry: "KZ", transportType: "air",      ratePerKg: 7.5,  minDays: 5,  maxDays: 10 },
    { originCountry: "CN", destinationCountry: "KZ", transportType: "rail",     ratePerKg: 2.8,  minDays: 8,  maxDays: 15 },
    { originCountry: "TR", destinationCountry: "UZ", transportType: "air",      ratePerKg: 10.0, minDays: 5,  maxDays: 10 },
    { originCountry: "TR", destinationCountry: "UZ", transportType: "combined", ratePerKg: 5.0,  minDays: 15, maxDays: 25 },
    { originCountry: "TR", destinationCountry: "KZ", transportType: "air",      ratePerKg: 9.5,  minDays: 5,  maxDays: 10 },
  ];

  for (const route of routes) {
    await prisma.route.upsert({
      where: {
        originCountry_destinationCountry_transportType: {
          originCountry: route.originCountry,
          destinationCountry: route.destinationCountry,
          transportType: route.transportType,
        },
      },
      update: route,
      create: route,
    });
  }
  console.log(`Routes seeded: ${routes.length}`);

  // 2. Admin user
  await prisma.user.upsert({
    where: { phone: "+998900000000" },
    update: {},
    create: {
      phone: "+998900000000",
      name: "Admin",
      role: "admin",
      clientCode: "PG-ADMIN",
    },
  });
  console.log("Admin user seeded.");

  // 3. Warehouses — use createMany with skipDuplicates (no unique constraint on model)
  const warehouses: { country: string; city: string; address: string; type: WarehouseType }[] = [
    { country: "KR", city: "Сеул",      address: "Incheon, Korea",           type: WarehouseType.origin },
    { country: "CN", city: "Гуанчжоу", address: "Guangzhou, China",          type: WarehouseType.origin },
    { country: "TR", city: "Стамбул",  address: "Istanbul, Turkey",          type: WarehouseType.origin },
    { country: "UZ", city: "Ташкент",  address: "Tashkent, Uzbekistan",      type: WarehouseType.destination },
    { country: "KZ", city: "Алматы",   address: "Almaty, Kazakhstan",        type: WarehouseType.destination },
  ];

  await prisma.warehouse.createMany({ data: warehouses, skipDuplicates: true });
  console.log(`Warehouses seeded: ${warehouses.length}`);

  console.log("Seed complete!");
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
