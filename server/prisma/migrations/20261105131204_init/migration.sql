-- CreateEnum
CREATE TYPE "Role" AS ENUM ('CUSTOMER', 'OPERATOR');

-- CreateEnum
CREATE TYPE "EntryStatus" AS ENUM ('WAITING', 'CALLED', 'SERVING', 'COMPLETED', 'CANCELLED', 'NO_SHOW');

-- CreateTable
CREATE TABLE "User" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "role" "Role" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Session" (
    "id" TEXT NOT NULL,
    "userId" INTEGER NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Session_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Queue" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "serviceName" TEXT NOT NULL,
    "lastNumber" INTEGER NOT NULL DEFAULT 0,
    "isOpen" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "Queue_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OperatorQueue" (
    "userId" INTEGER NOT NULL,
    "queueId" INTEGER NOT NULL,

    CONSTRAINT "OperatorQueue_pkey" PRIMARY KEY ("userId","queueId")
);

-- CreateTable
CREATE TABLE "QueueEntry" (
    "id" SERIAL NOT NULL,
    "queueId" INTEGER NOT NULL,
    "customerId" INTEGER NOT NULL,
    "number" INTEGER NOT NULL,
    "status" "EntryStatus" NOT NULL DEFAULT 'WAITING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "calledAt" TIMESTAMP(3),
    "servingAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "handledByOperatorId" INTEGER,

    CONSTRAINT "QueueEntry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EntryEvent" (
    "id" SERIAL NOT NULL,
    "entryId" INTEGER NOT NULL,
    "fromStatus" "EntryStatus",
    "toStatus" "EntryStatus" NOT NULL,
    "actorId" INTEGER NOT NULL,
    "at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EntryEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE INDEX "Session_userId_idx" ON "Session"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "Queue_name_key" ON "Queue"("name");

-- CreateIndex
CREATE INDEX "QueueEntry_customerId_idx" ON "QueueEntry"("customerId");

-- CreateIndex
CREATE UNIQUE INDEX "QueueEntry_queueId_number_key" ON "QueueEntry"("queueId", "number");

-- CreateIndex
CREATE INDEX "EntryEvent_entryId_idx" ON "EntryEvent"("entryId");

-- AddForeignKey
ALTER TABLE "Session" ADD CONSTRAINT "Session_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OperatorQueue" ADD CONSTRAINT "OperatorQueue_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OperatorQueue" ADD CONSTRAINT "OperatorQueue_queueId_fkey" FOREIGN KEY ("queueId") REFERENCES "Queue"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QueueEntry" ADD CONSTRAINT "QueueEntry_queueId_fkey" FOREIGN KEY ("queueId") REFERENCES "Queue"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QueueEntry" ADD CONSTRAINT "QueueEntry_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QueueEntry" ADD CONSTRAINT "QueueEntry_handledByOperatorId_fkey" FOREIGN KEY ("handledByOperatorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EntryEvent" ADD CONSTRAINT "EntryEvent_entryId_fkey" FOREIGN KEY ("entryId") REFERENCES "QueueEntry"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EntryEvent" ADD CONSTRAINT "EntryEvent_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- D-13 / BR-01 / NFR-04: at most one active entry per customer and queue.
-- Prisma cannot express a partial unique index, so it is written by hand.
-- Check every later migration for an accidental DROP INDEX of this index.
CREATE UNIQUE INDEX "QueueEntry_one_active_per_customer_queue"
ON "QueueEntry" ("queueId", "customerId")
WHERE "status" IN ('WAITING', 'CALLED', 'SERVING');
