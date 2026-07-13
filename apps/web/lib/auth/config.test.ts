import { afterEach, describe, expect, it, vi } from "vitest";

import { getAuthConfig } from "./config";

const originalGoogleClientId = process.env.GOOGLE_CLIENT_ID;
const originalGoogleClientSecret = process.env.GOOGLE_CLIENT_SECRET;

afterEach(() => {
  if (originalGoogleClientId === undefined) {
    delete process.env.GOOGLE_CLIENT_ID;
  } else {
    process.env.GOOGLE_CLIENT_ID = originalGoogleClientId;
  }

  if (originalGoogleClientSecret === undefined) {
    delete process.env.GOOGLE_CLIENT_SECRET;
  } else {
    process.env.GOOGLE_CLIENT_SECRET = originalGoogleClientSecret;
  }
});

function createPrismaMock() {
  return {
    user: {
      findUnique: vi.fn(),
    },
    account: {
      findUnique: vi.fn(),
    },
  } as unknown as Parameters<typeof getAuthConfig>[0];
}

describe("getAuthConfig", () => {
  it("includes the google provider when env vars are set", () => {
    process.env.GOOGLE_CLIENT_ID = "google-client-id";
    process.env.GOOGLE_CLIENT_SECRET = "google-client-secret";

    const config = getAuthConfig(createPrismaMock());
    const providerIds = config.providers.map(
      (provider) => (provider as { id: string }).id,
    );

    expect(providerIds).toContain("google");
    expect(providerIds).toContain("credentials");
  });

  it("keeps the credentials provider available when google env vars are missing", () => {
    delete process.env.GOOGLE_CLIENT_ID;
    delete process.env.GOOGLE_CLIENT_SECRET;

    const config = getAuthConfig(createPrismaMock());
    const providerIds = config.providers.map(
      (provider) => (provider as { id: string }).id,
    );

    expect(providerIds).toEqual(["credentials"]);
  });

  it("preserves the existing session callback fields", async () => {
    const config = getAuthConfig(createPrismaMock());
    const jwtCallback = config.callbacks!.jwt!;
    const sessionCallback = config.callbacks!.session!;

    const token = await jwtCallback({
      token: {},
      user: {
        id: "user_1",
        email: "actor@example.com",
        role: "ADMIN",
      },
    } as Parameters<typeof jwtCallback>[0]);

    const session = await sessionCallback({
      session: {
        user: {},
        expires: "2099-01-01T00:00:00.000Z",
      },
      token,
    } as Parameters<typeof sessionCallback>[0]);

    expect(session.user).toMatchObject({
      id: "user_1",
      email: "actor@example.com",
      role: "ADMIN",
    });
  });
});
