import { describe, expect, it, vi } from "vitest";

import {
  DEFAULT_AUTH_CALLBACK_URL,
  GOOGLE_PROVIDER_ID,
  type GoogleAccountProvisionPrisma,
  isGoogleAuthConfigured,
  provisionGoogleAccount,
  resolveAuthCallbackUrl,
  startGoogleSignIn,
} from "./google";

function createProvisionPrismaMock(setup: {
  accountFindUnique: ReturnType<typeof vi.fn>;
  accountCreate: ReturnType<typeof vi.fn>;
  accountUpdate: ReturnType<typeof vi.fn>;
  userFindUnique: ReturnType<typeof vi.fn>;
  userCreate: ReturnType<typeof vi.fn>;
  profileUpsert: ReturnType<typeof vi.fn>;
}): GoogleAccountProvisionPrisma {
  return {
    $transaction: async <T>(
      callback: (tx: {
        account: {
          findUnique: typeof setup.accountFindUnique;
          create: typeof setup.accountCreate;
          update: typeof setup.accountUpdate;
        };
        user: {
          findUnique: typeof setup.userFindUnique;
          create: typeof setup.userCreate;
        };
        profile: {
          upsert: typeof setup.profileUpsert;
        };
      }) => Promise<T>,
    ): Promise<T> =>
      callback({
        account: {
          findUnique: setup.accountFindUnique,
          create: setup.accountCreate,
          update: setup.accountUpdate,
        },
        user: {
          findUnique: setup.userFindUnique,
          create: setup.userCreate,
        },
        profile: {
          upsert: setup.profileUpsert,
        },
      }),
  };
}

describe("google auth helpers", () => {
  it("reports google auth as configured only when both env vars are present", () => {
    expect(
      isGoogleAuthConfigured({
        GOOGLE_CLIENT_ID: "client-id",
        GOOGLE_CLIENT_SECRET: "client-secret",
      } as unknown as NodeJS.ProcessEnv),
    ).toBe(true);

    expect(
      isGoogleAuthConfigured({
        GOOGLE_CLIENT_ID: "client-id",
        GOOGLE_CLIENT_SECRET: "",
      } as unknown as NodeJS.ProcessEnv),
    ).toBe(false);
  });

  it("preserves callbackUrl and falls back to the default destination", () => {
    expect(resolveAuthCallbackUrl("/dashboard/jobs")).toBe("/dashboard/jobs");
    expect(resolveAuthCallbackUrl(undefined)).toBe(DEFAULT_AUTH_CALLBACK_URL);
  });

  it("starts google sign-in with the resolved callbackUrl", async () => {
    const signIn = vi.fn().mockResolvedValue(undefined);

    await startGoogleSignIn(signIn, "/dashboard/settings");

    expect(signIn).toHaveBeenCalledWith(GOOGLE_PROVIDER_ID, {
      callbackUrl: "/dashboard/settings",
      redirect: true,
    });
  });
});

describe("provisionGoogleAccount", () => {
  it("creates the user, profile, and account for a first-time google login", async () => {
    const accountFindUnique = vi.fn().mockResolvedValue(null);
    const accountCreate = vi.fn().mockResolvedValue({});
    const accountUpdate = vi.fn().mockResolvedValue({});
    const userFindUnique = vi.fn().mockResolvedValue(null);
    const userCreate = vi.fn().mockResolvedValue({
      id: "user_1",
      email: "actor@example.com",
      role: "USER",
    });
    const profileUpsert = vi.fn().mockResolvedValue({});

    const prisma = createProvisionPrismaMock({
      accountFindUnique,
      accountCreate,
      accountUpdate,
      userFindUnique,
      userCreate,
      profileUpsert,
    });

    const result = await provisionGoogleAccount(prisma, {
      email: "Actor@Example.com",
      name: "Actor Name",
      image: "https://example.com/avatar.png",
      providerAccountId: "google-account-1",
      accessToken: "access-token",
    });

    expect(result).toEqual({
      kind: "success",
      user: {
        id: "user_1",
        email: "actor@example.com",
        role: "USER",
      },
    });
    expect(userCreate).toHaveBeenCalledWith({
      data: {
        email: "actor@example.com",
        name: "Actor Name",
        role: "USER",
        profile: {
          create: {
            avatarUrl: "https://example.com/avatar.png",
          },
        },
      },
      select: {
        id: true,
        email: true,
        role: true,
      },
    });
    expect(accountCreate).toHaveBeenCalledWith({
      data: {
        userId: "user_1",
        type: "oauth",
        provider: GOOGLE_PROVIDER_ID,
        providerAccountId: "google-account-1",
        access_token: "access-token",
      },
    });
    expect(profileUpsert).not.toHaveBeenCalled();
  });

  it("does not create duplicate user or profile records for repeated google login", async () => {
    const accountFindUnique = vi.fn().mockResolvedValue({
      user: {
        id: "user_1",
        email: "actor@example.com",
        role: "USER",
      },
    });
    const accountCreate = vi.fn().mockResolvedValue({});
    const accountUpdate = vi.fn().mockResolvedValue({});
    const userFindUnique = vi.fn().mockResolvedValue(null);
    const userCreate = vi.fn().mockResolvedValue(null);
    const profileUpsert = vi.fn().mockResolvedValue({});

    const prisma = createProvisionPrismaMock({
      accountFindUnique,
      accountCreate,
      accountUpdate,
      userFindUnique,
      userCreate,
      profileUpsert,
    });

    const result = await provisionGoogleAccount(prisma, {
      email: "actor@example.com",
      image: "https://example.com/avatar.png",
      providerAccountId: "google-account-1",
      accessToken: "next-access-token",
    });

    expect(result).toEqual({
      kind: "success",
      user: {
        id: "user_1",
        email: "actor@example.com",
        role: "USER",
      },
    });
    expect(userCreate).not.toHaveBeenCalled();
    expect(accountCreate).not.toHaveBeenCalled();
    expect(profileUpsert).toHaveBeenCalledTimes(1);
    expect(accountUpdate).toHaveBeenCalledTimes(1);
  });

  it("keeps same-email credentials accounts unlinked", async () => {
    const accountFindUnique = vi.fn().mockResolvedValue(null);
    const accountCreate = vi.fn().mockResolvedValue({});
    const accountUpdate = vi.fn().mockResolvedValue({});
    const userFindUnique = vi.fn().mockResolvedValue({ id: "user_1" });
    const userCreate = vi.fn().mockResolvedValue(null);
    const profileUpsert = vi.fn().mockResolvedValue({});

    const prisma = createProvisionPrismaMock({
      accountFindUnique,
      accountCreate,
      accountUpdate,
      userFindUnique,
      userCreate,
      profileUpsert,
    });

    const result = await provisionGoogleAccount(prisma, {
      email: "actor@example.com",
      providerAccountId: "google-account-1",
    });

    expect(result).toEqual({ kind: "oauth_account_not_linked" });
    expect(userCreate).not.toHaveBeenCalled();
    expect(accountCreate).not.toHaveBeenCalled();
    expect(profileUpsert).not.toHaveBeenCalled();
  });
});
