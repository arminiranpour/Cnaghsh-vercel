import type { PlanCycle } from "@prisma/client";
import Link from "next/link";

import { Button } from "@/components/ui/button";
import { prisma } from "@/lib/db";
import { formatRials } from "@/lib/money";

import { PricesTable } from "./prices-table";

export const dynamic = "force-dynamic";

const getPlanCycleLabel = (cycle: PlanCycle) => {
  switch (cycle) {
    case "MONTHLY":
      return "ماهانه";
    case "QUARTERLY":
      return "سه ماهه";
    case "YEARLY":
      return "سالانه";
  }
};

export default async function PricesPage() {
  const prices = await prisma.price.findMany({
    include: {
      plan: {
        include: {
          product: true,
        },
      },
      product: true,
    },
    orderBy: { createdAt: "desc" },
  });

  const rows = prices.map((price) => {
    const linkType = price.planId ? "plan" : "product";
    const linkLabel = price.planId
      ? [price.plan?.name, price.plan?.cycle ? getPlanCycleLabel(price.plan.cycle) : null, price.plan?.product?.name]
          .filter(Boolean)
          .join(" • ") || "پلن"
      : price.product?.name ?? "محصول";

    return {
      id: price.id,
      formattedAmount: formatRials(price.amount),
      active: price.active,
      createdAt: price.createdAt.toISOString(),
      linkType,
      linkLabel,
    } as const;
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="space-y-1">
          <h2 className="text-xl font-semibold">قیمت‌ها</h2>
          <p className="text-sm text-muted-foreground">
            قیمت اشتراک‌ها بر اساس پلن و قیمت سایر آیتم‌ها بر اساس خود محصول مدیریت می‌شود.
          </p>
        </div>
        <Button asChild>
          <Link href="/admin/billing/prices/new">ایجاد قیمت</Link>
        </Button>
      </div>

      {rows.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border p-10 text-center text-sm text-muted-foreground">
          هنوز قیمتی ثبت نشده است.
        </div>
      ) : (
        <PricesTable prices={rows} />
      )}
    </div>
  );
}
