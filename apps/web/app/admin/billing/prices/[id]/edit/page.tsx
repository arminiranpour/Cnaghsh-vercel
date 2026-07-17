import { notFound } from "next/navigation";
import { ProductType, type PlanCycle } from "@prisma/client";

import { prisma } from "@/lib/db";

import { updatePrice } from "../../actions";
import { PriceForm } from "../../price-form";

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

export default async function EditPricePage({
  params,
}: {
  params: { id: string };
}) {
  const price = await prisma.price.findUnique({
    where: { id: params.id },
    include: {
      plan: { include: { product: true } },
      product: true,
    },
  });

  if (!price) {
    notFound();
  }

  const plans = await prisma.plan.findMany({
    where: {
      product: {
        type: ProductType.SUBSCRIPTION,
      },
    },
    include: { product: true },
    orderBy: { createdAt: "asc" },
  });

  const products = await prisma.product.findMany({
    where: { type: { not: ProductType.SUBSCRIPTION } },
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
        <h2 className="text-xl font-semibold">ویرایش قیمت</h2>
        <p className="text-sm text-muted-foreground">
          برای اشتراک، قیمت باید روی پلن بماند. برای سایر محصولات، قیمت روی خود محصول نگهداری می‌شود.
        </p>
      </div>
      <PriceForm
        plans={planOptions}
        products={productOptions}
        initialValues={{
          amount: price.amount,
          mode: price.planId ? "plan" : "product",
          planId: price.planId,
          productId: price.productId,
          active: price.active,
        }}
        action={updatePrice.bind(null, price.id)}
        submitLabel="ذخیره"
      />
    </div>
  );
}
