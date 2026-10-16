# SerpBear Security Patch Phase 2 — Next.js migration

**Status: `SECURITY_RELEASE_WAITING_UPSTREAM`**  
**Latest release recheck:** 2026-10-14 09:12 UTC  
**Production deployment:** not performed

The existing migration candidate passed the earlier functional and runtime validation below. Security release readiness is still waiting on the [Next.js team's announced 2026-10-14 out-of-band update](https://nextjs.org/blog/upcoming-nextjs-security-update-october-2026): at the latest check, the official announcement still describes it as planned and says the full advisories will be published with the update. Affected versions, patched releases, and upgrade instructions remain unavailable. Do not describe 15.5.27 as patched against these not-yet-documented issues. Reassess before production approval.

## Final upstream release recheck — 2026-10-14 09:12 UTC

- **Official announcement:** the [Next.js post dated 8 October](https://nextjs.org/blog/upcoming-nextjs-security-update-october-2026) still says the update is planned for Wednesday 14 October and promises full advisories alongside publication. It identifies two Critical and one High upstream vulnerabilities, but does not disclose their upstream packages or affected ranges.
- **GitHub release and advisory status:** the latest published 15.5 release remains [v15.5.27](https://github.com/vercel/next.js/releases/tag/v15.5.27), released 30 September. The [Next.js advisory list](https://github.com/vercel/next.js/security/advisories) has no advisory for the announced 14 October update at this check.
- **npm registry:** direct metadata from `https://registry.npmjs.org/next` reports `latest: 16.4.0` and `backport: 15.5.27`. The newest published `15.5.x` is 15.5.27 (published `2026-09-30T16:19:50.862Z`); there is no later 15.5 version in the registry response.
- **Affected versions / whether 15.5.27 is affected by the announced issues:** unknown until the promised advisories are published. Existing advisories do not identify these three announced upstream vulnerabilities.
- **Minimum patched 15.x version:** unavailable. 15.5.27 remains the newest available 15.5 release, but cannot be certified against the unpublished issues.
- **Whether Next.js 16 is required:** unknown; the announcement contains no migration instruction. Do not move to 16 speculatively.
- **React or other upstream dependency versions required:** unknown; the affected upstream packages and their fixed versions have not been disclosed.
- **Decision:** `SECURITY_RELEASE_WAITING_UPSTREAM`. No source, manifest, lockfile, candidate image, or UAT resource was changed or rebuilt in this recheck; tests were not rerun. Resume once the official advisories and patched package release(s) are public.

## Candidate and production state at this recheck

- The preserved Phase 2 candidate remains commit `4093af3b1f9631782beba5462286b7951059a241`, using Next.js 15.5.27 and image ID `sha256:98d71426b248e5e27b13450c9510f089fb390e629309d2c08fbdf7696406dcaa`. It has not been changed or rebuilt.
- The separately deployed tar runtime remediation is source commit `6f2d8f4e7439fcfc03fea1d80dff04eaf7e80c99`. It has not been merged into the Phase 2 candidate because the required upstream patch is not yet available and this task's stop condition applies.
- Production remains on Security Phase 1 plus the tar runtime remediation. No production, Cloudflare, provider, or unrelated Docker configuration was changed during this recheck.
- The earlier runtime UAT evidence below applies to the prior Phase 2 image, not to a combined candidate containing the tar runtime commit. No claim is made that such a combined image has been built or tested.

## Source and selected version

- Isolated worktree: `/tmp/serpbear-security-phase2`, branch `security-phase2-next-20261014`.
- Exact deployed Phase 1 parent: `7ac9cecff424f49edfee549147f6495560ed8743`.
- Reproducible candidate commit: `4093af3b1f9631782beba5462286b7951059a241`; worktree clean. Production checkout source and all production resources were left unchanged.
- Selected **Next.js 15.5.27** with `eslint-config-next` 15.5.27. [Next.js support policy](https://nextjs.org/support-policy) lists 15.x as Maintenance LTS; 12.x is unsupported. The npm 15.x backport tag resolved to 15.5.27 on 2026-10-14. This is the smallest supported major that includes the [AVIF image-optimizer RCE fix](https://github.com/advisories/GHSA-2xp9-vwfh-vxw4) in 15.5.24 plus the [later 15.5.27 security release](https://github.com/vercel/next.js/releases/tag/v15.5.27). Next.js 16 would require a larger migration and does not remove the outstanding tar finding.
- A registry check at 06:59 UTC failed with DNS `EAI_AGAIN`; a direct metadata recheck at 08:24 UTC succeeded and confirmed the same 15.5.27 backport tag. The release/advisory lists still lacked the announced update at that recheck.
- Node 22, React/React DOM 18.2.0, TypeScript 4.9.5, Pages Router, API routes, standalone output, and separate server/cron processes are retained. ESLint was updated within major 8 to 8.57.1 to satisfy the newer TypeScript ESLint peer range. Phase 1 Sequelize 6.37.8, Axios 1.20.0, shell-quote 1.12.0, and the Ranking History fix remain present. sqlite3 5.1.7 and tar 6.2.1 were not upgraded.

## Changes in the candidate commit

1. Pin `next` and `eslint-config-next` to 15.5.27 and `eslint` to 8.57.1; synchronize `package-lock.json` through npm. No other direct application dependency was changed.
2. Remove obsolete `swcMinify`; set `outputFileTracingRoot: __dirname` so the standalone trace uses this worktree instead of an unrelated `/tmp/package-lock.json`.
3. Add `legacyBehavior` to existing Next `<Link>` elements wrapping `<a>` in Sidebar, TopBar, DomainHeader, and DomainItem. This preserves navigation and avoids nested anchors under Next.js 15.
4. Set explicit Sequelize `modelName` values `Domain` and `Keyword`. Next.js 15 production minification otherwise gave both model classes the same name; Sequelize registered only one model, `db.sync()` omitted the `domain` table, and Domain API returned 400. Existing table names and database schema are unchanged.
5. Set `HOSTNAME=0.0.0.0` in the maintained Dockerfile. Without it, Next.js 15 standalone listened only on the container hostname address and loopback health checks could not connect. The final image listens on the container network and loopback; no new production port configuration was made.

## Validation

| Check | Result |
| --- | --- |
| `npm ci --no-audit` from the lockfile | PASS |
| Full `npm run test:ci` | PASS: 12/12 suites, 46/46 tests; Ranking History and Axios proxy tests included |
| `tsc --noEmit` | PASS |
| `npm run lint` | PASS, no ESLint errors or warnings |
| `npm run build` | PASS; all Pages Router routes and 19 API routes generated |
| Maintained Dockerfile build | PASS; final tag `serpbear-security-phase2-next15-candidate:20261014`, image ID `sha256:98d71426b248e5e27b13450c9510f089fb390e629309d2c08fbdf7696406dcaa` |
| Disposable runtime UAT | PASS after compatibility fixes below |

The existing Jest `act(...)` console warning remains; it does not fail the suite. Next.js 15 warns that `next/config` runtime config and `next lint` will be removed in Next.js 16. They still work in this candidate and should be addressed in a separate 16.x migration. A fresh empty SQLite database also emits legacy migration `describeTable` messages before the models create tables; migrations complete, and subsequent startup reports no migrations or runtime errors.

## Isolated runtime UAT

The approved UAT used `/tmp/serpbear-security-phase2-uat.compose.yml`, synthetic credentials, `example.com`, one synthetic keyword, a dedicated SQLite volume, and an `internal: true` Docker network. Network inspection showed no default route, and no host port was actually published by Docker on the internal-only network. The browser reached the test container through its internal Docker address. The image ran as `nextjs` (UID 1001), with both the Next.js server and cron processes running.

- Login, bad-password rejection, logout, dashboard, domain view, keyword view, and settings view: **PASS**. Unauthenticated `/api/domains`, `/api/keywords`, and `/api/settings` returned 401.
- Next.js static JS asset and page route responses: **PASS**.
- Synthetic Domain and Keyword create/update/delete: **PASS**. No production data or real domains used.
- Failed refresh with scraper disabled: error recorded, current position remained 0, no dated ranking history created, retry queue stayed empty. No SERP provider, Google integration, SMTP, or ProxyEmpire setting was enabled.
- Settings and synthetic rows persisted after container restart; SQLite `PRAGMA integrity_check` returned `ok` before and after cleanup. Final test database contained 0 domains and 0 keywords.
- Final test container health: **healthy**. The UAT healthcheck was corrected to use `127.0.0.1` because Alpine resolved `localhost` to IPv6 while the server listened on IPv4.
- No external SERP request was possible through the isolated network: `Internal=true` and `/proc/net/route` contained only the connected subnet, with no default route. This is network configuration evidence, not packet-capture evidence.
- The UAT browser session was closed. Only the Phase 2 UAT container, network, and volume were deleted. Production container remained healthy on Phase 1 image `sha256:589f6a5718d76574793bfe1275f5f9fa21ed6259d32d3070b0393a4c9374de7c`.

## Production dependency audit

Fresh `npm audit --omit=dev --json` against the npm registry on 2026-10-14:

| Severity | Phase 1 | Phase 2 candidate |
| --- | ---: | ---: |
| Critical | 2 | 1 |
| High | 23 | 23 |
| Moderate | 14 | 15 |
| Low | 2 | 2 |
| Total affected packages | 41 | 41 |

The direct Next.js advisories reported against 12.3.7, including the AVIF RCE, are absent from the candidate audit. The `next` aggregate still appears at Moderate because of transitive `postcss`; do not interpret that as a direct Next.js advisory. The remaining Critical package is transitive **tar 6.2.1** under `sqlite3 -> node-gyp` and its build/cache chain. No application path that extracts attacker-supplied archives was found, but the package is present in the runtime image; exploitability is limited by that path, not proven impossible. High findings include native build dependencies and other packages. These findings are outside this phase and must be reviewed separately; the audit does not show a clean application.

The announced additional Next.js issues were not yet described in npm advisories. Their effect on 15.5.27 cannot be assessed until the upstream release and advisories are published.

## Deployment risk and next action

The largest migration risks were model registration in the optimized bundle, standalone network binding, and authentication/navigation. Each was exercised in the disposable image; a production-data migration was neither needed nor performed. Cloudflare Access configuration was unchanged. A read-only unauthenticated check of the production `/login` route returned a Cloudflare Access redirect, and the production container remained healthy.

**Next action:** wait for the announced Next.js security release, review its affected ranges, select the patched 15.x backport if provided, update this isolated branch, and repeat `npm ci`, the complete Jest/TypeScript/lint/build/audit checks, Docker build, and isolated runtime UAT. If 15.x receives no applicable fix, assess the smallest supported patched major before deployment. Then prepare a fresh consistent SQLite backup, verify checksum and integrity, deploy only the SerpBear app service after a separate explicit operator approval, preserve the production volume and previous image, and verify login, routes, counts, settings, Cloudflare Access, health, and Ranking History. Roll back only the app image/service if critical verification fails; restore SQLite only after a separate recovery decision.

No production deployment was performed during Phase 2.
