"use client";

import { useMemo, useState } from "react";

import type { ProfileTabId, PublicProfileData } from "@/components/profile/ProfilePageClient";
import { CenterPane } from "@/components/profile/CenterPane/CenterPane";
import { LeftRail } from "@/components/profile/LeftRail/LeftRail";
import { RightPane } from "@/components/profile/RightPane/RightPane";
import { SubscriptionPane } from "@/components/profile/editProfile/CenterPane/SubscriptionPane";
import { EditProfileChallengesPane } from "@/components/profile/editProfile/CenterPane/EditProfileChallengesPane";
import { EditProfileCoursesPane } from "@/components/profile/editProfile/CenterPane/EditProfileCoursesPane";
import { EditProfileArchivePane } from "@/components/profile/editProfile/CenterPane/EditProfileArchivePane";
import { EditProfileSettingsPane } from "@/components/profile/editProfile/CenterPane/EditProfileSettingsPane";
import {
  EditProfileLeftRail,
  type EditProfileTabId,
} from "@/components/profile/editProfile/EditProfileLeftRail";
import { PortfolioEditCenterPane } from "@/components/profile/editProfile/PortfolioEditCenterPane";
import { EditProfileRightRail } from "@/components/profile/editProfile/EditProfileRightRail";
import type { BillingDashboardData } from "@/lib/billing/dashboard.types";
import { formatJalaliDate } from "@/lib/datetime/jalali";
import type { City } from "@/lib/location/cities";
import type { PortfolioEditInitialValues } from "@/lib/profile/portfolio-edit";

type ProvinceOption = {
  id: string;
  name: string;
};

type DashboardProfileClientProps = {
  profile: PublicProfileData;
  isOwner: boolean;
  initialValues: PortfolioEditInitialValues;
  cities: City[];
  provinces: ProvinceOption[];
  billingData: BillingDashboardData;
  enrolledCourses: Array<{
    id: string;
    title: string;
    imageUrl: string | null;
  }>;
  registeredChallenges: Array<{
    id: string;
    title: string;
    imageUrl: string | null;
    statusLabel: string;
    dateRangeLabel: string;
  }>;
  savedSummary: {
    profiles: number;
    movies: number;
    books: number;
    monologues: number;
  };
  publishSettings: {
    canPublish: boolean;
    isPublished: boolean;
    readinessIssues: string[];
  };
};

const paymentStatusLabels: Record<string, string> = {
  PAID: "پرداخت\u200cشده",
  PENDING: "در انتظار",
  FAILED: "ناموفق",
  REFUNDED: "بازپرداخت\u200cشده",
  REFUNDED_PARTIAL: "بازپرداخت جزئی",
};

export function DashboardProfileClient({
  profile,
  isOwner,
  initialValues,
  cities,
  provinces,
  billingData,
  enrolledCourses,
  registeredChallenges,
  savedSummary,
  publishSettings,
}: DashboardProfileClientProps) {
  const [activeTab, setActiveTab] = useState<ProfileTabId>("personal");
  const [isEditingPortfolio, setIsEditingPortfolio] = useState(false);
  const [activeEditTab, setActiveEditTab] = useState<EditProfileTabId>("portfolio");
  const canEdit = Boolean(isOwner);

  const subscriptionSummary = useMemo(() => {
    const subscription = billingData.subscription;
    const now = new Date(billingData.now);
    const endsAt = subscription?.endsAt ? new Date(subscription.endsAt) : null;
    const diffMs = endsAt ? endsAt.getTime() - now.getTime() : 0;
    const daysLeft =
      Number.isFinite(diffMs) && diffMs > 0
        ? Math.ceil(diffMs / (1000 * 60 * 60 * 24))
        : 0;

    const payments = billingData.payments.map((payment) => {
      const invoiceNumber = payment.invoice?.number;
      const title = invoiceNumber ? `فاکتور ${invoiceNumber}` : "پرداخت اشتراک";
      return {
        date: formatJalaliDate(payment.createdAt),
        title,
        status: paymentStatusLabels[payment.status] ?? payment.status,
      };
    });

    return { daysLeft, payments };
  }, [billingData]);

  const exitEditMode = () => {
    setIsEditingPortfolio(false);
    setActiveEditTab("portfolio");
  };

  if (isEditingPortfolio) {
    return (
      <>
        <EditProfileLeftRail activeTab={activeEditTab} onTabChange={setActiveEditTab} />
        {activeEditTab === "subscription" ? (
          <SubscriptionPane
            daysLeft={subscriptionSummary.daysLeft}
            payments={subscriptionSummary.payments}
          />
        ) : activeEditTab === "saved" ? (
          <EditProfileArchivePane counts={savedSummary} />
        ) : activeEditTab === "challenges" ? (
          <EditProfileChallengesPane challenges={registeredChallenges} />
        ) : activeEditTab === "courses" ? (
          <EditProfileCoursesPane courses={enrolledCourses} />
        ) : activeEditTab === "settings" ? (
          <EditProfileSettingsPane
            canPublish={publishSettings.canPublish}
            isPublished={publishSettings.isPublished}
            readinessIssues={publishSettings.readinessIssues}
          />
        ) : (
          <PortfolioEditCenterPane
            initialValues={initialValues}
            cities={cities}
            provinces={provinces}
            onCancel={exitEditMode}
            onSaved={exitEditMode}
          />
        )}
        <EditProfileRightRail
          avatarUrl={profile.avatarUrl ?? undefined}
          displayName={profile.displayName}
        />
      </>
    );
  }

  return (
    <>
      <LeftRail activeTab={activeTab} onTabChange={setActiveTab} />
      <CenterPane
        activeTab={activeTab}
        profile={profile}
        canEdit={canEdit}
        onEditClick={() => {
          setActiveEditTab("portfolio");
          setIsEditingPortfolio(true);
        }}
      />
      <RightPane profile={profile} isOwner={isOwner} />
    </>
  );
}
