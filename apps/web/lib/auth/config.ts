import bcrypt from "bcryptjs";
import Credentials from "next-auth/providers/credentials";
import GoogleProvider from "next-auth/providers/google";
import type { PrismaClient } from "@prisma/client";
import type { NextAuthOptions, Session, User } from "next-auth";
import type { AdapterUser } from "next-auth/adapters";
import type { JWT } from "next-auth/jwt";

import { createInMemoryRateLimiter } from "./rate-limit";
import {
  GOOGLE_PROVIDER_ID,
  isGoogleAuthConfigured,
  provisionGoogleAccount,
} from "./google";

const signinLimiter = createInMemoryRateLimiter({
  max: 5,
  windowMs: 60_000,
  namespace: "signin",
});

type CredentialsInput = {
  email?: string;
  password?: string;
};

type JwtContext = Parameters<
  NonNullable<NonNullable<NextAuthOptions["callbacks"]>["jwt"]>
>[0];

type SignInContext = {
  user?: AdapterUser | User | null;
  account?: {
    provider?: string | null;
    providerAccountId?: string | null;
    type?: string | null;
    access_token?: string | null;
    refresh_token?: string | null;
    expires_at?: number | null;
    token_type?: string | null;
    scope?: string | null;
    id_token?: string | null;
    session_state?: string | null;
  } | null;
  profile?: {
    email?: string | null;
    name?: string | null;
    picture?: string | null;
  } | null;
};

type OAuthJwtContext = JwtContext & {
  account?: {
    provider?: string | null;
    providerAccountId?: string | null;
  } | null;
};

type SessionContext = {
  session: Session;
  token: JWT;
};

const DEFAULT_DEV_SECRET = "development-next-auth-secret";

export function resolveNextAuthSecret() {
  const secretFromEnv = process.env.NEXTAUTH_SECRET;

  if (secretFromEnv && secretFromEnv.trim().length > 0) {
    return secretFromEnv;
  }

  const isProduction = process.env.NODE_ENV === "production";
  const isNextBuildPhase = process.env.NEXT_PHASE === "phase-production-build";

  if (!isProduction || isNextBuildPhase) {
    return DEFAULT_DEV_SECRET;
  }

  throw new Error(
    "NEXTAUTH_SECRET is required when running in production environments.",
  );
}

export function getAuthConfig(prisma: PrismaClient): NextAuthOptions {
  const secret = resolveNextAuthSecret();
  const providers: NextAuthOptions["providers"] = [
    Credentials({
      name: "credentials",
      credentials: {
        email: { label: "Email", type: "text" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials: CredentialsInput | undefined) {
        const email = credentials?.email?.toLowerCase().trim();
        const password = credentials?.password;

        if (!email || !password) {
          throw new Error("ایمیل و رمز عبور الزامی است.");
        }

        if (!signinLimiter.allow(email)) {
          throw new Error("تعداد تلاش‌ها زیاد است. لطفاً بعداً تلاش کنید.");
        }

        const user = await prisma.user.findUnique({
          where: { email },
          select: {
            id: true,
            email: true,
            passwordHash: true,
            role: true,
          },
        });

        if (!user?.passwordHash) {
          const withinLimit = signinLimiter.hit(email);
          if (!withinLimit) {
            throw new Error("تعداد تلاش‌ها زیاد است. لطفاً بعداً تلاش کنید.");
          }

          throw new Error("ایمیل یا رمز عبور نادرست است.");
        }

        const isValid = await bcrypt.compare(password, user.passwordHash);

        if (!isValid) {
          const withinLimit = signinLimiter.hit(email);
          if (!withinLimit) {
            throw new Error("تعداد تلاش‌ها زیاد است. لطفاً بعداً تلاش کنید.");
          }

          throw new Error("ایمیل یا رمز عبور نادرست است.");
        }

        signinLimiter.reset(email);

        return {
          id: user.id,
          email: user.email,
          role: user.role,
        } satisfies User;
      },
    }),
  ];

  if (isGoogleAuthConfigured()) {
    providers.unshift(
      GoogleProvider({
        clientId: process.env.GOOGLE_CLIENT_ID!,
        clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
      }),
    );
  }

  return {
    trustHost: true,
    secret,
    session: {
      strategy: "jwt",
    },
    pages: {
      signIn: "/auth",
    },
    providers,
    callbacks: {
      async signIn({ user, account, profile }: SignInContext) {
        if (account?.provider !== GOOGLE_PROVIDER_ID) {
          return true;
        }

        const result = await provisionGoogleAccount(prisma, {
          email: user?.email ?? profile?.email,
          name: user?.name ?? profile?.name,
          image: user?.image ?? profile?.picture,
          providerAccountId: account.providerAccountId,
          accountType: account.type,
          accessToken: account.access_token,
          refreshToken: account.refresh_token,
          expiresAt: account.expires_at,
          tokenType: account.token_type,
          scope: account.scope,
          idToken: account.id_token,
          sessionState: account.session_state,
        });

        if (result.kind === "success") {
          return true;
        }

        if (result.kind === "oauth_account_not_linked") {
          return "/auth?error=OAuthAccountNotLinked";
        }

        return "/auth?error=AccessDenied";
      },
      async jwt({ token, user, account }: OAuthJwtContext) {
        if (
          account?.provider === GOOGLE_PROVIDER_ID &&
          account.providerAccountId
        ) {
          const linkedAccount = await prisma.account.findUnique({
            where: {
              provider_providerAccountId: {
                provider: GOOGLE_PROVIDER_ID,
                providerAccountId: account.providerAccountId,
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

          if (linkedAccount?.user) {
            token.id = linkedAccount.user.id;
            token.email = linkedAccount.user.email;
            token.role = linkedAccount.user.role;
            token.sub = linkedAccount.user.id;
            return token;
          }
        }

        if (user) {
          token.id = user.id;
          token.email = user.email;
          if (typeof user.id === "string") {
            token.sub = user.id;
          }
          if ("role" in user && typeof user.role === "string") {
            token.role = user.role;
          }
        }

        return token;
      },
      async session({ session, token }: SessionContext) {
        if (session.user) {
          session.user.id = (token.id ?? session.user.id ?? "") as string;
          session.user.email = (token.email ?? session.user.email ?? "") as string;
          session.user.role =
            (token.role as "USER" | "ADMIN") ?? session.user.role ?? "USER";
        }

        return session;
      },
    },
  } satisfies NextAuthOptions;
}
