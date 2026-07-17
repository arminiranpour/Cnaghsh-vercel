// apps/web/vitest.setup.ts
// Make this file a module for TS.
export {};

// ---- Minimal test env ----
process.env.NOTIFICATIONS_SECRET ??= "test_secret_change_me";
process.env.NEXTAUTH_SECRET ??= "test_secret_change_me";

process.env.BASE_URL ??= "https://example.com";
process.env.NEXTAUTH_URL ??= "https://example.com";
process.env.PUBLIC_BASE_URL ??= "https://example.com";

// Prisma/env validation expects a string; we won't connect.
process.env.DATABASE_URL ??=
  "postgresql://user:pass@localhost:5432/testdb?schema=public";

// Quiet mail in tests
process.env.RESEND_API_KEY ??= "re_test_key";

process.env.MAIL_FROM ??= "test@example.com";
process.env.UPLOAD_ALLOWED_TYPES ??=
  "image/jpeg,image/png,image/webp,image/heic,image/heif,video/mp4,video/quicktime,video/webm,video/x-matroska,audio/mpeg,audio/mp4,audio/x-m4a,audio/wav,audio/x-wav,audio/aac";
process.env.UPLOAD_MAX_SIZE_MB_DEV ??= "25";
process.env.UPLOAD_MAX_SIZE_MB_PROD ??= "25";
process.env.UPLOAD_MAX_DURATION_SEC ??= "600";
process.env.UPLOAD_DAILY_USER_CAP_GB ??= "1";
process.env.UPLOAD_RATE_LIMIT_PER_MIN ??= "20";
process.env.UPLOAD_RATE_LIMIT_BURST ??= "40";

// Node 18+ already has fetch/Request/Response/FormData/Headers.
// If you truly need Blob/File in some test, you can uncomment below:
//
// import { Blob } from "node:buffer";
// (globalThis as any).Blob ??= Blob;
// (globalThis as any).File ??= class File extends Blob {
//   name: string; lastModified: number;
//   constructor(chunks: any[], name: string, opts: any = {}) {
//     super(chunks, opts);
//     this.name = name;
//     this.lastModified = opts.lastModified ?? Date.now();
//   }
// };
