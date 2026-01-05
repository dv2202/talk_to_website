-- Migrate BUSINESS → PRO, then replace PlanId enum with FREE | STARTER | PRO

UPDATE "Subscription" SET "planId" = 'PRO' WHERE "planId"::text = 'BUSINESS';
UPDATE "Payment" SET "planId" = 'PRO' WHERE "planId"::text = 'BUSINESS';

CREATE TYPE "PlanId_new" AS ENUM ('FREE', 'STARTER', 'PRO');

ALTER TABLE "Subscription"
  ALTER COLUMN "planId" TYPE "PlanId_new"
  USING ("planId"::text::"PlanId_new");

ALTER TABLE "Payment"
  ALTER COLUMN "planId" TYPE "PlanId_new"
  USING ("planId"::text::"PlanId_new");

DROP TYPE "PlanId";
ALTER TYPE "PlanId_new" RENAME TO "PlanId";
