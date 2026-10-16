# SerpBear Security Remediation Phase 1

**Status:** `SECURITY_PATCH_PHASE1_READY`  
**Validated:** 2026-10-14 06:16 UTC  
**Production:** unchanged; `serpbear-ranking-history-final:20261014`, image `sha256:9b6386566303ce0ca1036cd560849de5d8ad72fe492331edf44cccdf74a8d39b`, healthy after UAT. No production database, container, Cloudflare, or provider setting was changed.

## Candidate and exact changes

The isolated Git branch `security-phase1-20261014` and worktree `/tmp/serpbear-security-phase1` were created from upstream commit `32204ee044e499590aecd0e2e244c018fb8fc8a3`. The current deployed Ranking History patch, Docker packaging, and existing test fixes were copied into that worktree before the dependency update. Relative to the current production project files, only `package.json`, `package-lock.json`, and the new `__tests__/axiosProxyCompatibility.test.ts` test differ. No application business logic changed in Phase 1.

| Package | Before | Candidate | Why |
|---|---:|---:|---|
| Sequelize | 6.37.7 | **6.37.8** exact | Clears direct SQL-injection [GHSA-6457-6jrx-69cr](https://github.com/advisories/GHSA-6457-6jrx-69cr). |
| Axios | 1.13.5 | **1.20.0** exact | Clears Axios advisories in the production audit, including [GHSA-3pq3-5fj3-cg6v](https://github.com/advisories/GHSA-3pq3-5fj3-cg6v). |
| shell-quote | 1.8.3 | **1.12.0**, transitive lock update | Clears [GHSA-w7jw-789q-3m8p](https://github.com/advisories/GHSA-w7jw-789q-3m8p) and [GHSA-395f-4hp3-45gv](https://github.com/advisories/GHSA-395f-4hp3-45gv). It remains within `concurrently`'s `^1.7.3` range. |

Fresh registry metadata confirmed Sequelize 6.37.8 and Axios 1.20.0 are published. **`shell-quote@1.8.5` is not published**; npm lists 1.8.4 then 1.9.0 through 1.12.0, so 1.12.0 was selected and the fresh audit confirms no shell-quote advisory. The previous review's suggested 1.8.5 was incorrect. No broad `npm audit fix` was used.

The lock resolver also changed only four Axios-chain transitive versions: `follow-redirects` 1.15.11→1.16.1, `form-data` 4.0.5→4.0.6, `hasown` 2.0.2→2.0.4, and `proxy-from-env` 1.1.0→2.1.0. These satisfy the updated Axios graph and removed their prior audit rows; no other locked package version changed. Next.js 12.3.7, sqlite3 5.1.7, and tar 6.2.1 stayed fixed.

## Validation results

| Check | Result |
|---|---|
| Deterministic `npm ci` with install scripts | **PASS** in isolated worktree. Docker build independently ran `npm ci` and `npm ci --omit=dev`. |
| Ranking History regression | **PASS, 5/5**. Failed scrape does not write history; success and retry cases remain covered. |
| Mocked Axios proxy compatibility | **PASS, 1/1**. Verified proxy agent configuration, `proxy:false`, request URL, and response without network access. |
| Full Jest `npm run test:ci -- --runInBand` | **PASS, 12 suites / 46 tests**. One pre-existing React `act(...)` console warning appeared; no test failed. |
| TypeScript `tsc --noEmit` | **PASS**, no errors. |
| `npm run lint` | **PASS**, no warnings or errors. |
| `npm run build` | **PASS**. Existing Browserslist/Tailwind notices remain. |
| Docker image build from maintained `Dockerfile` | **PASS**. Candidate tag `serpbear-security-phase1-candidate:20261014`, image ID **`sha256:589f6a5718d76574793bfe1275f5f9fa21ed6259d32d3070b0393a4c9374de7c`**. |

The image's `npm ci --omit=dev` reported the same 41-package production audit count below. No custom temporary Dockerfile was used.

## Security audit comparison

Fresh production-only npm audits, before and after the candidate lockfile:

| Severity | Production baseline | Phase 1 candidate |
|---|---:|---:|
| Critical | 3 | **2** |
| High | 26 | **23** |
| Moderate | 13 | **14** |
| Low | 2 | **2** |
| Total vulnerable packages | **44** | **41** |

Axios and shell-quote no longer appear as vulnerable packages. Sequelize's direct GHSA-6457-6jrx-69cr advisory is gone, but Sequelize still appears as **moderate** through inherited `uuid` [GHSA-w5hq-g745-h8pq](https://github.com/advisories/GHSA-w5hq-g745-h8pq); `sequelize-typescript` becomes a new inherited moderate row. Thus the moderate count rises by one and **not all Sequelize-related audit rows are clean**. The remaining critical entries are Next.js and tar. sqlite3 remains high through native build dependencies. This phase does not claim a clean audit.

## Isolated Docker runtime UAT

The operator approved creation of the disposable container. It used `/tmp/serpbear-security-phase1-uat.compose.yml`, a protected synthetic credential env file, `127.0.0.1:3199`, its own empty SQLite volume, and its own Docker network with `Internal=true`. Inspection showed only the UAT container on that network and **no default route** in `/proc/net/route`; therefore public SERP egress was unavailable. No SERP provider, proxy, Google integration, or SMTP was configured.

The final image became **healthy**. Process inspection showed both `node server.js` and `node cron.js` running as `nextjs`. The synthetic API UAT passed login, Domain Create/Read/Update/Delete, Keyword Create/Read/Update/Delete, and cleanup. Keyword creation attempted its normal refresh with no provider; `lastUpdateError` was recorded, position stayed 0, history remained empty, `updating=false`, and the failed retry queue stayed empty. SQLite `PRAGMA integrity_check` returned `ok`; both synthetic tables were empty after cleanup. No Google search URL appeared in UAT logs. Fresh-database migration startup logged transient missing-table description messages before schema creation; no migration failure or persistent application error was observed. The intentional disabled-provider refresh error was the only scrape error.

The UAT container, its network, and its volume were removed with `docker compose down -v`. The candidate image remains available for review. Production image ID and healthy state were rechecked after cleanup; unrelated Docker containers were not modified.

## Separate Next.js migration assessment

Next.js **12.3.7 remains unsupported and audit-critical**; [Next.js support policy](https://nextjs.org/support-policy) lists 15.x as Maintenance LTS and 16.x as Active LTS. The critical [AVIF image optimizer advisory](https://github.com/advisories/GHSA-2xp9-vwfh-vxw4) affects versions below 15.5.24. Current image configuration defaults to WebP only, no `next/image` import was found, and `sharp` was not resolvable; that specific AVIF path appears inactive. Cloudflare Access redirects anonymous requests for `/_next/image` and application APIs. This is a risk-reduction finding, **not proof that all Next.js issues are unreachable**; Next remains the next separate security project.

**Recommended first migration candidate:** Next.js **15.5.24** (patched and currently Maintenance LTS), rather than automatically taking npm audit's 16.4.0 major suggestion. Npm metadata for 15.5.24 allows Node `^18.18.0 || ^19.8.0 || >=20` and React/React DOM `^18.2.0` or 19; this app uses Node 22 in Docker and React 18.2.0. [Next's Pages Router documentation](https://nextjs.org/docs/15/pages/getting-started) confirms Pages Router remains supported, so no App Router rewrite is required for the initial candidate. The current TypeScript 4.8 and `eslint-config-next` 12 need compatibility resolution in that **separate** worktree; test with the actual dependency graph rather than assuming peer metadata alone is sufficient. [Next 15 upgrade guidance](https://nextjs.org/docs/app/guides/upgrading/version-15) describes request API and caching changes, many specific to App Router. Next 16 has larger tooling changes, including removal of `next lint`, and should not be bundled into Phase 1.

Migration work must inspect `pages/api/login`, `utils/verifyUser`, cookie attributes and redirects behind Cloudflare, every API handler, Pages Router navigation, and `output:'standalone'` Docker packaging. Run full tests/build and isolated no-egress runtime UAT plus authorized browser tests. Estimated deployment risk: **high** because this spans three major Next releases; retain the current image and verified SQLite backup for rollback. If image optimization or an alternate direct-origin route is later shown reachable by unauthorized users, escalate immediately rather than wait for the normal migration cycle.

## Deployment and rollback considerations

Phase 1 is **ready for a separate production deployment decision**, not deployed. Before any production change: review this worktree diff, preserve it outside temporary storage or commit the candidate branch, rebuild and record the final image ID, re-run audit at build time, verify production backup/integrity and baseline counts, then request explicit deployment approval. Deployment should change only the SerpBear Compose image and recreate only its app service. Post-deploy checks must include health, Access, login, dashboard, Domain/Keyword navigation, SQLite integrity/counts, settings, and no unexpected jobs. On critical failure, restore the current image reference and recreate only that service; keep the production volume. Never restore SQLite automatically without a separate recovery decision.

Remaining security work includes Next.js, tar/native tooling, the inherited `uuid` advisory, and other audit rows documented in `SECURITY_DEPENDENCY_REVIEW.md`. Scraping providers remain disabled.
