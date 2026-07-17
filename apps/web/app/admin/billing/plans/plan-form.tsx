"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardFooter } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/components/ui/use-toast";

import type { createPlan } from "./actions";

type PlanAction = typeof createPlan;

type PlanCycleValue = "MONTHLY" | "QUARTERLY" | "YEARLY";

const cycleOptions: Array<{ value: PlanCycleValue; label: string }> = [
  { value: "MONTHLY", label: "ماهانه" },
  { value: "QUARTERLY", label: "سه ماهه" },
  { value: "YEARLY", label: "سالانه" },
];

type PlanFormValues = {
  productId: string;
  name: string;
  cycle: PlanCycleValue;
  limitsText: string;
  active: boolean;
};

type PlanFormProps = {
  products: Array<{ id: string; name: string }>;
  initialValues?: Partial<PlanFormValues>;
  action: PlanAction | ((values: Parameters<PlanAction>[0]) => ReturnType<PlanAction>);
  submitLabel: string;
};

type FormErrors = Partial<Record<keyof PlanFormValues, string>> & { limitsText?: string };

const DEFAULT_LIMITS = "{}";

export function PlanForm({ products, initialValues, action, submitLabel }: PlanFormProps) {
  const router = useRouter();
  const { toast } = useToast();
  const [values, setValues] = useState<PlanFormValues>({
    productId: initialValues?.productId ?? (products[0]?.id ?? ""),
    name: initialValues?.name ?? "",
    cycle: initialValues?.cycle ?? "MONTHLY",
    limitsText: initialValues?.limitsText ?? DEFAULT_LIMITS,
    active: initialValues?.active ?? true,
  });
  const [errors, setErrors] = useState<FormErrors>({});
  const [isPending, startTransition] = useTransition();

  const productOptions = useMemo(() => products, [products]);

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const nextErrors: FormErrors = {};

    if (!values.name.trim()) {
      nextErrors.name = "مقدار نامعتبر";
    }

    if (!values.productId) {
      nextErrors.productId = "مقدار نامعتبر";
    }

    if (!values.cycle) {
      nextErrors.cycle = "مقدار نامعتبر";
    }

    let parsedLimits: unknown = {};
    try {
      const text = values.limitsText.trim();
      parsedLimits = text ? JSON.parse(text) : {};
    } catch (error) {
      nextErrors.limitsText = "JSON نامعتبر";
    }

    if (Object.keys(nextErrors).length > 0) {
      setErrors(nextErrors);
      toast({ variant: "destructive", description: "لطفاً خطاهای فرم را برطرف کنید." });
      return;
    }

    setErrors({});

    startTransition(async () => {
      const result = await action({
        productId: values.productId,
        name: values.name.trim(),
        cycle: values.cycle as Parameters<PlanAction>[0]["cycle"],
        limits: parsedLimits as Parameters<PlanAction>[0]["limits"],
        active: values.active,
      });

      if (result?.error) {
        toast({ variant: "destructive", description: result.error });
        return;
      }

      toast({ description: "با موفقیت ذخیره شد." });
      router.push("/admin/billing/plans");
      router.refresh();
    });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <Card>
        <CardContent className="space-y-6 pt-6">
          <div className="space-y-2">
            <Label htmlFor="name">نام</Label>
            <Input
              id="name"
              name="name"
              value={values.name}
              onChange={(event) =>
                setValues((prev) => ({ ...prev, name: event.target.value }))
              }
              placeholder="نام پلن"
            />
            {errors.name ? (
              <p className="text-xs text-destructive">{errors.name}</p>
            ) : null}
          </div>
          <div className="space-y-2">
            <Label>محصول</Label>
            <Select
              value={values.productId}
              onValueChange={(value) =>
                setValues((prev) => ({ ...prev, productId: value }))
              }
            >
              <SelectTrigger>
                <SelectValue placeholder="انتخاب محصول" />
              </SelectTrigger>
              <SelectContent>
                {productOptions.map((product) => (
                  <SelectItem key={product.id} value={product.id}>
                    {product.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {errors.productId ? (
              <p className="text-xs text-destructive">{errors.productId}</p>
            ) : null}
          </div>
          <div className="space-y-2">
            <Label>چرخه</Label>
            <Select
              value={values.cycle}
              onValueChange={(value: PlanCycleValue) =>
                setValues((prev) => ({ ...prev, cycle: value }))
              }
            >
              <SelectTrigger>
                <SelectValue placeholder="انتخاب چرخه" />
              </SelectTrigger>
              <SelectContent>
                {cycleOptions.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {errors.cycle ? (
              <p className="text-xs text-destructive">{errors.cycle}</p>
            ) : null}
          </div>
          <div className="space-y-2">
            <Label htmlFor="limits">محدودیت‌ها (JSON)</Label>
            <Textarea
              id="limits"
              value={values.limitsText}
              onChange={(event) =>
                setValues((prev) => ({ ...prev, limitsText: event.target.value }))
              }
              className="font-mono text-sm"
              rows={6}
            />
            {errors.limitsText ? (
              <p className="text-xs text-destructive">{errors.limitsText}</p>
            ) : (
              <p className="text-xs text-muted-foreground">
                نمونه: <code className="rounded bg-muted px-1">{`{"maxPosts": 5}`}</code>
              </p>
            )}
          </div>
          <div className="flex items-center justify-between rounded-md border border-dashed border-border px-3 py-2">
            <div>
              <Label htmlFor="active">فعال</Label>
              <p className="text-xs text-muted-foreground">
                غیرفعال کردن، پلن را از صفحه قیمت‌گذاری حذف می‌کند.
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
          <Button type="submit" disabled={isPending || productOptions.length === 0}>
            {productOptions.length === 0
              ? "ابتدا محصول اشتراک بسازید"
              : isPending
                ? "در حال ذخیره..."
                : submitLabel}
          </Button>
        </CardFooter>
      </Card>
    </form>
  );
}
