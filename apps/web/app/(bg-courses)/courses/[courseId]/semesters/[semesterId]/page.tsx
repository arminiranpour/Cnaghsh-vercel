import Link from "next/link";
import { notFound } from "next/navigation";
import { unstable_noStore as noStore } from "next/cache";

import { SemesterPaymentPanel } from "@/components/courses/SemesterPaymentPanel";
import { SemesterSchedulePanel } from "@/components/courses/SemesterSchedulePanel";
import { startEnrollmentAction } from "@/lib/courses/enrollment/actions";
import { computeSemesterPricing } from "@/lib/courses/pricing";
import { fetchPublicSemesterById } from "@/lib/courses/public/queries";
import { getPublicMediaUrlFromKey } from "@/lib/media/urls";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function SemesterDetailPage({
  params,
  searchParams,
}: {
  params: { courseId: string; semesterId: string };
  searchParams?: Record<string, string | string[] | undefined>;
}) {
  noStore();
  const semester = await fetchPublicSemesterById(params.courseId, params.semesterId);

  if (!semester) {
    notFound();
  }

  const pricing = computeSemesterPricing(semester);
  const introVideoAsset = semester.course.introVideoMediaAsset;
  const introVideo =
    introVideoAsset?.visibility === "public"
      ? {
          mediaId: introVideoAsset.id,
          videoUrl: introVideoAsset.outputKey
            ? getPublicMediaUrlFromKey(introVideoAsset.outputKey)
            : null,
          posterUrl: introVideoAsset.posterKey
            ? getPublicMediaUrlFromKey(introVideoAsset.posterKey)
            : null,
        }
      : null;

  const enrollAction = startEnrollmentAction.bind(null, params.courseId, params.semesterId);
  const enrollmentError =
    searchParams?.enrollment === "error"
      ? typeof searchParams?.reason === "string"
        ? searchParams.reason
        : Array.isArray(searchParams?.reason)
          ? searchParams.reason[0]
          : null
      : null;

  const enrollmentErrorMessages: Record<string, string> = {
    INVALID_PAYMENT_MODE: "روش پرداخت معتبر نیست.",
    COURSE_NOT_PUBLISHED: "دوره منتشر نشده است.",
    SEMESTER_NOT_FOUND: "ترم پیدا نشد.",
    SEMESTER_CLOSED: "ترم بسته شده است.",
    SEMESTER_NOT_OPEN: "ترم برای ثبت‌نام باز نیست.",
    INSTALLMENTS_DISABLED: "پرداخت اقساطی فعال نیست.",
    ENROLLMENT_NOT_FOUND: "ثبت‌نام پیدا نشد.",
    FORBIDDEN: "اجازه دسترسی ندارید.",
    INVALID_ENROLLMENT_STATUS: "وضعیت ثبت‌نام معتبر نیست.",
    PAYMENT_MODE_MISMATCH: "روش پرداخت با ثبت‌نام همخوانی ندارد.",
    ALREADY_PAID: "پرداخت قبلاً ثبت شده است.",
    UNSUPPORTED_CURRENCY: "ارز پشتیبانی نمی‌شود.",
    INVALID_INSTALLMENT: "قسط انتخابی معتبر نیست.",
    INVALID_AMOUNT: "مبلغ معتبر نیست.",
    UNKNOWN_PROVIDER: "درگاه پرداخت معتبر نیست.",
    UNKNOWN_ERROR: "عملیات ناموفق بود.",
  };

  return (
    <div className="relative min-h-screen" dir="rtl">
      <div className="relative z-10 mx-auto flex w-full max-w-7xl flex-col gap-8 px-4 py-10">
        {/* Back Button */}
        <div className="flex justify-begin mb-4">
          <Link href={`/courses/${params.courseId}`} className="inline-block">
            <svg
              width="50"
              height="50"
              viewBox="0 0 50 50"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
              aria-hidden="true"
            >
              <rect width="50" height="50" rx="8" fill="#858585" />
              <path
                d="M15 25H36M36 25L27 17M36 25L27 33"
                stroke="white"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </Link>
        </div>

        {/* Main Content Grid */}
        <div className="grid gap-2 lg:grid-cols-11" data-no-transparent>
          {enrollmentError ? (
            <div className="lg:col-span-11 rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
              {enrollmentErrorMessages[enrollmentError] ??
                enrollmentErrorMessages.UNKNOWN_ERROR}
            </div>
          ) : null}
          {/* Right Pane - Schedule Panel (appears on right in RTL) */}
          <div className="flex justify-start lg:col-span-6 overflow-auto">
            <SemesterSchedulePanel
              semesterTitle={semester.title}
              scheduleDays={semester.scheduleDays}
            />
          </div>

          {/* Left Pane - Payment Panel (appears on left in RTL) */}
          <div className="flex justify-start h-[650px] min-h-0 lg:col-span-5">
            <SemesterPaymentPanel
              semesterTitle={semester.title}
              pricing={pricing}
              introVideo={introVideo}
              enrollAction={enrollAction}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
