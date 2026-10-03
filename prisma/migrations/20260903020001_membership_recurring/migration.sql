-- AlterTable
ALTER TABLE "User" ADD COLUMN "membershipSubscriptionId" TEXT,
ADD COLUMN "membershipCancelAtPeriodEnd" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "MembershipTier" ADD COLUMN "razorpayPlanMonthlyId" TEXT,
ADD COLUMN "razorpayPlanYearlyId" TEXT;

-- AlterTable
ALTER TABLE "MembershipOrder" ALTER COLUMN "razorpayOrderId" DROP NOT NULL;
ALTER TABLE "MembershipOrder" ADD COLUMN "recurring" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "razorpaySubscriptionId" TEXT,
ADD COLUMN "razorpayPlanId" TEXT,
ADD COLUMN "cancelAtPeriodEnd" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "cancelledAt" TIMESTAMP(3);

-- CreateIndex
CREATE INDEX "MembershipOrder_razorpaySubscriptionId_idx" ON "MembershipOrder"("razorpaySubscriptionId");

-- CreateIndex
CREATE UNIQUE INDEX "MembershipOrder_razorpayPaymentId_key" ON "MembershipOrder"("razorpayPaymentId");
