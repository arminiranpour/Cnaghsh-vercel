"use client";

import { useEffect, useMemo, useState } from "react";
import type { Route } from "next";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useToast } from "@/components/ui/use-toast";
import { cn } from "@/lib/utils";
import type { ProviderName } from "@/lib/billing/provider.types";
import { SubscriptionPlanCard } from "@/components/pricing/SubscriptionPlanCard";

import type {
  CadenceKey,
  PricingPlanCadence,
  PricingPlanGroupData,
  PricingViewer,
} from "./page";

type CadenceLabels = Readonly<Record<CadenceKey, string>>;

type PricingContentProps = {
  plans: PricingPlanGroupData[];
  cadenceLabels: CadenceLabels;
  initialCadence: CadenceKey;
  viewer: PricingViewer;
};

type SelectedPrice = {
  id: string;
  name: string;
  cadence?: CadenceKey;
  description?: string;
};

type DisplayPlan = {
  group: PricingPlanGroupData;
  cadenceKey: CadenceKey;
  cadence: PricingPlanCadence;
};

type CheckoutStartSuccess = {
  sessionId: string;
  redirectUrl: string;
};

type CheckoutStartError = {
  error?: string;
};

const SIGN_IN_URL = "/auth?tab=signin&callbackUrl=%2Fpricing";

const resolveGroupCadence = (
  group: PricingPlanGroupData,
  preferred: CadenceKey,
): DisplayPlan | null => {
  const exactCadence = group.cadences[preferred];
  if (exactCadence) {
    return { group, cadenceKey: preferred, cadence: exactCadence };
  }

  const fallbackEntry = (
    Object.entries(group.cadences) as Array<[
      CadenceKey,
      PricingPlanCadence | undefined,
    ]>
  ).find(([, cadence]) => Boolean(cadence));

  if (!fallbackEntry || !fallbackEntry[1]) {
    return null;
  }

  return {
    group,
    cadenceKey: fallbackEntry[0],
    cadence: fallbackEntry[1],
  };
};

const providerOptions: { id: ProviderName; label: string }[] = [
  { id: "zarinpal", label: "زرین‌پال" },
  { id: "idpay", label: "آیدی‌پی" },
  { id: "nextpay", label: "نکست‌پی" },
];

const FREE_PLAN_FEATURES = [
  { label: "امکان ساخت پروفایل و وارد کردن اطلاعات پایه", enabled: true },
  { label: "نمایش در فهرست بازیگران و جستوجوی پیشرفته", enabled: true },
  { label: "امکان دریافت پیام و گفتوگو با عوامل", enabled: true },
  { label: "امکان بارگزاری عکس و ویدئو و فایل صوتی", enabled: false },
  { label: "دسترسی به بخش‌های مختلف وب‌سایت", enabled: false },
  { label: "دسترسی به فراخوان‌ها", enabled: false },
  { label: "امکان شرکت در مسابقات و چالش و رویدادها", enabled: false },
  { label: "امکان برخورداری از مشاوره و آموزش‌ها", enabled: false },
] as const;

const PAID_PLAN_FEATURES = [
  { label: "امکان ساخت پروفایل و وارد کردن اطلاعات پایه", enabled: true },
  { label: "نمایش در فهرست بازیگران و جستوجوی پیشرفته", enabled: true },
  { label: "امکان دریافت پیام و گفتوگو با عوامل", enabled: true },
  { label: "امکان بارگزاری عکس و ویدئو و فایل صوتی", enabled: true },
  { label: "دسترسی به بخش‌های مختلف وب‌سایت", enabled: true },
  { label: "دسترسی به فراخوان‌ها", enabled: true },
  { label: "امکان شرکت در مسابقات و چالش و رویدادها", enabled: true },
  { label: "امکان برخورداری از مشاوره و آموزش‌ها", enabled: true },
] as const;

const cadencePriority: CadenceKey[] = ["monthly", "quarterly", "annual"];

const getCadenceLabel = (cadence: string, cadenceLabels: CadenceLabels) => {
  const normalized = cadence.trim().toLowerCase();

  const knownLabels: Record<string, string> = {
    monthly: "ماهانه",
    month: "ماهانه",
    quarterly: "سه ماهه",
    quarter: "سه ماهه",
    seasonal: "سه ماهه",
    semiannual: "۶ ماهه",
    "semi-annual": "۶ ماهه",
    biannual: "۶ ماهه",
    six_months: "۶ ماهه",
    "6_months": "۶ ماهه",
    annual: "سالانه",
    yearly: "سالانه",
    year: "سالانه",
  };

  return cadenceLabels[cadence as CadenceKey] ?? knownLabels[normalized] ?? cadence;
};

const getPlanTitleByCadence = (cadence: CadenceKey): string => {
  switch (cadence) {
    case "monthly":
      return "اشتراک ماهیانه";
    case "quarterly":
      return "اشتراک سه ماهه";
    case "annual":
      return "اشتراک سالانه";
    default:
      return "اشتراک";
  }
};

export function PricingContent({
  plans,
  cadenceLabels,
  initialCadence,
  viewer,
}: PricingContentProps) {
  const router = useRouter();
  const { toast } = useToast();
  const [activeCadence, setActiveCadence] = useState<CadenceKey>(initialCadence);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedProvider, setSelectedProvider] = useState<ProviderName>(
    providerOptions[0].id,
  );
  const [selectedPrice, setSelectedPrice] = useState<SelectedPrice | null>(
    null,
  );
  const [isSubmitting, setIsSubmitting] = useState(false);

  const cadenceOptions = useMemo(() => {
    const available = new Set<CadenceKey>();
    plans.forEach((group) => {
      (Object.entries(group.cadences) as Array<[
        CadenceKey,
        PricingPlanCadence | undefined,
      ]>).forEach(([key, value]) => {
        if (value) {
          available.add(key);
        }
      });
    });

    return Array.from(available).sort(
      (a, b) => cadencePriority.indexOf(a) - cadencePriority.indexOf(b),
    );
  }, [plans]);

  useEffect(() => {
    if (cadenceOptions.length === 0) {
      return;
    }
    if (cadenceOptions.includes(initialCadence)) {
      setActiveCadence(initialCadence);
      return;
    }
    setActiveCadence(cadenceOptions[0]);
  }, [initialCadence, cadenceOptions]);

  useEffect(() => {
    if (!dialogOpen) setSelectedPrice(null);
  }, [dialogOpen]);

  const displayPlans = useMemo(() => {
    return plans
      .map((group) => resolveGroupCadence(group, activeCadence))
      .filter((plan): plan is DisplayPlan => Boolean(plan));
  }, [plans, activeCadence]);

  const canCheckout = viewer.state === "signed-in" && Boolean(viewer.userId);

  const subscriptionPlanId = viewer.subscription?.planId ?? null;

  const handleSelectPrice = (price: SelectedPrice) => {
    if (!canCheckout) {
      toast({
        title: "برای خرید ابتدا وارد شوید",
        description: "جهت ادامه، وارد حساب کاربری خود شوید یا ثبت‌نام کنید.",
        variant: "destructive",
      });
      return;
    }
    setSelectedPrice(price);
    setSelectedProvider(providerOptions[0].id);
    setDialogOpen(true);
  };

  const handleStartCheckout = async () => {
    if (!selectedPrice) return;

    if (!viewer.userId) {
      toast({
        title: "برای ادامه وارد شوید",
        description: "شناسه کاربر معتبر یافت نشد.",
        variant: "destructive",
      });
      return;
    }

    setIsSubmitting(true);
    try {
      const response = await fetch("/api/checkout/start", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: viewer.userId,
          provider: selectedProvider,
          priceId: selectedPrice.id,
        }),
      });

      const isJsonResponse = response.headers
        .get("content-type")
        ?.toLowerCase()
        .includes("application/json");

      let data: CheckoutStartSuccess | CheckoutStartError | null = null;
      if (isJsonResponse) {
        try {
          data = (await response.json()) as
            | CheckoutStartSuccess
            | CheckoutStartError;
        } catch (e) {
          console.error("Failed to parse checkout response", e);
          data = null;
        }
      }

      if (
        !response.ok ||
        !data ||
        !("sessionId" in data) ||
        !("redirectUrl" in data)
      ) {
        const errorMessage =
          data && "error" in data && data.error
            ? data.error
            : "خطا در شروع فرایند پرداخت";
        throw new Error(errorMessage);
      }

      setDialogOpen(false);
      toast({
        title: "در حال انتقال",
        description: "به درگاه انتخابی منتقل می‌شوید...",
      });
      router.push(`/checkout/${data.sessionId}` as Route);
      window.location.href = data.redirectUrl;
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "خطای ناشناخته رخ داد";
      toast({
        title: "عدم موفقیت",
        description: message,
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const dialogTitle = useMemo(() => {
    if (!selectedPrice) return "انتخاب درگاه";
    return `انتخاب درگاه برای ${selectedPrice.name}`;
  }, [selectedPrice]);

  return (
    <div className="space-y-10">
      {cadenceOptions.length > 1 && (
        <div className="flex justify-center">
          <div className="inline-flex rounded-full border border-border bg-muted/60 p-1">
            {cadenceOptions.map((cadence) => (
              <Button
                key={cadence}
                type="button"
                variant={cadence === activeCadence ? "default" : "ghost"}
                className={cn(
                  "rounded-full px-4 py-2 text-sm",
                  cadence !== activeCadence && "text-muted-foreground",
                )}
                onClick={() => setActiveCadence(cadence)}
              >
                {getCadenceLabel(cadence, cadenceLabels)}
              </Button>
            ))}
          </div>
        </div>
      )}

      <section className="space-y-6">
        <div className="space-y-2 text-center">
          <h2 className="text-4xl font-bold text-black mb-4">خرید اشتراک</h2>
        </div>

        <div className="grid grid-cols-1 justify-items-center gap-8 lg:grid-cols-2 xl:grid-cols-3">
          {/* Free Plan */}
          <SubscriptionPlanCard
            title="رایگان"
            features={[...FREE_PLAN_FEATURES]}
            buttonText="انتخاب"
            buttonAction={
              canCheckout
                ? () => router.push("/dashboard/profile" as Route)
                : SIGN_IN_URL
            }
            isActive={false}
            isDisabled={isSubmitting}
          />

          {/* Paid Plans */}
          {displayPlans.map(({ group, cadenceKey, cadence }) => {
            const isActivePlan = subscriptionPlanId === cadence.planId;
            const planTitle = getPlanTitleByCadence(cadenceKey);

            return (
              <SubscriptionPlanCard
                key={`${group.groupId}-${cadenceKey}`}
                title={planTitle}
                subtitle={cadence.formattedAmount}
                features={[...PAID_PLAN_FEATURES]}
                buttonText="پرداخت"
                buttonAction={
                  canCheckout
                    ? () =>
                        handleSelectPrice({
                          id: cadence.priceId,
                          name: planTitle,
                          cadence: cadenceKey,
                          description: getCadenceLabel(cadenceKey, cadenceLabels),
                        })
                    : SIGN_IN_URL
                }
                isActive={isActivePlan}
                isDisabled={isSubmitting}
              />
            );
          })}
        </div>
      </section>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{dialogTitle}</DialogTitle>
            <DialogDescription>
              درگاه پرداخت مورد نظر خود را انتخاب کنید و ادامه دهید.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="flex flex-wrap gap-2">
              {providerOptions.map((option) => (
                <Button
                  key={option.id}
                  variant={
                    selectedProvider === option.id ? "default" : "outline"
                  }
                  onClick={() => setSelectedProvider(option.id)}
                  type="button"
                  disabled={isSubmitting}
                >
                  {option.label}
                </Button>
              ))}
            </div>
            {selectedPrice?.description && (
              <p className="text-sm text-muted-foreground">
                دوره انتخابی: {selectedPrice.description}
              </p>
            )}
          </div>
          <DialogFooter>
            <Button
              type="button"
              onClick={handleStartCheckout}
              disabled={isSubmitting}
              className="w-full sm:w-auto"
            >
              {isSubmitting ? "در حال ارسال..." : "تایید و ادامه"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
