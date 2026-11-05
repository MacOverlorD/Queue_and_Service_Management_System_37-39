import { PrismaClient, EntryStatus } from "@prisma/client";
import bcrypt from "bcryptjs";

// Development-only demo password. Override with SEED_PASSWORD. Never use real credentials.
const DEFAULT_SEED_PASSWORD = "DemoPass123!";
const BCRYPT_COST = 10;

const OPERATORS = [
  { name: "Operator One", email: "operator1@example.test" },
  { name: "Operator Two", email: "operator2@example.test" },
];
const CUSTOMERS = [
  { name: "Customer One", email: "customer1@example.test" },
  { name: "Customer Two", email: "customer2@example.test" },
  { name: "Customer Three", email: "customer3@example.test" },
  { name: "Customer Four", email: "customer4@example.test" },
];

type SeedEntry = { number: number; customer: string; status: EntryStatus; operator?: string };

// Queue A: WAITING x2, SERVING, COMPLETED, CANCELLED, NO_SHOW. Queue B: empty.
// Queue C (closed): one CALLED entry. BR-05 holds: at most one CALLED/SERVING per queue.
const QUEUES: Array<{
  name: string;
  serviceName: string;
  isOpen: boolean;
  operators: string[];
  entries: SeedEntry[];
}> = [
  {
    name: "Registrar Desk",
    serviceName: "Document requests",
    isOpen: true,
    operators: ["operator1@example.test"],
    entries: [
      { number: 1, customer: "customer1@example.test", status: "COMPLETED", operator: "operator1@example.test" },
      { number: 2, customer: "customer2@example.test", status: "CANCELLED" },
      { number: 3, customer: "customer3@example.test", status: "NO_SHOW", operator: "operator1@example.test" },
      { number: 4, customer: "customer4@example.test", status: "SERVING", operator: "operator1@example.test" },
      { number: 5, customer: "customer1@example.test", status: "WAITING" },
      { number: 6, customer: "customer2@example.test", status: "WAITING" },
    ],
  },
  {
    name: "Finance Desk",
    serviceName: "Payments and receipts",
    isOpen: true,
    operators: ["operator1@example.test"],
    entries: [],
  },
  {
    name: "Student Affairs",
    serviceName: "Student activities",
    isOpen: false,
    operators: ["operator2@example.test"],
    entries: [{ number: 1, customer: "customer3@example.test", status: "CALLED", operator: "operator2@example.test" }],
  },
];

const PATH: Record<EntryStatus, EntryStatus[]> = {
  WAITING: [],
  CALLED: ["CALLED"],
  SERVING: ["CALLED", "SERVING"],
  COMPLETED: ["CALLED", "SERVING", "COMPLETED"],
  CANCELLED: ["CANCELLED"],
  NO_SHOW: ["CALLED", "NO_SHOW"],
};

// Rerunnable: users, queues and assignments are upserted; entries are created only
// for queues that have none yet, so running the seed twice changes nothing.
export async function seedDatabase(prisma: PrismaClient): Promise<void> {
  const password = process.env.SEED_PASSWORD ?? DEFAULT_SEED_PASSWORD;
  const passwordHash = await bcrypt.hash(password, BCRYPT_COST);

  const users = new Map<string, number>();
  for (const [list, role] of [
    [OPERATORS, "OPERATOR"],
    [CUSTOMERS, "CUSTOMER"],
  ] as const) {
    for (const u of list) {
      const existing = await prisma.user.findUnique({ where: { email: u.email } });
      const row =
        existing ??
        (await prisma.user.create({ data: { name: u.name, email: u.email, passwordHash, role } }));
      users.set(u.email, row.id);
    }
  }

  for (const q of QUEUES) {
    const queue = await prisma.queue.upsert({
      where: { name: q.name },
      update: {},
      create: { name: q.name, serviceName: q.serviceName, isOpen: q.isOpen },
    });
    for (const email of q.operators) {
      const userId = users.get(email)!;
      await prisma.operatorQueue.upsert({
        where: { userId_queueId: { userId, queueId: queue.id } },
        update: {},
        create: { userId, queueId: queue.id },
      });
    }
    if (q.entries.length === 0 || (await prisma.queueEntry.count({ where: { queueId: queue.id } })) > 0) {
      continue;
    }
    for (const e of q.entries) {
      const customerId = users.get(e.customer)!;
      const operatorId = e.operator ? users.get(e.operator)! : null;
      const entry = await prisma.queueEntry.create({
        data: {
          queueId: queue.id,
          customerId,
          number: e.number,
          status: e.status,
          handledByOperatorId: operatorId,
        },
      });
      let from: EntryStatus | null = null;
      await prisma.entryEvent.create({ data: { entryId: entry.id, fromStatus: null, toStatus: "WAITING", actorId: customerId } });
      from = "WAITING";
      for (const to of PATH[e.status]) {
        await prisma.entryEvent.create({
          data: { entryId: entry.id, fromStatus: from, toStatus: to, actorId: to === "CANCELLED" ? customerId : (operatorId ?? customerId) },
        });
        from = to;
      }
    }
    const max = Math.max(...q.entries.map((e) => e.number));
    await prisma.queue.update({ where: { id: queue.id }, data: { lastNumber: max } });
  }
}

if (require.main === module) {
  const prisma = new PrismaClient();
  seedDatabase(prisma)
    .then(() => prisma.$disconnect())
    .catch(async (err) => {
      console.error(err);
      await prisma.$disconnect();
      process.exit(1);
    });
}
