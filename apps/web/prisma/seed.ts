import {
  ApplicationEventType,
  ApplicationStatus,
  CourseDurationUnit,
  CourseStatus,
  DayOfWeek,
  JobModeration,
  JobStatus,
  MediaStatus,
  MediaType,
  MediaVisibility,
  ModerationStatus,
  PlanCycle,
  Prisma,
  PrismaClient,
  ProductType,
  ProfileVisibility,
  SemesterStatus,
  TranscodeJobStatus,
  type Job,
  type MediaAsset,
  type Profile,
  type User,
} from '@prisma/client';
const prisma = new PrismaClient();

const SUBSCRIPTION_PRODUCT_NAME = 'اشتراک';
const SUBSCRIPTION_PLAN_NAME = 'ماهانه';
const SUBSCRIPTION_PRICE_AMOUNT = 5_000_000;

const DATABASE_RETRY_ATTEMPTS = 10;
const DATABASE_RETRY_DELAY_MS = 500;

async function waitForDatabase() {
  let lastError: unknown;

  for (let attempt = 1; attempt <= DATABASE_RETRY_ATTEMPTS; attempt += 1) {
    try {
      await prisma.$queryRaw`SELECT 1`;
      return;
    } catch (error) {
      lastError = error;

      if (!isRetryableDatabaseError(error) || attempt === DATABASE_RETRY_ATTEMPTS) {
        break;
      }

      const waitMs = DATABASE_RETRY_DELAY_MS * attempt;
      console.warn(
        `Database not ready (attempt ${attempt}/${DATABASE_RETRY_ATTEMPTS}). Retrying in ${waitMs}ms...`,
      );

      await new Promise((resolve) => setTimeout(resolve, waitMs));
    }
  }

  const lastErrorMessage =
    lastError instanceof Error ? lastError.message : JSON.stringify(lastError);

  throw new Error(
    `Unable to connect to the database using DATABASE_URL. Last error: ${lastErrorMessage}. ` +
      'Ensure the Postgres service is running (e.g., `pnpm dev:infra`) and credentials in `apps/web/.env.local` are correct.',
  );
}

function isRetryableDatabaseError(error: unknown) {
  if (error instanceof Prisma.PrismaClientInitializationError) {
    return true;
  }

  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    return ['P1001', 'P1002', 'P1008', 'P1010'].includes(error.code);
  }

  return false;
}

const JOB_PRODUCT_NAME = 'ثبت آگهی شغلی';
const JOB_PRICE_AMOUNT = 1_500_000;

const MEDIA_SEED_USER_EMAIL = 'media-seed@example.com';

const COURSE_TITLE = 'Acting Fundamentals';
const COURSE_SEMESTER_TITLE = 'Spring 2025';
const COURSE_TUITION_AMOUNT = 12_000_000;
const COURSE_LUMP_SUM_DISCOUNT = 1_000_000;
const COURSE_INSTALLMENT_COUNT = 4;
const COURSE_STARTS_AT = new Date('2025-01-15T00:00:00.000Z');
const COURSE_ENDS_AT = new Date('2025-04-15T00:00:00.000Z');

const MOVIE_GENRES = [
  { slug: 'action', nameEn: 'Action', nameFa: 'اکشن' },
  { slug: 'drama', nameEn: 'Drama', nameFa: 'درام' },
  { slug: 'comedy', nameEn: 'Comedy', nameFa: 'کمدی' },
  { slug: 'thriller', nameEn: 'Thriller', nameFa: 'هیجان‌انگیز' },
  { slug: 'horror', nameEn: 'Horror', nameFa: 'ترسناک' },
  { slug: 'romance', nameEn: 'Romance', nameFa: 'عاشقانه' },
  { slug: 'sci-fi', nameEn: 'Sci-Fi', nameFa: 'علمی‌تخیلی' },
  { slug: 'fantasy', nameEn: 'Fantasy', nameFa: 'فانتزی' },
  { slug: 'documentary', nameEn: 'Documentary', nameFa: 'مستند' },
  { slug: 'animation', nameEn: 'Animation', nameFa: 'انیمیشن' },
  { slug: 'crime', nameEn: 'Crime', nameFa: 'جنایی' },
  { slug: 'family', nameEn: 'Family', nameFa: 'خانوادگی' },
  { slug: 'war', nameEn: 'War', nameFa: 'جنگی' },
  { slug: 'history', nameEn: 'History', nameFa: 'تاریخی' },
  { slug: 'music', nameEn: 'Music', nameFa: 'موزیکال' },
  { slug: 'mystery', nameEn: 'Mystery', nameFa: 'رازآلود' },
  { slug: 'adventure', nameEn: 'Adventure', nameFa: 'ماجراجویی' },
  { slug: 'western', nameEn: 'Western', nameFa: 'وسترن' },
  { slug: 'biography', nameEn: 'Biography', nameFa: 'زندگی‌نامه‌ای' },
] as const;

async function ensureSeedUser() {
  const existingUser = await prisma.user.findFirst();

  if (existingUser) {
    return existingUser;
  }

  return prisma.user.create({
    data: {
      email: MEDIA_SEED_USER_EMAIL,
      name: 'Media Seed User',
    },
  });
}

async function ensureSeedMediaAsset(ownerId: string) {
  const sourceKey = `uploads/originals/${ownerId}/seed-video.mp4`;

  let mediaAsset = await prisma.mediaAsset.findFirst({
    where: {
      ownerUserId: ownerId,
      sourceKey,
    },
  });

  if (!mediaAsset) {
    mediaAsset = await prisma.mediaAsset.create({
      data: {
        ownerUserId: ownerId,
        type: MediaType.video,
        status: MediaStatus.uploaded,
        visibility: MediaVisibility.private,
        sourceKey,
      },
    });
  }

  let transcodeJob = await prisma.transcodeJob.findFirst({
    where: {
      mediaAssetId: mediaAsset.id,
      attempt: 1,
    },
    orderBy: {
      createdAt: 'asc',
    },
  });

  if (!transcodeJob) {
    transcodeJob = await prisma.transcodeJob.create({
      data: {
        mediaAssetId: mediaAsset.id,
        attempt: 1,
        status: TranscodeJobStatus.queued,
      },
    });
  }

  return { mediaAsset, transcodeJob };
}

async function ensureGenres() {
  await prisma.genre.createMany({
    data: MOVIE_GENRES.map((genre) => ({
      slug: genre.slug,
      nameEn: genre.nameEn,
      nameFa: genre.nameFa,
    })),
    skipDuplicates: true,
  });
}

async function ensureProduct(type: ProductType, name: string) {
  const existing = await prisma.product.findFirst({
    where: {
      type,
      name,
    },
  });

  if (existing) {
    if (!existing.active) {
      return prisma.product.update({
        where: { id: existing.id },
        data: { active: true },
      });
    }

    return existing;
  }

  return prisma.product.create({
    data: {
      type,
      name,
      active: true,
    },
  });
}

async function ensurePlan(productId: string, cycle: PlanCycle, name: string) {
  const existing = await prisma.plan.findFirst({
    where: {
      productId,
      cycle,
    },
  });

  if (existing) {
    const limitsIsEmpty = JSON.stringify(existing.limits ?? {}) === '{}';
    const shouldUpdate =
      !existing.active || existing.name !== name || !limitsIsEmpty;

    if (shouldUpdate) {
      return prisma.plan.update({
        where: { id: existing.id },
        data: {
          name,
          limits: {},
          active: true,
        },
      });
    }

    return existing;
  }

  return prisma.plan.create({
    data: {
      productId,
      name,
      cycle,
      limits: {},
      active: true,
    },
  });
}

async function ensurePlanPrice(planId: string, amount: number) {
  const existing = await prisma.price.findFirst({
    where: {
      planId,
      currency: 'IRR',
    },
    orderBy: {
      createdAt: 'asc',
    },
  });

  let price;

  if (existing) {
    price = await prisma.price.update({
      where: { id: existing.id },
      data: {
        amount,
        currency: 'IRR',
        active: true,
      },
    });
  } else {
    price = await prisma.price.create({
      data: {
        planId,
        amount,
        currency: 'IRR',
        active: true,
      },
    });
  }

  await prisma.price.updateMany({
    where: {
      planId,
      id: { not: price.id },
      active: true,
    },
    data: { active: false },
  });

  return price;
}

async function ensureProductPrice(productId: string, amount: number) {
  const existing = await prisma.price.findFirst({
    where: {
      productId,
      planId: null,
      currency: 'IRR',
    },
    orderBy: {
      createdAt: 'asc',
    },
  });

  let price;

  if (existing) {
    price = await prisma.price.update({
      where: { id: existing.id },
      data: {
        amount,
        currency: 'IRR',
        active: true,
      },
    });
  } else {
    price = await prisma.price.create({
      data: {
        productId,
        amount,
        currency: 'IRR',
        active: true,
      },
    });
  }

  await prisma.price.updateMany({
    where: {
      productId,
      planId: null,
      id: { not: price.id },
      active: true,
    },
    data: { active: false },
  });

  return price;
}

type SemesterScheduleSeed = {
  dayOfWeek: DayOfWeek;
  slots: Array<{ title?: string; startMinute: number; endMinute: number }>;
};

async function ensureCourse(seed: {
  title: string;
  description: string;
  ageRangeText: string;
  durationValue: number;
  durationUnit: CourseDurationUnit;
  instructorName: string;
  prerequisiteText: string;
  bannerMediaAssetId: string | null;
  introVideoMediaAssetId: string | null;
  status: CourseStatus;
}) {
  const existing = await prisma.course.findFirst({
    where: {
      title: seed.title,
    },
  });

  if (existing) {
    return prisma.course.update({
      where: { id: existing.id },
      data: seed,
    });
  }

  return prisma.course.create({
    data: seed,
  });
}

async function ensureSemester(
  courseId: string,
  seed: {
    title: string;
    startsAt: Date;
    endsAt: Date;
    tuitionAmountIrr: number;
    currency: string;
    lumpSumDiscountAmountIrr: number;
    installmentPlanEnabled: boolean;
    installmentCount: number | null;
    status: SemesterStatus;
  },
) {
  const existing = await prisma.semester.findFirst({
    where: {
      courseId,
      title: seed.title,
    },
  });

  const payload = {
    ...seed,
    courseId,
  };

  if (existing) {
    return prisma.semester.update({
      where: { id: existing.id },
      data: payload,
    });
  }

  return prisma.semester.create({
    data: payload,
  });
}

async function ensureSemesterSchedule(
  semesterId: string,
  schedule: SemesterScheduleSeed[],
) {
  for (const day of schedule) {
    const scheduleDay = await prisma.semesterScheduleDay.upsert({
      where: {
        semesterId_dayOfWeek: {
          semesterId,
          dayOfWeek: day.dayOfWeek,
        },
      },
      update: {},
      create: {
        semesterId,
        dayOfWeek: day.dayOfWeek,
      },
    });

    for (const slot of day.slots) {
      await prisma.semesterClassSlot.upsert({
        where: {
          scheduleDayId_startMinute_endMinute: {
            scheduleDayId: scheduleDay.id,
            startMinute: slot.startMinute,
            endMinute: slot.endMinute,
          },
        },
        update: {
          title: slot.title ?? null,
        },
        create: {
          scheduleDayId: scheduleDay.id,
          title: slot.title ?? null,
          startMinute: slot.startMinute,
          endMinute: slot.endMinute,
        },
      });
    }
  }
}

const APPLICATION_ATTACHMENT_LIMIT = 5;

async function ensureUserAccount(email: string, name: string): Promise<User> {
  const existing = await prisma.user.findUnique({ where: { email } });

  if (existing) {
    if (name && existing.name !== name) {
      return prisma.user.update({
        where: { id: existing.id },
        data: { name },
      });
    }

    return existing;
  }

  return prisma.user.create({
    data: {
      email,
      name,
    },
  });
}

async function ensurePublishedProfile(
  user: User,
  profileData: Partial<Profile> & { bio?: string } = {},
): Promise<Profile> {
  const existing = await prisma.profile.findUnique({
    where: { userId: user.id },
  });

  const baseBio =
    profileData.bio ??
    'Published profile ready for job applications and employer review.';

  const payload = {
    userId: user.id,
    firstName: profileData.firstName ?? user.name ?? 'Talent',
    lastName: profileData.lastName ?? 'Applicant',
    bio: baseBio,
    cityId: profileData.cityId ?? 'tehran',
    visibility: ProfileVisibility.PUBLIC,
    publishedAt: profileData.publishedAt ?? new Date(),
    moderationStatus: ModerationStatus.APPROVED,
  };

  if (existing) {
    return prisma.profile.update({
      where: { id: existing.id },
      data: {
        ...payload,
        publishedAt: existing.publishedAt ?? payload.publishedAt,
      },
    });
  }

  return prisma.profile.create({
    data: payload,
  });
}

async function ensureApplicantMediaAsset(
  ownerId: string,
  label: string,
  type: MediaType,
): Promise<MediaAsset> {
  const sourceKey = `uploads/applications/${ownerId}/${label}`;

  const existing = await prisma.mediaAsset.findFirst({
    where: {
      ownerUserId: ownerId,
      sourceKey,
    },
  });

  if (existing) {
    return existing;
  }

  return prisma.mediaAsset.create({
    data: {
      ownerUserId: ownerId,
      type,
      status: MediaStatus.ready,
      visibility: MediaVisibility.private,
      sourceKey,
    },
  });
}

async function ensurePublishedJob(
  owner: User,
  jobSeed: {
    title: string;
    description: string;
    category: string;
    cityId?: string | null;
    payType?: string | null;
    payAmount?: number | null;
    currency?: string | null;
    remote?: boolean;
  },
): Promise<Job> {
  const existing = await prisma.job.findFirst({
    where: {
      userId: owner.id,
      title: jobSeed.title,
    },
  });

  const payload = {
    userId: owner.id,
    title: jobSeed.title,
    description: jobSeed.description,
    category: jobSeed.category,
    cityId: jobSeed.cityId ?? 'tehran',
    payType: jobSeed.payType ?? 'fixed',
    payAmount: jobSeed.payAmount ?? 50000000,
    currency: jobSeed.currency ?? 'IRR',
    remote: jobSeed.remote ?? false,
    status: JobStatus.PUBLISHED,
    moderation: JobModeration.APPROVED,
  };

  if (existing) {
    return prisma.job.update({
      where: { id: existing.id },
      data: payload,
    });
  }

  return prisma.job.create({
    data: payload,
  });
}

type ApplicantContext = {
  user: User;
  profile: Profile;
  assets: MediaAsset[];
};

function buildAttachmentPayload(assets: MediaAsset[], take: number): Prisma.InputJsonValue {
  return assets.slice(0, take).map((asset, index) => ({
    mediaAssetId: asset.id,
    mediaType: asset.type,
    label: index === 0 ? 'portfolio' : 'reference',
  }));
}

function makeStatusChangePayload(
  from: ApplicationStatus | null,
  to: ApplicationStatus,
  reason?: string,
): Prisma.InputJsonValue {
  return {
    from,
    to,
    ...(reason ? { reason } : {}),
  };
}

async function seedApplicationWithTimeline(params: {
  job: Job;
  applicant: ApplicantContext;
  owner: User;
  finalStatus: ApplicationStatus;
  coverNote: string;
  attachments: Prisma.InputJsonValue;
  consents: Prisma.InputJsonValue;
  transitions: Array<{ from: ApplicationStatus | null; to: ApplicationStatus; actorUserId?: string; reason?: string }>;
  notes?: Array<{ text: string; actorUserId?: string }>;
  systemEvents?: Array<{ payload: Prisma.InputJsonValue; actorUserId?: string | null }>;
  attachmentEvents?: Array<{ asset: MediaAsset; actorUserId?: string; kind?: string }>;
  views?: Array<{ viewerUserId?: string | null; offsetMinutes: number; ipHash: string; userAgentHash: string }>;
  createdAt: Date;
}) {
  const existing = await prisma.application.findUnique({
    where: {
      jobId_applicantUserId: {
        jobId: params.job.id,
        applicantUserId: params.applicant.user.id,
      },
    },
  });

  const application = existing
    ? await prisma.application.update({
        where: { id: existing.id },
        data: {
          status: params.finalStatus,
          coverNote: params.coverNote,
          attachments: params.attachments,
          consents: params.consents,
        },
      })
    : await prisma.application.create({
        data: {
          jobId: params.job.id,
          applicantUserId: params.applicant.user.id,
          status: params.finalStatus,
          coverNote: params.coverNote,
          attachments: params.attachments,
          consents: params.consents,
          createdAt: params.createdAt,
        },
      });

  await prisma.applicationEvent.deleteMany({
    where: { applicationId: application.id },
  });

  let eventsCreated = 0;
  const baseTime = params.createdAt;

  const timelineInputs: Prisma.ApplicationEventCreateManyInput[] = [];

  params.transitions.forEach((transition, index) => {
    timelineInputs.push({
      applicationId: application.id,
      actorUserId: transition.actorUserId ?? null,
      type: ApplicationEventType.status_change,
      payload: makeStatusChangePayload(transition.from, transition.to, transition.reason),
      createdAt: new Date(baseTime.getTime() + index * 10 * 60 * 1000),
    });
  });

  const noteStartOffset = params.transitions.length;
  params.notes?.forEach((note, noteIndex) => {
    timelineInputs.push({
      applicationId: application.id,
      actorUserId: note.actorUserId ?? null,
      type: ApplicationEventType.note,
      payload: { text: note.text },
      createdAt: new Date(baseTime.getTime() + (noteStartOffset + noteIndex) * 10 * 60 * 1000),
    });
  });

  const systemStartOffset = timelineInputs.length;
  params.systemEvents?.forEach((event, eventIndex) => {
    timelineInputs.push({
      applicationId: application.id,
      actorUserId: event.actorUserId ?? null,
      type: ApplicationEventType.system,
      payload: event.payload,
      createdAt: new Date(baseTime.getTime() + (systemStartOffset + eventIndex) * 10 * 60 * 1000),
    });
  });

  const attachmentStartOffset = timelineInputs.length;
  params.attachmentEvents?.forEach((item, attachmentIndex) => {
    timelineInputs.push({
      applicationId: application.id,
      actorUserId: item.actorUserId ?? null,
      type: ApplicationEventType.attachment_add,
      payload: {
        mediaAssetId: item.asset.id,
        mediaType: item.asset.type,
        kind: item.kind ?? 'attachment',
      },
      createdAt: new Date(
        baseTime.getTime() + (attachmentStartOffset + attachmentIndex) * 10 * 60 * 1000,
      ),
    });
  });

  if (timelineInputs.length > 0) {
    await prisma.applicationEvent.createMany({
      data: timelineInputs,
    });
    eventsCreated = timelineInputs.length;
  }

  let viewsCreated = 0;

  if (params.views && params.views.length > 0) {
    const viewInputs = params.views.map((view) => ({
      applicationId: application.id,
      viewerUserId: view.viewerUserId ?? null,
      ipHash: view.ipHash,
      userAgentHash: view.userAgentHash,
      createdAt: new Date(baseTime.getTime() + view.offsetMinutes * 60 * 1000),
    }));

    await prisma.applicationView.createMany({
      data: viewInputs,
      skipDuplicates: true,
    });
    viewsCreated = viewInputs.length;
  }

  return { application, eventsCreated, viewsCreated };
}

async function verifyDuplicatePrevention(example: { jobId: string; applicantUserId: string }) {
  try {
    await prisma.application.create({
      data: {
        jobId: example.jobId,
        applicantUserId: example.applicantUserId,
        status: ApplicationStatus.new,
      },
    });

    console.warn(
      'Duplicate application creation unexpectedly succeeded; uniqueness constraint needs review.',
    );
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      console.log(
        `Duplicate application prevented for job ${example.jobId} and applicant ${example.applicantUserId}.`,
      );
      return;
    }

    throw error;
  }
}

async function main() {
  await waitForDatabase();

  await ensureGenres();

  const seedUser = await ensureSeedUser();

  const subscriptionProduct = await ensureProduct(
    ProductType.SUBSCRIPTION,
    SUBSCRIPTION_PRODUCT_NAME,
  );

  const subscriptionPlan = await ensurePlan(
    subscriptionProduct.id,
    PlanCycle.MONTHLY,
    SUBSCRIPTION_PLAN_NAME,
  );

  const subscriptionPrice = await ensurePlanPrice(
    subscriptionPlan.id,
    SUBSCRIPTION_PRICE_AMOUNT,
  );

  const jobProduct = await ensureProduct(ProductType.JOB_POST, JOB_PRODUCT_NAME);
  const jobPrice = await ensureProductPrice(jobProduct.id, JOB_PRICE_AMOUNT);

  const { mediaAsset, transcodeJob } = await ensureSeedMediaAsset(seedUser.id);

  const course = await ensureCourse({
    title: COURSE_TITLE,
    description: 'Foundational acting techniques with scene work and improvisation.',
    ageRangeText: '12-16',
    durationValue: 3,
    durationUnit: CourseDurationUnit.month,
    instructorName: 'Sample Instructor',
    prerequisiteText: 'No prior experience required.',
    bannerMediaAssetId: null,
    introVideoMediaAssetId: null,
    status: CourseStatus.published,
  });

  const semester = await ensureSemester(course.id, {
    title: COURSE_SEMESTER_TITLE,
    startsAt: COURSE_STARTS_AT,
    endsAt: COURSE_ENDS_AT,
    tuitionAmountIrr: COURSE_TUITION_AMOUNT,
    currency: 'IRR',
    lumpSumDiscountAmountIrr: COURSE_LUMP_SUM_DISCOUNT,
    installmentPlanEnabled: true,
    installmentCount: COURSE_INSTALLMENT_COUNT,
    status: SemesterStatus.open,
  });

  await ensureSemesterSchedule(semester.id, [
    {
      dayOfWeek: DayOfWeek.sat,
      slots: [
        { title: 'Scene Study', startMinute: 600, endMinute: 720 },
        { title: 'Movement Lab', startMinute: 840, endMinute: 960 },
      ],
    },
    {
      dayOfWeek: DayOfWeek.mon,
      slots: [{ title: 'Improv Workshop', startMinute: 1080, endMinute: 1170 }],
    },
  ]);

  const jobOwnerA = await ensureUserAccount('owner-a@example.com', 'Job Owner A');
  const jobOwnerB = await ensureUserAccount('owner-b@example.com', 'Job Owner B');

  const applicantSeeds = [
    {
      email: 'applicant-one@example.com',
      name: 'Ava Applicant',
      cityId: 'tehran',
      bio: 'Stage actor with musical experience and a published portfolio.',
    },
    {
      email: 'applicant-two@example.com',
      name: 'Ben Candidate',
      cityId: 'isfahan',
      bio: 'Voice talent with commercial and documentary work.',
    },
    {
      email: 'applicant-three@example.com',
      name: 'Cora Performer',
      cityId: 'mashhad',
      bio: 'Performer focused on live events and hosting.',
    },
    {
      email: 'applicant-four@example.com',
      name: 'Dara Storyteller',
      cityId: 'shiraz',
      bio: 'Narrator and presenter comfortable with remote productions.',
    },
  ];

  const applicants: ApplicantContext[] = [];

  for (const seed of applicantSeeds) {
    const user = await ensureUserAccount(seed.email, seed.name);
    const profile = await ensurePublishedProfile(user, {
      bio: seed.bio,
      cityId: seed.cityId,
    });

    const assets = await Promise.all([
      ensureApplicantMediaAsset(user.id, 'portfolio-video.mp4', MediaType.video),
      ensureApplicantMediaAsset(user.id, 'headshot.jpg', MediaType.image),
    ]);

    applicants.push({ user, profile, assets });
  }

  const jobs = await Promise.all([
    ensurePublishedJob(jobOwnerA, {
      title: 'Lead Stage Performer',
      description:
        'Casting for a lead performer comfortable with live audiences and musical numbers.',
      category: 'stage',
      cityId: 'tehran',
      payType: 'fixed',
      payAmount: 90000000,
    }),
    ensurePublishedJob(jobOwnerA, {
      title: 'Voice Actor for Trailer',
      description: 'Short-form trailer voiceover with energetic delivery.',
      category: 'voiceover',
      cityId: 'remote',
      payType: 'per_project',
      payAmount: 35000000,
      remote: true,
    }),
    ensurePublishedJob(jobOwnerB, {
      title: 'Documentary Narrator',
      description: 'Looking for a calm, trustworthy narrator for a three-part series.',
      category: 'narration',
      cityId: 'isfahan',
      payType: 'per_episode',
      payAmount: 40000000,
    }),
  ]);

  const applicationPlans = [
    {
      job: jobs[0],
      applicant: applicants[0],
      owner: jobOwnerA,
      finalStatus: ApplicationStatus.new,
      coverNote: 'Excited to bring musical theatre training to this production.',
      attachments: buildAttachmentPayload(applicants[0].assets, 1),
      consents: { shareContact: true },
      transitions: [
        { from: null, to: ApplicationStatus.new, actorUserId: applicants[0].user.id },
      ],
      notes: [
        { text: 'Applicant completed a full profile with links.', actorUserId: applicants[0].user.id },
      ],
      attachmentEvents: [
        { asset: applicants[0].assets[0], actorUserId: applicants[0].user.id, kind: 'portfolio' },
      ],
    },
    {
      job: jobs[0],
      applicant: applicants[1],
      owner: jobOwnerA,
      finalStatus: ApplicationStatus.shortlist,
      coverNote: 'Experience leading ensemble casts; available evenings.',
      attachments: buildAttachmentPayload(applicants[1].assets, 2),
      consents: { shareContact: true },
      transitions: [
        { from: null, to: ApplicationStatus.new, actorUserId: applicants[1].user.id },
        {
          from: ApplicationStatus.new,
          to: ApplicationStatus.shortlist,
          actorUserId: jobOwnerA.id,
          reason: 'Strong stage presence and availability.',
        },
      ],
      attachmentEvents: [
        { asset: applicants[1].assets[0], actorUserId: applicants[1].user.id, kind: 'audition-reel' },
      ],
      views: [
        {
          viewerUserId: jobOwnerA.id,
          offsetMinutes: 20,
          ipHash: 'ownerA-iphash',
          userAgentHash: 'ownerA-ua',
        },
      ],
    },
    {
      job: jobs[0],
      applicant: applicants[2],
      owner: jobOwnerA,
      finalStatus: ApplicationStatus.reject,
      coverNote: 'Available for touring dates; prior improv experience.',
      attachments: buildAttachmentPayload(applicants[2].assets, 1),
      consents: { shareContact: false },
      transitions: [
        { from: null, to: ApplicationStatus.new, actorUserId: applicants[2].user.id },
        {
          from: ApplicationStatus.new,
          to: ApplicationStatus.reject,
          actorUserId: jobOwnerA.id,
          reason: 'Schedule conflicts with rehearsal calendar.',
        },
      ],
      systemEvents: [
        {
          payload: { detail: 'Auto-notified applicant about rejection and feedback window.' },
          actorUserId: null,
        },
      ],
    },
    {
      job: jobs[1],
      applicant: applicants[3],
      owner: jobOwnerA,
      finalStatus: ApplicationStatus.select,
      coverNote: 'I can deliver upbeat and warm reads; home studio ready.',
      attachments: buildAttachmentPayload(applicants[3].assets, 2),
      consents: { shareContact: true },
      transitions: [
        { from: null, to: ApplicationStatus.new, actorUserId: applicants[3].user.id },
        {
          from: ApplicationStatus.new,
          to: ApplicationStatus.shortlist,
          actorUserId: jobOwnerA.id,
          reason: 'Matches vocal tone for trailer.',
        },
        {
          from: ApplicationStatus.shortlist,
          to: ApplicationStatus.select,
          actorUserId: jobOwnerA.id,
          reason: 'Accepted offer after callback.',
        },
      ],
      views: [
        {
          viewerUserId: jobOwnerA.id,
          offsetMinutes: 30,
          ipHash: 'ownerA-voip',
          userAgentHash: 'ownerA-ua-trailer',
        },
        {
          viewerUserId: null,
          offsetMinutes: 45,
          ipHash: 'system-reviewer',
          userAgentHash: 'pipeline-check',
        },
      ],
    },
    {
      job: jobs[1],
      applicant: applicants[0],
      owner: jobOwnerA,
      finalStatus: ApplicationStatus.withdrawn,
      coverNote: 'Applied before but accepted another role; withdrawing politely.',
      attachments: buildAttachmentPayload(applicants[0].assets, 1),
      consents: { shareContact: true },
      transitions: [
        { from: null, to: ApplicationStatus.new, actorUserId: applicants[0].user.id },
        {
          from: ApplicationStatus.new,
          to: ApplicationStatus.withdrawn,
          actorUserId: applicants[0].user.id,
          reason: 'Accepted another booking.',
        },
      ],
      notes: [{ text: 'Withdrawn by applicant via dashboard.', actorUserId: applicants[0].user.id }],
    },
    {
      job: jobs[2],
      applicant: applicants[2],
      owner: jobOwnerB,
      finalStatus: ApplicationStatus.shortlist,
      coverNote: 'Narration samples attached; comfortable with long-form reads.',
      attachments: buildAttachmentPayload(applicants[2].assets, 2),
      consents: { shareContact: true },
      transitions: [
        { from: null, to: ApplicationStatus.new, actorUserId: applicants[2].user.id },
        {
          from: ApplicationStatus.new,
          to: ApplicationStatus.shortlist,
          actorUserId: jobOwnerB.id,
          reason: 'Good pacing and tone.',
        },
      ],
      systemEvents: [
        {
          payload: { detail: 'Applicant marked as viewed by employer dashboard.' },
          actorUserId: jobOwnerB.id,
        },
      ],
      views: [
        {
          viewerUserId: jobOwnerB.id,
          offsetMinutes: 15,
          ipHash: 'ownerB-iphash',
          userAgentHash: 'ownerB-ua',
        },
      ],
    },
  ];

  let applicationCount = 0;
  let eventCount = 0;
  let viewCount = 0;

  applicationPlans.forEach((plan) => {
    if (
      Array.isArray(plan.attachments) &&
      plan.attachments.length > APPLICATION_ATTACHMENT_LIMIT
    ) {
      throw new Error('Attachment count exceeds allowed limit for seeding plan.');
    }
  });

  for (let index = 0; index < applicationPlans.length; index += 1) {
    const plan = applicationPlans[index];
    const createdAt = new Date(Date.now() - (applicationPlans.length - index) * 60 * 60 * 1000);
    const { application, eventsCreated, viewsCreated } = await seedApplicationWithTimeline({
      ...plan,
      createdAt,
    });

    applicationCount += 1;
    eventCount += eventsCreated;
    viewCount += viewsCreated;

    if (index === 0) {
      await verifyDuplicatePrevention({
        jobId: application.jobId,
        applicantUserId: application.applicantUserId,
      });
    }
  }

  console.log('Seed ensured records:');
  console.log('Subscription product:', subscriptionProduct.id);
  console.log('Subscription plan:', subscriptionPlan.id);
  console.log('Subscription price:', subscriptionPrice.id);
  console.log('Job post product:', jobProduct.id);
  console.log('Job post price:', jobPrice.id);
  console.log('Media seed user:', seedUser.id);
  console.log('Media asset:', mediaAsset.id);
  console.log('Transcode job:', transcodeJob.id);
  console.log('Course:', course.id);
  console.log('Semester:', semester.id);
  console.log('Job owners:', [jobOwnerA.id, jobOwnerB.id]);
  console.log(
    'Applicants:',
    applicants.map((a) => a.user.id),
  );
  console.log(
    'Jobs created:',
    jobs.map((job) => job.id),
  );
  console.log('Applications created:', applicationCount);
  console.log('Application events created:', eventCount);
  console.log('Application views created:', viewCount);
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
