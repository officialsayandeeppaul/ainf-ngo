-- AlterTable
ALTER TABLE "MembershipTier" ADD COLUMN "benefits" JSONB NOT NULL DEFAULT '[]';

UPDATE "MembershipTier"
SET "benefits" = '[
  {"label":"Member badge on your account","included":true},
  {"label":"Monthly support for field programmes","included":true},
  {"label":"Name on the public donor roll","included":false},
  {"label":"Gold badge","included":false},
  {"label":"Field-visit invites","included":false},
  {"label":"Patron briefings and field access","included":false}
]'::jsonb
WHERE "slug" = 'friend' AND "benefits" = '[]'::jsonb;

UPDATE "MembershipTier"
SET "benefits" = '[
  {"label":"Member badge on your account","included":true},
  {"label":"Monthly support for field programmes","included":true},
  {"label":"Name on the public donor roll","included":true},
  {"label":"Gold badge","included":true},
  {"label":"Field-visit invites","included":false},
  {"label":"Patron briefings and field access","included":false}
]'::jsonb
WHERE "slug" = 'gold' AND "benefits" = '[]'::jsonb;

UPDATE "MembershipTier"
SET "benefits" = '[
  {"label":"Member badge on your account","included":true},
  {"label":"Monthly support for field programmes","included":true},
  {"label":"Name on the public donor roll","included":true},
  {"label":"Gold badge","included":true},
  {"label":"Field-visit invites","included":true},
  {"label":"Patron briefings and field access","included":true}
]'::jsonb
WHERE "slug" = 'patron' AND "benefits" = '[]'::jsonb;
