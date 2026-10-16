# SerpBear Real Positive Ranking Verification

**Final Status: `POSITIVE_RANKING_TEST_PASS` — Browser Verification Completed**

Test date: 2026-10-14. The operator approved and the single Shopee lookup has completed. No follow-up ranking tests are authorized.

## Production preflight

| Check | Result |
|---|---|
| Container and image | PASS — `serpbear-official-app` is healthy on image `sha256:6c8eca5d61b6ffbee30501e632c9a87ee11d8f6a47c511c13f77557f0a19e675`. |
| Application processes | PASS — one `server.js` and one `cron.js` process are running under the process supervisor. |
| Provider credential | PASS — Serper is selected; the API key is present, decryptable by the application, encrypted at rest, and the settings file has mode `600`. The key was not printed. |
| Schedule, retry, queue | PASS — schedule is `never`, retry is disabled, and the failed queue has 0 entries. |
| Refresh in progress | PASS — 0 refresh locks and 0 `started` audit records. |
| SQLite | PASS — `PRAGMA integrity_check` returned `ok`; 1 domain and 1 keyword are stored. |
| Candidate duplicates | PASS — no domain variants or exact keyword duplicates were found for `shopee.co.id` / `Shopee Indonesia`, `detik.com` / `detikcom`, or `canva.com` / `Canva`. |
| Existing MAHJONGJP88 record | PASS — retained as keyword ID 2 for `mahjongjp88untouchable.com`, country `ID`, position `0`, history `{"2026-10-14":0}`, `updating=false`. This record will not be changed. |
| Audit and ranking protections | PASS — `refresh_audit` and `refresh_lock` exist. Refresh audit currently has 0 rows. The deployed source includes the Ranking Position Fix and avoids writing history for failed scrapes. |
| Other keyword-creation integrations | PASS — Google Ads credential fields are all absent, so the keyword-create handler's optional volume lookup will not call Google Ads. |

## Proposed primary test

- Domain: `shopee.co.id`
- Keyword: `Shopee Indonesia`
- Country and language: Indonesia (`gl=id`, `hl=id`)
- Device: no device selector in the Serper JSON body. The keyword is stored as `desktop` and SerpBear sent a desktop-shaped caller User-Agent; provider device targeting is unverified.
- Strategy and depth: Basic, page 1, request `num=10` organic results.
- Schedule: Never. Retry: disabled.
- Maximum Serper Search API requests: one.

The deployed source commit is `53a349f15f6e0e569d9a5d9765f3c9651ec9e008`. The Serper adapter constructs a POST request to `https://google.serper.dev/search`; the country mapping for `ID` yields language `id`, and the request body sets `gl=id`, `hl=id`, `page=1`, and `num=10`.

Keyword creation uses `findOrCreate`; only a newly created keyword starts the normal asynchronous refresh, with trigger source `create`. The Basic strategy selects only page 1 and hard-caps the refresh budget at one request. The request budget is consumed immediately before the outbound fetch. The configured retry setting is false, and schedule Never suppresses cron-triggered refreshes; it does not suppress the one creation-triggered refresh. Domain creation itself does not invoke the ranking refresh. No manual refresh or second keyword submission will be made.

The Refresh Safety single-flight lock permits at most one active refresh for the keyword. If the exact keyword exists when checks are repeated immediately before execution, execution will stop without refreshing it. If the domain exists, it will be reused; otherwise it will be created once. The production preflight found neither the domain nor the keyword.

## Credit estimate and uncertainty

The public Serper pricing page associates credit packages with a corresponding number of queries and says credits are deducted for successful query responses. On that published mapping, the estimate is one query credit for one successful standard search; at the listed Starter price, the equivalent is approximately `$0.001` before tax. The account's balance, purchase tier, and actual billing record are not accessible from this read-only application check, so exact cost and available credits are unverified. Serper also notes that it may retry its submission to Google internally; SerpBear can enforce one outbound API request, but cannot observe or cap provider-internal work. [Serper pricing and query FAQ](https://serper.dev/)

The operator confirmed at least one query credit was available. No balance-check request was sent to Serper; actual account balance and debit remain unverified.

## Approved execution result

Operator approval `APPROVE_SERPBEAR_SHOPEE_LIVE_TEST` and confirmation of at least one available query credit were received. The application created `shopee.co.id` once and keyword `Shopee Indonesia` once (keyword ID 3). The new keyword's automatic creation refresh was the only refresh initiated. No manual refresh, duplicate submission, retry, or additional page request was made.

| Result | Evidence |
|---|---|
| Provider outcome | PASS — refresh audit recorded HTTP status category `2xx`; the exact numeric HTTP status was not retained by the audit schema. |
| Localization and request | PASS — stored country is `ID`; deployed adapter maps it to `gl=id` and `hl=id`. Basic strategy requested page 1 with `num=10`; audit records requested page `[1]`. The Serper request body is generated by the deployed source and is not stored verbatim. |
| Organic results | PASS — 7 raw organic entries, 7 accepted, 0 filtered. The provider returned 7 results, so this verifies the first 7 returned organic results, not ten results. |
| Ranking | PASS — provider-reported organic position 1; SerpBear stored position 1. Position before was 0 and position after was 1. |
| Matched destination | PASS — `https://shopee.co.id/`; its hostname matches the target domain after the existing `www.` normalization rule. |
| Ranking History | PASS — `{"2026-10-14":1}`. |
| Refresh Audit | PASS — refresh ID `f9e9e9b4-ace3-498b-bdeb-cb4761bfedc6`, trigger `create`, actor `authenticated_user`, status `completed`, requested pages `[1]`, outbound request count 1, provider category `2xx`, no error category. The audit records 1 request total across all rows. |
| Keyword state | PASS — `lastUpdated=2026-10-14T13:43:24.477Z`, no update error, `updating=false`. |
| Retry and lock | PASS — failed queue has 0 entries and refresh lock table has 0 rows after completion. |
| SQLite and runtime | PASS — integrity check `ok`; container remains healthy on the expected image. One `server.js` and one `cron.js` process remain running. |
| Safe settings | PASS — Serper remains selected, schedule `never`, retry disabled, effective Basic request budget 1. No setting was changed. |
| Existing MAHJONGJP88 data | PASS — keyword ID 2 remains position 0 with its original `{"2026-10-14":0}` history and original last-updated timestamp. |
| Credential/log check | PASS — sanitized recent-log scan found no configured Serper key, no `apiKey=` query-string lines, and no unexpected error lines. |
| Billing | Estimated 1 query credit; the operator confirmed sufficient balance. Actual credit balance delta was not independently available, and provider-internal Google retries cannot be observed or capped by SerpBear. |
| UI verification | PASS — operator confirmed the domain and keyword appear, position 1 and the 2026-10-14 history value 1 display correctly, and refresh status is completed without error. No refresh was triggered. |

The keyword's stored SerpBear device field is `desktop`; this execution supplied that value, and SerpBear sent a desktop-shaped HTTP User-Agent to the Serper endpoint. The adapter did not include a device selector in the JSON request body. Serper's use of the caller User-Agent for its Google query is not independently verified, so this result is not claimed as a provider-confirmed Desktop SERP or guaranteed device-neutral result.

The one-request count is confirmed by the refresh audit at the SerpBear-to-Serper API boundary. Serper may perform internal retries when querying Google; that provider-side behavior and the exact credit debit were not independently observable.

## Verification and follow-up limits

The pre-mutation checks were repeated immediately before the domain and keyword were created. The stored audit, result rows, and database were checked after the refresh completed; the operator then completed the authorized UI verification without triggering another refresh. Tests 2 (`detik.com` / `detikcom`) and 3 (`canva.com` / `Canva`) were not authorized and were not run.

Test 2 (`detik.com` / `detikcom`) and Test 3 (`canva.com` / `Canva`) are not authorized by approval for Test 1 and will not be run automatically.

## Final status

`POSITIVE_RANKING_TEST_PASS` — Browser Verification Completed. Serper.dev returned organic results with `shopee.co.id` at position 1. SerpBear stored and displayed position 1 and Ranking History for 2026-10-14 as 1. Refresh Audit recorded one `create`-triggered refresh, one outbound request, HTTP category `2xx`, and no error. SQLite remained healthy and the Production container remained healthy. Schedule is still `never`, retry is disabled, and the failed queue is empty. The existing MAHJONGJP88 position and history were unchanged. Detik and Canva tests were not run.

The search device could not be established: the Serper request did not include a device selector, and provider interpretation of the caller User-Agent is unverified. Actual Serper credit debit was not independently verified. No further SERP request, manual refresh, deployment, or Production change was made.
