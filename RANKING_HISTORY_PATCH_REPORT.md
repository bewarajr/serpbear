# SerpBear Ranking History Patch Report

**Runtime UAT status: `RANKING_HISTORY_RUNTIME_UAT_PASS`**

The patch and isolated runtime UAT passed. The repository-wide Jest and standalone TypeScript checks still have unrelated existing fixture failures; they are reported separately below and are not marked PASS. The patch has not been deployed.

## Change

In `utils/refresh.ts`, `history[dateKey] = newPos` now runs only when `updatedKeyword.error` is false. Failed scrapes still update `lastUpdateError`, preserve `lastUpdated` and the prior position, and keep the existing retry/removal behavior. Successful “not found” results still record position `0`; successful matches still record their positive position.

No database schema or migration change is needed. No production database, running container, Cloudflare configuration, or package manifest/lockfile was changed.

## Regression and Build Results

- **Original implementation (red):** the five-case focused test run failed 3 cases and passed 2. Failures showed that an error appended a zero history entry, overwrote a same-day observation, and appended history with retries enabled.
- **Patched implementation (green):** `__tests__/rankingHistory.test.ts` passed **5/5**. The fixtures cover failed scrape, successful not-found, successful positive rank, repeated failure, and error/retry reporting. They use an in-memory model and make no network calls.
- **Full existing Jest suite:** **9/11 suites passed; 29/44 tests passed.** The other two suites fail on existing issues: `pages/domain.test.tsx` receives an undefined `useUpdateSettings` mock, and `hooks/domains.test.tsx` lacks `TextEncoder` in its test environment. The focused ranking-history suite passes within the full run.
- **Standalone TypeScript check:** `tsc --noEmit` failed on five existing `__tests__/components/Keyword.test.tsx` fixtures missing the required `maxTitleColumnWidth` prop. The production Next.js build’s own type check and build completed successfully.
- Development dependencies were installed in `/tmp/serpbear-rankhistory-fix` with `npm ci` and the existing lockfile. Neither `package.json` nor `package-lock.json` changed.
- The existing full-suite/type-check failures remain separate from the focused patch and runtime results; no unrelated tests or source were changed to mask them.

## Candidate Image

- Tag: `serpbear-ranking-history-candidate:20261014`
- Final image ID used for UAT: `sha256:5e1af34fe16f44f79436a5c8566b320d6843d65962e0db44f95a1c02fad733d7`.
- The initial image built with the repository Dockerfile exited because its final runtime dependency install pruned `@babel/runtime`, required by the standalone server. For this isolated UAT only, `/tmp/serpbear-ranking-history-uat.Dockerfile` restored that dependency from the build stage; no repository Dockerfile, application source, package manifest, or lockfile was changed.
- The final candidate image remains local. It was not deployed.

## Isolated Runtime UAT

**Result: `RANKING_HISTORY_RUNTIME_UAT_PASS`.** The approved Compose project used only the candidate app, its dedicated SQLite volume, and one `internal: true` network. The network had no default route; the container had no provider credential environment variables. `scraper_type` was `none`, provider settings were empty, and the failed queue was empty. No external SERP request could leave the container. The failed scrape logged a URL parse failure for the empty scraper URL, consistent with no configured scraper client.

- Login/authentication: **PASS**.
- Synthetic domain `example.com`: create and cleanup **PASS**.
- Keyword `serpbear uat test keyword`: create **PASS**; immediate refresh failed as expected; stored position remained `0`, history remained `{}`, and `lastUpdateError` was recorded.
- Keyword update: sticky flag persisted **PASS**.
- Keyword delete and subsequent absence check: **PASS**.
- Retry queue: empty before and after the failed refresh. In the fresh app settings response, `scrape_retry` was absent/undefined (therefore falsy); the application did not enqueue a retry.
- SQLite read-only `PRAGMA integrity_check`: **`ok`**. Final domain and keyword row counts were both zero; failed queue length was zero.
- Logs: one expected scraper failure; no other application error lines or credential values were observed.
- Network evidence: Docker network `Internal=true`, exactly one UAT endpoint, and no default route in `/proc/net/route`. The app had no SERP/provider credential environment variables.
- The Compose host binding to `127.0.0.1:3199` was configured, but that port was not reachable from this execution shell. The authenticated API checks ran inside the isolated app container against its loopback listener; this did not require opening the network or adding another route.

After verification, `docker compose down --volumes` removed only the UAT container, its network, and its dedicated volume. Follow-up inspection confirmed those three resources are absent, the candidate image remains available, and production `serpbear-official-app` remains healthy on its original image. Cloudflare and production data were not changed.

## Deployment and Rollback

No migration is required because the source change only gates a history assignment. No production deployment was performed. If a later deployment needs rollback, restore the current pinned official image, `towfiqi/serpbear:3.1.0@sha256:31bc71dc02a7d4efe4170e76eefac8be06077fb03d8d215919b602032dde3c38`; the patch changes no schema. Production remains on its existing image and data.

## Remaining Blockers / Next Action

1. Existing full-suite failures: two unrelated UI/hooks suites fail (`useUpdateSettings` mock is undefined; `TextEncoder` is missing).
2. Standalone TypeScript check still reports five existing `Keyword` test fixtures missing `maxTitleColumnWidth`.
3. The candidate runtime image needed a temporary build-only dependency restoration. Reconcile that packaging detail before any future production image build.
4. The configured localhost port was unreachable from the execution shell; UAT API behavior was verified from inside the container.

The focused patch and isolated runtime behavior are verified. Resolve or explicitly accept the broader test/type-check and candidate packaging findings before considering deployment. **Production deployment remains pending and was not authorized or attempted.**
