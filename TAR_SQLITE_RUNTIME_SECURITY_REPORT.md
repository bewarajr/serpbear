# SerpBear tar/sqlite3 Runtime Security Review

**Status: `TAR_RUNTIME_REMEDIATION_READY`**  
**Review date:** 2026-10-14  
**Production deployment:** not performed

## Finding

The production runtime dependency tree contains `tar@6.2.1` because `sqlite3@5.1.7` declares it and `node-gyp@8.4.1` also depends on it. `sqlite3` has an install script that first tries a prebuilt N-API binary and falls back to `node-gyp rebuild`. The `tar` imports found in the installed tree are confined to `sqlite3/deps/extract.js` and `node-gyp/lib/install.js`; these helpers are used during native package installation/build, not by SQLite's normal query/open/close runtime API. The runtime uses `sqlite3/lib/sqlite3.js` and its native binding.

This is supported by the Docker build flow: `npm ci --omit=dev` runs in the `runtime-deps` build stage, so the SQLite binding is installed before pruning. The candidate then removes `tar` and `node-gyp` from that dependency tree and from the Next standalone trace before copying runtime files into the runner image. No package manifests or lockfile entries were changed.

## Isolated candidate

- Base commit: Phase 1 production source `7ac9cecff424f49edfee549147f6495560ed8743`.
- Worktree: `/tmp/serpbear-tar-runtime`.
- Candidate branch and commit: `security-tar-runtime-20261014`, `6f2d8f4` (`build(docker): prune sqlite build helpers from runtime image`). Only `Dockerfile` changed.
- Candidate image: `serpbear-tar-runtime-candidate:20261014`, image ID `sha256:d12c177e13465308e9f46e9ffc16604da1daa7041fe6c4d8a69c7343beceac9a`.
- Runtime identity: non-root `nextjs` user; port remains container-only. The UAT Compose published no host port.

## Validation results

| Check | Result |
| --- | --- |
| `npm ci` | PASS; lockfile unchanged |
| Full Jest suite | PASS: 12 suites, 46 tests; includes Ranking History regression |
| TypeScript | PASS |
| ESLint | PASS, no warnings or errors |
| Next.js production build | PASS on the existing Phase 1 Next.js version |
| Docker candidate build | PASS |
| SQLite runtime after pruning | PASS: `sqlite3@5.1.7` opened an in-memory database and the persistent test database; `PRAGMA integrity_check` returned `ok` |
| `tar` and `node-gyp` in final image | PASS: `require.resolve` failed for both and recursive filesystem search found no `node_modules/tar` or `node_modules/node-gyp` under `/app` |
| Isolated Docker UAT | PASS; approved before container creation, synthetic data only, internal Docker network, no default route, no external egress |
| Production and cleanup | PASS: production stayed healthy on Phase 1 image; only UAT container/network/volume were removed |

UAT covered bad and valid login, logout, dashboard and static assets, domain view, Keyword Management, Domain CRUD, Keyword CRUD, settings persistence, and restart persistence. With providers disabled, the synthetic keyword's automatic refresh failed before a network request because its scraper URL was empty; the internal-only network also had no default route. The failure was recorded, position remained 0, no ranking history entry was created, and the retry queue remained empty. SQLite integrity passed after cleanup with 0 domains and 0 keywords.

Fresh database startup printed existing migration messages such as `No description found for "domain"/"keyword" table` before the initial model sync creates those tables. Migrations completed; after restart, the application reported that schema was up to date. The test refresh also emitted its expected failed-scrape log. These messages did not prevent health, CRUD, persistence, or integrity checks.

## Audit versus final image contents

Fresh `npm audit --omit=dev --json` on the unchanged Phase 1 lockfile reported **2 Critical, 23 High, 14 Moderate, and 2 Low** packages (41 affected packages). The Critical aggregates were `next@12.3.7` and `tar@6.2.1`; `node-gyp` and `sqlite3` were also reported High through the same install dependency chain. `npm audit` still reports these findings because `package.json` and `package-lock.json` correctly retain the dependencies needed to install/build SQLite. The candidate image filesystem no longer contains `tar` or `node-gyp`; the lockfile audit is not a measurement of the post-install pruned image. No broad vulnerability claim is made: Next.js and the remaining dependencies still need their separate remediation.

The relevant tar advisory aggregate includes [GHSA-23hp-3jrh-7fpw](https://github.com/advisories/GHSA-23hp-3jrh-7fpw); the production audit also reports other tar advisories. The candidate removes the package from the runtime filesystem rather than upgrading it. This leaves the build/install environment exposed to the lockfile's tar/node-gyp findings while `npm ci` runs. Build stages should therefore run in a controlled CI/build environment and must not process untrusted tar archives.

## Recommendation and limits

The tested Dockerfile pruning is a minimal, SQLite-compatible way to exclude `tar` and `node-gyp` from the final runtime filesystem while retaining `sqlite3@5.1.7` and its native binding. It does not resolve the vulnerable versions in the source lockfile or make the build stage safe from those advisories. It also does not address the separate Critical Next.js finding or the other audit results.

The production image, container, SQLite volume, Cloudflare settings, and unrelated Docker services were not modified. Production use requires a separate deployment approval and normal pre-deployment backup/rollback checks. No production deployment is authorized by this report.
