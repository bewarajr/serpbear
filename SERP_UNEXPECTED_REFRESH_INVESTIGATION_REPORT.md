# SerpBear Unexpected Ranking Refresh Investigation

**Status: `UNEXPECTED_REFRESH_UNRESOLVED`**  
**Investigation date:** 2026-10-14  
**Live SERP requests made during this investigation:** 0  
**Production changes made:** none

## Finding

The production keyword row contains a later successful-looking result snapshot, but the retained evidence does not identify which route or user action started it. The normal application code path for that snapshot performs a scrape, and a Basic Serper scrape makes one application-level Search API fetch. That makes an additional refresh and outbound call the expected explanation if the row was written by the application. There is no retained request or billing trace to confirm the trigger or exact wire-level/billable request count. The investigation therefore does not attribute the event to a specific user, UI action, cron, or duplicate request.

## Timeline and evidence

| Time (UTC) | Evidence | Interpretation |
|---|---|---|
| 2026-10-14 10:25:10 | Production container start time from Docker metadata. | The server and separate `cron.js` process were running before the two observations. Startup runs migrations and starts those processes; inspected startup code has no immediate ranking refresh. |
| 2026-10-14 10:44:58.745 | `REAL_GOOGLE_RANKING_TEST_REPORT.md` records the first completed observation: four accepted organic URLs, position 0, no error, and history `2026-10-14: 0`. It says keyword creation triggered the normal refresh. | The report attributes this observation to the authorized keyword creation. Its request count is inferred from that action and the Basic code path, not packet capture. |
| 2026-10-14 10:48:32.040 | The later read-only SQLite snapshot recorded by `SERP_TOP100_PREPARATION_REPORT.md`: three accepted organic URLs, position 0, same-day history value 0, and no error. | The saved result list and `lastUpdated` changed after the first observation. This is consistent with another successful refresh completion. No retained record identifies its initiator. |
| 2026-10-14 10:40–10:55 | Production container stdout retained one line in the inspected interval; it contains no refresh route, `START SCRAPE`, keyword-update, or error marker. No relevant application request was found in the available Docker event view. | These logs cannot correlate an API request to either update. They are not a complete HTTP access or egress audit. |

The deployed container was reported healthy on image `sha256:5075a0d44ecd5a698e71727271e8100cb18aed087243d410c026137214e7d955`. The inspected application source is the deployed Serper adapter candidate, commit `cf6d4f8818962869aa1a751897a84ed45e22d491`. Current settings are reported as provider Serper, schedule `never`, retries disabled, and the queue empty. The current queue snapshot does not establish what was in the queue at 10:48.

## Refresh trigger review

| Trigger | Code behavior | Could explain the later persisted row? | Evidence available for this event |
|---|---|---:|---|
| Keyword creation (`POST /api/keywords`) | Persists new rows and calls `refreshAndUpdateKeywords(newKeywords, settings)` once. This scrape is immediate and is independent of the scheduled interval. | Yes, if the create request was repeated or a matching refresh was otherwise started. The UI checks for existing keyword tuples and disables the Add button while its mutation is pending, but this is not a server-side idempotency guard. | First creation is documented. No second create/API request log was retained. A duplicate create normally adds another row rather than silently refreshing the existing ID. |
| Keyword update (`PUT /api/keywords`) | Updates tags or sticky state; it does not call the scraper. | No, for the normal UI/API update path. | Source inspection. |
| Manual refresh (`POST /api/refresh`) | Fetches the selected keyword rows and starts `refreshAndUpdateKeywords`. UI buttons exist for one keyword, selected keywords, and all keywords in a domain. | Yes. | No route/access audit record or browser action history is available for the timestamp. |
| Cron endpoint (`POST /api/cron`) | Starts a refresh for all keywords when called and a scraper is configured. It checks `scraper_type`, not `scrape_interval`. | Yes, if called directly by an authenticated caller. | No route/access audit record. |
| Scheduled refresh | `cron.js` registers a scheduled callback only when its startup-loaded `scrape_interval !== 'never'`; the callback calls `/api/cron`. It does not run an immediate scrape at process start. | Only if the cron process loaded a non-`never` interval or the endpoint was called separately. | The schedule is now `never` and was reported as `never` in the first-test preflight. There is no retained startup settings snapshot or cron execution log for 10:48. If it was `never` when `cron.js` loaded, this scheduled path was not registered. |
| Failed-queue hourly job | Every hour it reads `data/failed_queue.json` and calls `/api/refresh` only when the file has entries. Failed items are added only when retry is enabled. | Possible only if a queue entry existed at that time; current empty queue is not historical evidence. | Retry is reported disabled and queue empty now. No queue history or hourly job log is retained. |
| Dashboard/domain page load and polling | Keyword list fetches and polling use `GET /api/keywords`; polling checks the `updating` flag. Dashboard redirects to the domains page. The inspected mount effects do not call refresh. | No, for those read-only fetches. | Source inspection. |
| Search-result preview | `GET /api/refresh?keyword=…` calls `scrapeKeywordFromGoogle`, so an explicit “Perform Google Search” action can issue a provider request. Its UI query is disabled until the button is clicked. This path returns results and does not persist the keyword's ranking/history. | It could add a provider request, but cannot by itself explain the changed saved result row. | No user-action or request log. |
| Duplicate/concurrent refresh | Refresh APIs do not atomically reject a keyword whose `updating` flag is already true. The flag is written as UI state, not used as a lock. Multiple accepted refresh calls can run and race to update the same row. | Yes. | No refresh ID, lock record, or request trace exists to determine whether calls overlapped. |
| Container startup | Entrypoint runs database migrations, then the app starts `server.js` and `cron.js`. Inspected code contains no startup refresh call. | No direct startup refresh found. | Runtime process list shows server and cron processes; no relevant startup event occurred in the interval. |

The `GET /api/refresh` preview route is a distinct possible source of provider usage. It is only reached by an explicit preview button in the inspected UI and does not write ranking state. Dashboard/domain-page `useEffect` and polling were not found to trigger it automatically.

## Request and credit accounting

- `lastUpdated` and the saved result list moved from the first snapshot to the later snapshot. In normal application code, the ranking fields, result list, history, and successful `lastUpdated` value are written by `updateKeywordPosition` after `refreshAndUpdateKeyword` has called `scrapeKeywordWithStrategy`.
- There is no local SERP response cache/replay path in this flow. For Serper with Basic strategy, one refresh execution selects page 1 and invokes one `fetch` for that page; the adapter caps `num` at 10. If the later row was written through this ordinary path, a second application-level Serper request is expected.
- The retained database state proves neither the initiating route nor that a request reached Serper. There is no packet capture, outbound request counter, correlated application request ID, or provider usage record available here. Serper-side internal retries and billing are also outside the application's observable count.
- **Conclusion:** an additional refresh cycle is strongly suggested by the changed successful result snapshot; an additional outbound/billable request is **not confirmed** from retained telemetry. The exact trigger and exact billed count remain unresolved.

To complete request accounting, provide a sanitized Serper dashboard usage/history count for **10:44–10:49 UTC on 2026-10-14**, before/after if available. Do not include the API key, account secrets, query text, or raw response. Also useful is a sanitized server/Cloudflare audit export containing only timestamp, method, path (`/api/keywords`, `/api/refresh`, `/api/cron`), response status, and actor category for that window. Do not include cookies, bearer tokens, or Access JWTs. The current container stdout has no such records.

## Position calculation assessment

The Serper adapter selects `organic[]`, accepts entries only when both `title` and `link` are present, and carries the provider `position`. The shared scraper then overwrites each accepted item's position with `pagination.start + acceptedIndex + 1`.

Consequences:

- Entries filtered for missing title or link are removed before numbering. Later accepted entries are shifted upward in the recorded positions.
- Any provider position gaps are also discarded. For example, a synthetic response with provider positions `1, 3, 4` is numbered by this code as `1, 2, 3`; a malformed first entry filtered out would shift subsequent positions as well.
- The raw provider payload is not retained, so the observed count changing from four to three cannot be attributed to Serper returning fewer entries versus the adapter filtering an entry.
- Domain matching strips a leading `www.` and matches the apex. Other subdomains need explicit domain subdomain matching. A missing match returns position `0`.
- Both observations are accurately classified as `NOT_FOUND_IN_4_RETURNED_ORGANIC_RESULTS` and `NOT_FOUND_IN_3_RETURNED_ORGANIC_RESULTS`, respectively—not as verified absences from all ten results requested. The count difference does not change the meaning of position `0`, but it limits the depth for which “not found” is supported.

Minimal correction to consider in an isolated change: preserve a valid provider `position` instead of renumbering by filtered array index; define and test fallback behavior for missing/invalid position values and pagination. Keep sanitized parser metadata (page, raw organic count, accepted count, invalid-entry count) so future investigations can distinguish provider result count from parser filtering. No source changes were made here.

## Ranking History and timestamps

`updateKeywordPosition` builds a date key (`year-month-day`) and assigns `history[dateKey] = newPosition` only on a successful scrape. A second successful observation on the same date overwrites that key. Therefore the single history value `2026-10-14: 0` is expected daily-history behavior and cannot establish that only one refresh occurred.

On successful scrape processing, the same function writes `lastUpdated`, `position`, `url`, and `lastResult`; on an error it preserves the previous `lastUpdated` and position. Keyword creation also initializes `lastUpdated`, while tag/sticky, volume, and read-only keyword routes do not update ranking timestamps. The changed later timestamp and result list are therefore evidence consistent with a successful later refresh, but there is no event history to count refreshes or identify their source. Out-of-band database edits cannot be ruled out from the available audit evidence.

## Recommended minimum safety controls

1. **Single-flight per keyword:** add an atomic database lock/lease checked before starting refresh; reject or coalesce a second request while the keyword is updating. Do not rely on the `updating` display flag alone.
2. **Idempotent creation:** enforce a unique key for the intended keyword/domain/country/device/city tuple, or use an idempotency token, so duplicate create submissions cannot create extra rows and refresh work.
3. **Refresh event audit:** record a generated refresh ID, trigger source (`create`, `manual`, `cron`, `retry`, `preview`), keyword ID, page number, start/end times, result status, and outbound-call count. Never log provider keys, auth headers, cookies, or full result payloads.
4. **Request-budget guard:** for a one-request operation, reserve a one-call budget before starting and prevent the same refresh ID from issuing a second page/fallback/retry. Keep preview searches visibly separate from tracked-keyword refreshes.
5. **Operational evidence:** retain a short, access-controlled API audit window or sanitized egress/provider usage count so row changes can be correlated without exposing credentials.

## Tests required before another live request

- Mock Basic refresh and assert one Serper `fetch` per accepted refresh ID, with no pagination or retry.
- Submit two concurrent refresh requests for the same keyword and prove only one is admitted by the single-flight guard.
- Submit a repeated keyword-create request and prove it cannot create duplicate tracking work.
- Prove schedule `never` registers no scheduled refresh; prove an explicit/manual route remains distinguishable and guarded.
- Prove empty failed queue and retry disabled result in zero retry calls; test queue state as a historical event rather than only a final snapshot.
- Prove dashboard/domain GET and polling do not send Serper requests; prove preview sends none until its explicit action and is counted separately.
- Mock provider result arrays with missing fields and non-contiguous `position` values; assert correct absolute rank preservation and target-domain matching.
- Test two successful same-day observations: daily history may overwrite by design, while the separate audit records both refresh IDs.
- Verify logs contain no provider key, auth token, cookie, or raw sensitive payload.

## Remaining uncertainties and next action

The trigger is unresolved because production did not retain route-level request logs, refresh IDs, queue history, or provider usage records for the interval. Request the sanitized Serper usage count and sanitized access/audit records listed above. Until the event is correlated and single-flight/request-budget controls are tested, do not authorize another live refresh or Top 100 run.

No SERP/Google request, production mutation, setting change, container restart, deployment, Cloudflare change, database write, or unrelated service change was performed during this investigation.
