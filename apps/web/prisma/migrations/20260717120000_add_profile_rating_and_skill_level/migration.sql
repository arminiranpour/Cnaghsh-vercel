ALTER TABLE "Profile"
ADD COLUMN "rating" INTEGER,
ADD COLUMN "skillLevel" INTEGER;

UPDATE "Profile"
SET "rating" = 0
WHERE "rating" IS NULL;

UPDATE "Profile"
SET "skillLevel" = 0
WHERE "skillLevel" IS NULL;

ALTER TABLE "Profile"
ALTER COLUMN "rating" SET DEFAULT 0,
ALTER COLUMN "rating" SET NOT NULL,
ALTER COLUMN "skillLevel" SET DEFAULT 0,
ALTER COLUMN "skillLevel" SET NOT NULL;
