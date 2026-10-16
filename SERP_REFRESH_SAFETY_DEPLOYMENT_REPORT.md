# SerpBear Refresh Safety Production Deployment Report

**Final Status: `SERP_REFRESH_SAFETY_DEPLOYMENT_SUCCESS`**

Deployment: 2026-10-14 12:26:34 UTC. No live Serper.dev or Google request was made.

## Preflight

| Check | Result |
|---|---|
| Pre-deployment production container | PASS — `serpbear-official-app` was running and healthy. |
| Original image | `sha256:5075a0d44ecd5a698e71727271e8100cb18aed087243d410c026137214e7d955` (`serpbear-serper-adapter-candidate:20261014`); retained for rollback. |
| Candidate image | PASS — `serpbear-refresh-safety-candidate:20261014-v2`, exact image ID `sha256:6c8eca5d61b6ffbee30501e632c9a87ee11d8f6a47c511c13f77557f0a19e675`. |
| Candidate source | PASS — commit `53a349f15f6e0e569d9a5d9765f3c9651ec9e008`; isolated candidate worktree clean; v2 changes only `Dockerfile` relative to the v1 safety candidate. |
| Persistent volume and binding | PASS — `serpbear-official-data:/app/data`; app port remains bound to `127.0.0.1:3180`; restart policy is `unless-stopped`. |
| SQLite and existing data | PASS — `PRAGMA integrity_check=ok`; 1 domain, 1 keyword, and 1 stored Ranking History observation. No refresh was active (`updating=0`). |
| Provider and schedule | PASS — Serper is configured and its key is encrypted at rest; strategy is Basic; schedule is Never; retry is disabled; failed queue is empty. The key was not printed or copied into this report. |
| Cloudflare Access preflight | PASS — unauthenticated GETs to `/`, `/login`, `/api/domains`, and `/api/settings` each returned HTTP 302 to the Cloudflare Access flow. No session was used and no policy was changed. |

### Checkout preservation

The project checkout was not clean before deployment: it contained modified source/dependency/test files and multiple untracked reports and configuration files, including `compose.official.yml`. Those existing changes were preserved. The pre-deployment Compose SHA-256 was `13f15553c3d6f8e45dbaa24f911367aa1f08f1b970a3d28b19692fc16b8dfbc3`; a mode-600 exact copy is preserved at `/tmp/serpbear-refresh-safety-compose-predeploy-20261014T1218Z.yml` with the same hash. Deployment changed only `services.app.image` in place. No candidate source was copied into the checkout, and no reset/clean/checkout operation was run.

The active Compose image reference now names `serpbear-refresh-safety-candidate:20261014-v2`; volume, environment, network, port, restart policy, tunnel, and other services were preserved.

## SQLite backup

- Backup: `/var/backups/serpbear/serpbear-refresh-safety-predeploy-20261014T121800Z.sqlite`
- Created from the live SQLite connection using node-sqlite3's SQLite Online Backup API; the production database was opened read-only.
- SHA-256: `7fc95efd8706bfc66a85280c2c0e70c5aceaf67e6e95b0329116c18a41d162f4`
- Permissions and ownership: mode `600`, UID/GID `1000:1000`; size 40,960 bytes. Parent directory is mode `700`, UID/GID `1000:1000`.
- Backup `PRAGMA integrity_check`: `ok`.
- Backup contains 1 domain, 1 keyword, and 1 history observation. Domain and keyword row digests match the preflight snapshot.
- Existing backups were retained. The current production image remains available for rollback.

Settings are stored separately from SQLite in the persistent data volume. Their preflight state was recorded without exposing values: Serper configured/encrypted, `scrape_interval=never`, `scrape_retry=false`, Basic strategy, empty failed queue. The migration rehearsal did not mount or alter production settings.

## Isolated migration rehearsal

The verified backup was copied to a mode-600 disposable file under `/tmp` and migrated with the exact candidate image. The migration container used `--network none`, synthetic database environment values, and ran only `sequelize-cli db:migrate`; it did not start the app or cron and could not reach a provider. The live production database and volume were not mounted.

| Rehearsal check | Result |
|---|---|
| Duplicate keyword identity preflight | PASS — 0 duplicate identities; migration completed. |
| `refresh_audit` | PASS — table created with the expected 14 audit metadata columns and indexes; 0 rows after migration. |
| `refresh_lock` | PASS — table created with the expected 5 lock columns; 0 rows after migration. |
| Unique identity index | PASS — `keyword_identity_unique` exists. |
| Existing data and history | PASS — domain and keyword row digests matched the backup; counts remained 1/1 and the 1 history observation remained intact. |
| SQLite integrity | PASS — `PRAGMA integrity_check=ok` after migration and after the repeat invocation. |
| Repeat invocation | PASS — second `db:migrate` reported no migrations to execute because the migration was recorded in `SequelizeMeta`. |
| Scraping | PASS — migration-only command, network disabled; no provider request or setting change. |

The migration runs in a Sequelize transaction. The supported repeat-safe operation is the `sequelize-cli db:migrate` command, which consults `SequelizeMeta`; the migration's raw `up` body is not intended to be invoked manually a second time outside that runner.

The temporary rehearsal database and temporary backup files in the production container's `/tmp` were removed after verification. The verified backup under `/var/backups/serpbear` remains. During the rehearsal, no production container, SQLite volume, application setting, Cloudflare configuration, or unrelated Docker service was changed; the separately approved app deployment and migration are recorded below.

## Deployment and post-deployment verification

Operator approval `DEPLOY_SERP_REFRESH_SAFETY_APPROVED` was received. At 2026-10-14 12:26:34 UTC, only the `app` service was recreated with `docker compose -f compose.official.yml up -d --no-deps --wait app`. The Compose edit changed only `services.app.image` to `serpbear-refresh-safety-candidate:20261014-v2`. No other service was recreated or modified.

| Post-deployment check | Result |
|---|---|
| Running image and health | PASS — `serpbear-official-app` is healthy on exact image ID `sha256:6c8eca5d61b6ffbee30501e632c9a87ee11d8f6a47c511c13f77557f0a19e675`; restart policy remains `unless-stopped`. |
| Persistent storage and port | PASS — existing `serpbear-official-data:/app/data` volume retained; app remains bound to `127.0.0.1:3180`. |
| Application and cron processes | PASS — one Next.js server and one `cron.js` process are running. |
| SQLite and data preservation | PASS — integrity check `ok`; counts remain 1 domain, 1 keyword, and 1 Ranking History observation. Domain and keyword digests match the pre-deployment snapshot; keyword is not updating. |
| Production migration | PASS — `refresh_audit` (14 expected columns), `refresh_lock` (5 expected columns), and `keyword_identity_unique` exist. No active refresh locks, audit rows, or cron audit rows. |
| Settings and queue | PASS — Serper remains configured/encrypted, strategy Basic, schedule Never, retry disabled, failed queue empty. No setting was changed. |
| Local application routes | PASS — `/login`, `/`, `/domains`, and the existing domain page returned HTTP 200. Unauthenticated `/api/domains`, `/api/settings`, and `/api/keywords` returned HTTP 401 at the local origin. |
| Cloudflare Access after deployment | PASS — unauthenticated requests to `/`, `/login`, `/api/domains`, `/api/settings`, and `/api/keywords` returned HTTP 302 to the Access flow. No policy was changed. |
| Recent log scan and provider activity | PASS — a 15-minute sanitized scan found the configured provider credential absent from logs and zero logged Serper endpoint lines. Refresh and cron audit tables also contain zero rows. No refresh was initiated as part of deployment. |
| External SERP activity | PASS — no Serper.dev or Google request was initiated by this deployment or its verification. |
| Authorized browser UI | PASS — operator confirmed Cloudflare Access, SerpBear Login, Dashboard, Domain Management, and Keyword Management all work normally. No keyword was created and no refresh was run. |

The candidate entrypoint ran `sequelize-cli db:migrate --env production` against the preserved production SQLite volume, then started the Next.js server and cron process. The migration matches the isolated rehearsal described above. Cloudflare Tunnel and Zero Trust configuration were not changed. No unrelated Docker service was touched.

The verified v2 UAT passed the app and cron startup/restart checks, Never schedule behavior, migration, audit, locking, duplicate protection, request budget, Ranking History, HTTP 429 handling, and SQLite persistence. With the production schedule still Never and retries disabled, deployment is not expected to initiate provider work. No manual refresh or live SERP request is part of this deployment.

## Rollback plan

If a critical post-deployment check fails, stop further validation, restore only `services.app.image` to `serpbear-serper-adapter-candidate:20261014`, and recreate only service `app` using `--no-deps`. Preserve `serpbear-official-data` and all settings. Do not restore the SQLite backup automatically and do not drop the new tables or index without a separate reviewed recovery decision. The previous app can ignore the new tables; the unique index remains and may continue to reject duplicate keyword identities.

After rollback, verify the old image is healthy and SQLite integrity is `ok`. Report any partial migration state. Do not delete either the pre-deployment backup or the old image.

## Remaining security risk

Production remains on Next.js 12.3.7. Existing Phase 1 findings classify Next.js advisories as critical; the separate Phase 2 report remains `SECURITY_RELEASE_WAITING_UPSTREAM`. This refresh-safety deployment does not upgrade Next.js or resolve those advisories. Prior audit findings also include remaining high vulnerabilities. Do not describe the dependency tree as fully remediated.

## Final status

`SERP_REFRESH_SAFETY_DEPLOYMENT_SUCCESS` — deployment, SQLite migration, server-side verification, and authorized browser verification passed. The production image is `sha256:6c8eca5d61b6ffbee30501e632c9a87ee11d8f6a47c511c13f77557f0a19e675`. The Refresh Audit and Single-Flight Lock migrations, Ranking Position Fix, and Request Budget Guard are installed. Existing domain, keyword, and Ranking History data remain intact. Schedule remains Never, retry remains disabled, and no live SERP request occurred during deployment. Cloudflare Access and all operator-verified application pages work normally. The verified production backup and previous image remain available for rollback. Next.js 12.3.7 remains an unresolved residual security risk; this deployment did not address it.

No keyword was created and no refresh was run during the authorized browser verification. No live Serper.dev request or automatic monitoring was enabled.
