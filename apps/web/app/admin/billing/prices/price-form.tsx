"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardFooter } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/components/ui/use-toast";

import type { createPrice } from "./actions";

type PriceAction = typeof createPrice;

type LinkingMode = "plan" | "product";

type PriceFormState = {
  amount: string;
  mode: LinkingMode;
  planId: string | null;
  productId: string | null;
  active: boolean;
};

type PriceFormInitialValues = Partial<Omit<PriceFormState, "amount">> & {
  amount?: number | string;
};

type PriceFormProps = {
  plans: Array<{ id: string; name: string; cycleLabel?: string; productName?: string }>;
  products: Array<{ id: string; name: string; typeLabel?: string }>;
  initialValues?: PriceFormInitialValues;
  action: PriceAction | ((values: Parameters<PriceAction>[0]) => ReturnType<PriceAction>);
  submitLabel: string;
};

type FormErrors = {
  amount?: string;
  destination?: string;
};

const modeLabels: Record<LinkingMode, string> = {
  plan: "پلن اشتراک",
  product: "محصول غیر اشتراکی",
};

export function PriceForm({ plans, products, initialValues, action, submitLabel }: PriceFormProps) {
  const router = useRouter();
  const { toast } = useToast();
  const defaultMode: LinkingMode = initialValues?.mode
    ? initialValues.mode
    : plans.length > 0
      ? "plan"
      : "product";

  const [values, setValues] = useState<PriceFormState>({
    amount: initialValues?.amount !== undefined ? String(initialValues.amount) : "",
    mode: defaultMode,
    planId:
      initialValues?.planId ?? (defaultMode === "plan" && plans.length > 0 ? plans[0].id : null),
    productId:
      initialValues?.productId ?? (defaultMode === "product" && products.length > 0 ? products[0].id : null),
    active: initialValues?.active ?? true,
  });
  const [errors, setErrors] = useState<FormErrors>({});
  const [isPending, startTransition] = useTransition();

  const planOptions = useMemo(() => plans, [plans]);
  const productOptions = useMemo(() => products, [products]);

  const handleModeChange = (mode: LinkingMode) => {
    setValues((prev) => ({
      ...prev,
      mode,
      planId: mode === "plan" ? prev.planId ?? planOptions[0]?.id ?? null : null,
      productId: mode === "product" ? prev.productId ?? productOptions[0]?.id ?? null : null,
    }));
  };

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const nextErrors: FormErrors = {};

    const parsedAmount = Number(values.amount);
    if (!Number.isInteger(parsedAmount) || parsedAmount < 0) {
      nextErrors.amount = "مقدار نامعتبر";
    }

    const planId = values.mode === "plan" ? values.planId : null;
    const productId = values.mode === "product" ? values.productId : null;

    if (values.mode === "plan" && !planId) {
      nextErrors.destination = "باید یک مقصد قیمت انتخاب شود (پلن یا محصول)";
    }

    if (values.mode === "product" && !productId) {
      nextErrors.destination = "باید یک مقصد قیمت انتخاب شود (پلن یا محصول)";
    }

    if (Object.keys(nextErrors).length > 0) {
      setErrors(nextErrors);
      toast({ variant: "destructive", description: "لطفاً خطاهای فرم را برطرف کنید." });
      return;
    }

    setErrors({});

    startTransition(async () => {
      const result = await action({
        amount: parsedAmount,
        currency: "IRR",
        planId,
        productId,
        active: values.active,
      });

      if (result?.error) {
        toast({ variant: "destructive", description: result.error });
        return;
      }

      toast({ description: "با موفقیت ذخیره شد." });
      router.push("/admin/billing/prices");
      router.refresh();
    });
  };

  const hasDestination =
    values.mode === "plan" ? planOptions.length > 0 : productOptions.length > 0;

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <Card>
        <CardContent className="space-y-6 pt-6">
          <div className="space-y-2">
            <Label htmlFor="amount">مبلغ (ریال)</Label>
            <Input
              id="amount"
              inputMode="numeric"
              pattern="[0-9]*"
              value={values.amount}
              onChange={(event) =>
                setValues((prev) => ({ ...prev, amount: event.target.value }))
              }
              placeholder="مثلاً 5000000"
            />
            {errors.amount ? (
              <p className="text-xs text-destructive">{errors.amount}</p>
            ) : null}
          </div>
          <div className="space-y-2">
            <Label htmlFor="currency">ارز</Label>
            <Input id="currency" value="IRR" readOnly disabled className="bg-muted" />
            <p className="text-xs text-muted-foreground">
              تمام قیمت‌ها به ریال (IRR) نگهداری می‌شوند.
            </p>
          </div>
          <div className="space-y-3">
            <Label>مقصد قیمت</Label>
            <div className="grid gap-2 md:grid-cols-2">
              {(Object.keys(modeLabels) as LinkingMode[]).map((mode) => (
                <label
                  key={mode}
                  className="flex cursor-pointer items-center justify-between rounded-md border border-border px-3 py-2 text-sm"
                >
                  <span className="font-medium">{modeLabels[mode]}</span>
                  <input
                    type="radio"
                    name="price-mode"
                    value={mode}
                    checked={values.mode === mode}
                    onChange={() => handleModeChange(mode)}
                  />
                </label>
              ))}
            </div>
            {errors.destination ? (
              <p className="text-xs text-destructive">{errors.destination}</p>
            ) : (
              <p className="text-xs text-muted-foreground">
                برای اشتراک، قیمت به پلن وصل می‌شود. برای سایر محصولات، قیمت به خود محصول وصل می‌شود.
              </p>
            )}
          </div>

          {values.mode === "plan" ? (
            <div className="space-y-2">
              <Label>پلن اشتراک</Label>
              <Select
                value={values.planId ?? undefined}
                onValueChange={(value) =>
                  setValues((prev) => ({ ...prev, planId: value }))
                }
                disabled={planOptions.length === 0}
              >
                <SelectTrigger>
                  <SelectValue placeholder="انتخاب پلن" />
                </SelectTrigger>
                <SelectContent>
                  {planOptions.map((plan) => (
                    <SelectItem key={plan.id} value={plan.id}>
                      <div className="space-y-1">
                        <div className="font-medium">
                          {[plan.name, plan.cycleLabel].filter(Boolean).join(" • ")}
                        </div>
                        {plan.productName ? (
                          <div className="text-xs text-muted-foreground">
                            {plan.productName}
                          </div>
                        ) : null}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {planOptions.length === 0 ? (
                <p className="text-xs text-muted-foreground">
                  هیچ پلن اشتراک فعالی برای قیمت‌گذاری وجود ندارد.
                </p>
              ) : null}
            </div>
          ) : (
            <div className="space-y-2">
              <Label>محصول غیر اشتراکی</Label>
              <Select
                value={values.productId ?? undefined}
                onValueChange={(value) =>
                  setValues((prev) => ({ ...prev, productId: value }))
                }
                disabled={productOptions.length === 0}
              >
                <SelectTrigger>
                  <SelectValue placeholder="انتخاب محصول" />
                </SelectTrigger>
                <SelectContent>
                  {productOptions.map((product) => (
                    <SelectItem key={product.id} value={product.id}>
                      <div className="space-y-1">
                        <div className="font-medium">{product.name}</div>
                        {product.typeLabel ? (
                          <div className="text-xs text-muted-foreground">
                            {product.typeLabel}
                          </div>
                        ) : null}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {productOptions.length === 0 ? (
                <p className="text-xs text-muted-foreground">
                  هیچ محصول غیر اشتراکی فعالی برای قیمت‌گذاری وجود ندارد.
                </p>
              ) : null}
            </div>
          )}

          <div className="flex items-center justify-between rounded-md border border-dashed border-border px-3 py-2">
            <div>
              <Label htmlFor="active">فعال</Label>
              <p className="text-xs text-muted-foreground">
                قیمت‌های غیرفعال در صفحه قیمت‌گذاری نمایش داده نمی‌شوند.
              </p>
            </div>
            <Switch
              id="active"
              checked={values.active}
              onCheckedChange={(checked) =>
                setValues((prev) => ({ ...prev, active: checked }))
              }
            />
          </div>
        </CardContent>
        <CardFooter className="flex justify-end">
          <Button type="submit" disabled={isPending || !hasDestination}>
            {!hasDestination
              ? "گزینه‌ای برای لینک وجود ندارد"
              : isPending
                ? "در حال ذخیره..."
                : submitLabel}
          </Button>
        </CardFooter>
      </Card>
    </form>
  );
}
