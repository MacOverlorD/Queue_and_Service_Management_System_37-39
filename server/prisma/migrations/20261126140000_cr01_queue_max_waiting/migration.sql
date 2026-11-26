-- CR-01 (Lab 7, #82): optional waiting limit per queue. Additive and nullable: existing queues get NULL (no limit).
-- Checked: this migration does not drop or touch the D-13 partial unique index on "QueueEntry".
ALTER TABLE "Queue" ADD COLUMN "maxWaiting" INTEGER;
ALTER TABLE "Queue" ADD CONSTRAINT "Queue_maxWaiting_range" CHECK ("maxWaiting" IS NULL OR "maxWaiting" BETWEEN 1 AND 200);
