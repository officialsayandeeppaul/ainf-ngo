-- Messages from AINF to one member, shown in their dashboard inbox (and on the
-- suspended page while suspended). New table only; nothing existing changes.

-- CreateTable
CREATE TABLE "MemberMessage" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "sentByUserId" TEXT,
    "readAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MemberMessage_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "MemberMessage_userId_createdAt_idx" ON "MemberMessage"("userId", "createdAt");

-- AddForeignKey
ALTER TABLE "MemberMessage" ADD CONSTRAINT "MemberMessage_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

