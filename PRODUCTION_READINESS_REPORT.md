# SerpBear Production Readiness Report

**Date:** 2026-10-14 (Asia/Jakarta)  
**Application:** Official SerpBear v3.1.0  
**Current status:** `PRODUCTION_READY`

## Summary

The Ranking History patch and test-environment fixes are in the project. The focused regression suite, full Jest suite, standalone TypeScript check, Next.js production build, and repository Docker image build pass. The new image is `serpbear-ranking-history-final:20261014` (`sha256:9b6386566303ce0ca1036cd560849de5d8ad72fe492331edf44cccdf74a8d39b`).

The final image was started only in the approved disposable Compose project, passed health and isolated runtime checks, and was then cleaned up. Production has not been changed.

## Source and packaging changes

- `utils/refresh.ts`: append the dated history value only when the refresh result has no error. Existing position, prior observations, error reporting, timestamps, and retry behavior remain as before.
- `Dockerfile`: dependency stages now copy both package manifests and use `npm ci`; the runner gets the exact production dependency tree from a separate `npm ci --omit=dev` stage. The runner no longer deletes the standalone package manifest or runs an unpinned `npm install` that pruned traced packages such as `@babel/runtime`.
- `package.json` and `package-lock.json`: move the existing `sequelize-cli` 6.6.5 dependency from development to production dependencies because `entrypoint.sh` invokes it during application startup. No package version was upgraded.
- `.dockerignore`: exclude `.env` and `.env.*` from build context while allowing `.env.example`.
- Test setup: add `TextEncoder` and `TextDecoder` from Node’s `util` module before tests load; add the missing `useUpdateSettings` mock; provide the required `maxTitleColumnWidth` fixture value. The domain page test now uses mixed synthetic countries so its country-filter assertion checks actual filtering. The hook test uses a local React Query wrapper instead of importing an unused helper that eagerly loads MSW’s Jest-incompatible ESM dependency.

The packaging root cause was the combination of an install stage that ignored `package-lock.json` and a runner stage that recreated `package.json` then installed packages without a lockfile. That final npm install reconciled and pruned the standalone module tree, removing `@babel/runtime` required by the Next.js server.

## Validation results

| Validation | Result | Evidence |
|---|---|---|
| Ranking History regression | **PASS — 5/5** | Failed scrape preserves history; successful not-found records `0`; successful rank records a positive position; repeated failures preserve history; error and retry behavior remain covered. |
| Full Jest suite | **PASS — 11/11 suites, 45/45 tests** | `npm run test:ci -- --runInBand`. One existing React `act(...)` console warning appears in the domain page suite; it does not fail a test. |
| Standalone TypeScript | **PASS** | `./node_modules/.bin/tsc --noEmit`, exit code 0. |
| Next.js production build | **PASS** | `npm run build`, exit code 0. Non-blocking Browserslist and Tailwind configuration warnings remain. |
| Docker image build | **PASS** | `docker build --pull=false -t serpbear-ranking-history-final:20261014 .`, using the maintained repository Dockerfile. The builder ran `npm ci`; runtime dependencies ran `npm ci --omit=dev`. |
| Final image starts and becomes healthy | **PASS** | Approved disposable container reported `running healthy` on the final image ID. |
| Final image login and Keyword CRUD | **PASS** | Synthetic login; `example.com` and keyword create; sticky update; keyword deletion; domain cleanup. |
| Final image failed-refresh behavior and SQLite integrity | **PASS** | No-provider refresh recorded an error, preserved position `0` and empty history, left the retry queue empty; SQLite integrity was `ok` and synthetic rows were absent after cleanup. |
| No external SERP request possible | **PASS** | Docker network was `internal: true`, the container had no default route, and no scraper/provider credentials were configured. |

npm printed audit advisories during Docker dependency installation (44 for the production graph and 87 for the build graph). No dependency upgrades or audit remediation were made as part of this focused task.

## Image details

- Tag: `serpbear-ranking-history-final:20261014`
- Image ID: `sha256:9b6386566303ce0ca1036cd560849de5d8ad72fe492331edf44cccdf74a8d39b`
- Dockerfile base resolved during build: `node:22-alpine@sha256:0a7108bf6c7bf5de370ffb1a3ed6be93d405b43ff159f681a8d18c0e2bc2e402`
- Database migration required by the patch: **No**. The patch changes only refresh-history logic. The existing startup migration command remains in place.

## Isolated runtime UAT

**Result: PASS.** The approved final-image Compose project used only the candidate image, dedicated volume `serpbear-ranking-history-final-uat-data`, dedicated `internal: true` network `serpbear-ranking-history-final-uat-no-egress`, and loopback port `127.0.0.1:3199`. Synthetic credentials were read from the existing mode-600 file `/tmp/serpbear-ranking-history-uat.env`; values are not included here. Provider, proxy, Ads, and Search Console credentials were not configured. The container ran as the non-root `nextjs` user and became healthy on the exact final image ID.

The test script `/tmp/serpbear-ranking-history-final-uat.cjs` ran inside the app container. Authentication passed. It verified disabled providers, retries off, and an empty failed queue; created `example.com` and `serpbear uat test keyword`; waited for the expected no-provider refresh failure; and confirmed the error was recorded while position stayed `0`, history stayed `{}`, and `updating` returned to false. Sticky update persisted. Keyword deletion and synthetic domain cleanup passed. Final database checks returned SQLite `integrity_check = ok` and zero rows in both `domain` and `keyword` tables. The retry queue remained empty.

The network inspection showed `Internal=true`; `/proc/net/route` contained only the connected interface route and no default route. The container had no scraper/provider credential variables. Therefore no external SERP request could leave this UAT container.

Logs contained the expected failed refresh (`Failed to parse URL from` with no scraper configured). Fresh-volume startup also printed Sequelize migration diagnostics because the migration scripts attempted to describe `keyword` and `domain` tables before the first API request created them; despite these messages, migrations completed, the app became healthy, and CRUD passed. No credential values were observed in the report, test output, or inspected logs.

After testing, `docker compose down --volumes` removed only the UAT container, its named volume, and its named network. Follow-up inspection confirmed all three are absent. Production and unrelated Docker services remained running and unchanged.

The Compose file and synthetic test script remain at the `/tmp` paths above for review; no test container is running.

## Production state

Read-only inspection after the image build showed `serpbear-official-app` still healthy on the original pinned image `towfiqi/serpbear:3.1.0@sha256:31bc71dc02a7d4efe4170e76eefac8be06077fb03d8d215919b602032dde3c38`. The currently running unrelated Docker services were also still running. No production container, database volume, setting, Cloudflare configuration, or other Docker service was changed. The final candidate image is local and has not been deployed.

## Production deployment plan (not executed)

1. Confirm final-image runtime UAT passes and clean its dedicated resources.
2. Record the current production image ID, health, settings, domain/keyword row counts, failed queue, and logs. Keep SERP providers disabled.
3. Create and verify a consistent SQLite backup before changing the Compose image. The database path is `/app/data/database.sqlite`; use SQLite’s backup API while the application is running, then copy and checksum the backup:

   ```sh
   install -d -m 700 /var/backups/serpbear
   docker exec serpbear-official-app node -e 'const sqlite3=require("sqlite3").verbose(); const db=new sqlite3.Database("/app/data/database.sqlite"); db.backup("/tmp/serpbear-predeploy.sqlite", (err) => { if (err) { console.error(err.message); process.exitCode = 1; } db.close(); });'
   docker cp serpbear-official-app:/tmp/serpbear-predeploy.sqlite /var/backups/serpbear/serpbear-predeploy-YYYYMMDDTHHMMSSZ.sqlite
   sha256sum /var/backups/serpbear/serpbear-predeploy-YYYYMMDDTHHMMSSZ.sqlite
   ```

   Replace the timestamp placeholder with a unique UTC timestamp. Keep the backup protected and verify it with `PRAGMA integrity_check` before deployment.
4. After separate deployment approval, change only the SerpBear app image reference in the production Compose file to `serpbear-ranking-history-final:20261014`, then recreate only the SerpBear app service. Keep its existing production volume, port, environment, Cloudflare Tunnel, and Access policies unchanged.
5. Run the post-deployment checks below. Do not enable scraping providers as part of this deployment.

## Rollback procedure (not executed)

If startup, health, authentication, settings, or read-only integrity checks fail, restore the original production Compose image reference:

```text
towfiqi/serpbear:3.1.0@sha256:31bc71dc02a7d4efe4170e76eefac8be06077fb03d8d215919b602032dde3c38
```

Then recreate only the SerpBear app service with the existing production volume. No schema change is introduced by this patch, so image rollback should not require a database restore. Restore the verified SQLite backup only if an independent data-integrity issue requires it, after stopping the app and confirming the target volume and backup path.

## Post-deployment verification checklist

- Confirm `serpbear-official-app` reports the candidate image ID and healthy status.
- Confirm `/login` loads, SerpBear authentication succeeds, and dashboard/domain navigation works through the existing Cloudflare Access route.
- Confirm current settings match the pre-deployment snapshot: no provider credentials, scraping remains disabled, retry remains disabled, and failed queue is empty.
- Run a read-only SQLite `PRAGMA integrity_check`; compare domain and keyword row counts with the pre-deployment snapshot.
- Review application logs for startup, database, and unexpected runtime errors; redact credentials and cookies.
- Confirm Cloudflare Access and the unrelated Docker services remain unchanged.

## Blocker and next action

**Status: `PRODUCTION_READY`.** All requested regression, test, type, build, image, and isolated runtime checks pass. The observed Sequelize diagnostics during fresh-volume bootstrap did not prevent healthy startup or runtime checks. Production deployment remains unperformed and requires separate operator authorization.
