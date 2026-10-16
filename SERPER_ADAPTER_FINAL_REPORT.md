# Serper.dev Adapter Finalization

**Status: `SERPER_ADAPTER_READY` — offline checks and isolated mock Runtime UAT passed.**

No live Serper or Google request was made. Production settings, database, container, Cloudflare configuration, and provider key were not changed.

## Production read-only preflight

| Check | Result |
|---|---|
| Container/image | PASS — `serpbear-official-app` was running and healthy on `serpbear-tar-runtime-candidate:20261014`, image `sha256:d12c177e13465308e9f46e9ffc16604da1daa7041fe6c4d8a69c7343beceac9a`. Origin remains bound to `127.0.0.1:3180`. |
| SQLite | PASS — integrity check `ok`; zero domains and zero keywords. |
| Serper settings | PASS — provider `serper`, key configured and encrypted at rest, strategy `basic`, schedule `never`, retries `false`, failed queue empty. Google Ads credentials are not configured. |
| Cloudflare Access | PASS — an unauthenticated HTTPS request received HTTP 302 from Cloudflare to its Access login flow. Only sanitized status/booleans were retained. |
| Legacy GET URL logging | No evidence found in the retained application Docker logs scanned for the last 720 hours: no Serper endpoint or API-key query-parameter pattern. This does not cover logs outside Docker or provider/intermediary telemetry. No exposure was identified, so this review does not recommend key rotation. |

The production checkout contains unrelated local changes. Candidate work was isolated from it; no existing application or deployment file in that checkout was changed. This report is the only new file written there.

## Candidate source and adapter

- Production integration baseline: `6f2d8f4e7439fcfc03fea1d80dff04eaf7e80c99` (deployed tar/node-gyp runtime fix).
- Existing adapter candidate: `3ef5f1ca69777252be63619867a1b6f9dcf77da1`.
- Final offline candidate commit: `cf6d4f8818962869aa1a751897a84ed45e22d491` in `/tmp/serpbear-serper-final`, based directly on `3ef5f1c`.
- Candidate tree: `1818d5800d8a700cb4b07248913150c5266a653b`.
- Docker image built from that source tree with the maintained `Dockerfile`: `serpbear-serper-adapter-candidate:20261014`, ID `sha256:5075a0d44ecd5a698e71727271e8100cb18aed087243d410c026137214e7d955`. Image user is `nextjs` (non-root).

The adapter uses one fixed `POST https://google.serper.dev/search`, puts the key in `X-API-KEY`, and sends JSON containing `q`, `gl`, `hl`, page, and a result count capped at 10. For the target, the tested request mapping is `gl=id`, `hl=id`, `page=1`, `num=10`; no device field is sent. Serper's public site says search location can be customized by country and language; it does not document device targeting in the material checked, so this run is treated as device-unspecified. [Serper public API/pricing page](https://serper.dev/)

The response parser reads `organic[]` entries (`title`, `link`) and SerpBear assigns positions by organic array order. Matching strips a leading `www.` and matches the configured host. The mock target `mahjongjp88untouchable.com` matched `www.mahjongjp88untouchable.com` at the third organic result. A successful response without a match records position 0; missing/empty/invalid response data is a failure.

The adapter rejects redirects, applies a 15-second abort timeout, checks HTTP status without surfacing provider response bodies, and never places the key in the request URL. The final small source addition redacts the configured Serper key from unexpected fetch exception messages before logging or storing an error. API-key-at-rest encryption remains the production settings handler's existing behavior.

The exact POST/header request contract has been validated with offline mocked-fetch tests and an isolated HTTPS mock runtime. No live call was allowed, so provider acceptance and account-specific behavior remain unverified.

## Request-count and credit budget

For one keyword, `POST /api/keywords` saves the keyword and calls the refresh flow once. Basic strategy selects only page 1, which invokes one Serper `fetch`; it has no pagination or fallback. With `scrape_retry=false`, failed work is removed from the retry queue; `scrape_interval=never` prevents scheduled refresh. Creating the keyword already triggers the refresh, so the planned live sequence must not call Manual Refresh, `/api/refresh`, or repeat the create action. Production has no Google Ads credentials that would trigger its separate volume lookup.

Under that single controlled create action, the application path produces at most one SerpBear-to-Serper Search API request. This is not a global server-side spend limiter: a second explicit API action or manual refresh can make another request. The live procedure must therefore perform exactly one keyword creation and stop. Serper also says some response times increase when it retries submission to Google internally; those provider-side attempts are outside SerpBear's request counter. [Serper FAQ](https://serper.dev/)

Serper's public pricing page equates 50,000 credits with 50,000 submitted queries and says credits are deducted on successful responses. That supports an estimate of **one standard credit for the one standard query**, but the public first-party page checked does not state the exact `num=10` billing rule. Treat one credit as an estimate, not a guarantee. The account balance was not available for read-only verification. [Serper pricing and credit FAQ](https://serper.dev/)

## Offline validation

Using only mocked HTTP responses and a synthetic key, the final candidate passed:

- Full Jest: **13 suites, 59 tests passed**.
- TypeScript (`tsc --noEmit`): **PASS**.
- ESLint: **PASS**, no warnings or errors.
- Next.js production build: **PASS**.
- Docker build: **PASS**; candidate image ID recorded above.
- Tests cover found and not-found hosts, empty/missing/invalid organic data, HTTP 401/403/429, timeout, missing key, one Basic request, `gl=id`/`hl=id`, `num=10`, www-host matching, history on success, no history on failure, retry behavior, and key absence from URL/error/log output.

The Jest run displayed one pre-existing React `act(...)` warning in `pages/domain.test.tsx`; all tests passed. The Next build displayed existing outdated Browserslist and Tailwind configuration warnings; build completed successfully. `npm ci` made no dependency manifest or lockfile changes. Installed versions remain Next.js 12.3.7, Axios 1.20.0, Sequelize 6.37.8, and shell-quote 1.12.0. Runtime UAT confirmed direct `require.resolve('tar')` and `require.resolve('node-gyp')` lookups fail in the candidate, while the native `sqlite3` binding loads. This check does not assess copies bundled inside Next.js, so it does not establish that all tar implementation code is absent.

## Isolated Runtime UAT — PASS

Operator approval was received for mock Runtime UAT only. No production deployment or live SERP request was authorized or performed.

| Check | Result |
|---|---|
| Candidate image | PASS — exact ID `sha256:5075a0d44ecd5a698e71727271e8100cb18aed087243d410c026137214e7d955`; candidate image was not rebuilt or replaced. |
| Network and isolation | PASS — dedicated Docker network had `internal: true` and only the UAT app and mock attached. App port was published only on `127.0.0.1:3202`. No route to Serper.dev or Google was available from the UAT network. |
| Container health | PASS — app became healthy on the exact candidate image. The native `sqlite3` module loaded. Direct `tar` and `node-gyp` package lookups were unavailable in the runtime. |
| Authentication and navigation | PASS — synthetic login succeeded; `/login`, dashboard, and Domain Management page returned HTTP 200 after authentication. |
| Settings persistence | PASS — the synthetic Serper key and Basic/Never/no-retry settings survived a settings API write and subsequent read. The UAT volume was later removed. |
| Domain CRUD | PASS — created, read, updated, and deleted synthetic `example.com`; final domain row count was zero. |
| Keyword CRUD | PASS — created four synthetic keywords, updated sticky state and tags, and deleted all four; final keyword row count was zero. |
| Successful ranking | PASS — mocked organic results put `example.com` at position 2 with `https://example.com/mock-result`; history value 2 was recorded. |
| Successful not-found | PASS — a valid response without the target recorded position 0 and history 0, with no error. |
| Error handling and history | PASS — synthetic HTTP 401 and 429 failures kept position at 0, left history empty, recorded `Serper HTTP 401` / `Serper HTTP 429`, and left the retry queue empty. |
| Request shape and count | PASS — the clean run produced exactly four mock requests, one per synthetic keyword create. Each was `POST /search`, with `X-API-KEY` present, `gl=id`, `hl=id`, `num=10`, and `page=1`. Three requests used the matching synthetic key; one intentionally used a mismatched synthetic key to exercise HTTP 401 handling. No duplicate, pagination, or retry request occurred. |
| Credential leakage | PASS — synthetic username, password, signing secret, app API key, and Serper key were not found in container logs. No API-key query parameter pattern was found. |
| SQLite | PASS — `PRAGMA integrity_check` returned `ok`; final domain and keyword counts were both zero. |
| Cleanup | PASS — only the UAT app/mock containers, UAT network, and UAT volume were removed. Checks confirmed those named resources are absent. The candidate image was retained. |

The initial mock sidecar image `node:22-alpine` was not present locally, so the UAT-only mock used the locally available `node:22-bookworm-slim`. This changed neither the SerpBear candidate image nor production. Test harness assertions were aligned with the API's actual JSON types; the final clean run passed all 15 checks. The mock recorded request metadata and booleans only, never the synthetic key value.

Production remained unchanged and healthy on image `sha256:d12c177e13465308e9f46e9ffc16604da1daa7041fe6c4d8a69c7343beceac9a`.

## First live ranking test plan (not authorized or executed)

Target: `mahjongjp88untouchable.com`, keyword `MAHJONGJP88`, country Indonesia (`gl=id`), language Indonesian (`hl=id`), device unspecified, Basic first page, schedule Never, retries disabled. After a separately approved production adapter deployment, the live test requires its own `APPROVE_SERPBEAR_SINGLE_LIVE_CHECK` authorization. Configure/retain the provider key securely, create the domain if needed, create the keyword exactly once, wait for its automatic refresh, record the organic URL/position/history/error, then restore the original provider and scraper settings. Do not issue a second refresh. Account credits must be checked by the operator before this later approval; current balance is unknown.

## Production deployment and rollback plan

This candidate is not deployed. After a separate deployment approval is received, take a fresh consistent SQLite backup and verify its checksum/integrity. Change only the production SerpBear app image reference to the candidate image ID, recreate only that app service with dependencies untouched, and preserve its existing volume, settings, localhost port binding, Tunnel, and Access policy. Verify health, login, SQLite, settings, and runtime behavior before any live-query approval. Do not deploy by mutable tag alone; verify the image ID.

If critical post-deployment checks fail, restore the previous production image reference (`serpbear-tar-runtime-candidate:20261014`, `sha256:d12c177e13465308e9f46e9ffc16604da1daa7041fe6c4d8a69c7343beceac9a`) and recreate only the app service while keeping the production SQLite volume. Do not restore the backup unless database corruption is confirmed and separately approved.

## Remaining risks and next action

1. The candidate has not been deployed. Runtime UAT validates the adapter against a controlled mock, not Serper.dev's live service.
2. No live request has verified provider acceptance, real Google Indonesia results, or account credit use. Exact billing for `num=10` and the account balance remain unverified; one standard credit remains an estimate.
3. Direct runtime packages `tar` and `node-gyp` are absent, but this UAT does not establish that all tar code bundled by Next.js is absent.

The adapter is ready for separately approved production deployment. Deployment approval does not authorize a billable SERP lookup. The live ranking test still requires separate `APPROVE_SERPBEAR_SINGLE_LIVE_CHECK` approval after the operator reviews the request and credit uncertainty. No deployment or live test was performed as part of this Runtime UAT.
