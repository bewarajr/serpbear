# SerpBear First Live Google Ranking Test

**Status: `REAL_RANKING_TEST_PASS`**  
**Outcome: `NOT_FOUND_IN_TOP_10`**  
**Live test completed:** 2026-10-14

## Scope

One approved production ranking check was performed for `mahjongjp88untouchable.com` and `MAHJONGJP88`. The provider returned a successful response, and SerpBear stored the resulting not-found observation. No second SERP request, manual refresh, retry, schedule change, deployment, source change, or Cloudflare change was made.

## Preflight

| Check | Result |
|---|---|
| Production image and health | PASS — image `sha256:5075a0d44ecd5a698e71727271e8100cb18aed087243d410c026137214e7d955`; container healthy before and after the test. |
| Cloudflare Access | PASS — unauthenticated public request was redirected to the Access flow. No policy was changed. |
| Serper adapter | PASS — deployed bundle uses `POST https://google.serper.dev/search`, sends the key in `X-API-KEY`, and builds the request with `gl=id`, `hl=id`, page 1, and a maximum of 10 results. |
| Provider key | PASS — configured and encrypted in persistent settings; its value was never printed or written to this report. |
| Scrape settings | PASS — provider `serper`, strategy `basic`, schedule `never`. `scrape_retry` is absent from the stored JSON and therefore falsey in runtime retry checks; no retry occurred. |
| Queue and active work | PASS — failed queue empty; no existing keyword or refresh was running before the test. |
| SQLite and duplicates | PASS — integrity check `ok`; before the test there were 0 domains and 0 keywords, with no target domain or keyword duplicate. |
| Other integrations | PASS — no Google Ads credentials were configured to trigger a separate volume lookup. |

The operator confirmed that the Serper account had credit for at least one query. The test used the production Serper key already stored in SerpBear; no key value was exposed.

## Execution

1. Created `mahjongjp88untouchable.com` once through the authenticated SerpBear API (HTTP 201).
2. Created `MAHJONGJP88` once for country `ID`, with device unspecified (HTTP 201). This creation triggered the normal automatic refresh.
3. Issued no manual refresh, retry, pagination request, or second keyword creation.

The deployed Basic strategy selects page 1 only and calls the scraper once for that page. The Serper adapter caps `num` at 10. With one keyword creation, the application flow initiated one Serper Search API fetch. A packet-level request counter was not available; the count is verified from the single create action and the deployed Basic request path. Serper's internal Google retry behavior, if any, is outside SerpBear's outbound request count.

## Result

| Field | Result |
|---|---|
| Provider response | Successful HTTP 2xx; the exact numeric status is not persisted or logged by the application. |
| Country / language | Indonesia — `gl=id`, `hl=id`. Device unspecified. |
| Strategy / requested depth | Basic, page 1, maximum 10 organic results. |
| Organic results processed | 4 valid organic destination records were returned and examined. SerpBear stores a 100-position display array; 96 entries were marked skipped placeholders, not additional results. |
| Ranking | Position `0` — target domain was not present in the 4 returned organic records. No matching URL. |
| Outcome classification | `NOT_FOUND_IN_TOP_10` — not found in the organic results returned within the requested top-10 scope. The provider returned 4 results, rather than 10. |
| Ranking History | `2026-10-14: 0` — a successful not-found observation, not a scraping error. |
| `lastUpdated` | `2026-10-14T10:44:58.745Z` |
| `lastUpdateError` | `false` |
| Refresh state / retry queue | Refresh completed; failed queue count `0`. |
| SQLite integrity | `ok` after the test. |

The adapter accepted and parsed the provider response. The app does not retain the exact HTTP status code, so this report records the verified successful 2xx class rather than guessing a specific code.

## Credit estimate and request count

Application-level Serper Search API request count: **1**. The operator confirmed sufficient balance. One standard credit remains an estimate: Serper's official page equates 50,000 credits with 50,000 submitted queries and says credits are deducted for successful responses, but does not state the exact billing rule for a request with `num=10`. [Serper pricing and FAQ](https://serper.dev/)

## Final state

- One target domain and one target keyword remain in production, with the observed history preserved.
- Scrape schedule remains `never`; retries remain effectively disabled; failed queue is empty.
- Production container remains healthy on the verified image. SQLite remains intact.
- No production settings, Docker resources, source code, Cloudflare configuration, or unrelated services were changed.
- No additional live request was made after the result.

The earlier `REAL_RANKING_TEST_REPORT.md` is a pre-deployment preflight for a different provider configuration and predates this approved Serper test; this report records the completed live test.
