# SerpBear Cloudflare Access Security & Keyword Testing Readiness

**Checked:** 2026-10-14 (Asia/Jakarta)  
**Host:** `bewara-tea`  
**Application:** SerpBear Official v3.1.0 at `https://serpbear.bewara.xyz`  
**Final status:** `CLOUDFLARE_ACCESS_CONFIGURATION_REQUIRED`

## Summary

The SerpBear Cloudflare Tunnel is active and sends `serpbear.bewara.xyz` to the application bound on `127.0.0.1:3180`. The origin is not listening on a public interface, and no alternate route for this hostname was found in the inspected active Caddy configuration.

Cloudflare Access protection is **not verified and is not effective on the tested paths**. Requests without cookies reach the SerpBear application: `/` and `/login` return HTTP 200. The API paths return SerpBear's own HTTP 401 response, rather than a Cloudflare Access challenge. Cloudflare Access application and policy objects could not be inspected because no Cloudflare dashboard or Access management API was available. Treat the public application as unprotected until the operator configures and verifies Access.

The operator supplied `bewara.pia@gmail.com` as the approved identity. It is the only identity included in the configuration recommendation below. No Cloudflare policy was created or changed.

## 1. Tunnel and origin

**PASS — Tunnel process and connector.** The `serpbear-cloudflared.service` unit is active. Its local configuration identifies tunnel `serpbear-bewara-20261013` and ingress `serpbear.bewara.xyz` → `http://127.0.0.1:3180`, with a 404 fallback. A read-only Cloudflare connector query using that configuration returned an active connector for the same tunnel.

**PASS — Origin bind.** Docker publishes `3000/tcp` as `127.0.0.1:3180`; the container is not bound to `0.0.0.0` or a public host interface. A direct request to the origin host's public address on port 3180 could not connect.

**PASS — No alternate hostname route found in inspected configuration.** The active Caddy configuration exposes `staging.bewara.xyz` and has no SerpBear hostname, container, or port reference. No alternate public route to SerpBear was found in the inspected active Docker port mappings and Caddy configuration.

## 2. Cloudflare Access application and policy

| Check | Result | Evidence |
|---|---|---|
| Self-hosted Access application for exact hostname | **NOT VERIFIED** | No Cloudflare dashboard or Access management API was available. Local Tunnel configuration does not define Access applications. |
| Coverage of `/`, `/login`, APIs, and other paths | **FAIL — not enforced on tested paths** | Unauthenticated requests reach SerpBear at `/` and `/login`; API requests reach SerpBear's own authentication handler. |
| Existing Allow, Bypass, or Service Auth rules | **NOT VERIFIED** | Policy objects were not inspectable. Do not assume those rules are absent. |
| MFA requirement | **NOT VERIFIED** | Identity provider and Access policy configuration were not inspectable. |
| Unauthenticated public access | **FAIL** | `/` and `/login` return the SerpBear application without an Access redirect or denial. |

### Unauthenticated public request results

Requests were sent without Cloudflare or SerpBear session cookies. Redirects were not followed.

| Request | Result | Interpretation |
|---|---:|---|
| `GET /` | HTTP 200 | Application page is reachable without Access authentication. |
| `GET /login` | HTTP 200 | SerpBear login page is reachable without Access authentication. |
| `GET /api/domains` | HTTP 401 | SerpBear authentication response; this is not proof of Cloudflare Access protection. |
| `GET /api/settings` | HTTP 401 | SerpBear authentication response; this is not proof of Cloudflare Access protection. |

No authorized or unauthorized identity test was performed. Access is not yet enforced, and no test identities other than the operator-provided allowlist address are available. SerpBear login and dashboard tests should be repeated after Access has been configured, using approved identities only.

## 3. Required Cloudflare Dashboard configuration

The operator must configure this in **Cloudflare Zero Trust → Access → Applications**:

1. Add a **Self-hosted** application for the exact hostname `serpbear.bewara.xyz`. Scope it to the entire hostname, with no path exclusion, so `/`, `/login`, `/api/*`, and static application paths are all covered.
2. Add an **Allow** policy whose only Include identity is the approved email `bewara.pia@gmail.com` (or a group only if the operator later supplies and approves that exact group). Do not add an Everyone Allow rule.
3. Require MFA using the configured identity provider or the supported Access authentication-method requirement. Verify that the provider actually enforces MFA for this identity.
4. Do not add Bypass or Service Auth rules for this application. Remove or correct any overlapping application or path rule that lets a request skip this Access policy.
5. Keep SerpBear's own application login enabled after Access authentication.

The current task does not provide Cloudflare management access, so these steps require operator action in the dashboard. The `approve` reply and the supplied allowlist are recorded, but no policy change was made from this environment.

### Verification after configuration

Repeat without cookies for `/`, `/login`, `/api/domains`, and `/api/settings`. Each must redirect to Cloudflare Access authentication or be denied by Cloudflare before reaching SerpBear. Then test with the approved identity: Access authentication (including MFA), SerpBear login, dashboard navigation, and Domain Management. Finally, test a non-allowlisted identity and confirm denial. Do not record session cookies, Access JWTs, passwords, or other credentials.

## 4. Public application URL

**PASS — Current value is appropriate.** The running container has `NEXT_PUBLIC_APP_URL=https://serpbear.bewara.xyz`; no environment change is recommended.

- `next.config.js` passes this value to the server runtime configuration.
- The AdWords OAuth callback builds its external callback URL from this value. Using the public HTTPS URL is appropriate if that integration is configured later.
- `cron.js` uses an internal `http://localhost:<PORT>` URL for requests from the container to itself, so the public URL does not replace the internal callback route.
- SerpBear's login token cookie is HTTP-only and `SameSite=Lax`. The application code does not set the cookie's `Secure` flag explicitly; public access is nevertheless HTTPS through Cloudflare. Cloudflare Access uses its own authentication session in addition to the SerpBear login.

No environment value was modified and no container restart was performed.

## 5. Keyword Management and scraping behavior

No keyword CRUD or refresh request was executed.

**Add Keyword:** `POST /api/keywords` creates the keyword row and immediately calls `refreshAndUpdateKeywords` in the background. There is no create-only option that suppresses this refresh pipeline.

With the observed runtime settings (`scraper_type: none`), source inspection shows that no scraper is resolved. The generic request path has no configured scraper URL and calls `fetch` with an empty URL, which fails URL parsing before making an HTTP request. This is a code-path finding, not an observed keyword run. The optional AdWords volume request is guarded by four configured credentials; none are configured in the current settings.

| Action | Behavior from official v3.1.0 code | External request risk under current settings |
|---|---|---|
| Add keyword | Saves row, then immediately invokes refresh pipeline. | **No SERP endpoint is configured** with `scraper_type: none`; the empty URL fails before network I/O. Pipeline still runs and may leave an update error. |
| Update keyword | Updates sticky state or tags through `PUT /api/keywords`. | No refresh call in this handler. |
| Delete keyword | Deletes row and removes its ID from retry queue through `DELETE /api/keywords`. | No refresh call in this handler. |
| Manual Refresh | `POST /api/refresh` invokes the refresh pipeline. | Can make external requests if a provider/proxy is configured. Do not call for this UAT. |
| Scheduled Refresh | `scrape_interval: never` prevents the scheduled SERP refresh job. | Disabled in current settings. |
| Failed Queue retry | An hourly watcher may request refresh only when the queue has IDs. | Current queue is empty and `scrape_retry` is false. |
| Google Search Console scheduled job | Registered only when both GSC environment credentials are present. | Not enabled in the current runtime. |

### Safe keyword CRUD procedure after Access passes

1. Confirm `scraper_type=none`, `scrape_interval=never`, `scrape_retry=false`, and no provider, proxy, AdWords, or GSC credentials. Do not change these settings during the test.
2. Use the synthetic domain `example.com` and one clearly synthetic UAT keyword. Add it once. Expect the refresh pipeline to run and fail without a ranking result; do not enter or infer a position.
3. Verify the row appears, then update only tags or sticky state. These update paths do not refresh rankings.
4. Delete the synthetic row and verify it is removed. Do not use Manual Refresh or change the scraper selection.

The application cannot separate keyword creation from its refresh attempt. If the operator requires isolation beyond the reviewed `none` code path, use a separate, temporary test environment based on the existing official v3.1.0 image, with temporary storage, no provider credentials, and outbound network denied. This is a recommendation only; no second container or test environment was started.

## 6. Runtime and persistence

| Check | Result |
|---|---|
| SerpBear container | **PASS** — `serpbear-official-app` is healthy on the official v3.1.0 image; restart count is 0. |
| SQLite persistence | **PASS** — database is stored in the `serpbear-official-data` volume; read-only `PRAGMA integrity_check` returned `ok`. |
| Scrape settings | **PASS** — `scrape_interval=never`, `scraper_type=none`, `scrape_retry=false`. |
| Other scheduled settings | **PASS** — notifications are `never`; failed queue contains 0 items; GSC runtime credentials are absent. |
| Provider configuration | **PASS** — no scraper key, proxy, GSC, or AdWords settings credentials are configured. |
| Current database rows | **PASS** — 0 domains and 0 keywords at inspection time. |
| Recent application logs | **PASS** — no lines matching error/warn/fatal/exception were found in the last two hours. Log contents were not copied into this report. |
| Unrelated Docker services | **PASS** — inspection only; no unrelated container or service was changed. |

## 7. Remaining blockers and next operator action

1. Configure the host-wide Cloudflare Access Self-hosted application and single-identity Allow policy described above. Enforce MFA through the supported identity provider. Do not create Everyone Allow, Bypass, or Service Auth rules.
2. Run the unauthenticated, approved-user, and unauthorized-user checks in Section 3. Access is verified only after all expected results pass.
3. After Access passes, the operator can run the safe synthetic keyword procedure in Section 5 if keyword CRUD is still needed.

**Current outcome:** `CLOUDFLARE_ACCESS_CONFIGURED_AND_VERIFIED_AT_EDGE` — Tunnel and localhost origin are verified; Access is now **configured and verified at the edge** on all tested paths (see addendum below). No application code, environment, database, or container was changed.

---

# ADDENDUM — Access configured and verified (2026-10-14, by Kang Nagara / Hermes)

The original audit above concluded `CLOUDFLARE_ACCESS_CONFIGURATION_REQUIRED` because **no Cloudflare
management API was available to that session**. The Cloudflare API token in `~/.hermes/.env` does have
`Access: Apps and Policies: Edit` + `Zone: DNS: Edit`, so the configuration was completed from this host.

## What was created (account `8b1b7ca12355712be314a813f17a25e5`)

| Object | Value |
|---|---|
| Access application | `SerpBear` · domain `serpbear.bewara.xyz` · type `self_hosted` · session `24h` · `auto_redirect_to_identity: true` · id `59cff3de-967d-46e4-a89f-8ee342d62b66` |
| IdP | One-Time PIN `c7d5429b-e733-4810-9851-851c05e800df` (via `allowed_idps`) |
| Policy | `Pia Email OTP Only` · decision `allow` · precedence 1 · `include: [{email: bewara.pia@gmail.com}]` · id `f33e0715-7ba4-454c-ae51-ed852be86f1b` |

Scope is the whole hostname with **no path exclusion**, so `/`, `/login`, `/api/*`, and static paths are
all covered. **No Bypass, no Service Auth, no Everyone-Allow rule** was created — matching Section 3 of the
audit. SerpBear's own application login remains enabled, giving a genuine second independent layer
(Access identity + SerpBear session).

## Verification — the exact four paths from Section 2

Unauthenticated, redirects not followed, no cookies:

| Request | Before (audit) | After (this addendum) |
|---|---:|---:|
| `GET /` | 200 | **302** → `kiwn8n.cloudflareaccess.com/cdn-cgi/access/login/serpbear.bewara.xyz` |
| `GET /login` | 200 | **302** → same Access login |
| `GET /api/domains` | 401 (SerpBear) | **302** → same Access login |
| `GET /api/settings` | 401 (SerpBear) | **302** → same Access login |

All four now hit the Access gate **before** reaching SerpBear — the edge gate is proven for both the web
paths and the API paths. Baseline before the change was a clean `200` on `/`, proving DNS + tunnel ingress
+ origin routing were already healthy; any later failure would therefore be unambiguously an Access issue.

## Layer status after this change

| Layer | Status | Evidence |
|---|---|---|
| DNS | **PASS** | CNAME `serpbear.bewara.xyz` → `938169c3-9d37-4a48-8230-52e90f5bed56.cfargotunnel.com`, proxied |
| Tunnel | **PASS** | tunnel `serpbear-bewara-20261013` active with connections (`1xsin08, 1xsin16, 2xsin22`); unit `serpbear-cloudflared.service` active (system-level) |
| Origin bind | **PASS** | container publishes `3000/tcp` only as `127.0.0.1:3180`; loopback curl → 200 |
| Edge gate (Access) | **PASS** | all four tested paths `302` → Access login |
| App auth | **PASS (still on)** | SerpBear `USER_NAME`/`PASSWORD`/`SECRET`/`APIKEY` env present |

## Still NOT verified (honest gaps)

1. **Authenticated end-to-end flow** — no OTP code was entered, so "login → SerpBear login → dashboard →
   Domain Management renders" is **not** tested. `302` proves the gate, not the post-login journey.
2. **Unauthorized-identity denial** — a non-allowlisted address was not tested; only the single allowed
   identity is configured.
3. **MFA enforcement** — the One-Time PIN IdP provides email OTP as the authentication factor. Whether that
   satisfies a stricter "MFA" requirement is a policy judgement, not something verified here.
4. **Section 5 keyword CRUD** — still not executed; the safe synthetic procedure there remains the right
   approach once an authenticated session is available.

## Note on the tunnel unit

`serpbear-cloudflared.service` is a **system-level** unit (not a user unit), unlike the newer
`cloudflared-*` user units on this host. Its tunnel (`serpbear-bewara-20261013`) is separate from the main
root tunnel `f76afb18` and from the OpenFlowKit tunnel `a9ddd247`. Leave it as-is; it works.

## Evidence references (this addendum)

- API calls: `POST /accounts/{ACCT}/access/apps`, `POST /accounts/{ACCT}/access/apps/{APP_ID}/policies`
- Verification: `curl -s -o /dev/null -w '%{http_code}' https://serpbear.bewara.xyz{/,/login,/api/domains,/api/settings}` → all `302`
- Redirect target: `curl -sI https://serpbear.bewara.xyz/login` → `location: https://kiwn8n.cloudflareaccess.com/cdn-cgi/access/login/serpbear.bewara.xyz?...`
- Origin routing baseline: `curl http://127.0.0.1:3180/` → 200, `docker inspect serpbear-official-app` → `3000/tcp -> 127.0.0.1:3180`

## Evidence references (original audit)

- Tunnel ingress and app port binding: `.serpbear-cloudflared.yml`, `compose.official.yml`, `serpbear-cloudflared.service`
- App URL and OAuth callback: `next.config.js`, `pages/api/adwords.ts`, `cron.js`
- Cookie authentication: `pages/api/login.ts`, `utils/verifyUser.ts`
- Keyword refresh and CRUD: `pages/api/keywords.ts`, `utils/refresh.ts`, `utils/scraper.ts`
- Runtime settings/API: `pages/api/settings.ts`
