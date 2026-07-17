import { MediaStatus } from "@prisma/client";
import * as Sentry from "@sentry/nextjs";
import { NextRequest, NextResponse } from "next/server";

import { getServerAuthSession } from "@/lib/auth/session";
import { NO_STORE_HEADERS } from "@/lib/http";
import { logError, logInfo } from "@/lib/logging";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const fetchCache = "force-no-store";

type RouteContext = {
  params: Promise<{ mediaId: string }>;
};

export async function GET(_request: NextRequest, context: RouteContext) {
  try {
    const { mediaId } = await context.params;
    if (!mediaId) {
      logInfo("media.status.check", { result: "missing_media_id" });
      return NextResponse.json(
        { error: "NOT_FOUND" },
        { status: 404, headers: NO_STORE_HEADERS },
      );
    }
    const session = await getServerAuthSession();
    if (!session?.user?.id) {
      logInfo("media.status.check", { mediaId, result: "unauthorized" });
      return NextResponse.json(
        { error: "UNAUTHORIZED" },
        { status: 401, headers: NO_STORE_HEADERS },
      );
    }
    const userId = session.user.id;
    const media = await prisma.mediaAsset.findUnique({
      where: { id: mediaId },
    });
    if (!media || media.ownerUserId !== userId) {
      logInfo("media.status.check", { mediaId, userId, result: "not_found" });
      return NextResponse.json(
        { error: "NOT_FOUND" },
        { status: 404, headers: NO_STORE_HEADERS },
      );
    }
    let needsFinalize = false;
    if (media.status === MediaStatus.uploaded) {
      const existingJob = await prisma.transcodeJob.findFirst({
        where: { mediaAssetId: media.id },
        select: { id: true },
      });
      needsFinalize = !existingJob;
    }
    logInfo("media.status.check", {
      mediaId,
      userId,
      result: "ok",
      status: media.status,
      visibility: media.visibility,
      needsFinalize,
    });
    return NextResponse.json(
      {
        ok: true,
        mediaId: media.id,
        status: media.status,
        visibility: media.visibility,
        errorMessage: media.errorMessage ?? null,
        durationSec: media.durationSec ?? null,
        width: media.width ?? null,
        height: media.height ?? null,
        sizeBytes: media.sizeBytes ? Number(media.sizeBytes) : null,
        needsFinalize,
      },
      { headers: NO_STORE_HEADERS },
    );
  } catch (error) {
    Sentry.captureException(error);
    const { mediaId } = await context.params;
    logError("media.status.check", {
      mediaId,
      result: "error",
      message: error instanceof Error ? error.message : "unknown",
    });
    return NextResponse.json(
      { error: "ERROR" },
      { status: 500, headers: NO_STORE_HEADERS },
    );
  }
}
