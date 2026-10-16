# SerpBear Top 100 Preparation Review

**Status: `TOP100_PREFLIGHT_BLOCKED`**  
**Review date:** 2026-10-14  
**Live SERP requests made during this review:** 0

## Four-result investigation

The prior live-test report records four valid organic destination records from a request configured for `num=10`. It did not retain the raw Serper response, so it cannot show whether Serper returned only four organic entries or whether the adapter discarded other entries.

The deployed Serper adapter:

- Sends `num` capped at 10; it contains no code that truncates the `organic` array to four.
- Iterates over the provider's `organic` entries and keeps entries that have both a title and a link. Entries missing either field are filtered out.
- Does not preserve the raw provider response. The subsequent scraper assigns positions by the order of accepted results rather than using the provider's `position` field.
- Stores a 100-slot display array. Unqueried slots are marked `skipped`; they are placeholders, not additional results.

So the first observation is accurately described as **`NOT_FOUND_IN_4_RETURNED_ORGANIC_RESULTS`** within a request configured for up to 10. It does not establish that all ten Google organic positions were examined. The accepted-result count alone cannot distinguish a short provider response from malformed entries filtered by the parser. Query contents and localization can affect Google's returned SERP, but the retained evidence cannot identify either as the cause of the four-result count.

## Ranking and current-record assessment

- The application maps Indonesia `ID` to `gl=id` and `hl=id`; the test used no city or device parameter.
- Domain matching strips a leading `www.` and matches the apex domain. Other subdomains require an explicit subdomain rule; the current domain has no such rule.
- Accepted organic results are numbered in their returned order. Filtering an entry without a title or link can compress later positions because the adapter's result index, not the response's `position`, is used.
- Position `0` means no matching result was found among the records processed. A successful response records that `0` in the dated history; `lastUpdateError=false` distinguishes it from a scraping failure. The Ranking History fix prevents failed requests from recording unsupported observations.

The current SQLite row no longer matches the first-test snapshot: the prior report recorded `lastUpdated=2026-10-14T10:44:58.745Z` and four valid result URLs, while this read-only inspection found `lastUpdated=2026-10-14T10:48:32.040Z` and three valid result URLs. The row still has position `0`, history `{2026-10-14: 0}`, and no error. This is consistent with a later successful refresh, but retained logs do not identify its trigger. This review did not issue a refresh or any Serper request. The schedule is still `never`, the retry queue is empty, and the refresh cron code skips scheduling when the setting is `never`; the cause of the later update remains unknown.

## Top 100 options

| Option | Application behavior | Requests for this keyword |
|---|---|---:|
| Basic | Page 1; Serper adapter caps each request at 10 results. | 1 |
| Custom, limit 10 | Runs pages 1 through 10 sequentially, each with `num=10`; the loop does not stop early when a target is found or a page errors. | Up to 10; normally 10 attempts |
| Smart with full fallback | Starts from the prior position and may fetch further pages until a match or page 10. With the current position `0`, it can range from 1 to 10 requests when fallback is enabled. | 1–10 |
| Native pagination | The application has a separate path for providers marked `nativePagination` that asks for 100 results in one request. Serper is not marked for this path. | Not available to current Serper adapter |

The existing UI exposes a custom limit of up to 10 pages, and no source change is needed for SerpBear to attempt ten pages. The adapter sends the `page` value and caps each page at ten. However, the only live Serper page observed was page 1. The public Serper material checked does not document the maximum `num` or page-number semantics sufficiently to verify that pages 1–10 yield 100 distinct, ordered organic results. A full Top 100 result therefore cannot be promised from application code alone.

For a ten-page run, the expected application-level maximum is **10 outbound Search API requests**. Serper's public pricing describes query-based credits and says credits are deducted for successful responses; one credit per successful page request is an estimate, so ten successful pages are estimated at about **10 credits**, not a guaranteed charge. The account balance has not been checked for a ten-query budget. Serper states typical response times of 1–2 seconds and 2–4 seconds when it retries submission to Google internally. Since SerpBear sends custom pages sequentially, a rough estimate is 10–20 seconds under typical timing, or 20–40 seconds at the slower range, plus application/network overhead. These figures are estimates, not a service-level guarantee. [Serper pricing and FAQ](https://serper.dev/)

## Proposed one-time Top 100 procedure

Only after the blockers below are resolved and a separate operator approval is received:

1. Confirm the keyword is not currently updating, the failed queue is empty, SQLite is healthy, schedule is `never`, retries are effectively disabled, and no other refresh is active.
2. Record the current domain override (currently blank, so it uses the global Basic strategy).
3. Set only this domain's strategy to Custom with 10 pages. Leave the global schedule at `never` and retry disabled.
4. Use the existing keyword; do not create it again. Trigger exactly one refresh action and do not submit another while it is running.
5. Budget for up to 10 sequential Search API calls. Custom mode continues through the configured pages even if an earlier page errors, so approval must cover the full ceiling.
6. Check the completed result, page coverage, position, history, error state, queue, and SQLite integrity without refreshing again.
7. Restore the domain override to blank/global Basic without triggering another refresh. Preserve the result and history.

## Remaining blockers and next action

1. **Unexpected later update:** the stored keyword changed after the reported first test despite the `never` schedule and empty retry queue. Its trigger is unknown. Confirm through operator/browser/API audit or explain this update before authorizing another production refresh.
2. **Provider pagination is unverified:** public official documentation checked does not settle Serper `page=2..10` behavior or guarantee 100 distinct organic results. Obtain provider documentation/support confirmation, or separately authorize a bounded live pagination validation before treating Top 100 as reliable.
3. **Ten-query budget:** the previous confirmation covered at least one query only. Confirm sufficient credits for up to ten successful requests; exact charging for `num=10` remains uncertain.
4. **Result evidence:** the raw provider payload and exact numeric HTTP status are not retained. Future verification should preserve only sanitized metadata such as request page, HTTP status, organic entry count, and error category, without storing the API key or unnecessary result content.

Production image, provider key, settings, domain, keyword, history, Cloudflare Access, and SQLite were not changed during this review. No live Serper request was made. The earlier report's four-result observation remains historical; the current row contains a later three-result snapshot.
