-- CreateTable
CREATE TABLE "MembershipCard" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "regNo" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "frontPath" TEXT NOT NULL,
    "backPath" TEXT NOT NULL,
    "tierName" TEXT NOT NULL,
    "badge" TEXT NOT NULL,
    "issuedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MembershipCard_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "MembershipCard_userId_key" ON "MembershipCard"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "MembershipCard_regNo_key" ON "MembershipCard"("regNo");

-- CreateIndex
CREATE UNIQUE INDEX "MembershipCard_token_key" ON "MembershipCard"("token");

-- CreateIndex
CREATE INDEX "MembershipCard_token_idx" ON "MembershipCard"("token");

-- CreateIndex
CREATE INDEX "MembershipCard_expiresAt_idx" ON "MembershipCard"("expiresAt");

-- AddForeignKey
ALTER TABLE "MembershipCard" ADD CONSTRAINT "MembershipCard_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
