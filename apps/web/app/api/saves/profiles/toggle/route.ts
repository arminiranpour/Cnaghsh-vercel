import { SavedItemType } from "@prisma/client";

import { getServerAuthSession } from "@/lib/auth/session";
import { badRequest, ok, notFound, unauthorized, safeJson } from "@/lib/http";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const fetchCache = "force-no-store";

type ToggleProfileBody = {
  profileId?: string;
};

export async function POST(request: Request) {
  const session = await getServerAuthSession();
  if (!session?.user?.id) {
    return unauthorized("UNAUTHORIZED");
  }

  const parsed = await safeJson<ToggleProfileBody>(request);
  if (!parsed.ok) {
    return badRequest("INVALID_JSON");
  }

  const profileId = parsed.data.profileId?.trim();
  if (!profileId) {
    return badRequest("MISSING_PROFILE_ID");
  }

  const userId = session.user.id;

  const result = await prisma.$transaction(async (tx) => {
    const profile = await tx.profile.findUnique({
      where: { id: profileId },
      select: { likesCount: true, userId: true },
    });

    if (!profile) {
      return null;
    }

    if (profile.userId === userId) {
      return { error: "CANNOT_SAVE_OWN_PROFILE" as const };
    }

    const existing = await tx.savedItem.findUnique({
      where: {
        userId_type_entityId: {
          userId,
          type: SavedItemType.PROFILE,
          entityId: profileId,
        },
      },
      select: { id: true },
    });

    if (existing) {
      await tx.savedItem.delete({ where: { id: existing.id } });
      const nextCount = Math.max(0, profile.likesCount - 1);
      const updated = await tx.profile.update({
        where: { id: profileId },
        data: { likesCount: nextCount },
        select: { likesCount: true },
      });

      return { saved: false, likesCount: updated.likesCount };
    }

    await tx.savedItem.create({
      data: {
        userId,
        type: SavedItemType.PROFILE,
        entityId: profileId,
      },
    });

    const updated = await tx.profile.update({
      where: { id: profileId },
      data: { likesCount: { increment: 1 } },
      select: { likesCount: true },
    });

    return { saved: true, likesCount: updated.likesCount };
  });

  if (!result) {
    return notFound("PROFILE_NOT_FOUND");
  }

  if ("error" in result) {
    return Response.json({ error: result.error }, { status: 403 });
  }

  return ok(result);
}
