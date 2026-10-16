# SerpBear Refresh Safety & Ranking Accuracy Fix

**Status: `SERP_REFRESH_SAFETY_READY`**  
The v2 packaging correction passed offline validation and the approved isolated Runtime UAT. Production has not been changed; deployment, production database migration, and live SERP requests remain outside this verification.

## Initial candidate (v1)

- Baseline: deployed source commit `cf6d4f8818962869aa1a751897a84ed45e22d491`.
- Isolated branch: `refresh-safety-audit-ranking-20261014` in `/tmp/serpbear-refresh-safety`.
- Candidate commit: `35843e2cf9f22bd0546f8c911eba25a42fea72ba`.
- Docker tag: `serpbear-refresh-safety-candidate:20261014`.
- Docker image ID: `sha256:d20d48b1e1cda9fb6969e0724d8db3071818a1c96a6a6c4cdced20a3602a58c5`.
- `package.json` and `package-lock.json` are unchanged. Ranking History, Phase 1 dependency fixes, the deployed Serper adapter, and tar/node-gyp runtime pruning remain in the candidate baseline.
- The production checkout, production container, database, Cloudflare configuration, and other Docker services were not changed. UAT-only containers, network, and volume were removed after testing.

## Corrected candidate (v2)

- Parent source commit: `35843e2cf9f22bd0546f8c911eba25a42fea72ba`.
- New isolated source commit: `53a349f15f6e0e569d9a5d9765f3c9651ec9e008` (`fix(docker): include cron policy helper in runtime`).
- Changed files: `Dockerfile` only; `package.json`, `package-lock.json`, application logic, and database migrations are unchanged.
- New image tag: `serpbear-refresh-safety-candidate:20261014-v2`.
- New Docker image ID: `sha256:6c8eca5d61b6ffbee30501e632c9a87ee11d8f6a47c511c13f77557f0a19e675`.
- The v1 image remains tagged `serpbear-refresh-safety-candidate:20261014` with its original ID `sha256:d20d48b1e1cda9fb6969e0724d8db3071818a1c96a6a6c4cdced20a3602a58c5`.
- The final image still runs as non-root user `nextjs`, keeps the existing entrypoint and command, and retains the runtime dependency pruning. Inspection of the final image layers found `cron.js` and `utils/cronPolicy.js` with mode `0664` and owner UID/GID `1001:1001`; Node resolved and loaded the extracted `cronPolicy` module. The helper has no runtime imports. `tar` and `node-gyp` package manifests were absent from the application's runtime dependency paths.

## Changes

### Refresh audit

The migration `1760400000000-add-refresh-safety-audit-and-locks.js` adds separate `refresh_audit` and `refresh_lock` tables and a unique keyword identity index. Audit rows record refresh ID, keyword ID, trigger, actor category, timestamps, status, requested pages, request count, provider status category, error category, and position before/after. Page metadata contains only page number and raw/accepted/filtered counts.

Audit data is separate from daily Ranking History. Daily history continues to keep one observation per date, while audit rows retain individual refresh attempts. Retention removes audit rows older than 30 days and limits the table to the newest 10,000 rows. No credentials, cookies, authorization headers, or SERP payloads are stored. SQLite, settings, and retry-queue files are created/read with restrictive mode `0600` under `umask 077`.

Triggers are passed explicitly for create, manual, cron, retry, and preview refreshes; untagged calls are recorded as unknown. Duplicate and policy-disabled attempts are recorded as skipped. `verifyUser` logs the HTTP method and path with query strings removed.

### Single-flight and duplicate creation

`refresh_lock` uses `keyword_id` as its SQLite primary key, so SQLite atomically admits only one refresh for a keyword across the app server and cron processes. The lock records a Linux boot ID and process start-time token. A lock is reclaimed only after that process incarnation is confirmed dead; uncertain process identity fails closed. A `finally` path releases the lock after completion or failure.

All provider requests now have a timeout: Serper uses its configured 15-second bound; other providers use their configured timeout or 30 seconds by default. Fetch timeouts remain active through response body parsing, and Axios requests use the same bound, so a stalled provider request reaches error handling and releases its lock. `scrape_interval=never` is checked by both cron scheduling and the application cron path. Retry cron work and explicit retry-triggered calls are skipped when `scrape_retry=false`.

Keyword creation now uses `findOrCreate` and refreshes only rows actually created. The migration's unique expression index protects the same keyword/device/country/domain/city identity across concurrent API submissions. It first checks for pre-existing duplicate identities and aborts without changing the database if any are found.

### Ranking positions and request budgets

The Serper extractor keeps valid provider-reported organic positions when invalid entries are filtered. Missing or invalid positions fall back to the original organic array index, preserving gaps. Page-relative positions receive the page offset; absolute positions are retained. Serper pagination semantics are marked unknown, so a request requiring page 2 or later is rejected before sending a request. Basic remains limited to one request.

Custom and Smart strategies expose a maximum request budget from 1 to 10. They stop before starting a request beyond that cap; an incomplete search without a found domain is recorded as an error rather than a false not-found result. Preview requests have separate audit records and a one-request budget. Raw SERP payload output to `result.txt` was removed. Successful empty organic responses still represent a successful not-found result at position 0; failed responses preserve existing position and history.

## Offline validation

| Check | Result |
|---|---|
| Deterministic `npm ci` | PASS; lockfile unchanged |
| Jest | PASS — 18 suites, 76 tests |
| TypeScript `tsc --noEmit` | PASS |
| ESLint | PASS — no warnings or errors |
| Next.js production build | PASS |
| Docker image build | PASS — corrected v2 image ID above |
| `git diff --check` | PASS |
| SQLite migration regression | PASS — unique identity enforcement, duplicate preflight abort, integrity check `ok` |
| v1 isolated Docker Runtime UAT | PARTIAL — application and SQLite checks passed; cron subprocess startup failed |
| v2 image content/module resolution | PASS — exact runtime files present and Node resolved `./utils/cronPolicy` |
| v2 isolated Runtime UAT | PASS — approved synthetic UAT; app and cron healthy after startup/restart; resources cleaned |
| Live SERP calls | None; all provider tests use mocks |

Coverage includes one-request Basic behavior, filtered non-contiguous ranks, absolute page positions without double offset, custom budget exhaustion, 401/403/429, timeout and invalid responses, credential redaction, refresh audit metadata, concurrent lock admission, stale process-incarnation recovery, duplicate keyword submission, disabled cron/retry policy, and preservation of failed-scrape Ranking History.

Jest prints one existing React `act(...)` warning from `pages/domain.test.tsx`; it does not fail the suite. Build output also notes stale Browserslist data and existing Tailwind configuration warnings. `npm ci` reported 84 vulnerabilities (3 critical, 62 high, 16 moderate, 3 low); this task made no dependency upgrades or exploitability review. Next.js remains 12.3.7.

## Isolated Runtime UAT results (v1)

Operator approval `APPROVE_SERP_REFRESH_SAFETY_UAT` was provided. The UAT used the exact approved candidate image ID `sha256:d20d48b1e1cda9fb6969e0724d8db3071818a1c96a6a6c4cdced20a3602a58c5`, synthetic credentials, a separate SQLite volume, the mock Serper service, and an internal-only Docker network. The app had no published host port. The container network was verified as `internal=true`; a `NODE_OPTIONS` guard redirected only `https://google.serper.dev/search` to the mock and rejected other non-local fetch hosts. The mock recorded four synthetic POST requests; no live Serper or Google request was made.

| Runtime check | Result |
|---|---|
| Candidate image identity | PASS — exact approved image ID |
| Fresh legacy SQLite initialization and app migration | PASS — migration `1760400000000-add-refresh-safety-audit-and-locks` completed |
| App container health | PASS — healthy at startup and after restart |
| Cron subprocess startup | FAIL — `node cron.js` exited with code 1 because `./utils/cronPolicy` could not be resolved |
| Login, rejected login, dashboard and management routes | PASS |
| Domain create/read/delete | PASS |
| Keyword create/read/update/delete | PASS, including sticky and tags persistence |
| Duplicate concurrent keyword submissions | PASS for data/request protection — one row and one provider call; responses were HTTP 201 and 400, so the losing request is rejected rather than returning idempotent success |
| Concurrent refresh single-flight | PASS — two simultaneous manual refresh triggers produced one completed request and one audited `skipped` result (`concurrent_refresh`); the lock table was empty afterward |
| Refresh audit | PASS — five rows recorded trigger, actor, status, request count, status/error categories, positions and page counts; no provider payload or key was present |
| Basic request budget | PASS — Basic used one mock request per admitted refresh; duplicate submission and concurrent refresh did not create extra requests |
| Ranking position | PASS — mock result at provider position 4 was stored as 4; offline fixtures additionally verify filtering does not shift non-contiguous provider positions |
| Failed HTTP 429 behavior | PASS — error recorded, position remained 0, and no Ranking History observation was written |
| Settings and data after app restart | PASS — synthetic provider setting, schedule Never, retry disabled, domain, keywords and positions persisted |
| Retry queue and released locks | PASS — queue empty and no active lock remained |
| SQLite integrity | PASS — `PRAGMA integrity_check` returned `ok` before and after restart |
| Secret log scan | PASS — synthetic username/password/signing/API/provider values were not found in Compose logs |
| UAT cleanup | PASS — only UAT containers, internal network and dedicated volume were removed; Docker filters returned no matching resources |

The runtime request-budget check covers Basic's one-request cap. Custom multi-page budget exhaustion is covered by the offline Jest regression. Runtime Serper pagination is rejected before a request because later-page position semantics remain unverified.

### v1 cron packaging finding and v2 correction

The source commit contains `utils/cronPolicy.js`, and `cron.js` requires it. The maintained Dockerfile copies `cron.js`, but does not copy the `utils` directory; Next.js standalone tracing also omitted this file because the cron process is launched separately. Inspection inside the exact candidate image confirmed `/app/cron.js` exists while `/app/utils/cronPolicy.js` does not. The app server remains healthy, but the cron subprocess repeatedly exits on startup. Although schedule Never prevents scheduled SERP work, the candidate fails the full runtime startup check and is not ready for deployment.

The v2 Dockerfile now creates `/app/utils` owned by `nextjs` and copies `/app/utils/cronPolicy.js` from the builder with the same runtime ownership. This is the only source change in v2. The rebuilt image-layer inspection confirms both files are present and Node module resolution succeeds. The approved v2 Runtime UAT confirmed that one `node cron.js` subprocess remains running after startup and after app-container restart.

## v2 isolated Runtime UAT results

The operator approved UAT with `APPROVE_SERP_REFRESH_SAFETY_UAT_V2`. The exact approved image `serpbear-refresh-safety-candidate:20261014-v2` (`sha256:6c8eca5d61b6ffbee30501e632c9a87ee11d8f6a47c511c13f77557f0a19e675`) was used. The app had no published host port, the dedicated network reported `internal=true`, the SQLite volume was dedicated, and the init container used `network_mode: none` and exited successfully. The app's fetch guard redirected only the Serper endpoint to the mock and rejected non-local, non-mock fetch hosts. Thus the four observed provider calls were mock calls; no real Serper.dev or Google request was possible through the UAT provider path.

| v2 runtime check | Result |
|---|---|
| Exact candidate image | PASS — app and mock containers used the approved SHA-256 image ID |
| Fresh SQLite initialization and safety migration | PASS — init exited 0; `refresh_audit` and `refresh_lock` were exercised; integrity check returned `ok` |
| Next.js app startup and health | PASS — app became healthy and login/dashboard routes returned successfully |
| Cron subprocess | PASS — exactly one `node cron.js` process was running after startup and remained running after restarting the app container |
| Schedule Never | PASS — no cron-triggered audit rows; restart did not increase mock request count |
| Login and auth failure | PASS — synthetic login succeeded; invalid password returned 401 |
| Domain CRUD and management navigation | PASS — `example.com` create/read and management routes passed |
| Duplicate keyword protection | PASS — two concurrent identical create requests produced one row and one provider request (HTTP 201 and 400) |
| Keyword update and tracking | PASS — sticky/tags persisted; successful mock result retained provider position 4 and wrote history value 4 |
| Single-flight lock | PASS — two concurrent manual refreshes produced one completed request and one audited `skipped` result (`concurrent_refresh`); lock table was empty afterward |
| HTTP 429 handling | PASS — error category/status were recorded, position remained 0, no Ranking History observation was written, and retry queue stayed empty |
| Request budget and localization | PASS — Basic used one mock request per admitted refresh; each request was POST `/search`, with synthetic key in `X-API-KEY`, `gl=id`, `hl=id`, page 1 and `num=10` |
| Refresh audit | PASS — five refresh attempts were recorded with expected create/manual triggers, status, request counts, page counts and position deltas; no credential appeared in audit data |
| Restart persistence | PASS — settings, domain, keywords and positions persisted; SQLite integrity remained `ok`; mock request count remained four |
| Credential log scan | PASS — synthetic credential values were absent from container logs |
| Cleanup and production isolation | PASS — only UAT synthetic rows were removed; v2 containers, network and volume were deleted and matching Docker filters returned empty. Production container remained healthy on its unchanged Phase 1 image `sha256:5075a0d44ecd5a698e71727271e8100cb18aed087243d410c026137214e7d955` |

The successful mock returned a target at provider-reported organic position 4 after an earlier result at position 1, confirming the stored rank was not shifted by filtering. The failure case was an HTTP 429 and was intentionally not treated as a successful not-found observation.

## Remaining limitations and deployment plan

- Serper's position semantics for later pages remain unverified. The candidate blocks Serper multi-page requests until provider evidence establishes whether positions are absolute or page-relative. No Top 100 claim is made.
- Process liveness recovery assumes app and cron workers share the same Linux PID namespace and SQLite file, as in the current single-container deployment. Do not horizontally scale workers sharing this database without revisiting lock ownership.
- Deployment migration must run a duplicate-identity preflight. Existing duplicate keyword identities cause a safe migration abort; no rows are automatically deleted or merged.
- This is an isolated candidate only. Production deployment requires a separate approval, a verified SQLite backup, migration review, and rollback planning.
- Rollback restores the previous app image and preserves the SQLite volume. The old application ignores the added audit/lock tables, but the new unique index changes duplicate-submission behavior. If full old behavior is required, export any audit records first, then run the migration down operation; it drops only the new audit/lock tables and unique index. No Ranking History or keyword rows are changed by the migration.

## Final status

`SERP_REFRESH_SAFETY_READY` — the corrected source is committed, offline validation passed, and the approved v2 isolated Runtime UAT passed, including the live cron subprocess check after restart. This status covers the candidate and synthetic UAT only. Production remains on Phase 1; no production migration, deployment, Cloudflare change, or live SERP request was performed.
