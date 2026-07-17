import { PlanCycle, ProductType } from "@prisma/client";

import { prisma } from "@/lib/db";
import { ok, PUBLIC_CACHE_HEADERS } from "@/lib/http";
import { formatRials } from "@/lib/money";

type PricingPlan = {
  id: string;
  name: string;
  cycle: string;
  price: {
    id: string;
    amount: number;
    formatted: string;
  };
  limits: Record<string, unknown> | null;
};

type OneTimePrice = {
  id: string;
  name: string;
  amount: number;
  formatted: string;
};

const cycleLabels: Record<PlanCycle, string> = {
  [PlanCycle.MONTHLY]: "ماهانه",
  [PlanCycle.QUARTERLY]: "سه ماهه",
  [PlanCycle.YEARLY]: "سالانه",
};

const serializeLimits = (limits: unknown): Record<string, unknown> | null => {
  if (!limits || typeof limits !== "object") {
    return null;
  }

  if (Array.isArray(limits)) {
    return limits.reduce<Record<string, unknown>>((acc, value, index) => {
      acc[index.toString()] = value;
      return acc;
    }, {});
  }

  return limits as Record<string, unknown>;
};

export async function GET() {
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
        orderBy: { createdAt: "asc" },
      },
    },
    orderBy: { createdAt: "asc" },
  });

  const planItems: PricingPlan[] = plans
    .map((plan) => {
      const activePrice = plan.prices[0];
      if (!activePrice) {
        return null;
      }

      return {
        id: plan.id,
        name: plan.name,
        cycle: cycleLabels[plan.cycle],
        limits: serializeLimits(plan.limits),
        price: {
          id: activePrice.id,
          amount: activePrice.amount,
          formatted: formatRials(activePrice.amount),
        },
      } satisfies PricingPlan;
    })
    .filter(Boolean) as PricingPlan[];

  const oneTimePricesRaw = await prisma.price.findMany({
    where: {
      active: true,
      product: {
        active: true,
        type: ProductType.JOB_POST,
      },
    },
    include: { product: true },
    orderBy: { createdAt: "asc" },
  });

  const oneTimePrices: OneTimePrice[] = oneTimePricesRaw.map((price) => ({
    id: price.id,
    name: price.product?.name ?? "ثبت آگهی شغلی",
    amount: price.amount,
    formatted: formatRials(price.amount),
  }));

  return ok(
    {
      plans: planItems,
      oneTimePrices,
    },
    { headers: PUBLIC_CACHE_HEADERS },
  );
}
