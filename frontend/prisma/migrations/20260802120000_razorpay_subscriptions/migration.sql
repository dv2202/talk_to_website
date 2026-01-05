-- AlterTable
ALTER TABLE "Subscription" ADD COLUMN "razorpaySubscriptionId" TEXT;

-- AlterTable
ALTER TABLE "Payment" ADD COLUMN "razorpaySubscriptionId" TEXT;
ALTER TABLE "Payment" ALTER COLUMN "razorpayOrderId" DROP NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "Subscription_razorpaySubscriptionId_key" ON "Subscription"("razorpaySubscriptionId");

-- CreateIndex
CREATE INDEX "Payment_razorpaySubscriptionId_idx" ON "Payment"("razorpaySubscriptionId");
