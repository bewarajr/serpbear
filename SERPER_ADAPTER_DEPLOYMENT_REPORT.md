# SerpBear Serper Adapter Deployment

**Status: `SERPER_ADAPTER_DEPLOYMENT_SUCCESS` — deployment, server-side checks, and authorized browser verification passed.**

## Deployment

- Deployment approval: operator supplied `DEPLOY_SERPER_ADAPTER_APPROVED` before the production container was recreated.
- Deployment time: 2026-10-14 10:25:10 UTC (candidate container start time).
- Previous production image: `serpbear-tar-runtime-candidate:20261014`, `sha256:d12c177e13465308e9f46e9ffc16604da1daa7041fe6c4d8a69c7343beceac9a`.
- Deployed image: `serpbear-serper-adapter-candidate:20261014`, `sha256:5075a0d44ecd5a698e71727271e8100cb18aed087243d410c026137214e7d955`.
- Source commit: `cf6d4f8818962869aa1a751897a84ed45e22d491`; clean worktree and exact image were verified before deployment.
- Only `services.app.image` in `compose.official.yml` was changed. The app was recreated with `docker compose -f compose.official.yml up -d --no-deps app`.

## Backup and pre-deployment snapshot

- SQLite Online Backup API snapshot: `/var/backups/serpbear/serpbear-serper-adapter-predeploy-20261014T102116Z.sqlite`.
- SHA-256: `e9475d1d4989a7152547096bb8e8b3aee440e85762cdf7e2ac67be2fb315f84e`.
- Permissions and owner: mode `600`, UID/GID `1000:1000`.
- Backup `PRAGMA integrity_check`: `ok`.
- Pre-deployment and backup counts: 0 domains, 0 keywords.
- Existing production image remains available for rollback; backup retained.

## Post-deployment checks

| Check | Result |
|---|---|
| Container and exact image | PASS — `serpbear-official-app` running and healthy on the expected candidate image ID. |
| Persistent configuration | PASS — volume remains `serpbear-official-data`; port remains `127.0.0.1:3180`; `NEXT_PUBLIC_APP_URL` remains `https://serpbear.bewara.xyz`. |
| SQLite | PASS — live database `integrity_check=ok`; counts remain 0 domains and 0 keywords, matching backup/preflight. |
| Provider settings | PASS — Serper provider remains configured; key is present and encrypted at rest. Schedule is `never`, strategy `basic`, retries are disabled, failed queue is empty. No setting was changed by deployment. |
| Phase 1 security and ranking fix | PASS — runtime versions remain Sequelize 6.37.8, Axios 1.20.0, and shell-quote 1.12.0. Direct runtime `tar` and `node-gyp` packages are unavailable. The candidate source retains the Ranking History guard; the change set since the tar-runtime baseline does not modify `utils/refresh.ts`, `Dockerfile`, or dependency manifests. |
| Local route/auth behavior | PASS — `/`, `/login`, and `/domains` return HTTP 200 locally; unauthenticated `/api/domains`, `/api/settings`, and `/api/keywords` return HTTP 401. |
| Cloudflare Access | PASS — unauthenticated requests to `/`, `/login`, `/api/domains`, and `/api/settings` through the public hostname return HTTP 302 to the Access flow. No Cloudflare configuration was changed. |
| Unexpected SERP activity | PASS — no scrape-start log entries, Serper host/search URL, or API-key query parameter was found in startup logs. No keyword or refresh was issued. |
| Authorized browser flow | PASS — operator confirmed Cloudflare Access, SerpBear login, Dashboard, Domain Management, and Keyword Management navigation. No credentials or cookies were requested. |

No live Serper.dev or Google request was made, and no credit was consumed. No domain or keyword was created. No other Docker service was recreated.

## Remaining security risk

The deployed Next.js version remains 12.3.7. The prior Phase 1 production audit recorded 2 critical and 23 high findings, including critical Next.js advisories. Direct `tar` and `node-gyp` packages are absent from the runtime, but this deployment does not establish whether any tar implementation remains bundled inside Next.js. This adapter deployment does not claim that all dependency advisories are fixed.

## Rollback

If a critical check fails, change only `services.app.image` back to `serpbear-tar-runtime-candidate:20261014`, then run `docker compose -f compose.official.yml up -d --no-deps app`. Preserve `serpbear-official-data` and all production settings. Do not restore the SQLite backup unless corruption is confirmed and a separate recovery decision is approved. Rollback has not been needed.

## Browser verification

The operator confirmed all authorized browser checks passed: Cloudflare Access, SerpBear login, Dashboard, Domain Management, and Keyword Management navigation. No keyword was created and no refresh was run. No live Serper.dev or Google request was made. Live ranking testing requires separate approval.
