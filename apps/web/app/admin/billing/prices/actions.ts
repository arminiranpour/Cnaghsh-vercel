"use server";

import { ProductType } from "@prisma/client";
import { revalidatePath } from "next/cache";

import { prisma } from "@/lib/db";

type PriceInput = {
  amount: number;
  currency: "IRR";
  planId: string | null;
  productId: string | null;
  active: boolean;
};

type ActionResult = {
  success?: true;
  error?: string;
};

const PRICES_INDEX_PATH = "/admin/billing/prices";

const revalidatePrices = async () => {
  revalidatePath(PRICES_INDEX_PATH);
  revalidatePath("/pricing");
};

const validateLinking = async (
  planId: string | null,
  productId: string | null
): Promise<ActionResult & { planId: string | null; productId: string | null }> => {
  const hasPlan = Boolean(planId);
  const hasProduct = Boolean(productId);

  if ((hasPlan && hasProduct) || (!hasPlan && !hasProduct)) {
    return {
      error: "باید یک مقصد قیمت انتخاب شود (پلن یا محصول)",
      planId: null,
      productId: null,
    };  }

  if (hasPlan && planId) {
    const plan = await prisma.plan.findUnique({
      where: { id: planId },
      include: { product: true },
    });

    if (!plan || plan.product?.type !== ProductType.SUBSCRIPTION) {
      return { error: "مقدار نامعتبر", planId: null, productId: null };
    }

    return { success: true, planId, productId: null };
  }

  if (hasProduct && productId) {
    const product = await prisma.product.findUnique({ where: { id: productId } });

    if (!product || product.type === ProductType.SUBSCRIPTION) {
      return { error: "مقدار نامعتبر", planId: null, productId: null };
    }

    return { success: true, planId: null, productId };
  }

  return { error: "مقدار نامعتبر", planId: null, productId: null };
};

export async function createPrice(values: PriceInput): Promise<ActionResult> {
  try {
    if (!Number.isInteger(values.amount) || values.amount < 0) {
      return { error: "مقدار نامعتبر" };
    }

    const link = await validateLinking(values.planId, values.productId);
    if (link.error) {
      return { error: link.error };
    }

    await prisma.price.create({
      data: {
        amount: values.amount,
        currency: "IRR",
        active: values.active,
        planId: link.planId,
        productId: link.productId,
      },
    });

    await revalidatePrices();

    return { success: true };
  } catch (error) {
    console.error("createPrice", error);
    return { error: "خطایی رخ داد" };
  }
}

export async function updatePrice(
  id: string,
  values: PriceInput
): Promise<ActionResult> {
  try {
    const existing = await prisma.price.findUnique({ where: { id } });
    if (!existing) {
      return { error: "موردی یافت نشد" };
    }

    if (!Number.isInteger(values.amount) || values.amount < 0) {
      return { error: "مقدار نامعتبر" };
    }

    const link = await validateLinking(values.planId, values.productId);
    if (link.error) {
      return { error: link.error };
    }

    await prisma.price.update({
      where: { id },
      data: {
        amount: values.amount,
        currency: "IRR",
        active: values.active,
        planId: link.planId,
        productId: link.productId,
      },
    });

    await revalidatePrices();

    return { success: true };
  } catch (error) {
    console.error("updatePrice", error);
    return { error: "خطایی رخ داد" };
  }
}

export async function togglePriceActive(id: string): Promise<ActionResult> {
  try {
    const existing = await prisma.price.findUnique({ where: { id } });
    if (!existing) {
      return { error: "موردی یافت نشد" };
    }

    await prisma.price.update({
      where: { id },
      data: {
        active: !existing.active,
      },
    });

    await revalidatePrices();

    return { success: true };
  } catch (error) {
    console.error("togglePriceActive", error);
    return { error: "خطایی رخ داد" };
  }
}
