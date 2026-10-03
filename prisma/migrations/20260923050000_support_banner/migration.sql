-- Support campaign banner (admin-editable message + countdown).
CREATE TABLE "SupportBanner" (
    "id" TEXT NOT NULL DEFAULT 'singleton',
    "enabled" BOOLEAN NOT NULL DEFAULT false,
    "headline" TEXT NOT NULL DEFAULT '',
    "message" TEXT NOT NULL DEFAULT '',
    "ctaLabel" TEXT NOT NULL DEFAULT 'Support AINF',
    "ctaHref" TEXT NOT NULL DEFAULT '/donate-now',
    "endsAt" TIMESTAMP(3),
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "updatedByUserId" TEXT,

    CONSTRAINT "SupportBanner_pkey" PRIMARY KEY ("id")
);
