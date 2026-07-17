import { MediaStatus, MediaType, MediaVisibility } from "@prisma/client";
import * as Sentry from "@sentry/nextjs";
import { NextRequest, NextResponse } from "next/server";

import { getServerAuthSession } from "@/lib/auth/session";
import { NO_STORE_HEADERS, PRIVATE_SHORT_CACHE_HEADERS } from "@/lib/http";
import { logError, logInfo } from "@/lib/logging";
import { prisma } from "@/lib/prisma";
import { storageConfig } from "@/lib/storage/config";
import { getSignedGetUrl } from "@/lib/storage/signing";
import { resolveBucketForVisibility } from "@/lib/storage/visibility";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const fetchCache = "force-no-store";

type RouteContext = {
  params: { mediaId: string };
};

const privateBucket = storageConfig.privateBucket;

export async function GET(_request: NextRequest, context: RouteContext) {
  const mediaId = context.params.mediaId;
  if (!mediaId) {
    return NextResponse.json(
      { error: "NOT_FOUND" },
      { status: 404, headers: NO_STORE_HEADERS },
    );
  }

  let userId: string | null = null;

  try {
    const media = await prisma.mediaAsset.findUnique({
      where: { id: mediaId },
      select: {
        id: true,
        ownerUserId: true,
        status: true,
        type: true,
        visibility: true,
        sourceKey: true,
        outputKey: true,
      },
    });

    if (
      !media ||
      media.type !== MediaType.audio ||
      media.status !== MediaStatus.ready ||
      !(media.outputKey || media.sourceKey)
    ) {
      logInfo("media.file.fetch", { mediaId, result: "not_found" });
      return NextResponse.json(
        { error: "NOT_FOUND" },
        { status: 404, headers: NO_STORE_HEADERS },
      );
    }

    const isPublic = media.visibility === MediaVisibility.public;

    if (!isPublic) {
      const session = await getServerAuthSession();
      if (!session?.user?.id) {
        logInfo("media.file.fetch", { mediaId, result: "unauthorized" });
        return NextResponse.json(
          { error: "UNAUTHORIZED" },
          { status: 401, headers: NO_STORE_HEADERS },
        );
      }
      userId = session.user.id;

      if (media.ownerUserId !== userId) {
        logInfo("media.file.fetch", {
          mediaId,
          userId,
          result: "forbidden",
        });
        return NextResponse.json(
          { error: "FORBIDDEN" },
          { status: 403, headers: NO_STORE_HEADERS },
        );
      }
    }

    const key = media.outputKey ?? media.sourceKey;
    if (!key) {
      return NextResponse.json(
        { error: "NOT_FOUND" },
        { status: 404, headers: NO_STORE_HEADERS },
      );
    }

    const bucket = media.outputKey ? resolveBucketForVisibility("public") : privateBucket;
    const signedUrl = await getSignedGetUrl(bucket, key);

    logInfo("media.file.fetch", {
      mediaId,
      userId,
      ownerUserId: media.ownerUserId,
      visibility: media.visibility,
      bucket,
      key,
      result: "redirect",
    });

    const response = NextResponse.redirect(signedUrl, 302);
    for (const [key, value] of Object.entries(PRIVATE_SHORT_CACHE_HEADERS)) {
      response.headers.set(key, value);
    }
    return response;
  } catch (error) {
    Sentry.captureException(error);
    logError("media.file.fetch", {
      mediaId,
      userId: typeof userId === "string" ? userId : null,
      bucket: privateBucket,
      message: error instanceof Error ? error.message : "unknown",
    });
    return NextResponse.json(
      { error: "ERROR" },
      { status: 500, headers: NO_STORE_HEADERS },
    );
  }
}
