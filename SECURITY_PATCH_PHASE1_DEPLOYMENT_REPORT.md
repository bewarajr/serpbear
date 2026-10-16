# SerpBear Security Patch Phase 1 deployment

**Status:** `SECURITY_PATCH_PHASE1_DEPLOYMENT_SUCCESS`  
**Preflight:** 2026-10-14 UTC  
**Production deployment:** 2026-10-14 06:30:04 UTC, after explicit `DEPLOY_SECURITY_PATCH_PHASE1_APPROVED` authorization.

## Validated candidate and source provenance

| Item | Verified value |
|---|---|
| Current production tag / image ID | `serpbear-ranking-history-final:20261014` / `sha256:9b6386566303ce0ca1036cd560849de5d8ad72fe492331edf44cccdf74a8d39b` |
| Phase 1 candidate tag / image ID | `serpbear-security-phase1-candidate:20261014` / `sha256:589f6a5718d76574793bfe1275f5f9fa21ed6259d32d3070b0393a4c9374de7c` |
| Reproducible source | Git branch `security-phase1-20261014`, commit `7ac9cecff424f49edfee549147f6495560ed8743`, worktree `/tmp/serpbear-security-phase1` (clean after commit). |
| Source content | Includes existing Ranking History fix, Docker packaging correction, original test fixture fixes, Sequelize 6.37.8, Axios 1.20.0, shell-quote 1.12.0, and regression tests. No source content changed between the validated Docker build and the commit; the commit recorded the tested worktree. |
| Prior validation | Ranking History 5/5; full Jest 46/46; TypeScript, lint, Next.js build, Docker build, and isolated no-egress runtime UAT all PASS in `SECURITY_PATCH_PHASE1_REPORT.md`. Exact image ID matches the tested artifact; no rebuild or substitution was made. |

The production checkout's existing uncommitted changes were not overwritten. The isolated branch permanently records the deployable source and tests. Before any future rebuild, use the exact commit and compare resulting image ID separately; this deployment proposes using the already validated local image.

## Production preflight

| Check | Result |
|---|---|
| Compose identity | Project `serpbear-official`, service `app`, file `/home/kiwkiw/projects/serpbear/compose.official.yml`. |
| Container | `serpbear-official-app` running and **healthy**, with the expected current image ID. |
| Port and data | `127.0.0.1:3180 -> 3000/tcp`; existing `serpbear-official-data` volume mounted read/write at `/app/data`. Both will be retained. |
| SQLite source | Read-only `PRAGMA integrity_check=ok`; **0 domains, 0 keywords**. |
| Settings | `scraper_type=none`, `scrape_interval=never`, retry disabled, failed queue count 0, no configured provider settings or checked provider environment variables; public URL remains `https://serpbear.bewara.xyz`. |
| Cloudflare | `serpbear-cloudflared.service` active. Anonymous GET `/`, `/login`, `/api/domains`, `/api/settings`, `/api/keywords`, and `/_next/image` each returned 302 with a Cloudflare Access login Location. No cookies or credentials used. |
| Other Docker services | Running container identifiers were recorded before deployment for a post-deployment comparison. No unrelated service has been modified. |

## New production SQLite backup

The running application's SQLite3 Online Backup API created a consistent snapshot without changing database contents. It was copied to the protected host backup directory. Verification passed:

- **Host path:** `/var/backups/serpbear/serpbear-security-phase1-predeploy-20261014T062715Z.sqlite`
- **SHA-256:** `e9475d1d4989a7152547096bb8e8b3aee440e85762cdf7e2ac67be2fb315f84e`
- **Permissions:** backup directory `700`; file `600`, owner UID/GID `1000:1000`
- **Read-only verification:** `PRAGMA integrity_check=ok`; 0 domains, 0 keywords

The checksum matches the prior verified backup because the SQLite contents have not changed. The previous backup remains retained. Stop deployment if any later pre-deployment integrity or image check fails.

## Dependency audit and remaining risk

The exact candidate's production-only audit reports **41 packages with advisories: 2 critical, 23 high, 14 moderate, 2 low**, versus 44 before Phase 1 (3 critical, 26 high, 13 moderate, 2 low). Direct Axios and shell-quote findings are absent; Sequelize's direct SQL-injection advisory is absent. Sequelize still inherits a moderate `uuid` finding. Critical findings remain for **Next.js 12.3.7** and **tar 6.2.1**; high findings include Nodemailer, sqlite3's native dependency chain, Umzug/transitive tooling, postcss, and undici. This deployment does not claim a clean dependency audit. Next.js and tar are deliberately deferred to separate work.

## Approved-change plan and rollback

Approval gate was satisfied by the operator's exact `DEPLOY_SECURITY_PATCH_PHASE1_APPROVED` response. No Compose edit or production recreation occurred before that response.

Only `services.app.image` in `compose.official.yml` was changed to `serpbear-security-phase1-candidate:20261014`. The existing environment, `serpbear-official-data` volume, localhost port binding, restart policy, network, Cloudflare Tunnel, and Access settings were retained. Only `app` was recreated with `docker compose -f compose.official.yml up -d --no-deps app`. There was a brief interruption. No `docker compose down -v`, Docker prune, manual migration, or live scraping was run.

Post-deployment, verify exact image ID, container health, SQLite integrity and counts, settings, absence of new jobs/errors, Cloudflare Access redirects, login/dashboard and Domain/Keyword navigation. If an authorized Cloudflare browser session is required, request operator verification rather than bypassing Access. Do not create a tracking keyword or call refresh on production.

On critical startup, health, authentication, or integrity failure, restore `services.app.image` to `serpbear-ranking-history-final:20261014`, recreate only `app` with `--no-deps`, and verify the old image is healthy. Preserve the volume. Do not restore the SQLite backup automatically; decide separately if actual corruption is confirmed. Original image remains local for rollback.

## Post-deployment result

| Check | Result |
|---|---|
| Exact deployed image | **PASS:** `sha256:589f6a5718d76574793bfe1275f5f9fa21ed6259d32d3070b0393a4c9374de7c`; runtime reports Sequelize 6.37.8, Axios 1.20.0, shell-quote 1.12.0; Next.js 12.3.7, sqlite3 5.1.7, and tar 6.2.1 remain unchanged. |
| Container health | **PASS:** running/healthy, restart count 0; `serpbear-official` project and `app` service labels retained. |
| Production data | **PASS:** read-only SQLite `integrity_check=ok`; 0 domains and 0 keywords, matching preflight. Same `serpbear-official-data` volume and `127.0.0.1:3180->3000` binding. |
| Settings and jobs | **PASS:** `scraper_type=none`, interval `never`, retry disabled, failed queue 0, checked provider settings absent, public URL unchanged. Startup logs show migrations up to date, no error/exception, no scrape-start or SERP URL entry. |
| Cloudflare | **PASS:** Tunnel active; anonymous `/`, `/login`, `/api/domains`, `/api/settings`, `/api/keywords`, and `/_next/image` each redirected to Cloudflare Access (302). |
| Local route availability/access control | **PASS:** `/`, `/login`, `/domains` respond; unauthenticated `/api/domains` and `/api/keywords` return 401. This does not substitute for an authorized browser login. |
| Other Docker services | **PASS:** seven unrelated running containers retained the same IDs and images recorded before deployment. |
| Authorized browser | **PASS:** operator confirmed Cloudflare Access authentication, SerpBear login, dashboard, Domain Management, and Keyword Management navigation. No keyword was created, no refresh was run, and no session cookie or credential was collected. |

The final recheck after operator confirmation found the exact candidate image healthy with restart count 0, SQLite `integrity_check=ok`, unchanged 0/0 row counts, and no new error or scrape-start log lines. Rollback status: **not needed**. The deployment and required verification passed; remaining dependency vulnerabilities are listed above and in the Phase 1 report.
