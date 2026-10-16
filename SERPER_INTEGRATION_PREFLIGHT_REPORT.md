# Serper.dev Integration Preflight

**Status: `SERPER_PREFLIGHT_BLOCKED`**

No Serper API request was made. No production keyword, domain, Docker service, or Cloudflare setting was changed by this preflight. The operator reported adding a Serper credential in Settings; a sanitized read-only check confirmed `scraper_type=serper` and that a credential is configured. Its value was not read into output or recorded here.

## Current production state

| Check | Result |
|---|---|
| Container | PASS — `serpbear-official-app` is running and healthy on image `serpbear-tar-runtime-candidate:20261014`, ID `sha256:d12c177e13465308e9f46e9ffc16604da1daa7041fe6c4d8a69c7343beceac9a`. |
| Origin binding | PASS — only `127.0.0.1:3180` maps to container port 3000. |
| SQLite | PASS — read-only integrity check is `ok`; 0 domains and 0 keywords. |
| Scraping settings | PASS — strategy `basic`, schedule `never`, retries disabled, failed queue empty. |
| Provider setting | **BLOCKER** — Serper is selected and a key is configured. This check reported presence only. |
| Cloudflare Access | Not retested in this scoped preflight. The prior [tar runtime deployment report](TAR_RUNTIME_DEPLOYMENT_REPORT.md) records successful operator browser verification; no Cloudflare configuration was changed here. |

**Production caution:** keyword creation asynchronously calls the refresh function. With the current production Serper adapter, creating one keyword now would attempt a live request using the legacy GET URL, which contains the key as a query parameter. Do not add `MAHJONGJP88`, use a refresh action, or press the Ideas screen's **Perform Google Search** button until the adapter blocker is resolved and a separate live-test approval is given. `Never` prevents scheduled scraping; it does not suppress the immediate refresh caused by keyword creation.

## Integration findings

| Area | Finding |
|---|---|
| Production request method/auth | `scrapers/services/serper.ts` currently builds `GET https://google.serper.dev/search?...&apiKey=<key>`. `utils/scraper.ts` sends GET and has no Serper auth header. The key is therefore placed in the request URL. The current code does not print the full URL on its normal path, but query strings can enter URL-level diagnostics or intermediary telemetry. |
| Official API evidence | The publicly accessible [Serper site](https://serper.dev/) describes its Google Search API, localization by country/language, real-time queries, and credit deduction for successful responses. Its accessible [playground](https://serper.dev/playground) and public site do not expose a complete request/authentication specification or a device parameter. I did not send a request to test legacy GET compatibility. |
| POST/header compatibility | Current public client integrations use `POST https://google.serper.dev/search` with JSON and `X-API-KEY`; examples include [Agno's Serper client](https://github.com/agno-agi/agno/blob/main/libs/agno/agno/tools/serper.py) and the [API Evangelist catalog](https://github.com/api-evangelist/serper/blob/main/README.md). These are corroborating third-party sources, not a substitute for an official Serper API specification. Legacy GET/query-key support remains **unverified** and should not be relied on. |
| Target parameters | SerpBear's country table maps `ID` to Indonesia and `id` (`utils/countries.ts`). The isolated adapter maps query to `q`, country to `gl=id`, language to `hl=id`, page 1 and 10 results; no city is sent when unset. Serper's public site confirms country/language localization. |
| Device | SerpBear stores `desktop`/`mobile` and changes its generic User-Agent for direct scraping, but the Serper adapter currently sends no device parameter. The public Serper documentation available during this review does not specify device selection. The requested Desktop SERP therefore cannot be independently enforced or verified for Serper.dev. |
| Result mapping | Serper `organic[]` entries map `title` and `link` to SerpBear `title` and `url`. The generic scraper assigns organic entries sequential positions (page 1: 1–10), then matches the target host. It ignores a leading `www.` on both sides; other subdomains require a configured subdomain rule. A successful nonempty organic response with no match produces position 0. |
| Ranking history | The deployed Ranking History fix writes a date entry only when the scrape result has no error. The isolated tests confirm successful found/not-found results update history and provider failures preserve history and position. |
| HTTP/provider errors | Production `scrapeSinglePage` parses JSON without checking `response.ok`; 401/429 can become a generic empty-response failure, while invalid JSON is caught as a parsing error. It does not intentionally log the API key, but key-in-URL remains a risk. |

The Serper homepage currently advertises 2,500 free queries, says successful query responses deduct credits, and notes that Google-side retries can make some provider responses take longer. It does not publicly establish an exact `num=10` to credit conversion or an account-level one-request spending cap. The [third-party API catalog](https://github.com/api-evangelist/serper/blob/main/README.md) says a 100-result request can consume twice the credits, but this is not independently confirmed in accessible first-party documentation. Treat one 10-result request as an **expected** one-standard-query/credit estimate, not a verified billing guarantee.

## Request-count analysis

- `POST /api/keywords` invokes `refreshAndUpdateKeywords` immediately after saving. One submitted keyword with Basic strategy selects page 1 only; the isolated mock confirms exactly one Serper `fetch` for that operation.
- Basic uses 10 organic results. It does not invoke pagination or smart fallback. Keep global and domain-level strategy at Basic.
- `scrape_retry=false`, schedule Never, and the currently empty failed queue prevent retry and scheduled SERP jobs for the present state. The cron process checks the failed queue hourly, but it is empty; a new failed attempt is not queued while retries remain off.
- Manual Refresh can initiate another query and is excluded from the proposed test.
- SerpBear also has a separate authenticated `GET /api/refresh?keyword=...` path behind the Ideas screen's **Perform Google Search** button. It invokes `scrapeKeywordFromGoogle` directly and is a separate request trigger. Do not use it in the single-query procedure.
- The application has no global one-request budget lock or provider-side per-test cap verified here. A single deliberate keyword submission maps to one application request in Basic, but the one-request/one-credit ceiling is not a hard server-side limit. Provider account balance and billing history were not inspected.

## Isolated adapter correction and offline validation

An isolated clone was created from the deployed source commit `6f2d8f4e7439fcfc03fea1d80dff04eaf7e80c99` at `/tmp/serpbear-serper-preflight`, branch `serper-integration-preflight-20261014`. The production checkout was left untouched.

The candidate commit is `3ef5f1c` (`fix(scraper): use secure Serper API requests`). It changes Serper to POST JSON with `X-API-KEY`, a fixed endpoint URL, redirect rejection, a bounded timeout, status-code errors that do not surface provider response bodies, and a missing-key fail-closed check. The payload limits `num` to 10, including the alternate preview code path, and preserves `q`, `gl`, `hl`, page, and optional location. No production image was built or replaced.

Offline validation used only a mocked fetch and a synthetic placeholder key:

- Serper integration + Ranking History tests: **15/15 PASS**.
- TypeScript `tsc --noEmit`: **PASS**.
- ESLint on changed files: **PASS**.
- Mock cases covered: found domain, nonmatching domain, empty/missing organic data, HTTP 401, HTTP 429, timeout failure, missing credential, one Basic request, 100-result caller capped to 10, direct-preview HTTP failure, and history/position behavior.
- No request was sent to the Serper Search API (`google.serper.dev`) or Google Search. Full Jest suite, production build, Docker build, and live-provider compatibility were not run for this preflight.

## Blockers and next action

1. Production still runs the legacy GET/query-key adapter. The isolated POST/header candidate is not deployed. A keyword add now could send the configured key in a URL; do not create the target keyword yet.
2. Serper.dev device behavior is undocumented in the accessible first-party materials, so the Desktop requirement is unverified.
3. The exact one-credit billing rule and an account-level one-request cap are unverified. The application only gives an operational one-request path for one Basic keyword submission; it does not enforce a global spend cap.

Next: confirm with Serper whether its `/search` API guarantees desktop results and the precise credit charge for a 10-result request; confirm a provider-side balance/limit adequate for at most one standard request. Then review and separately authorize deployment of the isolated adapter fix. Only after that, request a separate explicit approval for the single billable Google lookup. Do not use the production key for compatibility probing.
