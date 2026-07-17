"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTransition } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useToast } from "@/components/ui/use-toast";

import { togglePlanActive } from "./actions";

type PlanRow = {
  id: string;
  name: string;
  cycle: "MONTHLY" | "QUARTERLY" | "YEARLY";
  productName: string;
  productId: string;
  active: boolean;
  createdAt: string;
};

const cycleLabels: Record<PlanRow["cycle"], string> = {
  MONTHLY: "ماهانه",
  QUARTERLY: "سه ماهه",
  YEARLY: "سالانه",
};

export function PlansTable({ plans }: { plans: PlanRow[] }) {
  return (
    <div className="overflow-hidden rounded-lg border border-border bg-background">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-32">شناسه</TableHead>
            <TableHead>نام</TableHead>
            <TableHead>چرخه</TableHead>
            <TableHead>محصول</TableHead>
            <TableHead>وضعیت</TableHead>
            <TableHead>تاریخ ایجاد</TableHead>
            <TableHead className="w-40 text-left">اقدامات</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {plans.map((plan) => (
            <TableRow key={plan.id}>
              <TableCell className="font-mono text-xs text-muted-foreground">
                {plan.id}
              </TableCell>
              <TableCell className="font-medium">{plan.name}</TableCell>
              <TableCell>
                <Badge variant="secondary">{cycleLabels[plan.cycle]}</Badge>
              </TableCell>
              <TableCell>
                <div className="space-y-1">
                  <div className="font-medium">{plan.productName}</div>
                  <div className="text-xs text-muted-foreground">{plan.productId}</div>
                </div>
              </TableCell>
              <TableCell>
                <Badge variant={plan.active ? "success" : "outline"}>
                  {plan.active ? "فعال" : "غیرفعال"}
                </Badge>
              </TableCell>
              <TableCell>
                {new Date(plan.createdAt).toLocaleDateString("fa-IR")}
              </TableCell>
              <TableCell className="space-x-2 space-x-reverse text-left">
                <Button variant="outline" size="sm" asChild>
                  <Link href={`/admin/billing/plans/${plan.id}/edit`}>ویرایش</Link>
                </Button>
                <TogglePlanButton id={plan.id} active={plan.active} />
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

function TogglePlanButton({ id, active }: { id: string; active: boolean }) {
  const { toast } = useToast();
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const handleClick = () => {
    startTransition(async () => {
      const result = await togglePlanActive(id);
      if (result?.error) {
        toast({ variant: "destructive", description: result.error });
        return;
      }

      toast({ description: active ? "پلن غیرفعال شد." : "پلن فعال شد." });
      router.refresh();
    });
  };

  return (
    <Button
      variant={active ? "secondary" : "default"}
      size="sm"
      onClick={handleClick}
      disabled={isPending}
    >
      {isPending ? "در حال اجرا..." : active ? "غیرفعال" : "فعال"}
    </Button>
  );
}
