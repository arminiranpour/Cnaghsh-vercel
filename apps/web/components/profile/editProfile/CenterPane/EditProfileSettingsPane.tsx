"use client";

import Link from "next/link";
import { useEffect, useState, useTransition, type CSSProperties } from "react";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/components/ui/use-toast";
import { EDIT_PROFILE_MOBILE_BOTTOM_NAV_H } from "@/components/profile/editProfile/constants";
import { publishProfile, unpublishProfile } from "@/lib/profile/profile-actions";

type EditProfileSettingsPaneProps = {
  canPublish: boolean;
  isPublished: boolean;
  readinessIssues: string[];
};

export function EditProfileSettingsPane({
  canPublish,
  isPublished,
  readinessIssues,
}: EditProfileSettingsPaneProps) {
  const { toast } = useToast();
  const [published, setPublished] = useState(isPublished);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<string[]>([]);
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    setPublished(isPublished);
  }, [isPublished]);

  const readyToPublish = readinessIssues.length === 0;
  const statusLabel = published ? "قابل مشاهده" : "مخفی";

  const handleToggleVisibility = (nextChecked: boolean) => {
    const previousState = published;

    setError(null);
    setFieldErrors([]);
    setPublished(nextChecked);

    startTransition(() => {
      const action = nextChecked ? publishProfile : unpublishProfile;

      action()
        .then((result) => {
          if (result.ok) {
            toast({
              title: nextChecked ? "پروفایل قابل مشاهده شد." : "پروفایل مخفی شد.",
              description: nextChecked
                ? "پروفایل شما اکنون برای عموم قابل مشاهده است."
                : "پروفایل شما دیگر در فهرست عمومی نمایش داده نمی‌شود.",
            });
            return;
          }

          setPublished(previousState);
          setError(result.error ?? "خطایی رخ داد. لطفاً دوباره تلاش کنید.");

          if (result.fieldErrors) {
            setFieldErrors(Object.values(result.fieldErrors).filter(Boolean) as string[]);
          }
        })
        .catch(() => {
          setPublished(previousState);
          setError("خطایی رخ داد. لطفاً دوباره تلاش کنید.");
        });
    });
  };

  return (
    <section
      aria-label="تنظیمات پروفایل"
      className="fixed left-0 right-0 bottom-0 top-[calc(var(--mobile-header-h,72px)+env(safe-area-inset-top))] z-40 w-screen overflow-x-hidden overflow-y-auto bg-white pb-[calc(var(--edit-profile-bottom-nav-h)+env(safe-area-inset-bottom))] shadow-[0_10px_30px_rgba(0,0,0,0.10)] md:absolute md:left-[273px] md:right-auto md:top-[315px] md:h-[595px] md:w-[748px] md:overflow-hidden md:rounded-[20px] md:pb-0"
      style={{ "--edit-profile-bottom-nav-h": `${EDIT_PROFILE_MOBILE_BOTTOM_NAV_H}px` } as CSSProperties & {
        "--edit-profile-bottom-nav-h": string;
      }}
      dir="rtl"
    >
      <div className="flex min-w-0 flex-col px-4 pt-4 text-right md:h-full md:px-[44px] md:pt-[28px]">
        <h2 className="text-[30px] font-bold text-black">تنظیمات</h2>

        <div className="mt-8 rounded-[24px] border border-[#E6E6E6] bg-[#FAFAFA] p-5 md:mt-10 md:p-6">
          <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
            <div className="space-y-3">
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant={published ? "success" : "secondary"} className="px-3 py-1">
                  {statusLabel}
                </Badge>
                <Badge variant={canPublish ? "outline" : "destructive"} className="px-3 py-1">
                  {canPublish ? "اشتراک فعال" : "بدون اشتراک"}
                </Badge>
              </div>

              <div className="space-y-1">
                <h3 className="text-base font-bold text-black">نمایش عمومی پروفایل</h3>
                <p className="text-sm leading-7 text-[#5C5A5A]">
                  با فعال بودن این گزینه، پروفایل شما در فهرست عمومی نمایش داده می‌شود و دیگران
                  می‌توانند آن را مشاهده کنند.
                </p>
              </div>
            </div>

            <div className="flex items-center gap-3 self-start rounded-full border border-[#E3E3E3] bg-white px-4 py-3">
              <Label htmlFor="profile-visibility-toggle" className="text-sm font-medium text-black">
                {published ? "قابل مشاهده" : "مخفی"}
              </Label>
              <Switch
                id="profile-visibility-toggle"
                checked={published}
                disabled={isPending || (!canPublish && !published)}
                onCheckedChange={handleToggleVisibility}
              />
            </div>
          </div>

          {!canPublish && !published ? (
            <div className="mt-5 rounded-[18px] border border-amber-500/50 bg-amber-100/70 p-4 text-sm text-amber-900">
              <p className="font-semibold">برای قابل مشاهده کردن پروفایل به اشتراک فعال نیاز دارید.</p>
              <p className="mt-1 text-xs text-amber-900/80">
                بعد از فعال‌سازی اشتراک می‌توانید این گزینه را روشن کنید.
              </p>
              <Button
                asChild
                variant="outline"
                className="mt-3 border-amber-600 text-amber-800 hover:bg-amber-200"
              >
                <Link href="/pricing">مشاهده پلن‌های اشتراک</Link>
              </Button>
            </div>
          ) : null}

          {!readyToPublish && !published ? (
            <div className="mt-5 rounded-[18px] border border-yellow-400/60 bg-yellow-100/60 p-4 text-sm text-yellow-900">
              <p className="font-semibold">برای عمومی کردن پروفایل، این موارد را تکمیل کنید:</p>
              <ul className="mt-2 list-disc space-y-1 pr-5">
                {readinessIssues.map((issue, index) => (
                  <li key={`${issue}-${index}`}>{issue}</li>
                ))}
              </ul>
            </div>
          ) : null}

          {fieldErrors.length > 0 ? (
            <div className="mt-5 rounded-[18px] border border-destructive/50 bg-destructive/10 p-4 text-sm text-destructive">
              {fieldErrors.map((message, index) => (
                <p key={`${message}-${index}`}>{message}</p>
              ))}
            </div>
          ) : null}

          {error ? <p className="mt-4 text-sm text-destructive">{error}</p> : null}

          <p className="mt-5 text-xs leading-6 text-[#7C7C7C]">
            {isPending
              ? "در حال به‌روزرسانی وضعیت نمایش پروفایل..."
              : "هر زمان بخواهید می‌توانید وضعیت نمایش پروفایل را از همین بخش تغییر دهید."}
          </p>
        </div>
      </div>
    </section>
  );
}
