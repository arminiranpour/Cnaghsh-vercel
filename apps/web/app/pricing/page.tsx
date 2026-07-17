import { PlanCycle, ProductType } from "@prisma/client";
import type { Metadata } from "next";
import localFont from "next/font/local";

import { prisma } from "@/lib/prisma";
import { getServerAuthSession } from "@/lib/auth/session";
import { getSubscription } from "@/lib/billing/subscriptionService";
import { formatRials } from "@/lib/money";

import { PricingContent } from "./pricing-content";

const iranSans = localFont({
  src: [
    {
      path: "../../public/fonts/IRANSansWeb.woff2",
      weight: "400",
      style: "normal",
    },
    {
      path: "../../public/fonts/IRANSansWeb_Medium.woff2",
      weight: "500",
      style: "normal",
    },
    {
      path: "../../public/fonts/IRANSansWeb_Bold.woff2",
      weight: "700",
      style: "normal",
    },
    {
      path: "../../public/fonts/IRANSansWeb_Black.woff2",
      weight: "900",
      style: "normal",
    },
  ],
  display: "swap",
  variable: "--font-iransans",
});

export const metadata: Metadata = {
  title: "قیمت‌ها و پلن‌ها | سی‌نقش",
  description:
    "پلن‌های اشتراک ماهیانه، سه ماهه و سالانه سی‌نقش را مقایسه کنید، ویژگی‌ها و مزایای هر پلن را ببینید و با اطمینان خرید کنید.",
};

const CADENCE_LABELS = {
  monthly: "ماهانه",
  quarterly: "سه ماهه",
  annual: "سالانه",
} as const;

type SearchParams = Record<string, string | string[] | undefined>;

type CadenceKey = keyof typeof CADENCE_LABELS;

type NormalizedValue = {
  kind: "boolean" | "number" | "text";
  valueLabel: string;
  raw: boolean | number | string | null;
};

type NormalizedFeature = {
  key: string;
  label: string;
  primary: string;
  secondary?: string;
  value?: NormalizedValue;
};

type NormalizedComparison = {
  key: string;
  label: string;
  value: NormalizedValue;
  footnote?: string;
};

type PricingPlanCadence = {
  planId: string;
  priceId: string;
  cycle: PlanCycle;
  amount: number;
  formattedAmount: string;
};

type PricingPlanGroupData = {
  groupId: string;
  name: string;
  tagline?: string;
  persona?: string;
  highlight: boolean;
  badgeLabel?: string;
  order: number;
  features: NormalizedFeature[];
  comparison: Record<string, NormalizedComparison>;
  cadences: Partial<Record<CadenceKey, PricingPlanCadence>>;
  note?: string;
};

type PricingSubscriptionInfo = {
  planId: string;
  groupId: string | null;
  cycle: CadenceKey | null;
  status: string;
  endsAt: string;
  cancelAtPeriodEnd: boolean;
};

type PlanMetadata = {
  groupKey: string;
  displayName?: string;
  persona?: string;
  tagline?: string;
  highlight: boolean;
  badgeLabel?: string;
  order: number;
  note?: string;
  features: NormalizedFeature[];
  comparison: Record<string, NormalizedComparison>;
};

const featureLabelFallback: Record<string, string> = {
  jobPosts: "تعداد آگهی‌های ماهانه",
  jobCredits: "اعتبار آگهی شغلی",
  publishProfile: "انتشار پروفایل",
  highlightProfile: "برجسته کردن پروفایل",
  support: "پشتیبانی",
  analytics: "گزارش‌گیری پیشرفته",
  storage: "فضای ذخیره‌سازی",
  seats: "تعداد صندلی",
};

const reservedLimitKeys = new Set([
  "groupKey",
  "slug",
  "id",
  "key",
  "highlight",
  "primary",
  "featured",
  "badge",
  "badgeLabel",
  "displayName",
  "title",
  "tagline",
  "subtitle",
  "description",
  "persona",
  "target",
  "audience",
  "order",
  "rank",
  "priority",
  "note",
  "helper",
  "legalNote",
  "features",
  "featureList",
  "comparison",
  "comparisonRows",
  "featureComparison",
]);

const cadenceByCycle: Partial<Record<PlanCycle, CadenceKey>> = {
  [PlanCycle.MONTHLY]: "monthly",
  [PlanCycle.QUARTERLY]: "quarterly",
  [PlanCycle.YEARLY]: "annual",
};

const cadencePriority: CadenceKey[] = ["monthly", "quarterly", "annual"];

const numberFormatter = new Intl.NumberFormat("fa-IR");

const isPlainObject = (value: unknown): value is Record<string, unknown> => {
  return typeof value === "object" && value !== null && !Array.isArray(value);
};

const toStringValue = (value: unknown): string | undefined => {
  if (typeof value === "string") {
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : undefined;
  }
  if (typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }
  return undefined;
};

const toBooleanValue = (value: unknown): boolean | undefined => {
  if (typeof value === "boolean") {
    return value;
  }
  if (typeof value === "number") {
    return value !== 0;
  }
  if (typeof value === "string") {
    const normalized = value.trim().toLowerCase();
    if (normalized === "true" || normalized === "yes" || normalized === "1") {
      return true;
    }
    if (normalized === "false" || normalized === "no" || normalized === "0") {
      return false;
    }
  }
  return undefined;
};

const toNumberValue = (value: unknown): number | undefined => {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }
  if (typeof value === "string") {
    const parsed = Number(value);
    if (!Number.isNaN(parsed)) {
      return parsed;
    }
  }
  return undefined;
};

const normalizeValue = (input: unknown): NormalizedValue => {
  if (typeof input === "boolean") {
    return { kind: "boolean", valueLabel: input ? "دارد" : "ندارد", raw: input };
  }
  if (typeof input === "number" && Number.isFinite(input)) {
    return {
      kind: "number",
      valueLabel: numberFormatter.format(input),
      raw: input,
    };
  }
  if (typeof input === "string") {
    const trimmed = input.trim();
    if (trimmed.length === 0) {
      return { kind: "text", valueLabel: "—", raw: "" };
    }
    return { kind: "text", valueLabel: trimmed, raw: trimmed };
  }
  if (input === null || input === undefined) {
    return { kind: "text", valueLabel: "—", raw: null };
  }
  if (Array.isArray(input)) {
    const joined = input.map((value) => String(value)).join("، ");
    return { kind: "text", valueLabel: joined, raw: joined };
  }
  try {
    const json = JSON.stringify(input);
    return { kind: "text", valueLabel: json ?? "—", raw: json ?? null };
  } catch (error) {
    return { kind: "text", valueLabel: "—", raw: null };
  }
};

const buildFeaturePrimary = (label: string, value?: NormalizedValue): string => {
  if (!value) {
    return label;
  }
  if (value.kind === "boolean") {
    return value.raw ? label : `بدون ${label}`;
  }
  if (value.kind === "number") {
    return `${value.valueLabel} ${label}`;
  }
  if (value.kind === "text") {
    return value.valueLabel === label ? label : `${label}: ${value.valueLabel}`;
  }
  return label;
};

const sanitizeGroupKey = (input: string): string => {
  return input
    .trim()
    .replace(/\s+/g, "-")
    .replace(/[^\p{L}\p{N}-]+/gu, "-")
    .replace(/-+/g, "-")
    .toLowerCase();
};

const extractPlanMetadata = (
  planName: string,
  limitsInput: Record<string, unknown> | null,
): PlanMetadata => {
  const source = isPlainObject(limitsInput) ? limitsInput : {};
  const rawGroupKey =
    toStringValue(source.groupKey) ??
    toStringValue(source.slug) ??
    toStringValue(source.id) ??
    toStringValue(source.key);
  const groupKey = rawGroupKey ? sanitizeGroupKey(rawGroupKey) : sanitizeGroupKey(planName);
  const displayName =
    toStringValue(source.displayName) ??
    toStringValue(source.title) ??
    toStringValue(source.name) ??
    planName;
  const persona =
    toStringValue(source.persona) ??
    toStringValue(source.target) ??
    toStringValue(source.audience);
  const tagline =
    toStringValue(source.tagline) ??
    toStringValue(source.subtitle) ??
    toStringValue(source.description);
  const note =
    toStringValue(source.note) ??
    toStringValue(source.helper) ??
    toStringValue(source.legalNote);
  const highlight =
    toBooleanValue(source.highlight ?? source.primary ?? source.featured) ?? false;
  const badgeLabel =
    toStringValue(source.badgeLabel ?? source.badge) ?? (highlight ? "پیشنهاد ما" : undefined);
  const order = toNumberValue(source.order ?? source.rank ?? source.priority) ?? 0;

  const features: NormalizedFeature[] = [];
  const appendFeature = (
    key: string,
    label: string,
    value?: NormalizedValue,
    secondary?: string,
  ) => {
    const normalizedKey = key || sanitizeGroupKey(`${label}-${features.length}`);
    features.push({
      key: normalizedKey,
      label,
      primary: buildFeaturePrimary(label, value),
      secondary,
      value,
    });
  };

  const featuresSource =
    (isPlainObject(source.features) ? source.features : null) ??
    (Array.isArray(source.features) ? source.features : null) ??
    (isPlainObject(source.featureList) ? source.featureList : null) ??
    (Array.isArray(source.featureList) ? source.featureList : null);

  if (Array.isArray(featuresSource)) {
    featuresSource.forEach((entry, index) => {
      if (typeof entry === "string") {
        appendFeature(`feature-${index}`, entry);
        return;
      }
      if (isPlainObject(entry)) {
        const key =
          toStringValue(entry.key) ??
          `feature-${index}`;
        const label =
          toStringValue(entry.label) ??
          featureLabelFallback[key] ??
          `ویژگی ${index + 1}`;
        const secondary = toStringValue(entry.description ?? entry.detail);
        const value =
          "value" in entry
            ? normalizeValue((entry as Record<string, unknown>).value)
            : undefined;
        appendFeature(key, label, value, secondary);
      }
    });
  } else if (isPlainObject(featuresSource)) {
    Object.entries(featuresSource).forEach(([key, value]) => {
      if (value === undefined) {
        return;
      }
      const label = featureLabelFallback[key] ?? key;
      const normalizedValue = normalizeValue(value);
      appendFeature(key, label, normalizedValue);
    });
  }

  Object.entries(source).forEach(([key, value]) => {
    if (reservedLimitKeys.has(key) || value === undefined) {
      return;
    }
    if (typeof value === "object" && value !== null) {
      return;
    }
    const label = featureLabelFallback[key] ?? key;
    const normalizedValue = normalizeValue(value);
    appendFeature(key, label, normalizedValue);
  });

  const comparison: Record<string, NormalizedComparison> = {};
  const comparisonSource =
    (Array.isArray(source.comparison) || isPlainObject(source.comparison))
      ? source.comparison
      : (Array.isArray(source.comparisonRows) || isPlainObject(source.comparisonRows))
        ? source.comparisonRows
        : (Array.isArray(source.featureComparison) || isPlainObject(source.featureComparison))
          ? source.featureComparison
          : null;

  if (Array.isArray(comparisonSource)) {
    comparisonSource.forEach((entry, index) => {
      if (typeof entry === "string") {
        const normalizedValue = normalizeValue(true);
        const key = `comparison-${index}`;
        comparison[key] = {
          key,
          label: entry,
          value: normalizedValue,
        };
        return;
      }
      if (isPlainObject(entry)) {
        const entryObject = entry as Record<string, unknown>;
        const key =
          toStringValue(entryObject.key) ??
          sanitizeGroupKey(
            toStringValue(entryObject.label) ?? `comparison-${index}`,
          );
        const label =
          toStringValue(entryObject.label) ??
          featureLabelFallback[key] ??
          `ویژگی ${index + 1}`;
        const normalizedValue = normalizeValue(
          entryObject.value ?? entryObject.amount ?? entryObject.enabled ?? true,
        );
        const footnote = toStringValue(entryObject.note ?? entryObject.footnote);
        comparison[key] = {
          key,
          label,
          value: normalizedValue,
          footnote,
        };
      }
    });
  } else if (isPlainObject(comparisonSource)) {
    Object.entries(comparisonSource).forEach(([key, value]) => {
      if (isPlainObject(value)) {
        const valueObject = value as Record<string, unknown>;
        const label =
          toStringValue(valueObject.label) ??
          featureLabelFallback[key] ??
          key;
        const normalizedValue = normalizeValue(
          valueObject.value ?? valueObject.amount ?? valueObject.enabled ?? value,
        );
        const footnote = toStringValue(valueObject.note ?? valueObject.footnote);
        comparison[key] = {
          key,
          label,
          value: normalizedValue,
          footnote,
        };
        return;
      }
      const label = featureLabelFallback[key] ?? key;
      comparison[key] = {
        key,
        label,
        value: normalizeValue(value),
      };
    });
  }

  if (Object.keys(comparison).length === 0) {
    features.forEach((feature) => {
      if (!feature.value) {
        return;
      }
      if (comparison[feature.key]) {
        return;
      }
      comparison[feature.key] = {
        key: feature.key,
        label: feature.label,
        value: feature.value,
      };
    });
  }

  return {
    groupKey,
    displayName,
    persona,
    tagline,
    highlight,
    badgeLabel,
    order,
    note,
    features,
    comparison,
  } satisfies PlanMetadata;
};

const mapCycleToCadence = (cycle: PlanCycle): CadenceKey | null => {
  return cadenceByCycle[cycle] ?? null;
};

const normalizePlanGroups = (
  plans: Array<{
    id: string;
    name: string;
    cycle: PlanCycle;
    limits: Record<string, unknown> | null;
    prices: Array<{ id: string; amount: number }>;
  }>,
): PricingPlanGroupData[] => {
  const groups = new Map<string, PricingPlanGroupData>();

  plans.forEach((plan) => {
    const [activePrice] = plan.prices;
    if (!activePrice) {
      return;
    }

    const metadata = extractPlanMetadata(plan.name, plan.limits);
    const cadenceKey = mapCycleToCadence(plan.cycle);

    if (!groups.has(metadata.groupKey)) {
      groups.set(metadata.groupKey, {
        groupId: metadata.groupKey,
        name: metadata.displayName ?? plan.name,
        tagline: metadata.tagline,
        persona: metadata.persona,
        highlight: metadata.highlight,
        badgeLabel: metadata.badgeLabel,
        order: metadata.order,
        features: metadata.features,
        comparison: metadata.comparison,
        cadences: {},
        note: metadata.note,
      });
    }

    const group = groups.get(metadata.groupKey)!;
    if (!group.tagline && metadata.tagline) {
      group.tagline = metadata.tagline;
    }
    if (!group.persona && metadata.persona) {
      group.persona = metadata.persona;
    }
    if (!group.note && metadata.note) {
      group.note = metadata.note;
    }
    if (metadata.highlight) {
      group.highlight = true;
    }
    if (metadata.badgeLabel) {
      group.badgeLabel = metadata.badgeLabel;
    }
    if (metadata.displayName) {
      group.name = metadata.displayName;
    }
    if (metadata.order && metadata.order !== group.order) {
      group.order = Math.min(group.order, metadata.order);
    }
    if (group.features.length === 0 && metadata.features.length > 0) {
      group.features = metadata.features;
    }
    if (
      Object.keys(group.comparison).length === 0 &&
      Object.keys(metadata.comparison).length > 0
    ) {
      group.comparison = metadata.comparison;
    }

    if (cadenceKey) {
      group.cadences[cadenceKey] = {
        planId: plan.id,
        priceId: activePrice.id,
        cycle: plan.cycle,
        amount: activePrice.amount,
        formattedAmount: formatRials(activePrice.amount),
      } satisfies PricingPlanCadence;
    }
  });

  return Array.from(groups.values()).sort((a, b) => {
    if (a.order !== b.order) {
      return a.order - b.order;
    }
    return a.name.localeCompare(b.name, "fa");
  });
};

const isCadenceKey = (value: string | undefined | null): value is CadenceKey => {
  if (!value) {
    return false;
  }
  return value === "monthly" || value === "quarterly" || value === "annual";
};

export type { CadenceKey, NormalizedComparison, NormalizedFeature, NormalizedValue, PricingPlanCadence, PricingPlanGroupData, PricingSubscriptionInfo };

export type PricingViewer = {
  state: "guest" | "signed-in";
  userId: string | null;
  subscription: PricingSubscriptionInfo | null;
};

const mapSearchCadence = (
  searchParams: SearchParams | undefined,
): CadenceKey | null => {
  if (!searchParams) {
    return null;
  }
  const raw = searchParams.cadence;
  if (!raw) {
    return null;
  }
  const value = Array.isArray(raw) ? raw[0] : raw;
  if (isCadenceKey(value)) {
    return value;
  }
  return null;
};

export default async function PricingPage({
  searchParams,
}: {
  searchParams?: Promise<SearchParams>;
}) {
  const resolvedSearchParams = searchParams ? await searchParams : undefined;
  const session = await getServerAuthSession();
  const sessionUserId = session?.user?.id ?? null;
  const subscription = sessionUserId
    ? await getSubscription(sessionUserId)
    : null;

  const plans = await prisma.plan.findMany({
    where: {
      active: true,
      product: {
        active: true,
        type: ProductType.SUBSCRIPTION,
      },
    },
    include: {
      prices: {
        where: { active: true },
        orderBy: { amount: "asc" },
        select: { id: true, amount: true },
      },
    },
    orderBy: { createdAt: "asc" },
  });

  const planGroups = normalizePlanGroups(
    plans.map((plan) => ({
      id: plan.id,
      name: plan.name,
      cycle: plan.cycle,
      limits: isPlainObject(plan.limits) ? (plan.limits as Record<string, unknown>) : null,
      prices: plan.prices.map((price) => ({ id: price.id, amount: price.amount })),
    })),
  );

  const availableCadences = new Set<CadenceKey>();
  planGroups.forEach((group) => {
    (Object.keys(group.cadences) as CadenceKey[]).forEach((key) => {
      if (group.cadences[key]) {
        availableCadences.add(key);
      }
    });
  });

  const activeSubscriptionGroup = subscription
    ? planGroups.find((group) =>
        Object.values(group.cadences).some(
          (cadence) => cadence && cadence.planId === subscription.planId,
        ),
      ) ?? null
    : null;

  const subscriptionInfo: PricingSubscriptionInfo | null = subscription
    ? {
        planId: subscription.planId,
        groupId: activeSubscriptionGroup?.groupId ?? null,
        cycle: mapCycleToCadence(subscription.plan.cycle),
        status: subscription.status,
        endsAt: subscription.endsAt.toISOString(),
        cancelAtPeriodEnd: subscription.cancelAtPeriodEnd,
      }
    : null;

  const urlCadence = mapSearchCadence(resolvedSearchParams);
  const requestedCadence =
    urlCadence ??
    subscriptionInfo?.cycle ??
    cadencePriority.find((cadence) => availableCadences.has(cadence)) ??
    "monthly";

  const defaultCadence = availableCadences.has(requestedCadence)
    ? requestedCadence
    : availableCadences.values().next().value ?? "monthly";

  const viewer: PricingViewer = {
    state: sessionUserId ? "signed-in" : "guest",
    userId: sessionUserId,
    subscription: subscriptionInfo,
  };

  return (
    <main className={`${iranSans.className} relative min-h-[840px] h-full w-full bg-[#E5E5E5]`}>
      <div
        className="fixed inset-0 -z-10 bg-[#E5E5E5]"
        aria-hidden="true"
      />
      <div className="mx-auto w-full max-w-[1600px] px-4 pt-[120px] pb-12">
        <div
          className="w-full rounded-none border-0 lg:rounded-[34px] lg:border-[3px] lg:border-white"
        >
          <div className="flex w-full gap-12 md:flex-row" dir="ltr">
            <div className="w-full p-0 lg:p-12" dir="rtl">
              <PricingContent
                plans={planGroups}
                cadenceLabels={CADENCE_LABELS}
                initialCadence={defaultCadence}
                viewer={viewer}
              />
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
