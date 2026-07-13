import type { Role } from "@prisma/client";

export const GOOGLE_PROVIDER_ID = "google";
export const DEFAULT_AUTH_CALLBACK_URL = "/dashboard/profile";
export const GOOGLE_AUTH_NOT_CONFIGURED_MESSAGE =
  "ورود با گوگل هنوز برای این محیط فعال نشده است.";

export function isGoogleAuthConfigured(
  env: NodeJS.ProcessEnv = process.env,
): boolean {
  return Boolean(env.GOOGLE_CLIENT_ID?.trim() && env.GOOGLE_CLIENT_SECRET?.trim());
}

export function resolveAuthCallbackUrl(callbackUrl?: string | null): string {
  const normalized = callbackUrl?.trim();
  return normalized && normalized.length > 0
    ? normalized
    : DEFAULT_AUTH_CALLBACK_URL;
}

export type GoogleAccountProvisionInput = {
  email?: string | null;
  name?: string | null;
  image?: string | null;
  providerAccountId?: string | null;
  accountType?: string | null;
  accessToken?: string | null;
  refreshToken?: string | null;
  expiresAt?: number | null;
  tokenType?: string | null;
  scope?: string | null;
  idToken?: string | null;
  sessionState?: string | null;
};

export type ProvisionedGoogleUser = {
  id: string;
  email: string;
  role: Role;
};

export type GoogleAccountProvisionResult =
  | {
      kind: "success";
      user: ProvisionedGoogleUser;
    }
  | {
      kind: "oauth_account_not_linked";
    }
  | {
      kind: "invalid_profile";
    };

type AuthTransaction = {
  account: {
    findUnique(args: {
      where: {
        provider_providerAccountId: {
          provider: string;
          providerAccountId: string;
        };
      };
      select: {
        user: {
          select: {
            id: true;
            email: true;
            role: true;
          };
        };
      };
    }): Promise<{ user: ProvisionedGoogleUser } | null>;
    create(args: {
      data: {
        userId: string;
        type: string;
        provider: string;
        providerAccountId: string;
        access_token?: string;
        refresh_token?: string;
        expires_at?: number;
        token_type?: string;
        scope?: string;
        id_token?: string;
        session_state?: string;
      };
    }): Promise<unknown>;
    update(args: {
      where: {
        provider_providerAccountId: {
          provider: string;
          providerAccountId: string;
        };
      };
      data: {
        access_token?: string;
        refresh_token?: string;
        expires_at?: number;
        token_type?: string;
        scope?: string;
        id_token?: string;
        session_state?: string;
      };
    }): Promise<unknown>;
  };
  user: {
    findUnique(args: {
      where: { email: string };
      select: { id: true };
    }): Promise<{ id: string } | null>;
    create(args: {
      data: {
        email: string;
        name?: string;
        role: Role;
        profile: {
          create: {
            avatarUrl?: string;
          };
        };
      };
      select: {
        id: true;
        email: true;
        role: true;
      };
    }): Promise<ProvisionedGoogleUser>;
  };
  profile: {
    upsert(args: {
      where: { userId: string };
      create: {
        userId: string;
        avatarUrl?: string;
      };
      update: Record<string, never>;
    }): Promise<unknown>;
  };
};

export type GoogleAccountProvisionPrisma = {
  $transaction<T>(callback: (tx: AuthTransaction) => Promise<T>): Promise<T>;
};

function normalizeEmail(email?: string | null): string | null {
  const normalized = email?.trim().toLowerCase();
  return normalized && normalized.length > 0 ? normalized : null;
}

function normalizeName(name?: string | null): string | undefined {
  const normalized = name?.trim();
  return normalized && normalized.length > 0 ? normalized : undefined;
}

function buildProfileCreate(image?: string | null) {
  return image ? { avatarUrl: image } : {};
}

function buildAccountPersistenceData(input: GoogleAccountProvisionInput) {
  return {
    type: input.accountType ?? "oauth",
    provider: GOOGLE_PROVIDER_ID,
    providerAccountId: input.providerAccountId!,
    access_token: input.accessToken ?? undefined,
    refresh_token: input.refreshToken ?? undefined,
    expires_at: input.expiresAt ?? undefined,
    token_type: input.tokenType ?? undefined,
    scope: input.scope ?? undefined,
    id_token: input.idToken ?? undefined,
    session_state: input.sessionState ?? undefined,
  };
}

async function ensureProfile(
  tx: AuthTransaction,
  userId: string,
  image?: string | null,
) {
  await tx.profile.upsert({
    where: { userId },
    create: {
      userId,
      ...buildProfileCreate(image),
    },
    update: {},
  });
}

export async function provisionGoogleAccount(
  prisma: GoogleAccountProvisionPrisma,
  input: GoogleAccountProvisionInput,
): Promise<GoogleAccountProvisionResult> {
  const email = normalizeEmail(input.email);
  const providerAccountId = input.providerAccountId?.trim();

  if (!email || !providerAccountId) {
    return { kind: "invalid_profile" };
  }

  return prisma.$transaction(async (tx) => {
    const existingAccount = await tx.account.findUnique({
      where: {
        provider_providerAccountId: {
          provider: GOOGLE_PROVIDER_ID,
          providerAccountId,
        },
      },
      select: {
        user: {
          select: {
            id: true,
            email: true,
            role: true,
          },
        },
      },
    });

    if (existingAccount?.user) {
      await tx.account.update({
        where: {
          provider_providerAccountId: {
            provider: GOOGLE_PROVIDER_ID,
            providerAccountId,
          },
        },
        data: {
          access_token: input.accessToken ?? undefined,
          refresh_token: input.refreshToken ?? undefined,
          expires_at: input.expiresAt ?? undefined,
          token_type: input.tokenType ?? undefined,
          scope: input.scope ?? undefined,
          id_token: input.idToken ?? undefined,
          session_state: input.sessionState ?? undefined,
        },
      });
      await ensureProfile(tx, existingAccount.user.id, input.image);
      return {
        kind: "success",
        user: existingAccount.user,
      };
    }

    const existingUser = await tx.user.findUnique({
      where: { email },
      select: { id: true },
    });

    if (existingUser) {
      return { kind: "oauth_account_not_linked" };
    }

    const createdUser = await tx.user.create({
      data: {
        email,
        name: normalizeName(input.name),
        role: "USER",
        profile: {
          create: buildProfileCreate(input.image),
        },
      },
      select: {
        id: true,
        email: true,
        role: true,
      },
    });

    await tx.account.create({
      data: {
        userId: createdUser.id,
        ...buildAccountPersistenceData({
          ...input,
          providerAccountId,
        }),
      },
    });

    return {
      kind: "success",
      user: createdUser,
    };
  });
}

export async function startGoogleSignIn(
  signInFn: (
    provider?: string,
    options?: Record<string, unknown>,
  ) => Promise<unknown>,
  callbackUrl?: string,
) {
  return signInFn(GOOGLE_PROVIDER_ID, {
    callbackUrl: resolveAuthCallbackUrl(callbackUrl),
    redirect: true,
  });
}
