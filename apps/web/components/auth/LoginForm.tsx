"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { signIn } from "next-auth/react";
import { User, Mail, Phone, Lock } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/components/ui/use-toast";
import { cn } from "@/lib/utils";
import type { AuthTab } from "@/lib/url/auth-tabs";


type LoginFormProps = {
  callbackUrl?: string;
  onPasswordPhaseChange?: (isActive: boolean) => void;
  initialTab?: AuthTab;
};

type AuthMode = "register" | "login";

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

export function LoginForm({
  callbackUrl,
  onPasswordPhaseChange,
  initialTab,
}: LoginFormProps) {
  const router = useRouter();
  const { toast } = useToast();
  const [mode, setMode] = useState<AuthMode>(() =>
    initialTab === "signin" ? "login" : "register",
  );
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showPasswordStep, setShowPasswordStep] = useState(false);
  const [formData, setFormData] = useState({
    username: "",
    email: "",
    phone: "",
    password: "",
    confirmPassword: "",
  });

  const handleInputChange = (field: keyof typeof formData, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
    setError(null);
  };

  const handleFirstStep = () => {
    if (!formData.email) {
      setError("لطفاً ایمیل را وارد کنید.");
      return;
    }

    if (mode === "register") {
      if (!formData.username || !formData.phone) {
        setError("لطفاً تمام فیلدها را تکمیل کنید.");
        return;
      }

      const normalizedPhone = normalizeDigits(formData.phone).trim();
      if (!PHONE_REGEX.test(normalizedPhone)) {
        setError(PHONE_ERROR);
        return;
      }
    }

    setShowPasswordStep(true);
    setError(null);
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);

    if (!showPasswordStep) {
      handleFirstStep();
      return;
    }

    // Password step submission
    if (mode === "register") {
      const normalizedPhone = normalizeDigits(formData.phone).trim();

      if (!PHONE_REGEX.test(normalizedPhone)) {
        setError(PHONE_ERROR);
        return;
      }

      if (!formData.password || !formData.confirmPassword) {
        setError("لطفاً رمز عبور و تکرار آن را وارد کنید.");
        return;
      }

      if (formData.password !== formData.confirmPassword) {
        setError("رمز عبور و تکرار آن یکسان نیست.");
        return;
      }

      if (formData.password.length < 8) {
        setError("رمز عبور باید حداقل ۸ کاراکتر باشد.");
        return;
      }

      setIsSubmitting(true);

      try {
        const response = await fetch("/api/auth/signup", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            name: formData.username || undefined,
            email: formData.email.toLowerCase().trim(),
            password: formData.password,
            phone: normalizedPhone,
          }),
        });

        const data = await response.json().catch(() => ({}));

        if (!response.ok) {
          const message =
            data?.message ?? "خطا در ثبت‌نام. لطفاً کمی بعد دوباره امتحان کنید.";
          setError(message);
          setIsSubmitting(false);
          return;
        }

        const signInResult = await signIn("credentials", {
          redirect: false,
          email: formData.email.toLowerCase().trim(),
          password: formData.password,
          callbackUrl: callbackUrl ?? "/dashboard/profile",
        });

        if (signInResult?.error) {
          const fallbackMessage =
            signInResult.error === "CredentialsSignin"
              ? "ایمیل یا رمز عبور نادرست است."
              : signInResult.error ?? "خطایی رخ داد. لطفاً دوباره تلاش کنید.";
          setError(fallbackMessage);
          setIsSubmitting(false);
          return;
        }

        toast({
          title: "ثبت‌نام موفق",
          description: "حساب شما با موفقیت ایجاد و وارد شدید.",
        });

        setIsSubmitting(false);
        const destination = signInResult?.url ?? callbackUrl ?? "/dashboard/profile";
        router.push(destination);
        router.refresh();
      } catch (err) {
        setError("خطا در ارتباط با سرور. بعداً تلاش کنید.");
        setIsSubmitting(false);
      }
    } else {
      // Login mode
      if (!formData.password) {
        setError("لطفاً رمز عبور را وارد کنید.");
        return;
      }

      setIsSubmitting(true);
      setError(null);

      const result = await signIn("credentials", {
        redirect: false,
        email: formData.email.toLowerCase().trim(),
        password: formData.password,
        callbackUrl: callbackUrl ?? "/dashboard/profile",
      });

      setIsSubmitting(false);

      if (result?.error) {
        const fallback =
          result.error === "CredentialsSignin"
            ? "ایمیل یا رمز عبور نادرست است."
            : result.error;
        setError(fallback);
        return;
      }

      const destination = result?.url ?? callbackUrl ?? "/dashboard/profile";
      router.push(destination);
      router.refresh();
    }
  };

  const handleGoogleSignIn = async () => {
    setIsSubmitting(true);
    setError(null);
    try {
      await signIn("google", {
        callbackUrl: callbackUrl ?? "/dashboard/profile",
        redirect: true,
      });
    } catch (err) {
      setError("خطا در ورود با گوگل. لطفاً دوباره تلاش کنید.");
      setIsSubmitting(false);
    }
  };

  return (
    <div className="h-full w-full max-w-[564px]" dir="rtl">
      <div
        className="flex h-full max-h-[647px] w-full flex-col justify-center rounded-[22px] bg-white p-5 shadow-[0_4px_30px_rgba(0,0,0,0.1)] sm:p-6 lg:p-10"
      >
      {/* Welcome Message */}
      <div className="mb-3 space-y-1.5 text-center sm:space-y-2">
        <h1 className="text-2xl font-bold text-black sm:text-3xl">خــوش آمـدیـد!</h1>
        <p className="text-sm text-black sm:text-base">
          لطفا اطلاعات خودتون رو وارد کنید.
        </p>
      </div>
{/* Toggle Switch */}
<div className="relative mb-4 flex gap-2 rounded-full bg-[#D9D9D9] p-1.5 sm:p-2">
  <button
    type="button"
    onClick={() => {
      setMode("register");
      setError(null);
      setShowPasswordStep(false);
      setFormData({
        username: "",
        email: "",
        phone: "",
        password: "",
        confirmPassword: "",
      });
    }}
    className={cn(
      "flex-1 rounded-full px-4 py-2.5 text-sm font-semibold transition-colors duration-200 sm:px-6 sm:py-3 sm:text-base",
      mode === "register"
        ? "bg-black text-white"
        : "bg-transparent text-black"
    )}
  >
    ثبت نام
  </button>

  <button
    type="button"
    onClick={() => {
      setMode("login");
      setError(null);
      setShowPasswordStep(false);
      setFormData({
        username: "",
        email: "",
        phone: "",
        password: "",
        confirmPassword: "",
      });
    }}
    className={cn(
      "flex-1 rounded-full px-4 py-2.5 text-sm font-semibold transition-colors duration-200 sm:px-6 sm:py-3 sm:text-base",
      mode === "login"
        ? "bg-black text-white"
        : "bg-transparent text-black"
    )}
  >
    ورود
  </button>
</div>



      {/* Form */}
      <form onSubmit={handleSubmit} className="space-y-3 sm:space-y-4">
        {/* Username Field */}
        {mode === "register" && (
          <div className="relative">
            <div className="flex items-center justify-center rounded-md bg-[#8B8B8B] p-1.5 sm:p-2 absolute left-0 top-1/2 -translate-y-1/2 z-10">
              <User className="h-5 w-8 text-foreground sm:h-5.5 sm:w-10" />
            </div>
            <Input
              type="text"
              placeholder="نام کاربری"
              value={formData.username}
              onChange={(e) => handleInputChange("username", e.target.value)}
              className="h-10 rounded-lg border-muted bg-white/50 pr-4 text-sm text-black placeholder:text-gray-400 sm:h-11 sm:pr-5 sm:text-base"
              required={mode === "register"}
            />
          </div>
        )}

        {/* Email Field */}
        {!showPasswordStep && (
          <div className="relative">
            <div className="flex items-center justify-center rounded-md bg-[#8B8B8B] p-1.5 sm:p-2 absolute left-0 top-1/2 -translate-y-1/2 z-10">
              <Mail className="h-5 w-8 text-foreground sm:h-5.5 sm:w-10" />
            </div>
            <Input
              type="email"
              placeholder="ایمیل"
              value={formData.email}
              onChange={(e) => handleInputChange("email", e.target.value)}
              className="h-10 rounded-lg border-muted bg-white/50 pr-4 text-sm text-black placeholder:text-gray-400 sm:h-11 sm:pr-5 sm:text-base"
              dir="trl"
              required

            />
          </div>
        )}

        {/* Phone Field */}
        {mode === "register" && !showPasswordStep && (
          <div className="relative">
            <div className="flex items-center justify-center rounded-md bg-[#8B8B8B] p-1.5 sm:p-2 absolute left-0 top-1/2 -translate-y-1/2 z-10">
              <Phone className="h-5 w-8 text-foreground sm:h-5.5 sm:w-10" />
            </div>
            <Input
              type="tel"
              placeholder="شماره تلفن"
              value={formData.phone}
              onChange={(e) => handleInputChange("phone", e.target.value)}
              className="h-10 rounded-lg border-muted bg-white/50 pr-4 text-sm text-black placeholder:text-gray-400 sm:h-11 sm:pr-5 sm:text-base"
              dir="rtl"
              inputMode="numeric"
              autoComplete="tel"
              required={mode === "register"}
            />
          </div>
        )}

        {/* Password Fields - Show after first step */}
        {showPasswordStep && (
          <>
            <div className="relative">
              <div className="flex items-center justify-center rounded-md bg-[#8B8B8B] p-1.5 sm:p-2 absolute left-0 top-1/2 -translate-y-1/2 z-10">
                <Lock className="h-5 w-8 text-foreground sm:h-5.5 sm:w-10" />
              </div>
              <Input
                type="password"
                placeholder="رمز عبور"
                value={formData.password}
                onChange={(e) => handleInputChange("password", e.target.value)}
                className="h-10 rounded-lg border-muted bg-white/50 pr-4 text-sm text-black placeholder:text-gray-400 sm:h-11 sm:pr-5 sm:text-base"
                required
                onFocus={() => onPasswordPhaseChange?.(true)}
                onBlur={() => onPasswordPhaseChange?.(false)}
              />
            </div>
            {mode === "register" && (
              <div className="relative">
                <div className="flex items-center justify-center rounded-md bg-[#8B8B8B] p-1.5 sm:p-2 absolute left-0 top-1/2 -translate-y-1/2 z-10">
                  <Lock className="h-5 w-8 text-foreground sm:h-5.5 sm:w-10" />
                </div>
                <Input
                  type="password"
                  placeholder="تکرار رمز عبور"
                  value={formData.confirmPassword}
                  onChange={(e) => handleInputChange("confirmPassword", e.target.value)}
                  className="h-10 rounded-lg border-muted bg-white/50 pr-4 text-sm text-black placeholder:text-gray-400 sm:h-11 sm:pr-5 sm:text-base"
                  required
                  onFocus={() => onPasswordPhaseChange?.(true)}
                  onBlur={() => onPasswordPhaseChange?.(false)}
                />
              </div>
            )}
          </>
        )}

        {/* Error Message */}
        {error && (
          <div className="text-center text-xs text-destructive sm:text-sm">{error}</div>
        )}

        {/* Continue Button */}
        <div className="flex gap-2">
          {showPasswordStep && (
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setShowPasswordStep(false);
                setError(null);
              }}
              className="h-10 flex-1 rounded-lg text-sm sm:h-11 sm:text-base"
            >
              بازگشت
            </Button>
          )}
          <Button
            type="submit"
            className="h-10 flex-1 rounded-lg bg-orange-500 text-sm font-medium text-white hover:bg-orange-600 sm:h-11 sm:text-base"
            disabled={isSubmitting}
          >
            {isSubmitting
              ? "در حال پردازش..."
              : showPasswordStep
                ? mode === "register"
                  ? "ثبت نام"
                  : "ورود"
                : "ادامه"}
          </Button>
        </div>
      </form>

{/* Google Sign In */}
<div dir="ltr" className="mt-5 flex justify-end sm:mt-8">
  <button
    type="button"
    onClick={handleGoogleSignIn}
    disabled={isSubmitting}
    className="mx-auto flex w-full max-w-[400px] flex-row-reverse items-center justify-between text-xs text-black transition hover:text-gray-800 disabled:opacity-50 sm:text-sm"
  >

    <span dir="rtl" className="whitespace-nowrap">بــا اکـانـت گـوگـل وارد شـویـد.</span>
<svg
  className="h-7 w-7 text-black sm:h-8 sm:w-8"
  viewBox="0 0 24 24"
  fill="currentColor"
  xmlns="http://www.w3.org/2000/svg"
>
  <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
  <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
  <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
  <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
</svg>

  </button>
</div>


    </div>
    </div>
  );
}
