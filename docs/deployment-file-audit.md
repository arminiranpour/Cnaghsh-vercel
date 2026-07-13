# CNaghsh Deployment File Audit

## 1. Executive summary

**Recommended deployment strategy: Option C implemented via Option A.**

Deploy a **trimmed monorepo source bundle**, install and build on the Ubuntu server, and run **two separate processes** behind Nginx:

- `@app/web` as the Next.js web process
- `@app/worker` as the BullMQ/media-transcoding worker

This is the best fit for the repository as it exists today because:

- `apps/web/next.config.mjs` does **not** set `output: "standalone"`.
- `apps/web/.next/standalone` and `apps/web/.next/required-server-files.json` are **absent**.
- The checked-in `apps/web/.next` output is a **local development build**, not a production deploy artifact:
  - `apps/web/.next/static/development/**`
  - many `*.webpack.hot-update.json` files
- The worker is a real separate service:
  - BullMQ/Redis usage in `apps/worker/src/lib/queue-connection.ts`
  - media transcode worker in `apps/worker/src/workers/mediaTranscode.worker.ts`
  - ffmpeg/ffprobe execution in `apps/worker/src/services/hls-transcode.ts`, `apps/worker/src/services/ffprobe.ts`, and `apps/worker/src/services/poster.ts`
- There is **no production Dockerfile**, **no production docker-compose**, and **no PM2/systemd unit files** in the repo. Only `infra/docker-compose.dev.yml` exists, and it is clearly development-only.
- The repo uses workspace/package-local source during builds:
  - `@acme/contracts` is a real workspace dependency of both apps
  - the web app uses `@acme/ui` from `file:./vendor/ui`
- `.npmrc` sets `ignore-scripts=true`, so a fresh server install will **not** automatically run package install scripts. In practice, this means you should expect to run **explicit Prisma generation** yourself during deployment.

### Practical recommendation

Upload only the files needed to:

1. install dependencies with pnpm on Ubuntu
2. run `prisma generate`
3. optionally run `prisma migrate deploy`
4. build `@app/web` and `@app/worker`
5. start them as separate services

Do **not** upload local caches, checked-in `.next` output, test artifacts, reports, `.env.local`, or local uploaded media.

### Important runtime finding

The repository has **two media-storage paths**:

- S3-compatible object storage for the media pipeline and course intro videos
- local filesystem writes for some image uploads in `apps/web/lib/media/storage.ts`

That means production must either:

- preserve a writable, persistent `public/uploads` location for the web app, or
- replace that local upload path with external storage before deployment

The existing files under `apps/web/public/uploads/**` and `apps/web/apps/web/public/uploads/**` should be treated as **local/user-generated data**, not application code.

### Prisma/runtime conclusion

- **Prisma CLI is not needed for steady-state runtime.**
- **Prisma CLI is needed during deployment/build/migration time** because the repo installs with `ignore-scripts=true`.
- `apps/web/prisma/migrations/**` are needed only if you run migrations on the server.
- `apps/web/prisma/seed.ts` is **not** required for normal production runtime; use it only for intentional bootstrap/demo data.

## 2. Required files to deploy

The table below assumes the recommended approach: trimmed monorepo source uploaded to Ubuntu, then install/build on the server.

| Path or glob | Required by | Reason | Deployment stage | Can be prebuilt locally |
| --- | --- | --- | --- | --- |
| `package.json` | web + worker build | Root scripts, Prisma schema pointer, pnpm package manager version | build-time | no |
| `pnpm-lock.yaml` | web + worker build | Reproducible dependency graph for server install | build-time | no |
| `pnpm-workspace.yaml` | web + worker build | Workspace resolution for `apps/*` and `packages/*` | build-time | no |
| `.npmrc` | web + worker build | Preserves install behavior, especially `ignore-scripts=true` and peer-dep behavior | build-time | no |
| `turbo.json` | web + worker build | `pnpm build` resolves through Turbo task graph | build-time | no |
| `tsconfig.base.json` | web + worker build | Base TS config inherited by both apps and workspace package | build-time | no |
| `apps/web/package.json` | web build | Next.js app scripts and dependencies | build-time | no |
| `apps/web/{tsconfig.json,next-env.d.ts,next.config.mjs,middleware.ts,sentry.client.config.ts,sentry.server.config.ts}` | web build/runtime | Required app build config and runtime middleware/Sentry wiring | build-time, runtime | yes |
| `apps/web/app/**` | web | Next.js routes, layouts, API handlers, metadata, route groups | build-time, runtime | yes |
| `apps/web/components/**` | web | React UI and client/server components | build-time, runtime | yes |
| `apps/web/lib/**` | web | auth, Prisma, billing, storage, Redis, notifications, SEO, media logic | build-time, runtime | yes |
| `apps/web/types/**` | web build | local declaration files used by TS/Next build | build-time | yes |
| `apps/web/vendor/ui/**` | web build | actual `@acme/ui` dependency used by `file:./vendor/ui` | build-time | yes |
| `apps/web/public/**` except local user uploads | web | static images, fonts, CSS, JSON datasets, logo, assets served by Next | build-time, runtime | yes |
| `apps/web/prisma/schema.prisma` | web + worker + Prisma generate | source of Prisma Client generation and DB schema | build-time, migration-time | yes |
| `apps/web/prisma/migrations/**` | deployment migration step | needed for `prisma migrate deploy` on the server | migration-time | no |
| `apps/worker/package.json` | worker build/runtime | worker scripts and dependencies | build-time | no |
| `apps/worker/{tsconfig.json,types/**}` | worker build | TS worker build config and declarations | build-time | yes |
| `apps/worker/src/**` | worker | BullMQ worker, Redis, Prisma, S3, ffmpeg/ffprobe, temp-file handling | build-time, worker-only | yes |
| `packages/contracts/{package.json,tsconfig.json,src/**}` | web + worker build | workspace package actually imported by both apps (`@acme/contracts`) | build-time | yes |

### Required operating-system/runtime dependencies not stored in the repo

These are not files to upload, but they are required by the code:

- Node.js compatible with the app. `apps/web/package.json` declares `node >=18.17.0`.
- pnpm 9.x. Root `package.json` pins `packageManager: "pnpm@9.12.0"`.
- PostgreSQL
- Redis
- S3-compatible object storage or AWS S3
- `ffmpeg`
- `ffprobe`

### Files that are required only because of current implementation details

- `apps/web/public/uploads/`
  - not required as code
  - required as a **writable runtime location** if you keep the current local image-upload implementation in `apps/web/lib/media/storage.ts`
  - deploy the directory empty or let the app create it; do **not** copy local contents from development

## 3. Conditionally required files

### If using the recommended local-server build on Ubuntu

Required:

- everything listed in section 2

Not required:

- local `.next` output
- local `node_modules`
- local `dist/` output

### If trying to use Next.js standalone output

Current repo status:

- **not supported as-is**
- `apps/web/next.config.mjs` does not enable standalone output
- `apps/web/.next/standalone` is absent
- `apps/web/.next/required-server-files.json` is absent

If you later change the repo to a real standalone deployment, the runtime bundle would shift to:

- `apps/web/.next/standalone/**`
- `apps/web/.next/static/**`
- `apps/web/public/**`

But that is **not** what the current repository produces. The existing `.next/server/app/(standalone)` path is only the compiled output for the route-group folder `app/(standalone)`, not a deployable standalone server bundle.

### If using Docker or Docker Compose

Current repo status:

- no production Dockerfile
- no production Compose file
- only `infra/docker-compose.dev.yml`

Conditionally useful only as references:

- `infra/docker-compose.dev.yml`
- `infra/minio/cors.json`
- `infra/minio/README.md`

These are **development aids**, not a production deployment definition.

### If PostgreSQL runs on the same server

Conditionally required:

- `apps/web/prisma/schema.prisma`
- `apps/web/prisma/migrations/**` if you will run `prisma migrate deploy`

Not stored in repo and must live outside the deploy bundle:

- PostgreSQL data directory
- database dumps/backups

### If Redis runs on the same server

No repo files are required beyond the app source itself. The code only needs:

- `REDIS_URL`

Redis data/storage should live outside the repo.

### If S3-compatible storage is self-hosted on the same server

Conditionally useful:

- `infra/minio/cors.json`
- `infra/minio/README.md`

Not present and should not be stored in the repo:

- MinIO object data directories/volumes

### If the media-transcoding worker is deployed

Required:

- `apps/worker/**`
- `packages/contracts/**`
- `apps/web/prisma/schema.prisma`
- `ffmpeg` and `ffprobe` available on Ubuntu or addressed by `FFMPEG_PATH` / `FFPROBE_PATH`
- Redis
- S3-compatible storage credentials/config

### If Prisma migrations are run during deployment

Required:

- `apps/web/prisma/schema.prisma`
- `apps/web/prisma/migrations/**`
- installed Prisma CLI from dependencies

Recommended because of `.npmrc`:

- run explicit Prisma generation after install

Not required after the database is already migrated:

- migration files at steady-state runtime

### If seed execution is part of first-time environment bootstrap

Required only for that step:

- `apps/web/prisma/seed.ts`

Not required for normal production runtime:

- seed file
- seed-only demo content in the database

## 4. Files and folders that should not be uploaded

| Path or glob | Reason it is unnecessary or unsafe | Safe to delete from a temporary deployment copy | Must remain in the main repository |
| --- | --- | --- | --- |
| `node_modules/`, `apps/*/node_modules/`, `packages/*/node_modules/` | Local pnpm install state, symlinks, cache layout, and generated artifacts are machine-specific. Reinstall on Ubuntu instead. | yes | no |
| `apps/web/.next/cache/**` | Pure local build cache (`swc`, webpack, image cache, fetch cache). | yes | no |
| `apps/web/.next/**` | Current checked-in Next output is a local development build, not a production artifact. It contains `static/development/**` and hot-update files. | yes | no |
| `apps/web/.next/standalone/**` | Not present. Do not confuse `.next/server/app/(standalone)` with standalone deployment output. | yes | no |
| `.turbo/**` | Turbo cache. Not present now, but should never be shipped. | yes | no |
| `coverage/**` | Coverage reports. Not present now. | yes | no |
| `test-results/**` | Test runner output. Not present now. | yes | no |
| `playwright-report/**` | Browser-test report output. Not present now. | yes | no |
| `dist/**` | Generic build output. Currently absent. Exclude stale copies from source-based deployments. | yes | yes |
| `build/**` | Generic build output. Currently absent. | yes | yes |
| `out/**` | Static export output. Currently absent, and the repo is not configured for `next export`. | yes | yes |
| `.git/**` | Git metadata, including logs and object database. Not needed on the app server. | yes | yes |
| `.github/**` | CI-only metadata. Not present now. | yes | yes |
| `.vscode/**` | Editor-local settings. Not present now. | yes | yes |
| `.idea/**` | Editor-local settings. Not present now. | yes | yes |
| `**/.DS_Store` | macOS metadata junk. Present in multiple directories. | yes | no |
| `logs/**` | Runtime/application logs should not be copied from development. No app logs directory is currently tracked. | yes | no |
| `apps/web/public/uploads/**` | Local user-generated/profile-upload media. Current code may write here at runtime, but existing contents should not be shipped from development. | yes | no |
| `apps/web/apps/web/public/uploads/**` | Nested duplicate local upload tree; not used by the intended runtime path and should not be shipped. | yes | no |
| `infra/minio/**` | Dev/self-hosting reference material only. Not required for external S3 and not sufficient as a production MinIO deployment. | yes | yes |
| `deploy-cpanel/**` | Not present; `.gitignore` shows it as an old deployment path. Not part of current workspace. | yes | no |
| `*.zip`, `*.tar`, `*.tgz`, `*.gz`, `*.7z`, `AWSCLIV2.pkg` | Old archives/installers are unrelated to app runtime. `AWSCLIV2.pkg` is a macOS installer package. | yes | no |
| `*.sql`, `*.dump`, `*.sqlite`, `*.db` | Database dumps/backups must never ride with application code. None are present now. | yes | no |
| `docs/**`, `apps/web/docs/**`, `README.md` | Documentation/runbooks only. Helpful for maintainers, not required on the server. | yes | yes |
| `apps/web/app/__tests__/**`, `apps/web/lib/**/__tests__/**`, `apps/web/test/**` | Tests, mocks, and fixtures are not required to build or run production. | yes | yes |
| `apps/web/reports/**`, `apps/reports/**`, `reports/**`, `chromewebdata_*.report.html`, `localhost_*.report.html` | QA/Lighthouse/perf output only. | yes | no |
| `apps/web/public/static/bootstrap/css/*.map` | CSS source maps are devtools/debug artifacts only. Runtime uses the CSS files, not the maps. | yes | yes |
| `node_modules/@prisma/client/**`, `node_modules/.prisma/**` | Generated Prisma output should be regenerated on the Ubuntu server after install. | yes | no |
| `apps/web/prisma/_archive_pre_s6/**` | Archived historical Prisma migrations not used by the active migration chain. | yes | yes |
| `apps/web/prisma/migrations_backup_20251128_1754/**` | Historical backup migrations, not part of active deploy chain. | yes | yes |
| `apps/web/middleware.ts.bak` | Backup file, not loaded by Next.js. | yes | no |
| `packages/ui/**` | Not imported by current web/worker code. The web app uses `apps/web/vendor/ui` instead. | yes | yes |
| `persian-signup-form/**` | Unrelated stray directory; not part of the pnpm workspace. | yes | no |
| `.agents/**`, `skills-lock.json` | Codex/agent tooling, not application runtime. | yes | yes |
| `tools/**`, `eslint/**`, `eslint-local/**` | Dev/QA/lint tooling only. Not required for `pnpm build` or runtime. | yes | yes |
| `cnaghsh-next@`, `dotenv`, `tsx` | Zero-byte top-level leftovers; not part of the application. | yes | no |

### Explicit classification notes requested in the prompt

- **`node_modules`**: do not upload
- **`.next/cache`**: do not upload
- **`.next` standalone output**: not present; current repo does not produce it
- **`.next` non-standalone output**: present, but local/dev only; do not upload
- **`.turbo`**: not present; if present, do not upload
- **`coverage`**: not present; if present, do not upload
- **`test-results`**: not present; if present, do not upload
- **`playwright-report`**: not present; if present, do not upload
- **`dist` / `build` / `out`**: absent now; exclude stale copies unless you intentionally switch to a prebuilt deployment mode
- **`.git`**: do not upload
- **`.github`**: not present; not needed on server
- **`.vscode` / `.idea`**: not present; not needed on server
- **`.DS_Store`**: present; remove from any deployment copy
- **`logs`**: no app log dir tracked; never upload local logs
- **temporary media**: `apps/web/public/uploads/**` and nested duplicate upload trees should not be shipped from dev
- **local MinIO data**: not present in repo
- **`deploy-cpanel`**: not present in repo
- **old ZIP files**: not present, but `AWSCLIV2.pkg` is a local installer artifact and should not be uploaded
- **database dumps/backups**: none present; never upload if later created
- **documentation**: exclude from deployment
- **tests and fixtures**: exclude from deployment
- **source maps**: bootstrap CSS `.map` files are optional debug-only artifacts
- **Prisma generated output**: regenerate on server; do not upload from workstation

## 5. Files that must never be uploaded

Do not upload or commit the contents of any secret-bearing file. The audit found the following current paths/patterns:

- `apps/web/.env.local`
- any future repo-local `.env`, `.env.production`, `.env.development`, `.env.test`
- any future credential/key material such as `*.pem`, `*.key`, `*.crt`, `*.p12`
- any future database dumps/backups such as `*.sql`, `*.dump`, `*.sqlite`, `*.db`
- `apps/web/public/uploads/**`
- `apps/web/apps/web/public/uploads/**`

Notes:

- `apps/web/.env.example` and `apps/web/prisma/.env.example` are templates, not secret files.
- Existing upload folders likely contain local user/profile media and should be treated as private data unless you intentionally perform a separate media migration.
- No secret values are reproduced in this report.

## 6. Production environment-variable inventory

The table below lists variables actually referenced by source code, package configuration, or deployment/migration tooling in this repo.

### Core application and database

| Variable name | Used by which app | Required or optional | Purpose | Example format using placeholders only | Build-time, runtime, or both |
| --- | --- | --- | --- | --- | --- |
| `DATABASE_URL` | web + worker + Prisma deployment | required | PostgreSQL connection string for Prisma Client, runtime DB access, and migrations | `postgresql://USER:PASSWORD@DB_HOST:5432/DB_NAME?schema=public` | both |
| `SHADOW_DATABASE_URL` | Prisma deployment only | optional in production, required only for `prisma migrate dev` workflows | Shadow DB used by Prisma development migrations; not needed for normal production runtime or `migrate deploy` | `postgresql://USER:PASSWORD@DB_HOST:5432/DB_NAME_shadow?schema=public` | migration-time |
| `PUBLIC_BASE_URL` | web | required | canonical public origin used by `apps/web/lib/env.ts`, metadata, sitemap, URL builders, email fallbacks | `https://app.example.com` | both |
| `NEXT_PUBLIC_BASE_URL` | web | required for full client feature set | client-exposed public origin used by analytics/domain logic and client-side URL helpers | `https://app.example.com` | both |
| `BASE_URL` | web | optional | server-side URL fallback used by email/smoke scripts | `https://app.example.com` | runtime |
| `NEXTAUTH_URL` | web | optional but recommended | NextAuth/email/script origin fallback; README treats it as standard app config | `https://app.example.com` | runtime |
| `NEXTAUTH_SECRET` | web | required in production | NextAuth JWT/session secret; also fallback secret for notification-link signing | `LONG_RANDOM_SECRET` | runtime |

### Redis, queues, and worker behavior

| Variable name | Used by which app | Required or optional | Purpose | Example format using placeholders only | Build-time, runtime, or both |
| --- | --- | --- | --- | --- | --- |
| `REDIS_URL` | worker, web queue integration | required for worker; optional for web-only/demo mode | BullMQ queue backend and queue health/dispatch | `redis://REDIS_HOST:6379` | runtime |
| `MEDIA_TRANSCODE_CONCURRENCY` | worker | optional | worker parallelism; defaults to `2` | `4` | runtime |
| `MEDIA_TRANSCODE_BACKOFF_MS` | web + worker | optional | retry backoff for queued media jobs; defaults to `30000` | `30000` | runtime |
| `MEDIA_TRANSCODE_MAX_ATTEMPTS` | web + worker | optional | max retry attempts for media jobs; defaults to `5` | `5` | runtime |

### Object storage and CDN/media URLs

| Variable name | Used by which app | Required or optional | Purpose | Example format using placeholders only | Build-time, runtime, or both |
| --- | --- | --- | --- | --- | --- |
| `S3_ENDPOINT` | web + worker | optional if using AWS S3, required for MinIO/custom S3 | custom S3-compatible endpoint | `https://s3.example.com` | runtime |
| `S3_REGION` | web + worker | required | S3 region | `us-east-1` | runtime |
| `S3_ACCESS_KEY` | web + worker | required | S3 access key | `S3_ACCESS_KEY_PLACEHOLDER` | runtime |
| `S3_SECRET_KEY` | web + worker | required | S3 secret key | `S3_SECRET_KEY_PLACEHOLDER` | runtime |
| `S3_PUBLIC_BUCKET` | web + worker | required | bucket for public media/HLS/posters | `media-public` | runtime |
| `S3_PRIVATE_BUCKET` | web + worker | required | bucket for originals/private media | `media-private` | runtime |
| `S3_SIGNED_URL_TTL_SEC` | web | optional | signed URL TTL; defaults to `300` | `300` | runtime |
| `S3_FORCE_PATH_STYLE` | web + worker | optional | required by many MinIO/self-hosted setups | `true` | runtime |
| `MEDIA_PUBLIC_BASE_URL` | web | required unless `MEDIA_CDN_BASE_URL` is provided instead | public base URL used to construct browser-facing media URLs | `https://cdn.example.com/media` | runtime |
| `MEDIA_CDN_BASE_URL` | web | optional alias | fallback source for `MEDIA_PUBLIC_BASE_URL` | `https://cdn.example.com/media` | runtime |
| `MEDIA_ORIGIN_BASE_URL` | web | required | origin URL used by media URL logic | `https://origin-media.example.com/media` | runtime |
| `MEDIA_CDN_SIGNED` | web | optional | toggles signed CDN behavior (`0` or `1`) | `1` | runtime |

### Media upload/transcode tuning

| Variable name | Used by which app | Required or optional | Purpose | Example format using placeholders only | Build-time, runtime, or both |
| --- | --- | --- | --- | --- | --- |
| `UPLOAD_ALLOWED_TYPES` | web | required | allowed MIME types for uploads | `image/png,image/jpeg,image/webp` | runtime |
| `UPLOAD_MAX_SIZE_MB_DEV` | web | required | max upload size used outside production | `50` | runtime |
| `UPLOAD_MAX_SIZE_MB_PROD` | web | required | max upload size used in production | `50` | runtime |
| `UPLOAD_MAX_DURATION_SEC` | web | required | media duration limit | `180` | runtime |
| `UPLOAD_DAILY_USER_CAP_GB` | web | required | per-user daily upload quota | `2` | runtime |
| `UPLOAD_RATE_LIMIT_PER_MIN` | web | required | request rate limit baseline | `30` | runtime |
| `UPLOAD_RATE_LIMIT_BURST` | web | required | burst allowance | `10` | runtime |
| `COURSE_INTRO_VIDEO_MAX_MB` | web | optional | max size for admin course intro-video upload; default is 600 MB | `600` | runtime |
| `FFMPEG_PATH` | worker | optional if `ffmpeg` is on PATH | ffmpeg executable path | `/usr/bin/ffmpeg` | runtime |
| `FFPROBE_PATH` | worker | optional if `ffprobe` is on PATH | ffprobe executable path | `/usr/bin/ffprobe` | runtime |
| `HLS_SEGMENT_DURATION_SEC` | worker | optional | HLS segment duration; default `6` | `6` | runtime |
| `HLS_PLAYLIST_NAME` | worker | optional | top-level HLS manifest filename | `index.m3u8` | runtime |
| `HLS_VARIANTS` | worker | optional | JSON array describing HLS renditions | `[{"name":"720p","width":1280,"height":720,"videoBitrateKbps":2500,"audioBitrateKbps":128}]` | runtime |
| `HLS_POSTER_TIME_FRACTION` | worker | optional | fraction of duration used to grab poster frame | `0.5` | runtime |
| `HLS_SEGMENT_MAX_AGE_SEC` | web | optional | cache TTL for HLS segments | `31536000` | runtime |
| `HLS_MANIFEST_MAX_AGE_SEC` | web | optional | cache TTL for HLS manifests | `120` | runtime |
| `POSTER_MAX_AGE_SEC` | web | optional | cache TTL for poster images | `31536000` | runtime |

### Email and notifications

| Variable name | Used by which app | Required or optional | Purpose | Example format using placeholders only | Build-time, runtime, or both |
| --- | --- | --- | --- | --- | --- |
| `SMTP_HOST` | web | required if sending email | SMTP relay host | `smtp.example.com` | runtime |
| `SMTP_PORT` | web | required if sending email | SMTP port | `587` | runtime |
| `SMTP_USER` | web | optional | SMTP auth username if relay requires auth | `smtp-user` | runtime |
| `SMTP_PASS` | web | optional | SMTP auth password if relay requires auth | `smtp-password` | runtime |
| `MAIL_FROM` | web | required if sending email | From header for notification mail | `App Name <no-reply@example.com>` | runtime |
| `NOTIFICATIONS_SECRET` | web | optional if `NEXTAUTH_SECRET` is acceptable fallback | HMAC secret for notification-management links | `LONG_RANDOM_SECRET` | runtime |
| `NOTIFICATIONS_DELIVERY_MODE` | web | optional | queue processing mode; defaults to `inline` | `worker` | runtime |
| `NOTIFICATIONS_INTERNAL_EMAIL` | web | optional | fallback internal recipient used in some notification events | `ops@example.com` | runtime |
| `NOTIFICATIONS_SUPPORT_EMAIL` | web | optional | support link used in webhook/email messaging | `mailto:support@example.com` | runtime |
| `NOTIFICATIONS_REMINDERS_ENABLED` | web | optional | toggles reminder generation in cron endpoint; defaults enabled | `0` | runtime |

### Billing, webhooks, admin, cron

| Variable name | Used by which app | Required or optional | Purpose | Example format using placeholders only | Build-time, runtime, or both |
| --- | --- | --- | --- | --- | --- |
| `WEBHOOK_SHARED_SECRET` | web | optional but strongly recommended in production | shared webhook-signature secret used when provider-specific secret is absent | `LONG_RANDOM_SECRET` | runtime |
| `ZARINPAL_WEBHOOK_SECRET` | web | optional | provider-specific webhook secret override | `LONG_RANDOM_SECRET` | runtime |
| `IDPAY_WEBHOOK_SECRET` | web | optional | provider-specific webhook secret override | `LONG_RANDOM_SECRET` | runtime |
| `NEXTPAY_WEBHOOK_SECRET` | web | optional | provider-specific webhook secret override | `LONG_RANDOM_SECRET` | runtime |
| `WEBHOOK_TEST_SECRET` | web | optional | admin simulator endpoint guard (`/api/admin/billing/test-webhook`) | `LONG_RANDOM_SECRET` | runtime |
| `NEXT_PUBLIC_WEBHOOK_SHARED_SECRET` | web | optional | client-exposed hint for sandbox webhook simulator UX only | `LONG_RANDOM_SECRET` | runtime |
| `CRON_SECRET` | web | required if internal cron routes are used | protects `/api/internal/cron/*` endpoints | `LONG_RANDOM_SECRET` | runtime |
| `ADMIN_EMAILS` | web | optional | extra admin authorization by email in addition to DB role | `admin1@example.com,admin2@example.com` | runtime |
| `ADMIN_MEDIA_METRICS_SECRET` | web | optional | bypass secret for admin media metrics endpoint | `LONG_RANDOM_SECRET` | runtime |

### Observability, analytics, flags, and diagnostics

| Variable name | Used by which app | Required or optional | Purpose | Example format using placeholders only | Build-time, runtime, or both |
| --- | --- | --- | --- | --- | --- |
| `SENTRY_DSN` | web + worker | optional | server-side Sentry DSN | `https://PUBLIC_KEY@o0.ingest.sentry.io/PROJECT_ID` | runtime |
| `NEXT_PUBLIC_SENTRY_DSN` | web | optional | client-side Sentry DSN | `https://PUBLIC_KEY@o0.ingest.sentry.io/PROJECT_ID` | runtime |
| `SENTRY_ENVIRONMENT` | web + worker | optional | Sentry environment label | `production` | runtime |
| `ANALYTICS_DISABLED` | web | optional | disables analytics even if feature flag is on | `1` | runtime |
| `NEXT_PUBLIC_ENV` | web | optional | environment label used by metadata logic; `staging` disables indexing | `production` | both |
| `NEXT_PUBLIC_FLAGS` | web | optional | client-visible feature flags | `analytics,canary` | both |
| `FLAGS` | web | optional | server/runtime feature flags merged with public flags | `sentry,canary` | runtime |
| `PRISMA_SLOW_LOG` | web | optional | enables Prisma slow-query logging | `1` | runtime |
| `ORCH_BYPASS_CACHE` | web | optional | bypasses Next cache in orchestrator search logic | `1` | runtime |
| `GIT_COMMIT_SHA` | web | optional | version string exposed by health endpoint | `abcdef123456` | runtime |
| `NEXT_PUBLIC_APP_VERSION` | web | optional | version string fallback for health endpoint/UI | `2026.07.11` | both |

### Variables found in code that are not production requirements

These are real references, but they are build/test/script/platform helpers rather than core production requirements:

- `NEXT_PUBLIC_APP_URL`
- `VERCEL_URL`
- `VERCEL_GIT_COMMIT_SHA`
- `NEXT_PUBLIC_DEBUG_SLOT`
- `MEDIA_ID`
- `UPLOAD_SMOKE_EMAIL`
- `UPLOAD_SMOKE_PASSWORD`

### Payment gateway credential note

The current source tree references **webhook secrets** for payment providers, but I did **not** find separate payment-gateway merchant IDs, API keys, or SDK secrets in the application source. If those are needed in the real production environment, they are not currently represented as first-class env variables in this repo.

### Deployment note triggered by `.npmrc`

Because `.npmrc` sets `ignore-scripts=true`, do not assume install-time generation happens automatically. Plan for an explicit deployment sequence such as:

1. `pnpm install --frozen-lockfile`
2. `pnpm --filter @app/web prisma generate`
3. `pnpm --filter @app/web exec prisma migrate deploy` if you are applying migrations
4. `pnpm build`

Then run the two services separately:

- web: `pnpm --filter @app/web start`
- worker: `pnpm --filter @app/worker start`
