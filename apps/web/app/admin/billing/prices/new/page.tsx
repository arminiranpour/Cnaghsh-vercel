import { ProductType, type PlanCycle } from "@prisma/client";

import { prisma } from "@/lib/db";

import { createPrice } from "../actions";
import { PriceForm } from "../price-form";

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

const getProductTypeLabel = (type: ProductType) => {
  switch (type) {
    case "JOB_POST":
      return "ثبت آگهی";
    case "SUBSCRIPTION":
      return "اشتراک";
  }
};

export default async function NewPricePage() {
  const plans = await prisma.plan.findMany({
    where: {
      active: true,
      product: {
        active: true,
        type: ProductType.SUBSCRIPTION,
      },
    },
    include: { product: true },
    orderBy: { createdAt: "asc" },
  });

  const products = await prisma.product.findMany({
    where: { active: true, type: { not: ProductType.SUBSCRIPTION } },
    orderBy: { createdAt: "asc" },
  });

  const planOptions = plans.map((plan) => ({
    id: plan.id,
    name: plan.name,
    cycleLabel: getPlanCycleLabel(plan.cycle),
    productName: plan.product?.name,
  }));

  const productOptions = products.map((product) => ({
    id: product.id,
    name: product.name,
    typeLabel: getProductTypeLabel(product.type),
  }));

  return (
    <div className="max-w-3xl space-y-6">
      <div>
        <h2 className="text-xl font-semibold">ایجاد قیمت</h2>
        <p className="text-sm text-muted-foreground">
          برای اشتراک، قیمت را روی پلن ثبت کنید. برای سایر محصولات، قیمت روی خود محصول ثبت می‌شود.
        </p>
      </div>
      <PriceForm
        plans={planOptions}
        products={productOptions}
        action={createPrice}
        submitLabel="ذخیره"
      />
    </div>
  );
}
