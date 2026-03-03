import { PrismaClient } from "@prisma/client";

const db = new PrismaClient();

const users = [
  { phone: "+998900000001", name: "Клиент Тест", role: "client" as const, clientCode: "PG-000001", city: "Ташкент" },
  { phone: "+998900000002", name: "Оператор Сеул", role: "operator_origin" as const, clientCode: "PG-000002", city: "Сеул" },
  { phone: "+998900000003", name: "Оператор Ташкент", role: "operator_destination" as const, clientCode: "PG-000003", city: "Ташкент" },
  { phone: "+998900000004", name: "Курьер Тест", role: "courier" as const, clientCode: "PG-000004", city: "Ташкент" },
  { phone: "+998900000005", name: "Админ Тест", role: "admin" as const, clientCode: "PG-000005", city: "Ташкент" },
];

async function main() {
  for (const u of users) {
    const user = await db.user.upsert({
      where: { phone: u.phone },
      update: { role: u.role },
      create: u,
    });
    console.log(`${user.role.padEnd(22)} | ${user.phone} | ${user.name}`);
  }
  console.log("\nDone! Use OTP code 000000 to login with any of these accounts.");
}

main().catch(console.error).finally(() => db.$disconnect());
