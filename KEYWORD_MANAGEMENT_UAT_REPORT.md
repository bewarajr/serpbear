# Keyword Management Functional UAT Report

**Date:** 2026-10-14 (Asia/Jakarta)  
**Environment:** Official SerpBear v3.1.0  
**Status: KEYWORD_UAT_BLOCKED**

## Summary

Keyword CRUD succeeded against a disposable instance of the official v3.1.0 image, with container networking disabled. The production container, database, settings, and other Docker services were left unchanged.

The UAT is blocked by one data-integrity finding: after the expected refresh failure, SerpBear persisted a dated keyword history value of 0 even though no SERP data was fetched. The current position remained 0, which the application presents as “not in Top 100”; no positive ranking was fabricated. The dated history sample is still unsupported by SERP evidence, so the “no false ranking history” criterion did not pass.

## Results

| Check | Result | Evidence |
|---|---|---|
| Production container health and persistence | PASS | serpbear-official-app remained running and healthy with zero restarts. The existing named volume serpbear-official-data remains mounted at /app/data. |
| Production configuration preflight | PASS with note | scraper_type=none, scrape_interval=never, failed queue empty, and no scraper, proxy, Ads, or GSC credentials found in settings or relevant environment variables. The scrape_retry key is absent; the application treats the missing value as false, so retries are disabled. |
| Cloudflare Access recheck | PASS for anonymous requests | Requests without Access cookies to /, /login, /api/domains, and /api/settings each returned HTTP 302 to the Cloudflare Access flow. The operator previously reported authorized Cloudflare Access UAT as passed; an authorized session was not replayed in this run. |
| SerpBear authentication | PASS on isolated instance | Synthetic local login returned HTTP 200. Unauthenticated calls to the isolated instance’s domains, keywords, and settings APIs returned HTTP 401. |
| Domain create and cleanup | PASS | example.com was created through the isolated application API and removed after the keyword test. Final isolated domain count was zero. |
| Keyword create and persistence | PASS | serpbear uat test keyword returned HTTP 201 and was present on a subsequent GET. |
| Refresh trigger and outbound safety | PASS with expected error | The official create handler immediately starts refreshAndUpdateKeywords. The isolated run logged a scrape attempt, which failed with “Failed to parse URL from” because no scraper is configured. The container used Docker network mode none, had only loopback, and had no default route or non-loopback interface. No external SERP request could leave the container. |
| Ranking position | PASS | Position remained 0; no positive ranking position or SERP result was returned. |
| Ranking history | FAIL | After the failed refresh, GET returned history {2026-10-14: 0}. No SERP data supported this dated sample. The refresh update path writes the history value even when the scrape result contains an error. |
| Keyword update | PASS | Tags changed to uat and phase2 and persisted on a subsequent GET. |
| Keyword delete and cleanup | PASS | Delete returned one removed keyword; a subsequent GET returned no keywords. The synthetic domain was then removed. |
| Retry queue and settings | PASS | Isolated failed queue remained empty; scraper_type=none, scrape_interval=never, scrape_retry=false; no provider credentials were configured. Production settings were not changed. |
| SQLite integrity | PASS | PRAGMA integrity_check returned ok for production and the isolated database. Both had zero domain and keyword rows after cleanup. |
| Application logs | PASS for production; WARN for isolated bootstrap | Production logs contained zero error markers in the last 60 minutes. The isolated fresh-volume startup emitted missing-table migration diagnostics before the app became healthy; CRUD then completed. The isolated scrape failure was expected under the no-provider setup. |
| Unrelated Docker services | PASS | Only the UAT-owned container and volume were created and removed. No unrelated service was changed. |

## Method and scope

- The production instance was inspected read-only. No production domain or keyword was created.
- Because the keyword handler starts a refresh immediately, CRUD ran against a disposable container using the existing official v3.1.0 image. It was not rebuilt, published, or connected to a network.
- Requests used the application’s API handlers with synthetic test credentials held only in a temporary protected environment file. Credentials and session cookies are omitted from this report and logs.
- No Manual Refresh endpoint was called. No source code, production settings, or production database rows were modified.
- The isolated container, its volume, and the temporary environment file were removed after verification.

## Issues and next action

The failed scrape still produces a dated zero-valued history entry. Position 0 is the application’s unranked sentinel, but the history sample was recorded after an error without SERP evidence. This prevents a strict UAT pass.

Keep all SERP providers disabled. Before enabling keyword tracking, confirm whether official v3.1.0 is expected to record history on scrape errors. Repeat this history check on an official version or configuration whose error path does not create unsupported history samples. No custom source change was made.
