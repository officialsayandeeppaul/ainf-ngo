-- Admin-editable field projects for the public /projects cards.
CREATE TABLE "FieldProject" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "summary" TEXT NOT NULL,
    "raisedLabel" TEXT NOT NULL,
    "goalLabel" TEXT NOT NULL,
    "imageUrl" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "published" BOOLEAN NOT NULL DEFAULT true,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "updatedByUserId" TEXT,

    CONSTRAINT "FieldProject_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "FieldProject_slug_key" ON "FieldProject"("slug");
CREATE INDEX "FieldProject_published_sortOrder_idx" ON "FieldProject"("published", "sortOrder");

INSERT INTO "FieldProject" ("id", "slug", "title", "summary", "raisedLabel", "goalLabel", "imageUrl", "sortOrder", "published", "updatedAt")
VALUES
  ('proj_swasthya', 'medical-aid-health-camps', 'Swasthya Camps', 'Checkups, referrals, and medicines for families in Nala, Jamtara, and nearby blocks.', '₹75k', '₹100k', '/assets/img/hero-third/518fb7f61a5e6510.webp', 0, true, CURRENT_TIMESTAMP),
  ('proj_meals', 'daily-meal-program', 'Daily Meal Program', 'A meal with the coaching batch, so hunger never sends a student home before class ends.', '₹50k', '₹65k', '/assets/img/hero-third/4a27119994acc349.webp', 1, true, CURRENT_TIMESTAMP),
  ('proj_shiksha', 'education-support-drive', 'Education Support Drive', 'Books, uniforms, and fees so a child in our blocks does not have to leave class.', '₹25k', '₹40k', '/assets/img/home-sixth/ce25dc676c029d0e.webp', 2, true, CURRENT_TIMESTAMP),
  ('proj_winter', 'winter-relief-program', 'Winter Kits for Our Blocks', 'Blankets and warm sets for families in our blocks when the cold sets in.', '₹40k', '₹80k', '/assets/img/hero-third/9fzzlw9fzzlw9fzz.webp', 3, true, CURRENT_TIMESTAMP),
  ('proj_water', 'clean-water-initiative', 'Safe Water in Our Hamlets', 'Safe drinking water for hamlets where the source turns bad after the rains.', '₹30k', '₹90k', '/assets/img/hero-third/571e61ddc71daaf0.webp', 4, true, CURRENT_TIMESTAMP);
