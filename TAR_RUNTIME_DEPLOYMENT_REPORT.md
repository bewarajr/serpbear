# SerpBear tar Runtime Deployment Report

**Status:** `TAR_RUNTIME_DEPLOYMENT_COMPLETE_WITH_RESIDUAL_RISK`  
**Preflight:** 2026-10-14 08:50 UTC  
**Deployment:** 2026-10-14 08:56:56 UTC, after explicit `DEPLOY_TAR_RUNTIME_APPROVED` authorization  
**Production:** `https://serpbear.bewara.xyz`  

## Candidate and source verification

| Check | Result |
|---|---|
| Candidate tag and ID | **PASS:** `serpbear-tar-runtime-candidate:20261014`, `sha256:d12c177e13465308e9f46e9ffc16604da1daa7041fe6c4d8a69c7343beceac9a` |
| Candidate source | **PASS:** isolated worktree `/tmp/serpbear-tar-runtime`, branch `security-tar-runtime-20261014`, commit `6f2d8f4e7439fcfc03fea1d80dff04eaf7e80c99`; one-file Dockerfile change atop Phase 1 source commit `7ac9cecff424f49edfee549147f6495560ed8743` |
| Phase 1 fixes | **PASS:** source retains Sequelize 6.37.8, Axios 1.20.0, shell-quote 1.12.0, and the Ranking History guard that only writes history when `updatedKeyword.error` is false. The prior runtime security report records 46/46 Jest tests and the candidate runtime UAT passing. |
| Runtime package removal | **PASS WITH SCOPE:** the prior UAT used this exact image ID and verified the npm package `tar` and `node-gyp` were absent from `node_modules`, while sqlite3@5.1.7 opened and queried databases. Candidate image metadata reports user `nextjs` and only container port 3000 exposed. A separate Next.js vendored module at `next/dist/compiled/tar` is present; see the post-deployment finding below. |

The production checkout already contains unrelated uncommitted and untracked files. They were not overwritten. No source or Compose file was changed for this preflight.

## Production preflight

| Check | Result |
|---|---|
| Current application | **PASS:** `serpbear-official-app` running and healthy on `serpbear-security-phase1-candidate:20261014`, image ID `sha256:589f6a5718d76574793bfe1275f5f9fa21ed6259d32d3070b0393a4c9374de7c` |
| Compose service | **PASS:** project `serpbear-official`, file `/home/kiwkiw/projects/serpbear/compose.official.yml`, service `app` |
| Runtime configuration to preserve | **RECORDED:** restart `unless-stopped`; `127.0.0.1:3180 -> 3000/tcp`; volume `serpbear-official-data` mounted at `/app/data`; network `serpbear-official-network` |
| Rollback image | **PASS:** `serpbear-security-phase1-candidate:20261014` remains available locally with image ID `sha256:589f6a5718d76574793bfe1275f5f9fa21ed6259d32d3070b0393a4c9374de7c` |
| Cloudflare Tunnel and Access | **PASS, unauthenticated check:** `serpbear-cloudflared.service` is active. Anonymous GETs to `/` and `/manifest.json` return HTTP 302 to the Cloudflare Access flow. The earlier production report records operator-confirmed authenticated navigation. No authenticated browser session was available for this preflight. |
| Scraping and provider configuration | **PASS:** `scraper_type=none`, `scrape_interval=never`, retries disabled, failed queue empty. No provider credential fields are populated in application settings, and the container environment has no provider-specific variables. |
| Current SQLite database | **PASS:** read-only `PRAGMA integrity_check` returned `ok`; 0 domain rows and 0 keyword rows. |
| Other Docker services | **UNCHANGED:** no unrelated service was started, stopped, or recreated. |

## Verified production backup

A fresh snapshot was created using sqlite3's Online Backup API from the running production database. Temporary copies used during verification were removed after the protected copy passed verification.

- **Path:** `/var/backups/serpbear/serpbear-tar-runtime-predeploy-20261014T085036Z.sqlite`
- **SHA-256:** `e9475d1d4989a7152547096bb8e8b3aee440e85762cdf7e2ac67be2fb315f84e`
- **Permissions and owner:** mode `600`, UID/GID `1000:1000`
- **Size:** 32,768 bytes
- **Verification:** read-only `PRAGMA integrity_check=ok`; 0 domains; 0 keywords

The existing production volume and prior backups remain intact.

## Remaining security risks

The Phase 1 production-only audit recorded **2 critical, 23 high, 14 moderate, and 2 low** findings. This runtime packaging change does not clear the lockfile audit:

- **Next.js 12.3.7 remains in the production runtime** and is still the principal unresolved critical exposure.
- **tar 6.2.1 and node-gyp 8.4.1 remain in the dependency installation/build environment and lockfile**. The exact npm package directories are absent from `/app/node_modules`; Next.js's separate bundled tar code remains as described below.
- **sqlite3 5.1.7 remains installed for SQLite functionality** and its audit findings remain unresolved. This task does not upgrade sqlite3 or claim a clean audit.

The build/install environment must still be treated as exposed to its dependency advisories. The candidate reduces runtime package exposure; it does not fix vulnerable code in build stages or address Next.js.

## Deployment and post-deployment verification

The operator provided `DEPLOY_TAR_RUNTIME_APPROVED`. Only the `app` image reference in `compose.official.yml` was changed to `serpbear-tar-runtime-candidate:20261014`; Compose recreated only the SerpBear app with `--no-deps`. No Cloudflare, Tunnel, provider, or unrelated Docker configuration was changed.

| Check | Result |
|---|---|
| Running candidate | **PASS:** `serpbear-official-app`, container `dd0fb03e9dfee2890eef704e6ab32e946f53c044439ab07a626b6f599bb51034`, uses image ID `sha256:d12c177e13465308e9f46e9ffc16604da1daa7041fe6c4d8a69c7343beceac9a`; running and healthy, restart count 0. |
| Preserved production settings | **PASS:** port `127.0.0.1:3180 -> 3000/tcp`, volume `serpbear-official-data:/app/data`, network `serpbear-official-network`, and restart policy `unless-stopped` match the preflight. |
| SQLite and data | **PASS:** read-only `PRAGMA integrity_check=ok`; domain and keyword counts remain 0/0. The previously verified backup remains at the recorded path and checksum. |
| Scraping/integrations | **PASS:** `scraper_type=none`, interval `never`, retries false, failed queue 0; provider credential settings count 0 and integration flags are off. No scrape or refresh was invoked. |
| Phase 1 fixes | **PASS BY ARTIFACT:** the running digest is the exact candidate built from commit `6f2d8f4e7439fcfc03fea1d80dff04eaf7e80c99`; `utils/refresh.ts` in that commit retains the error guard before writing ranking history. The prior exact-image Jest and isolated UAT evidence remains applicable. No production keyword was created and no refresh was run, so this fix was not re-triggered against production data. |
| Tunnel/Access | **PASS:** `serpbear-cloudflared.service` remains active. Unauthenticated checks after deployment returned Cloudflare Access redirects where DNS resolution succeeded. The operator subsequently confirmed successful Cloudflare Zero Trust authentication. No policy or Tunnel change was made. |
| Login and dashboard | **PASS — OPERATOR CONFIRMED:** after deployment, the operator authenticated through Cloudflare Zero Trust and SerpBear, then opened Dashboard, Domain Management, and Keyword Management. No credentials or cookies were collected. |
| Startup errors | **PASS:** container became healthy with restart count 0; no `error`, `exception`, or `fatal` match appeared in the inspected post-start log window. |
| Other Docker services | **PASS:** every non-SerpBear container retained the pre-deployment container ID. |

### Runtime tar distinction

In the running image, `require.resolve("tar")` and `require.resolve("node-gyp")` both report absent, and a search found no `*/node_modules/tar` or `*/node_modules/node-gyp` package directories. However, `/app/node_modules/next/dist/compiled/tar` remains. Its bundled `package.json` has no version field; Next.js imports it from `download-wasm-swc.js` for its WASM SWC download/extraction fallback. The native `@next/swc-linux-x64-musl` package is installed in this image, so the fallback is not needed for the observed production startup. The bundled code's exact tar version and advisory status cannot be established from its package metadata. Therefore the npm `tar@6.2.1` build dependency and `node-gyp` are absent from normal runtime module resolution, but an absolute claim that all tar implementation code is absent would be false. This residual bundled code belongs to the unchanged Next.js package and was not modified under this deployment's scope.

## Manifest CORS investigation

`pages/_document.tsx` currently emits `<link rel="manifest" href="/manifest.json" />`; the manifest is a same-host public asset. An unauthenticated request to that path is redirected by Access, as expected for a protected hostname. The redirect sends the browser toward the separate Cloudflare Access team hostname; a manifest fetch that receives that login response instead of JSON can surface a browser CORS/manifest warning.

The authenticated request could not be captured in this preflight because there was no active authorized browser session. Therefore the exact cookie/request behavior after successful Access login remains unverified. A redirect at that point would indicate that Access did not receive or accept a valid application authorization cookie for the manifest request; a browser HAR and console entry would distinguish cookie-scope/session issues from a pure CORS response issue.

The smallest app-side correction to test separately is:

```html
<link rel="manifest" href="/manifest.json" crossorigin="use-credentials" />
```

The HTML Standard defines manifest fetches as CORS requests and derives their credentials mode from the link's `crossorigin` attribute. MDN specifically documents `use-credentials` for manifests that require authentication, including same-origin manifests. Cloudflare documents that Access-protected CORS requests require a valid `CF-Authorization` cookie. These sources support testing this attribute as a targeted fix; it does not bypass Access or make the manifest public ([HTML Standard](https://html.spec.whatwg.org/multipage/links.html#link-type-manifest), [CORS settings attributes](https://html.spec.whatwg.org/multipage/urls-and-fetching.html#cors-settings-attributes), [MDN manifest guidance](https://developer.mozilla.org/en-US/docs/Web/Progressive_web_apps/Manifest/index.html), [Cloudflare Access CORS](https://developers.cloudflare.com/cloudflare-one/access-controls/applications/http-apps/authorization-cookie/cors/)).

No manifest source change, CORS policy change, Access policy change, or deployment was made. After a separate source fix, verify in an authorized browser that the request includes Access credentials, returns HTTP 200 with a JSON manifest MIME type, and has no CORS warning; verify unauthenticated access still redirects to Access. If it still redirects, inspect the Access cookie scope/session and the authenticated HAR before considering any policy change.

## Deployment and rollback plan

After the exact approval `DEPLOY_TAR_RUNTIME_APPROVED`, change only `services.app.image` in `compose.official.yml` to `serpbear-tar-runtime-candidate:20261014`, then recreate only the app service with `docker compose -p serpbear-official -f compose.official.yml up -d --no-deps app`. Preserve the SQLite volume, environment, port binding, restart policy, Docker network, Tunnel, and Access configuration. Expect a brief application interruption. Do not enable scraping or providers.

Post-deployment checks: exact candidate image ID; healthy container; `tar` and `node-gyp` absent in runtime; SQLite integrity and unchanged row counts; settings and failed queue unchanged; local login/dashboard/Domain and Keyword navigation; anonymous Access redirects; and no new startup/runtime errors. Ask the operator to verify the authorized browser flow if an authenticated session is required. Do not create keywords or run refresh.

If a critical health, startup, authentication, or integrity check fails, restore `serpbear-security-phase1-candidate:20261014` in Compose and recreate only `app` with `--no-deps`, retaining the same volume. Verify the original image becomes healthy. Do not restore the SQLite backup unless actual database corruption is confirmed and a separate recovery decision is approved.

## Rollback and remaining verification

No rollback was performed: the candidate is healthy, SQLite is intact, and the preserved volume/settings match the preflight. The Phase 1 image remains available as `serpbear-security-phase1-candidate:20261014` with ID `sha256:589f6a5718d76574793bfe1275f5f9fa21ed6259d32d3070b0393a4c9374de7c`. If a critical startup, health, authentication, or integrity failure is confirmed, restore that image in Compose and recreate only `app` with `--no-deps`; retain the production volume and do not restore the database backup automatically.

The dependency audit still reports **2 critical and 23 high** findings from Phase 1, including Next.js 12.3.7 and build/install dependencies. The vendored Next.js tar bundle is unversioned and remains unassessed. The separate manifest CORS correction remains out of scope and was not applied.

**Deployment outcome:** candidate deployed; health, database, settings, and authenticated UI verification passed. The standalone npm `tar` package and `node-gyp` are absent from runtime module resolution, but the Next.js-bundled `next/dist/compiled/tar` remains and its advisory status is unknown. This report does not claim all tar implementation code was removed or all vulnerabilities were resolved. No additional production changes were made after the operator's UI confirmation.
