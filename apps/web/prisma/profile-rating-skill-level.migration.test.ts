import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

const schema = readFileSync(new URL("./schema.prisma", import.meta.url), "utf8");
const migration = readFileSync(
  new URL("./migrations/20260717120000_add_profile_rating_and_skill_level/migration.sql", import.meta.url),
  "utf8",
);

describe("profile rating and skill level persistence", () => {
  it("adds non-null Prisma defaults on the Profile model", () => {
    expect(schema).toContain("rating            Int               @default(0)");
    expect(schema).toContain("skillLevel        Int               @default(0)");
  });

  it("backfills existing rows and enforces database defaults", () => {
    expect(migration).toContain('ADD COLUMN "rating" INTEGER');
    expect(migration).toContain('ADD COLUMN "skillLevel" INTEGER');
    expect(migration).toContain('UPDATE "Profile"\nSET "rating" = 0');
    expect(migration).toContain('UPDATE "Profile"\nSET "skillLevel" = 0');
    expect(migration).toContain('ALTER COLUMN "rating" SET DEFAULT 0');
    expect(migration).toContain('ALTER COLUMN "rating" SET NOT NULL');
    expect(migration).toContain('ALTER COLUMN "skillLevel" SET DEFAULT 0');
    expect(migration).toContain('ALTER COLUMN "skillLevel" SET NOT NULL');
  });
});
