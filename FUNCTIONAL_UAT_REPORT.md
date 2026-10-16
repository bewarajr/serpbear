# SerpBear Official Functional UAT

**Date:** 2026-10-14  
**Server:** `bewara-tea`  
**Application:** `https://serpbear.bewara.xyz`  
**Version:** Official SerpBear `v3.1.0`  
**Status:** `SERPBEAR_UAT_BLOCKED`

Core installation, application authentication, domain CRUD, settings persistence, and isolated restart checks passed. The UAT is blocked because Cloudflare Access policy could not be verified and keyword CRUD was deliberately skipped to honor the no-scraping restriction.

## Results

| # | Check | Result | Evidence |
|---|---|---|---|
| 1 | Docker health, SQLite persistence, public URL | **PASS** | `serpbear-official-app` is running and healthy on the official `3.1.0` image. The `serpbear-official-data` volume is mounted at `/app/data`; `database.sqlite` exists and `PRAGMA integrity_check` returned `ok` after restart. `NEXT_PUBLIC_APP_URL` is `https://serpbear.bewara.xyz`, and the public login route returned HTTP 200. |
| 2 | Cloudflare Access protection | **BLOCKED / UNVERIFIED** | No Cloudflare Access challenge was observed. An unauthenticated `/api/domains` request reached SerpBear and returned its application-level HTTP 401 (`Not authorized`); `/login` returned HTTP 200. `/cdn-cgi/access/get-identity` returned HTTP 400 (`no app token set`). Cloudflare Zero Trust policy configuration was not available for direct inspection. HTTPS and the active Tunnel are not evidence that an Access policy protects the hostname. No Cloudflare policy was changed. |
| 3 | Authentication, dashboard, navigation | **PASS** | Synthetic configured credentials logged in successfully (HTTP 200); a synthetic invalid login was rejected (HTTP 401). The authenticated browser displayed the empty Domains dashboard, navigated to Research, opened Settings, and logged out to `/login`. Unauthenticated API access returned HTTP 401. |
| 4 | Domain CRUD with `example.com` | **PASS** | Created with HTTP 201; read it back; updated `subdomain_matching` and verified the update; deleted the test domain; confirmed it was absent afterward. The domain was not present before the test. No keyword was attached. |
| 5 | Keyword creation behavior and CRUD | **SKIPPED** | Source review found that `POST /api/keywords` calls `refreshAndUpdateKeywords` immediately after inserting keywords (`pages/api/keywords.ts:113`). Keyword creation would start the refresh pipeline, so keyword CRUD was not attempted. No SERP/provider request was made. |
| 6 | Scraping frequency remains Never | **PASS** | Persisted settings report `scrape_interval=never` and `scraper_type=none`; both values remained unchanged after restart and settings restoration. The failed-scrape queue was empty. The cron setup also omits the SERP schedule when the interval is `never` (`cron.js:93-95`). |
| 7 | Settings persistence and isolated restart | **PASS** | A temporary non-secret display-name setting was updated, verified, and observed to persist across restart. Its original value was restored and verified. Only `serpbear-official-app` was restarted. |
| 8 | Access-control behavior and logs | **PARTIAL** | SerpBear app authentication behaved as expected: valid login succeeded, invalid login failed, unauthenticated API access was denied, and browser logout returned to the login page. Cloudflare Access remains unverified as described above. The recent container log scan found no application `[ERROR]`, unhandled exception, or exception entries; it showed one generic Node deprecation diagnostic without an identified source. |
| 9 | Unrelated Docker services | **PASS** | Docker container IDs for unrelated services remained unchanged across the UAT. The SerpBear Tunnel service remained active. No other Docker service was restarted or modified. |

## Final State

- SQLite integrity is `ok`; domain and keyword counts are both zero after test cleanup.
- `scraper_type` is `none`; `scrape_interval` is `never`; no provider credentials or integrations were added.
- The app container is healthy, its persistent volume remains mounted, and the public login route responds.
- Temporary browser cookies and UAT response files were cleared. No credentials are included in this report.
- No SerpBear source code or Cloudflare policy was changed.

## Next Recommended Action

Have the Cloudflare operator verify in Zero Trust whether `serpbear.bewara.xyz` is covered by an Access application and policy. Treat Access protection as unconfirmed until then. Keep keyword CRUD pending unless a no-network test method is explicitly approved; the current create route starts the refresh pipeline.
