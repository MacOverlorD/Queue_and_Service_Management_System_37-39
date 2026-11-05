import bcrypt from "bcryptjs";
import { newPrisma, resetAndSeed } from "../tests/helpers";

// Resets the test database to the documented seed for the end-to-end suite and adds one
// extra customer with no entries (customer5) for the empty-state journey.
// Refuses to run unless DATABASE_URL points to a database whose name contains "test".
async function main() {
  const prisma = newPrisma();
  try {
    await resetAndSeed(prisma);
    const passwordHash = await bcrypt.hash(process.env.SEED_PASSWORD ?? "DemoPass123!", 10);
    await prisma.user.create({
      data: { name: "Customer Five", email: "customer5@example.test", passwordHash, role: "CUSTOMER" },
    });
    console.log("test database reset and seeded");
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
