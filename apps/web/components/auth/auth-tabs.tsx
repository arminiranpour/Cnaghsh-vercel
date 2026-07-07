"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { signIn } from "next-auth/react";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/components/ui/use-toast";
import { cn } from "@/lib/utils";
import { parseAuthTabParam, type AuthTab } from "@/lib/url/auth-tabs";

type AuthTabsProps = {
  initialTab: AuthTab;
  callbackUrl?: string;
  onPasswordPhaseChange?: (isActive: boolean) => void;
};

const tabLabels: Record<AuthTab, string> = {
  signin: "ورود",
  signup: "ثبت‌نام",
};

const panelIds: Record<AuthTab, string> = {
  signin: "auth-signin-panel",
  signup: "auth-signup-panel",
};

const tabIds: Record<AuthTab, string> = {
  signin: "auth-signin-tab",
  signup: "auth-signup-tab",
};

const PHONE_REGEX = /^09\d{9}$/;
const PHONE_ERROR = "شماره تلفن باید با 09 شروع شود و 11 رقم باشد.";

const DIGIT_MAP: Record<string, string> = {
  "۰": "0",
  "۱": "1",
  "۲": "2",
  "۳": "3",
  "۴": "4",
  "۵": "5",
  "۶": "6",
  "۷": "7",
  "۸": "8",
  "۹": "9",
  "٠": "0",
  "١": "1",
  "٢": "2",
  "٣": "3",
  "٤": "4",
  "٥": "5",
  "٦": "6",
  "٧": "7",
  "٨": "8",
  "٩": "9",
};

const normalizeDigits = (value: string) =>
  value.replace(/[۰-۹٠-٩]/g, (char) => DIGIT_MAP[char] ?? char);

// TODO: add debounced client-side validation + rate-limit hook once the supporting services are available.

export function AuthTabs({
  initialTab,
  callbackUrl,
  onPasswordPhaseChange,
}: AuthTabsProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [activeTab, setActiveTab] = useState<AuthTab>(initialTab);
  const lastAnnouncedTab = useRef<AuthTab | null>(null);

  useEffect(() => {
    const currentParam = searchParams.get("tab");
    const normalizedTab = parseAuthTabParam(currentParam);

    if (currentParam !== normalizedTab) {
      const params = new URLSearchParams(searchParams.toString());
      params.set("tab", normalizedTab);
      const nextUrl = buildUrlWithParams(pathname, params);
      router.replace(nextUrl, { scroll: false });
    }

    if (lastAnnouncedTab.current !== normalizedTab) {
      lastAnnouncedTab.current = normalizedTab;
      setActiveTab(normalizedTab);
      // eslint-disable-next-line no-console
      console.info("auth_tab_view", { tab: normalizedTab });
    }
  }, [pathname, router, searchParams]);

  const handleSelectTab = (tab: AuthTab) => {
    if (tab === activeTab) return;
    setActiveTab(tab);
    const params = new URLSearchParams(searchParams.toString());
    params.set("tab", tab);
    const nextUrl = buildUrlWithParams(pathname, params);
    router.replace(nextUrl, { scroll: false });
  };

  return (
    <Card className="w-full border border-border shadow-sm">
      <CardHeader className="space-y-3">
        <div
          role="tablist"
          aria-label="فرم احراز هویت"
          className="flex w-full gap-2"
        >
          {(Object.keys(tabLabels) as AuthTab[]).map((tabKey) => {
            const isSelected = activeTab === tabKey;
            return (
              <button
                key={tabKey}
                id={tabIds[tabKey]}
                type="button"
                role="tab"
                tabIndex={isSelected ? 0 : -1}
                aria-controls={panelIds[tabKey]}
                aria-selected={isSelected}
                className={cn(
                  "flex-1 rounded-full px-4 py-2 text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                  isSelected
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted text-muted-foreground hover:bg-muted/80",
                )}
                onClick={() => handleSelectTab(tabKey)}
              >
                {tabLabels[tabKey]}
              </button>
            );
          })}
        </div>
        <CardTitle className="text-2xl font-bold text-foreground">
          {tabLabels[activeTab]}
        </CardTitle>
        <CardDescription className="text-sm text-muted-foreground">
          {activeTab === "signin"
            ? "برای ادامه وارد حساب خود شوید."
            : "چند مرحله ساده تا ساخت حساب جدید."}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div
          id={panelIds.signin}
          role="tabpanel"
          aria-labelledby={tabIds.signin}
          tabIndex={activeTab === "signin" ? 0 : -1}
          hidden={activeTab !== "signin"}
        >
          <SignInPanel
            callbackUrl={callbackUrl}
            onSwitchTab={() => handleSelectTab("signup")}
            onPasswordPhaseChange={onPasswordPhaseChange}
          />
        </div>
        <div
          id={panelIds.signup}
          role="tabpanel"
          aria-labelledby={tabIds.signup}
          tabIndex={activeTab === "signup" ? 0 : -1}
          hidden={activeTab !== "signup"}
        >
          <SignUpPanel
            onSwitchTab={() => handleSelectTab("signin")}
            onPasswordPhaseChange={onPasswordPhaseChange}
          />
        </div>
      </CardContent>
    </Card>
  );
}

type SignInPanelProps = {
  callbackUrl?: string;
  onSwitchTab: () => void;
  onPasswordPhaseChange?: (isActive: boolean) => void;
};

function SignInPanel({
  callbackUrl,
  onSwitchTab,
  onPasswordPhaseChange,
}: SignInPanelProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const errorParam = searchParams.get("error");
    if (!errorParam) {
      setError(null);
      return;
    }

    const errorMessages: Record<string, string> = {
      CredentialsSignin: "ایمیل یا رمز عبور نادرست است.",
      AccessDenied: "دسترسی شما مجاز نیست.",
    };

    setError(errorMessages[errorParam] ?? "خطایی رخ داد. دوباره تلاش کنید.");
  }, [searchParams]);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    const email =
      (formData.get("email") as string | null)?.trim().toLowerCase() ?? "";
    const password = (formData.get("password") as string | null) ?? "";

    if (!email || !password) {
      setError("لطفاً تمام فیلدها را تکمیل کنید.");
      return;
    }

    setIsSubmitting(true);
    setError(null);

    // eslint-disable-next-line no-console
    console.info("auth_signin_submit", { email });

    const result = await signIn("credentials", {
      redirect: false,
      email,
      password,
      callbackUrl: callbackUrl ?? "/dashboard",
    });

    setIsSubmitting(false);

    if (result?.error) {
      const fallback =
        result.error === "CredentialsSignin"
          ? "ایمیل یا رمز عبور نادرست است."
          : result.error;
      setError(fallback);
      // eslint-disable-next-line no-console
      console.info("auth_error", { flow: "signin", message: fallback });
      return;
    }

    const destination = result?.url ?? callbackUrl ?? "/dashboard";
    router.push(destination);
    router.refresh();
  }

  return (
    <form className="space-y-4" onSubmit={handleSubmit} aria-describedby="signin-errors">
        <div className="space-y-2">
          <Label htmlFor="signin-email">ایمیل</Label>
          <Input
            id="signin-email"
            name="email"
            type="email"
            dir="ltr"
            autoComplete="email"
            required
            placeholder="you@example.com"
            onFocus={() => onPasswordPhaseChange?.(true)}
            onBlur={() => onPasswordPhaseChange?.(false)}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="signin-password">رمز عبور</Label>
          <Input
            id="signin-password"
            name="password"
            type="password"
            autoComplete="current-password"
            required
            placeholder="********"
            onFocus={() => onPasswordPhaseChange?.(true)}
            onBlur={() => onPasswordPhaseChange?.(false)}
          />
        </div>
        <div className="text-left">
          <Link
            href={{ pathname: "/auth/forgot-password" }}
            className="text-sm text-primary underline-offset-2 hover:underline"
          >
            رمز عبور را فراموش کرده‌اید؟
          </Link>
        </div>
        <div
          id="signin-errors"
          role="status"
          aria-live="assertive"
          aria-atomic="true"
          className={cn(
            "min-h-[1.5rem] text-sm",
            error ? "text-destructive" : "text-muted-foreground",
          )}
        >
          {error ?? " "}
        </div>
        <Button type="submit" className="w-full" disabled={isSubmitting}>
          {isSubmitting ? "در حال ورود..." : "ورود به حساب کاربری"}
        </Button>
        <p className="text-center text-sm text-muted-foreground">
          حساب ندارید؟{" "}
          <button
            type="button"
            onClick={onSwitchTab}
            className="font-medium text-primary underline-offset-2 hover:underline"
          >
            ثبت‌نام کنید
          </button>
        </p>
    </form>
  );
}

type SignUpPanelProps = {
  onSwitchTab: () => void;
  onPasswordPhaseChange?: (isActive: boolean) => void;
};

function SignUpPanel({
  onSwitchTab,
  onPasswordPhaseChange,
}: SignUpPanelProps) {
  const router = useRouter();
  const { toast } = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [acceptedTerms, setAcceptedTerms] = useState(false);

  const handlePasswordBlur = () => {
    setTimeout(() => {
      if (typeof document === "undefined") {
        onPasswordPhaseChange?.(false);
        return;
      }
      const activeId = document.activeElement?.id;
      if (activeId === "signup-password") {
        return;
      }
      onPasswordPhaseChange?.(false);
    }, 0);
  };

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    const name = (formData.get("name") as string | null)?.trim() ?? "";
    const email =
      (formData.get("email") as string | null)?.trim().toLowerCase() ?? "";
    const phoneRaw = (formData.get("phone") as string | null) ?? "";
    const phone = normalizeDigits(phoneRaw).trim();
    const password = (formData.get("password") as string | null) ?? "";

    if (!email || !password || !phone) {
      setError("تمام فیلدهای ضروری را تکمیل کنید.");
      return;
    }

    if (!PHONE_REGEX.test(phone)) {
      setError(PHONE_ERROR);
      return;
    }

    if (password.length < 8) {
      setError("رمز عبور باید حداقل ۸ کاراکتر باشد.");
      return;
    }

    if (!acceptedTerms) {
      setError("برای ادامه باید شرایط و قوانین را بپذیرید.");
      return;
    }

    setError(null);
    setIsSubmitting(true);

    // eslint-disable-next-line no-console
    console.info("auth_signup_submit", { email });

    try {
      const response = await fetch("/api/auth/signup", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          name: name || undefined,
          email,
          password,
          phone,
        }),
      });

      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        const message =
          data?.message ?? "خطا در ثبت‌نام. لطفاً کمی بعد دوباره امتحان کنید.";
        setError(message);
        setIsSubmitting(false);
        // eslint-disable-next-line no-console
        console.info("auth_error", { flow: "signup", message });
        return;
      }

      const signInResult = await signIn("credentials", {
        redirect: false,
        email,
        password,
        callbackUrl: "/dashboard",
      });

      if (signInResult?.error) {
        const fallbackMessage =
          signInResult.error === "CredentialsSignin"
            ? "ایمیل یا رمز عبور نادرست است."
            : signInResult.error ?? "خطایی رخ داد. لطفاً دوباره تلاش کنید.";
        setError(fallbackMessage);
        setIsSubmitting(false);
        // eslint-disable-next-line no-console
        console.info("auth_error", {
          flow: "signup-signin",
          message: fallbackMessage,
        });
        return;
      }

      toast({
        title: "ثبت‌نام موفق",
        description: "حساب شما با موفقیت ایجاد و وارد شدید.",
      });
      // eslint-disable-next-line no-console
      console.info("auth_signup_success", { email });

      setIsSubmitting(false);
      const destination = signInResult?.url ?? "/dashboard";
      router.push(destination);
      router.refresh();
    } catch (err) {
      const message =
        err instanceof Error
          ? err.message
          : typeof err === "string"
            ? err
            : "خطای ناشناخته رخ داد.";
      setError("خطا در ارتباط با سرور. بعداً تلاش کنید.");
      setIsSubmitting(false);
      // eslint-disable-next-line no-console
      console.info("auth_error", { flow: "signup-network", message });
    }
  }

  return (
    <form className="space-y-4" onSubmit={handleSubmit} aria-describedby="signup-errors">
        <div className="space-y-2">
          <Label htmlFor="signup-name">نام</Label>
          <Input
            id="signup-name"
            name="name"
            type="text"
            autoComplete="name"
            placeholder="نام و نام خانوادگی"
            onFocus={() => onPasswordPhaseChange?.(true)}
            onBlur={handlePasswordBlur}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="signup-email">ایمیل</Label>
          <Input
            id="signup-email"
            name="email"
            dir="ltr"
            type="email"
            autoComplete="email"
            required
            placeholder="you@example.com"
            onFocus={() => onPasswordPhaseChange?.(true)}
            onBlur={handlePasswordBlur}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="signup-phone">شماره تلفن</Label>
          <Input
            id="signup-phone"
            name="phone"
            dir="ltr"
            type="tel"
            inputMode="numeric"
            autoComplete="tel"
            required
            placeholder="09XXXXXXXXX"
            onFocus={() => onPasswordPhaseChange?.(true)}
            onBlur={handlePasswordBlur}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="signup-password">رمز عبور</Label>
          <Input
            id="signup-password"
            name="password"
            type="password"
            autoComplete="new-password"
            required
            placeholder="********"
            onFocus={() => onPasswordPhaseChange?.(true)}
            onBlur={handlePasswordBlur}
          />
          <p className="text-xs text-muted-foreground">
            رمز عبور باید حداقل ۸ کاراکتر باشد و ترکیبی از حروف و اعداد باشد.
          </p>
        </div>
        <label className="flex items-center gap-2 text-sm text-muted-foreground">
          <input
            type="checkbox"
            className="h-4 w-4 rounded border border-border"
            checked={acceptedTerms}
            onChange={(event) => setAcceptedTerms(event.currentTarget.checked)}
          />
          <span>شرایط و قوانین را می‌پذیرم.</span>
        </label>
        <div
          id="signup-errors"
          role="status"
          aria-live="assertive"
          aria-atomic="true"
          className={cn(
            "min-h-[1.5rem] text-sm",
            error ? "text-destructive" : "text-muted-foreground",
          )}
        >
          {error ?? " "}
        </div>
        <Button type="submit" className="w-full" disabled={isSubmitting || !acceptedTerms}>
          {isSubmitting ? "در حال ارسال..." : "ساخت حساب جدید"}
        </Button>
        <p className="text-center text-sm text-muted-foreground">
          قبلاً حساب دارید؟{" "}
          <button
            type="button"
            onClick={onSwitchTab}
            className="font-medium text-primary underline-offset-2 hover:underline"
          >
            وارد شوید
          </button>
        </p>
    </form>
  );
}

function buildUrlWithParams(pathname: string, params: URLSearchParams) {
  const query = params.toString();
  return query ? `${pathname}?${query}` : pathname;
}
