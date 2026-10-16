# SerpBear Production Deployment Report

**Preflight timestamp:** 2026-10-14 05:04 UTC (12:04 Asia/Jakarta)  
**Deployment timestamp:** 2026-10-14 05:10 UTC (12:10 Asia/Jakarta)  
**Production:** Official SerpBear v3.1.0 at `https://serpbear.bewara.xyz`  
**Status:** `SERPBEAR_PRODUCTION_DEPLOYMENT_SUCCESS`

## Deployment status

The operator provided `DEPLOY_SERPBEAR_APPROVED`. Only the Compose `app` image reference was changed, and only `serpbear-official-app` was recreated. The existing production volume and all unrelated Docker containers remain in place. The original image remains available for rollback.

## Pre-deployment verification

| Check | Result | Evidence |
|---|---|---|
| Production container | **PASS** | `serpbear-official-app` is running and healthy; restart policy is `unless-stopped`. |
| Production baseline image | **PASS** | `towfiqi/serpbear:3.1.0@sha256:31bc71dc02a7d4efe4170e76eefac8be06077fb03d8d215919b602032dde3c38`; running image ID matches. |
| Candidate image | **PASS** | `serpbear-ranking-history-final:20261014`, ID `sha256:9b6386566303ce0ca1036cd560849de5d8ad72fe492331edf44cccdf74a8d39b`. |
| Compose identity | **PASS** | Project `serpbear-official`, service `app`, file `/home/kiwkiw/projects/serpbear/compose.official.yml`. |
| Runtime mapping | **PASS** | `127.0.0.1:3180 -> 3000/tcp`; volume `serpbear-official-data` mounted at `/app/data`. |
| Cloudflare Tunnel and Access | **PASS** | `serpbear-cloudflared.service` is active/running. Anonymous GETs to `/`, `/login`, `/api/domains`, and `/api/settings` each returned HTTP 302, consistent with the existing Access redirect. No session cookies were used. |
| Scraping/provider settings | **PASS** | `scraper_type=none`, `scrape_interval=never`, `scrape_retry=null` (falsey/disabled), failed queue is empty. No provider or integration credential values are configured in application settings or provider-related environment variables. |
| Production URL | **PASS** | `NEXT_PUBLIC_APP_URL=https://serpbear.bewara.xyz`. |
| Production database before backup | **PASS** | Read-only `PRAGMA integrity_check` returned `ok`; domain count 0; keyword count 0. |

## Backup verification

A SQLite Online Backup API snapshot was created without changing production database contents. The verified host copy is:

- **Path:** `/var/backups/serpbear/serpbear-predeploy-20261014T050431Z.sqlite`
- **SHA-256:** `e9475d1d4989a7152547096bb8e8b3aee440e85762cdf7e2ac67be2fb315f84e`
- **Permissions:** directory mode `700`, file mode `600`; owner UID/GID `1000:1000`
- **Verification:** `PRAGMA integrity_check=ok`; 0 domains; 0 keywords

The backup copied from the required host path was re-opened read-only and verified. No existing backup was overwritten or removed.

## Post-deployment verification

| Check | Result | Evidence |
|---|---|---|
| Candidate running | **PASS** | Container uses `serpbear-ranking-history-final:20261014`, image ID matches `sha256:9b6386566303ce0ca1036cd560849de5d8ad72fe492331edf44cccdf74a8d39b`. |
| Health/startup | **PASS** | Container reports `running`, `healthy`, restart count 0. Startup log says the schema was already up to date and the app listens on port 3000. No startup, migration, SQLite, or application errors appeared in the inspected startup logs. |
| Production resources | **PASS** | Port remains `127.0.0.1:3180`; volume remains `serpbear-official-data:/app/data`; restart policy remains `unless-stopped`. Other Docker containers were still running after the app-only Compose command. |
| Database/data preservation | **PASS** | Read-only `PRAGMA integrity_check=ok`; domain and keyword counts remain 0/0, matching the pre-deployment snapshot. No migration ran. |
| Settings/provider state | **PASS** | `scraper_type=none`, `scrape_interval=never`, retry remains falsey/disabled, failed queue count 0, no provider credentials configured, and public URL remains `https://serpbear.bewara.xyz`. |
| Cloudflare edge protection | **PASS** | Tunnel service remains active/running. Anonymous requests to `/`, `/login`, `/api/domains`, `/api/settings`, and `/api/keywords` returned HTTP 302 through the public hostname, consistent with Access enforcement. No cookies or credentials were used. |
| Scraping activity | **PASS WITH LIMITATION** | New container startup logs contain no `START SCRAPE` event or SERP host request; providers remain disabled and interval remains Never. No packet-level outbound capture was performed, so absence of all outbound traffic is not independently verified. |
| Authorized UI verification | **PASS** | Operator confirmed Cloudflare Access authentication, SerpBear login, dashboard, Domain Management, and Keyword Management navigation using the approved browser identity at 2026-10-14 05:12 UTC. No keyword was created and no refresh was run. Credentials and cookies were not collected. |

No login or UI verification was performed by bypassing Cloudflare Access.

## Dependency audit risk

The saved `npm audit --omit=dev` result reports 44 advisories in the production dependency graph: 2 low, 13 moderate, 26 high, and 3 critical. Notable direct production dependencies include Next.js 12.3.7 (critical), Axios 1.13.5 (high), Nodemailer 8.0.1 (high), Sequelize 6.37.7 (high), sqlite3 5.1.7 (high), and Umzug 3.8.2 (high). The graph also includes critical advisories for transitive `shell-quote` 1.8.3 and `tar` 6.2.1. Next.js is part of the live application server path; the audit does not establish exploitability for every advisory or code path. No dependencies were changed. A fresh audit request could not reach `registry.npmjs.org` from the sandbox (`EAI_AGAIN`), so these counts are from the saved same-day audit result.

## Deployment and rollback

Deployment completed after the verified backup and explicit `DEPLOY_SERPBEAR_APPROVED` authorization. Only the `app.image` reference in `compose.official.yml` was changed, and Compose recreated only the `app` service with `--no-deps`. The application had a brief interruption during replacement. The environment, volume, port, restart policy, Cloudflare configuration, and disabled scraping settings were preserved.

No rollback was required. If a later critical health, authentication, or database-integrity failure is confirmed, restore `towfiqi/serpbear:3.1.0@sha256:31bc71dc02a7d4efe4170e76eefac8be06077fb03d8d215919b602032dde3c38` in Compose and recreate only `app` with the existing volume. Do not restore the SQLite backup unless data corruption is confirmed and a separate recovery decision is approved.

## Final result

`SERPBEAR_PRODUCTION_DEPLOYMENT_SUCCESS`. The approved candidate is running and healthy, the verified pre-deployment backup is retained, post-deployment database/settings checks match the baseline, Cloudflare Access remains enforced, and the operator confirmed the authorized UI flow. No rollback was needed. The dependency advisories listed above remain an unresolved security risk; no dependency upgrade was included in this deployment.
