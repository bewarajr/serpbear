# SerpBear First Real Google Ranking Test

**Status:** `REAL_RANKING_TEST_BLOCKED`  
**Preflight:** 2026-10-14  
**Live SERP requests sent:** 0

## Scope and result

Only read-only preflight and provider research were performed. No domain or keyword was created, no provider setting was enabled, no API credential was added, and no SERP request was sent. The requested ranking check remains gated on explicit operator approval and an available ValueSERP credential with usable quota.

## Read-only preflight

| Check | Result |
| --- | --- |
| Production container | **PASS** — `serpbear-official-app` is running and healthy on `serpbear-tar-runtime-candidate:20261014`, image ID `sha256:d12c177e13465308e9f46e9ffc16604da1daa7041fe6c4d8a69c7343beceac9a`. |
| Origin binding | **PASS** — host mapping is `127.0.0.1:3180` to container port 3000; the origin is not bound to a public host interface. |
| Cloudflare Access | **PASS** — unauthenticated GET `/login` returned HTTP 302 to the Cloudflare Access login flow. No cookie or credential was used. |
| SQLite | **PASS** — read-only `PRAGMA integrity_check` returned `ok`. |
| Existing records | **PASS** — 0 domains and 0 keywords; target domain and target keyword are not present. No existing records would be overwritten. |
| Ranking History Fix | **PASS** — deployed source at the tar runtime commit preserves history only when `updatedKeyword.error` is false; errors preserve position/history and retain error reporting. The deployed runtime report records that fix. |
| Scraping settings | **PASS** — `scraper_type=none`, `scrape_interval=never`, `scrape_retry=false`, strategy `basic`, failed queue empty. No setting was changed. |
| Provider credentials | **PASS** — no SERP API key, proxy, Google Ads, Search Console, SMTP, or related integration credential is configured in SerpBear settings. Only presence/absence was inspected; no secret values were read into output. |
| ProxyEmpire | **Not configured** — no proxy value exists and no ProxyEmpire-specific scraper is present in the built-in scraper registry. The generic `proxy` scraper sends direct Google requests through configured proxy addresses and is not a ProxyEmpire integration. |

## Scraper behavior and target matching

- The built-in registry includes Serper.dev, ValueSERP, SerpApi, SearchApi.io, and other providers. No provider is active now.
- `POST /api/keywords` saves the keyword and immediately calls `refreshAndUpdateKeywords` asynchronously. With a configured provider and the current Basic strategy, it requests only page 1. Adding the keyword is therefore the one action that will initiate the live lookup; no Manual Refresh or refresh-all call is needed or planned.
- The Basic strategy targets the first results page (up to 10 organic entries). SerpBear's ValueSERP extractor reads only `organic_results` and maps each result's `title`, destination `link`, and `position`; ads are not included in this array.
- `utils/countries.ts` maps Indonesia `ID` to language `id`. The ValueSERP integration constructs `gl=ID`, `hl=id`, and `page=1`. It sends no `device` parameter for Desktop because ValueSERP documents Desktop as the default device.
- Domain matching ignores a leading `www.` on both the configured domain and result URL, so `www.mahjongjp88untouchable.com` matches `mahjongjp88untouchable.com`. Other subdomains do not match by default; they require an explicit subdomain rule or `*`. The new domain will use the default behavior unless the operator authorizes otherwise.
- No Search Console or Google Ads credentials are configured, so keyword creation should not trigger those integrations. `scrape_retry=false` and `scrape_interval=never` remain set to prevent retries and scheduled follow-up requests.

## Provider selection and cost

**Recommended provider: ValueSERP (`valueserp`)**, subject to approval and usable account quota.

The installed integration supports the required Google country and language parameters, uses Desktop by default, returns organic results with URLs and positions in the shape SerpBear parses, and Basic mode makes one page request. Official ValueSERP docs describe `gl`, `hl`, `page`, and the default Desktop device, and show the `organic_results` response fields ([search parameters](https://docs.trajectdata.com/valueserp/search-api/searches/google/search), [common/device parameters](https://docs.trajectdata.com/valueserp/search-api/searches/common), [result format](https://docs.trajectdata.com/valueserp/search-api/results/google/search)).

Serper.dev is built in and its current SerpBear adapter maps country/language and organic result fields, but the adapter does not send a device parameter. The official Serper site confirms country/language localization but its public page does not establish Desktop targeting for this adapter. ValueSERP is selected because its Desktop default is explicitly documented.

- **Maximum expected provider calls:** 1 successful Search API request, consuming 1 credit. Stop on any error, CAPTCHA, rate limit, or insufficient credit; do not retry or submit another refresh.
- **Cost:** ValueSERP advertises 100 free searches for a new account and a pay-as-you-go rate of $2.50 per 1,000 requests, or $0.0025 per successful request. Its pricing page also states a $25 initial purchase for 10,000 requests if an account has no free/paid quota. No purchase is authorized here; if a usable existing credit is unavailable, remain blocked ([official pricing](https://trajectdata.com/serp/value-serp-api/pricing/)).
- **Credential handling:** SerpBear encrypts the stored API key at rest, but the built-in ValueSERP integration places it in the HTTPS request URL. Use a dedicated provider key; do not paste it into chat, logs, or this report. Configure it only through SerpBear Settings after approval.

## Exact approval-gated changes

If approved and the operator confirms a ValueSERP credential with usable quota is available:

1. Set provider `scraper_type` from `none` to `valueserp` and add its key through the protected SerpBear Settings UI.
2. Keep `scrape_interval=never`, `scrape_retry=false`, and `scrape_strategy=basic` unchanged.
3. Create domain `mahjongjp88untouchable.com` only if still absent.
4. Add keyword `MAHJONGJP88`, country `ID`, language `id`, Desktop. Keyword creation triggers the single Basic page request.
5. Wait for that one result. If it reports an error, CAPTCHA, rate limiting, or insufficient credits, stop without retrying.
6. Restore `scraper_type=none` and clear the ValueSERP key because the initial settings had no provider or key. Leave Never/retry-disabled settings intact. Keep the resulting domain, keyword, and legitimate ranking history; do not delete them.

## Blocker and next operator action

The live test has **not** been approved, and the production settings currently contain no provider key or quota evidence. Reply with the exact phrase `APPROVE_SERPBEAR_SINGLE_LIVE_CHECK` only if you authorize the settings above and exactly one ValueSERP request. Keep the key out of chat; after approval, provide/confirm that a usable key and at least one credit can be entered through SerpBear Settings. If no usable quota is available, do not proceed or switch to another provider.

No production configuration, database, Cloudflare setting, Docker service, domain, or keyword was changed during this preflight.
