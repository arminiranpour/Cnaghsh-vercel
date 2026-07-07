import { redirect } from "next/navigation";

import type { PublicProfileData } from "@/components/profile/ProfilePageClient";
import { ProfilePageLayout } from "@/components/profile/ProfilePageLayout";
import { iransans } from "@/app/fonts";
import { getServerAuthSession } from "@/lib/auth/session";
import { getBillingDashboardData } from "@/lib/billing/dashboard";
import { challengeParticipationStatusLabels } from "@/lib/challenges/constants";
import { listUserEnrollments } from "@/lib/courses/enrollments/queries";
import { formatJalaliDate } from "@/lib/datetime/jalali";
import { getCities, getProvinces } from "@/lib/location/cities";
import { getPublicMediaUrlFromKey } from "@/lib/media/urls";
import { prisma } from "@/lib/prisma";
import { canPublishProfile } from "@/lib/profile/entitlement";
import { enforceUserProfileVisibility } from "@/lib/profile/enforcement";
import {
  buildProfilePageData,
  getDisplayName,
} from "@/lib/profile/profile-page-data";
import {
  normalizeAccentEntries,
  normalizeDegreeEntries,
  normalizeLanguageEntries,
  normalizePortfolioExperience,
  normalizeSkillKeys,
  type PortfolioEditInitialValues,
} from "@/lib/profile/portfolio-edit";
import { shouldHighlightEditProfileIcon } from "@/lib/profile/profile-edit-cue";
import { validateReadyToPublish } from "@/lib/profile/validation";

import { DashboardProfileClient } from "./_components/dashboard-profile-client";

const DIGIT_MAP: Record<string, string> = {
  "۰": "0",
  "۱": "1",
  "۲": "2",
  "۳": "3",
  "۴": "4",
  "۵": "5",
  "۶": "6",
  "۷": "7",
  "۸": "8",
  "۹": "9",
  "٠": "0",
  "١": "1",
  "٢": "2",
  "٣": "3",
  "٤": "4",
  "٥": "5",
  "٦": "6",
  "٧": "7",
  "٨": "8",
  "٩": "9",
};

function normalizeDigits(value: string): string {
  return value.replace(/[۰-۹٠-٩]/g, (char) => DIGIT_MAP[char] ?? char);
}

export default async function DashboardProfilePage() {
  const session = await getServerAuthSession();

  if (!session?.user?.id) {
    redirect("/auth?tab=signin");
  }

  const userId = session.user.id;

  const [initialProfile, cities, entitlementActive, billingData, enrollments, challengeParticipations] = await Promise.all([
    prisma.profile.findUnique({
      where: { userId },
      include: {
        awards: {
          orderBy: [
            { awardDate: "desc" },
            { createdAt: "desc" },
          ],
        },
      },
    }),
    getCities(),
    canPublishProfile(userId),
    getBillingDashboardData(userId),
    listUserEnrollments(userId),
    prisma.challengeParticipation.findMany({
      where: { userId },
      orderBy: { updatedAt: "desc" },
      include: {
        challenge: {
          include: {
            coverMediaAsset: {
              select: {
                outputKey: true,
                visibility: true,
              },
            },
          },
        },
      },
    }),
  ]);

  const provinces = getProvinces().map((province) => ({
    id: String(province.id),
    name: province.name,
  }));

  let profile = initialProfile;

  if (profile?.visibility === "PUBLIC" && !entitlementActive) {
    const enforcementResult = await enforceUserProfileVisibility(userId);

    if (enforcementResult === "auto_unpublished") {
      profile = await prisma.profile.findUnique({
        where: { userId },
        include: {
          awards: {
            orderBy: [
              { awardDate: "desc" },
              { createdAt: "desc" },
            ],
          },
        },
      });
    }
  }

  const profileData: PublicProfileData = profile
    ? await buildProfilePageData(profile, cities, { includePrivateMedia: true })
    : {
        id: "draft",
        userId,
        displayName: getDisplayName(undefined, undefined, undefined),
        avatarUrl: null,
        age: null,
        bio: null,
        cityName: undefined,
        likesCount: 0,
        isSavedByMe: false,
        skills: [],
        languages: [],
        accents: [],
        degrees: [],
        gallery: [],
        experience: null,
        voices: [],
        videos: [],
        awards: [],
      };

  const savedProfile = await prisma.savedItem.findUnique({
    where: {
      userId_type_entityId: {
        userId,
        type: "PROFILE",
        entityId: profileData.id,
      },
    },
    select: { id: true },
  });

  const savedSummaryRows = await prisma.savedItem.groupBy({
    by: ["type"],
    where: { userId },
    _count: { _all: true },
  });

  const savedSummary = {
    profiles: 0,
    movies: 0,
    books: 0,
    monologues: 0,
  };

  for (const row of savedSummaryRows) {
    switch (row.type) {
      case "PROFILE":
        savedSummary.profiles = row._count._all;
        break;
      case "MOVIE":
        savedSummary.movies = row._count._all;
        break;
      case "BOOK":
        savedSummary.books = row._count._all;
        break;
      case "MONOLOGUE":
        savedSummary.monologues = row._count._all;
        break;
      default:
        break;
    }
  }

  const portfolioExperience = normalizePortfolioExperience(profile?.experience ?? null);

  const portfolioInitialValues: PortfolioEditInitialValues = {
    firstName: profile?.firstName ?? "",
    lastName: profile?.lastName ?? "",
    birthDate: profile?.birthDate ? profile.birthDate.toISOString().slice(0, 10) : "",
    cityId: profile?.cityId ?? "",
    bio: profile?.bio ?? "",
    skills: normalizeSkillKeys(profile?.skills ?? null),
    languages: normalizeLanguageEntries(profile?.languages ?? null),
    accents: normalizeAccentEntries(profile?.accents ?? null),
    voices: profileData.voices ?? [],
    awards:
      profileData.awards?.map((award) => ({
        id: award.id,
        title: award.title,
        workTitle: award.workTitle ?? null,
        place: award.place ?? null,
        awardDate: award.awardDate ?? null,
      })) ?? [],
    degrees: normalizeDegreeEntries(profile?.degrees ?? null),
    resume: portfolioExperience.resume,
    courses: portfolioExperience.courses,
    experienceBase: {
      theatre: portfolioExperience.theatre,
      shortFilm: portfolioExperience.shortFilm,
      cinema: portfolioExperience.cinema,
      tv: portfolioExperience.tv,
    },
    avatarUrl: profile?.avatarUrl ?? "",
    stageName: profile?.stageName ?? "",
    age: profile?.age ?? null,
    phone: profile?.phone ?? "",
    address: profile?.address ?? "",
    introVideoMediaId: profile?.introVideoMediaId ?? "",
    gallery: profileData.gallery ?? [],
    videos:
      profileData.videos?.map((video) => ({
        mediaId: video.mediaId,
        url: video.url,
        title: video.title ?? null,
        posterUrl: video.posterUrl ?? null,
        playbackKind: video.playbackKind ?? null,
      })) ?? [],
  };

  const publishValidation = validateReadyToPublish({
    firstName: profile?.firstName ?? "",
    lastName: profile?.lastName ?? "",
    stageName: profile?.stageName ?? "",
    age: profile?.age ?? "",
    phone: normalizeDigits(profile?.phone ?? ""),
    address: profile?.address ?? "",
    cityId: profile?.cityId ?? "",
    avatarUrl: profile?.avatarUrl ?? "",
    bio: profile?.bio ?? "",
    introVideoMediaId: profile?.introVideoMediaId ?? "",
  });

  const publishSettings = {
    canPublish: entitlementActive,
    isPublished: profile?.visibility === "PUBLIC",
    readinessIssues: publishValidation.success
      ? []
      : Array.from(new Set(publishValidation.error.issues.map((issue) => issue.message))),
  };
  const shouldHighlightEditIcon = shouldHighlightEditProfileIcon(profile);

  const isOwner = session.user.id === profileData.userId;
  const profileDataWithSaved = {
    ...profileData,
    likesCount: profile?.likesCount ?? 0,
    isSavedByMe: Boolean(savedProfile),
  };
  const enrolledCourses = [];
  const seenCourses = new Set<string>();

  for (const enrollment of enrollments) {
    const courseId = enrollment.semester.course.id;
    if (seenCourses.has(courseId)) {
      continue;
    }

    seenCourses.add(courseId);

    const banner = enrollment.semester.course.bannerMediaAsset;
    const imageUrl =
      banner?.outputKey && banner.visibility === "public"
        ? getPublicMediaUrlFromKey(banner.outputKey)
        : null;

    enrolledCourses.push({
      id: courseId,
      title: enrollment.semester.course.title,
      imageUrl,
    });
  }

  const registeredChallenges = challengeParticipations.map((participation) => {
    const cover = participation.challenge.coverMediaAsset;
    const imageUrl =
      cover?.outputKey && cover.visibility === "public"
        ? getPublicMediaUrlFromKey(cover.outputKey)
        : null;

    return {
      id: participation.challenge.id,
      title: participation.challenge.title,
      imageUrl,
      statusLabel: challengeParticipationStatusLabels[participation.status],
      dateRangeLabel: `${formatJalaliDate(participation.challenge.startDate)} تا ${formatJalaliDate(participation.challenge.endDate)}`,
    };
  });

  return (
    <div className={iransans.className}>
      <ProfilePageLayout>
        <DashboardProfileClient
          profile={profileDataWithSaved}
          isOwner={isOwner}
          initialValues={portfolioInitialValues}
          cities={cities}
          provinces={provinces}
          billingData={billingData}
          enrolledCourses={enrolledCourses}
          registeredChallenges={registeredChallenges}
          savedSummary={savedSummary}
          publishSettings={publishSettings}
          shouldHighlightEditIcon={shouldHighlightEditIcon}
        />
      </ProfilePageLayout>
    </div>
  );
}
