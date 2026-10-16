# SerpBear production dependency security review

**Date:** 2026-10-14  
**Status:** `SECURITY_REVIEW_COMPLETED`  
**Scope:** Read-only review of the deployed `serpbear-ranking-history-final:20261014` image (`sha256:9b6386566303ce0ca1036cd560849de5d8ad72fe492331edf44cccdf74a8d39b`). No dependencies, source, database, image, container, or Cloudflare settings were changed.

## Evidence and interpretation

Fresh `npm audit --omit=dev --json` completed against the npm registry on 2026-10-14. It reports **44 vulnerable packages** in a tree of 443 production dependencies: **3 critical, 26 high, 13 moderate, 2 low**. These are package findings, not 44 independently exploitable production paths. `npm ls --omit=dev` and package resolution inside the running image confirmed the eight priority versions below. The audit's `fixAvailable` field is a solver suggestion, not a compatibility or runtime-safety guarantee.

The deployed Next.js server is behind Cloudflare Access. Anonymous requests to `/`, `/login`, `/api/domains`, `/api/settings`, `/api/keywords`, `/_next/image`, `/api/notify`, and `/api/dbmigrate` received a Cloudflare Access redirect (302), before application content. The Docker port is bound to `127.0.0.1:3180`; the container runs as `nextjs` (UID 1001), is not privileged, and uses a persistent `/app/data` volume. Docker has no explicit capability drop or read-only root filesystem. The host `.env` is mode 600 and excluded from the Docker build context; runtime secrets remain accessible to Docker administrators and the app process. These controls reduce exposure but do not repair vulnerable code or protect against a compromised Access identity, host access, or an alternate route introduced later.

Application reachability was assessed from the current source and settings, without exploit requests. The live configuration has `scraper_type=none`, `scrape_interval=never`, retry disabled, no SERP/proxy/Google credentials, and no SMTP configuration. No scraper or provider was enabled. This review did not independently prove the absence of all possible alternate network routes or perform an authorized exploit test.

## Priority findings

| Priority / package | Installed; advisory, affected range; corrected version | Production path and authentication | Recommended change; compatibility, testing, risk and rollback |
|---|---|---|---|
| **P0 planning / Next.js** | `12.3.7`; critical [GHSA-2xp9-vwfh-vxw4](https://github.com/advisories/GHSA-2xp9-vwfh-vxw4), `>=10 <15.5.24`; patched `15.5.24` (also `16.3.3`). Additional high [authorization bypass](https://github.com/advisories/GHSA-7gfc-8cq8-jh5f), [i18n middleware bypass](https://github.com/advisories/GHSA-36qx-fr4f-26g5), and [rewrites SSRF](https://github.com/advisories/GHSA-p9j2-gv94-2wf4). Audit aggregate ends at `15.5.23`. | Next serves every page/API, so it is genuinely in runtime. The critical advisory requires AVIF image optimization through `sharp`/libheif; current Next image defaults allow WebP only, no `next/image` import was found, and `sharp` was not resolvable in the image. Thus that **specific** path appears inactive, not proven impossible. No custom rewrites, i18n, or middleware were found for the cited high advisories. Cloudflare Access blocks anonymous public traffic; an Access-authorized identity can still reach Next. | Prepare **a separate Next 15.5.24 candidate**, not an automatic `npm audit fix` to 16.4.0. Node engine and React 18 peer range are compatible according to npm metadata, but Pages Router, auth/cookies, image handling, build output, lint script, and TypeScript 4.8 need migration assessment. Test all routes, Access, full Jest, typecheck, build, isolated runtime, and image behavior. **High deployment risk**; retain current image and database backup for rollback. Keep Access and localhost binding enforced while preparing this candidate. |
| **P1 / shell-quote** | `1.8.3` via `concurrently`; critical [GHSA-w7jw-789q-3m8p](https://github.com/advisories/GHSA-w7jw-789q-3m8p), `1.1.0–1.8.3`, fixed `1.8.4`; high [GHSA-395f-4hp3-45gv](https://github.com/advisories/GHSA-395f-4hp3-45gv) affects `<=1.8.4`, so target **`1.8.5` or later confirmed clean 1.x**. | Present in runtime through `concurrently`, which starts fixed `node server.js` and `node cron.js` commands. Critical injection needs attacker-controlled object `.op` passed to `quote()` and then a shell. No such input path found. The parse DoS likewise requires attacker-controlled shell syntax. No app authentication applies to the fixed startup command. | Refresh the transitive lock entry within the parent semver range, or use a narrowly scoped override if necessary. No application source change expected. Test startup of both processes and isolated image. **Low deployment risk**; roll back image/lock if startup fails. |
| **P2 currently / tar and sqlite3 chain** | `tar 6.2.1`; critical [GHSA-23hp-3jrh-7fpw](https://github.com/advisories/GHSA-23hp-3jrh-7fpw), `<=7.5.18`, fixed `7.5.19` for that advisory; other tar advisories extend through `7.5.20`, so audit-clean target is **`>=7.5.21`**. `sqlite3 5.1.7` is marked high through `node-gyp`/`tar`, not a direct sqlite3 advisory. Audit proposes `sqlite3 6.0.1` (major). | `tar` enters via sqlite3's native build/install chain (`node-gyp`/`cacache`); no application archive extraction route was found. The installed native SQLite driver is used at runtime, while the vulnerable tar operations appear build-time. An attacker would need control over an archive processed in the image/build environment. | First prove whether tar can be omitted from the final runtime image while preserving sqlite3 native bindings; alternatively test a compatible locked tar update. Do **not** blindly force tar 7 into node-gyp 8. `sqlite3 6.0.1` requires isolated native build, migration compatibility, and database tests. **Medium/high build risk**; retain current image and SQLite backup. |
| **P1 before enabling proxy / Axios** | `1.13.5`; high [GHSA-3pq3-5fj3-cg6v](https://github.com/advisories/GHSA-3pq3-5fj3-cg6v), `>=1.13 <1.20.0`, patched `1.20.0`; other advisories include [GHSA-542g-h47m-68v8](https://github.com/advisories/GHSA-542g-h47m-68v8). Audit aggregate `1.0.0–1.19.0`. | Imported by `utils/scraper.ts` for proxy scraping, which requires `scraper_type=proxy` and proxy settings. Both absent; scheduled scraping is Never. These paths would be reachable only after an authenticated operator configures and invokes scraping. | Move to **`1.20.0`** in a small same-major candidate. Check proxy request/redirect/DNS behavior with mocks; never issue live SERP requests. **Low/medium risk**; rollback image if proxy behavior regresses. Must be done before enabling providers. |
| **P2 currently / Nodemailer** | `8.0.1`; high [GHSA-v53p-9fqp-m79j](https://github.com/advisories/GHSA-v53p-9fqp-m79j), `<=10.0.5`, patched `10.1.1`; other high findings include [GHSA-p6gq-j5cr-w38f](https://github.com/advisories/GHSA-p6gq-j5cr-w38f) and [GHSA-r7g4-qg5f-qqm2](https://github.com/advisories/GHSA-r7g4-qg5f-qqm2). | `pages/api/notify.ts` imports it; SMTP and notifications are disabled. The handler does not call `verifyUser`, so if SMTP is enabled, Cloudflare Access and localhost binding are the current gates, not SerpBear login. The app uses basic SMTP, not raw message input or OAuth2; some advisory paths appear absent. | Keep SMTP disabled. Before enabling it, test **`10.1.1`** major upgrade in isolation and separately review endpoint authorization. Mock malformed addresses, TLS, and mail generation. **Medium risk** due major API/runtime changes; rollback image and keep notifications disabled if it fails. |
| **P1 / Sequelize** | `6.37.7`; high [GHSA-6457-6jrx-69cr](https://github.com/advisories/GHSA-6457-6jrx-69cr), `6.0.0-beta.1–6.37.7`, patched **`6.37.8`**. Audit aggregate also inherits a `uuid` advisory. | Runtime ORM for authenticated domain/keyword routes. The SQL injection requires user-controlled JSON key casts in a JSON/JSONB `where` condition; current models and inspected queries use scalar columns, so that precise path was not found. Access plus app auth reduces access but is no substitute for the patch. | Update Sequelize within 6.x; review and update inherited `uuid` separately if audit remains. No business logic change expected. Test CRUD, migrations, ranking history, SQLite integrity, and full suite. **Low/medium risk**; rollback image without restoring DB unless corruption is confirmed. |
| **P2 / Umzug** | `3.8.2`; high aggregate, inherited via `fast-glob`/`micromatch` and `@rushstack/ts-command-line`; no direct Umzug advisory in this audit. `fixAvailable=true`, exact transitive clean versions require candidate lock resolution. | Used by authenticated `/api/dbmigrate` with a fixed migration glob. No user-controlled glob input found. `sequelize-cli` also pulls Umzug 2.3.0 for migration tooling. | Refresh compatible transitive dependencies in an isolated candidate; test migration discovery against synthetic DB, no production migration. **Medium risk** because migration tooling is sensitive; rollback candidate image/lock, never automatically reverse a production schema migration. |

**Priority meaning:** P0 is immediate exposure control and planned framework replacement, not an assertion that AVIF RCE is currently exploitable. P1 is a focused update in the next maintenance cycle or before activating the affected feature. P2 is limited current exposure, monitored and addressed during a scoped packaging/integration update. No verified unauthenticated production exploit was established in this review.

## Other audit findings

The remaining 36 packages are mostly inherited findings. Relevant clusters: `postcss`, `nanoid`, and `source-map-js` under Next/build processing; `undici`, `gaxios`, `googleapis-common`, `form-data`, and `follow-redirects` under disabled Google integrations; `node-gyp`, `cacache`, `make-fetch-happen`, and `http-cache-semantics` under native installation; `fast-glob`, `micromatch`, `braces`, `picomatch`, `minimatch`, `brace-expansion`, `argparse`, and Rushstack packages under migration/glob tooling. Browser dependencies include `js-cookie`. Findings should be rescanned after each focused candidate because one parent update can resolve several inherited rows. The complete package/version/advisory inventory appears below; `inherited` means npm reports risk through a child and does not supply a direct advisory for that parent.

## Safe remediation sequence

1. **Keep current containment in place**: Cloudflare Access on all routes, localhost-only origin, SerpBear login, scraper/SMTP/providers disabled. Recheck these gates before each release. No immediate production change was made.
2. **Small same-major candidate**: update Sequelize to 6.37.8, Axios to 1.20.0, and transitive shell-quote to an audit-clean 1.x; keep this separate from framework migration. Resolve lockfile with deterministic install, then audit and inspect actual image tree.
3. **Next candidate**: assess migration from 12.3.7 to patched 15.5.24. Npm metadata permits Node 18.18+ and React 18.2, but Next 15 is a major jump and may require code/tooling changes. Do not choose Next 16 solely because audit suggests 16.4.0: [Next 16 upgrade notes](https://nextjs.org/docs/app/guides/upgrading/version-16) include higher Node/TypeScript requirements and removal of `next lint`; this project uses TypeScript 4.8 and `next lint`. Test Pages Router and authentication carefully.
4. **Native/build and optional integrations**: isolate tar/node-gyp from the runtime image if possible, then evaluate sqlite3 6.0.1; handle Nodemailer before SMTP, Axios before proxy/Ads/Search Console, and Umzug before any new migration workflow. Do not combine these major upgrades with Next.

For each candidate: run `npm ci`, production audit, full Jest, standalone TypeScript check, Next build, Docker build, and an isolated no-egress runtime UAT with synthetic data; verify login, Cloudflare Access, domain/keyword CRUD, ranking-history regression, SQLite integrity, no unintended outbound requests, health, and non-root runtime. Before any production deployment, take and verify a SQLite backup, record image ID and counts, obtain separate operator approval, deploy only SerpBear, and retain the current image for application rollback. Never auto-restore the database merely because a new image fails.

## Evidence gaps and limits

- No exploit was attempted. Reachability conclusions are code/configuration inferences, not proof of impossibility.
- The audit is current, but advisory data can change; rescan candidates at build time. Advisory IDs are GHSA links; CVEs are included where confirmed by the linked source. Inherited rows do not have a unique CVE.
- The exact fixed transitive versions for Umzug, native install tooling, and the 36 secondary rows require lockfile resolution in a future **implementation** phase. This review did not modify the lockfile.
- Authorized browser behavior and alternative host routes were not retested during this dependency review; the deployment report and current anonymous Access redirects support the stated boundary.

## Full npm audit package inventory

The following inventory is generated from the fresh production-only audit and current package lock. Multiple advisories are represented by the first two GHSA IDs plus a count; the npm audit JSON is the authoritative complete list for this review. `Fix` is npm's proposed package version when specified, otherwise `yes` means an available compatible resolution (not yet validated).

| Package | Locked | Severity | Direct? | Advisory IDs / inheritance | npm fix |
|---|---:|---|---|---|---|
| @googleapis/searchconsole | 1.0.5 | moderate | yes | inherited | @googleapis/searchconsole@11.0.1 |
| @rushstack/node-core-library | 5.13.0 | moderate | no | inherited | true |
| @rushstack/terminal | 0.15.2 | moderate | no | inherited | true |
| @rushstack/ts-command-line | 4.23.7 | moderate | no | inherited | true |
| @tootallnate/once | 2.0.0 | low | no | [GHSA-vpq2-c234-7xj6](https://github.com/advisories/GHSA-vpq2-c234-7xj6) | sqlite3@6.0.1 |
| ajv | 6.14.0 | moderate | no | [GHSA-2g4f-4pwh-qvx6](https://github.com/advisories/GHSA-2g4f-4pwh-qvx6) | true |
| argparse | 2.0.1 | moderate | no | inherited | true |
| axios | 1.13.5 | high | yes | [GHSA-3p68-rc4w-qgx5](https://github.com/advisories/GHSA-3p68-rc4w-qgx5), [GHSA-w9j2-pvgh-6h63](https://github.com/advisories/GHSA-w9j2-pvgh-6h63) (+32) | true |
| brace-expansion | 1.1.12 | high | no | [GHSA-f886-m6hf-6m8v](https://github.com/advisories/GHSA-f886-m6hf-6m8v), [GHSA-jxxr-4gwj-5jf2](https://github.com/advisories/GHSA-jxxr-4gwj-5jf2) (+6) | true |
| braces | 3.0.3 | high | no | [GHSA-vfj7-8cjw-p6xm](https://github.com/advisories/GHSA-vfj7-8cjw-p6xm) | true |
| cacache | 15.3.0 | high | no | inherited | sqlite3@6.0.1 |
| editorconfig | 1.0.4 | high | no | inherited | true |
| fast-glob | 3.3.3 | high | no | inherited | true |
| fast-uri | 3.1.0 | high | no | [GHSA-v2hh-gcrm-f6hx](https://github.com/advisories/GHSA-v2hh-gcrm-f6hx), [GHSA-7p8r-x3mc-p8w7](https://github.com/advisories/GHSA-7p8r-x3mc-p8w7) (+7) | true |
| follow-redirects | 1.15.11 | moderate | no | [GHSA-r4q5-vmmm-2653](https://github.com/advisories/GHSA-r4q5-vmmm-2653) | true |
| form-data | 4.0.5 | high | no | [GHSA-hmw2-7cc7-3qxx](https://github.com/advisories/GHSA-hmw2-7cc7-3qxx) | true |
| gaxios | 6.7.1 | moderate | no | inherited | true |
| googleapis-common | 7.2.0 | moderate | no | inherited | @googleapis/searchconsole@11.0.1 |
| http-cache-semantics | 4.2.0 | high | no | [GHSA-ch52-4w7c-c8xp](https://github.com/advisories/GHSA-ch52-4w7c-c8xp) | true |
| http-proxy-agent | 5.0.0 | low | no | inherited | sqlite3@6.0.1 |
| immutable | 5.1.4 | high | no | [GHSA-wf6x-7x77-mvgw](https://github.com/advisories/GHSA-wf6x-7x77-mvgw), [GHSA-xvcm-6775-5m9r](https://github.com/advisories/GHSA-xvcm-6775-5m9r) (+1) | true |
| ip-address | 10.1.0 | high | no | [GHSA-v2v4-37r5-5v8g](https://github.com/advisories/GHSA-v2v4-37r5-5v8g), [GHSA-mwp4-54f8-5fhr](https://github.com/advisories/GHSA-mwp4-54f8-5fhr) (+3) | true |
| js-cookie | 3.0.5 | high | no | [GHSA-qjx8-664m-686j](https://github.com/advisories/GHSA-qjx8-664m-686j) | true |
| lodash | 4.17.23 | high | no | [GHSA-r5fr-rjxr-66jc](https://github.com/advisories/GHSA-r5fr-rjxr-66jc), [GHSA-f23m-r3pf-42rh](https://github.com/advisories/GHSA-f23m-r3pf-42rh) | true |
| make-fetch-happen | 9.1.0 | high | no | inherited | sqlite3@6.0.1 |
| micromatch | 4.0.8 | high | no | inherited | true |
| minimatch | 3.1.5 | high | no | [GHSA-3ppc-4f35-3m26](https://github.com/advisories/GHSA-3ppc-4f35-3m26), [GHSA-7r86-cg39-jmmj](https://github.com/advisories/GHSA-7r86-cg39-jmmj) (+1) | true |
| moment | 2.30.1 | moderate | no | [GHSA-4p3w-j4w9-5jqw](https://github.com/advisories/GHSA-4p3w-j4w9-5jqw) | true |
| nanoid | 3.3.11 | high | no | [GHSA-28wg-ghj8-5hjv](https://github.com/advisories/GHSA-28wg-ghj8-5hjv), [GHSA-2v37-7h3g-55p8](https://github.com/advisories/GHSA-2v37-7h3g-55p8) (+1) | true |
| next | 12.3.7 | critical | yes | [GHSA-c59h-r6p8-q9wc](https://github.com/advisories/GHSA-c59h-r6p8-q9wc), [GHSA-g77x-44xx-532m](https://github.com/advisories/GHSA-g77x-44xx-532m) (+13) | next@16.4.0 |
| node-gyp | 8.4.1 | high | no | inherited | sqlite3@6.0.1 |
| nodemailer | 8.0.1 | high | yes | [GHSA-c7w3-x93f-qmm8](https://github.com/advisories/GHSA-c7w3-x93f-qmm8), [GHSA-vvjj-xcjg-gr5g](https://github.com/advisories/GHSA-vvjj-xcjg-gr5g) (+11) | nodemailer@10.1.1 |
| picomatch | 2.3.1 | high | no | [GHSA-3v7f-55p6-f55p](https://github.com/advisories/GHSA-3v7f-55p6-f55p), [GHSA-c2c7-rcm5-vvqj](https://github.com/advisories/GHSA-c2c7-rcm5-vvqj) | true |
| postcss | 8.5.6 | high | no | [GHSA-7fh5-64p2-3v2j](https://github.com/advisories/GHSA-7fh5-64p2-3v2j), [GHSA-qx2v-qp2m-jg93](https://github.com/advisories/GHSA-qx2v-qp2m-jg93) (+3) | next@16.4.0 |
| qs | 6.15.0 | moderate | no | [GHSA-q8mj-m7cp-5q26](https://github.com/advisories/GHSA-q8mj-m7cp-5q26), [GHSA-x5fp-wj9c-mxmx](https://github.com/advisories/GHSA-x5fp-wj9c-mxmx) (+1) | true |
| sequelize | 6.37.7 | high | yes | [GHSA-6457-6jrx-69cr](https://github.com/advisories/GHSA-6457-6jrx-69cr) | true |
| shell-quote | 1.8.3 | critical | no | [GHSA-w7jw-789q-3m8p](https://github.com/advisories/GHSA-w7jw-789q-3m8p), [GHSA-395f-4hp3-45gv](https://github.com/advisories/GHSA-395f-4hp3-45gv) | true |
| source-map-js | 1.2.1 | high | no | [GHSA-68fv-2mgg-jv7q](https://github.com/advisories/GHSA-68fv-2mgg-jv7q) | true |
| sprintf-js | 1.0.3 | moderate | no | [GHSA-hp3w-g68c-fv3c](https://github.com/advisories/GHSA-hp3w-g68c-fv3c) | true |
| sqlite3 | 5.1.7 | high | yes | inherited | sqlite3@6.0.1 |
| tar | 6.2.1 | critical | no | [GHSA-34x7-hfp2-rc4v](https://github.com/advisories/GHSA-34x7-hfp2-rc4v), [GHSA-8qq5-rm4j-mr97](https://github.com/advisories/GHSA-8qq5-rm4j-mr97) (+10) | sqlite3@6.0.1 |
| umzug | 3.8.2 | high | yes | inherited | true |
| undici | 7.22.0 | high | no | [GHSA-f269-vfmq-vjvj](https://github.com/advisories/GHSA-f269-vfmq-vjvj), [GHSA-2mjp-6q6p-2qxm](https://github.com/advisories/GHSA-2mjp-6q6p-2qxm) (+22) | true |
| uuid | 9.0.1 | moderate | no | [GHSA-w5hq-g745-h8pq](https://github.com/advisories/GHSA-w5hq-g745-h8pq) | @googleapis/searchconsole@11.0.1 |
