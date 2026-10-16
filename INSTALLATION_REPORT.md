# Official SerpBear Installation Report

**Status:** Complete — `SERPBEAR_OFFICIAL_INSTALL_SUCCESS`

## Source and Image

- Repository: [towfiqi/serpbear](https://github.com/towfiqi/serpbear)
- Selected release: `v3.1.0` ([official release](https://github.com/towfiqi/serpbear/releases/tag/v3.1.0))
- Source commit: `32204ee044e499590aecd0e2e244c018fb8fc8a3`
- Image: `towfiqi/serpbear:3.1.0@sha256:31bc71dc02a7d4efe4170e76eefac8be06077fb03d8d215919b602032dde3c38`
- The application source is the unmodified release. Deployment uses `compose.official.yml`. `.env` contains freshly generated credentials, is mode `0600`, and is ignored by Git. The root `.gitignore` has an exact `.env` ignore entry.

## Runtime

- Compose project/service: `serpbear-official` / `app`
- Container: `serpbear-official-app` — running and healthy
- Port: `127.0.0.1:3180` to container port `3000`; HTTP login page returns `200`
- Dedicated volume/network: `serpbear-official-data` / `serpbear-official-network`
- Compose configuration passed `docker compose config --quiet`.

## Verification

- Authentication: login page returned `200`; invalid credentials returned `401`; generated credentials logged in successfully; logout succeeded and the protected domains API returned `401` afterward.
- Dashboard/domain UI: `/domains` returned `200` and includes the Add Domain control. The authenticated domains API returned an empty list. The per-domain keyword page route returned `200`. No domains or keywords were created.
- Database: `/app/data/database.sqlite` exists in the dedicated volume. Tables include `domain`, `keyword`, and `SequelizeMeta`; all five release migrations are recorded. `PRAGMA integrity_check` returned `ok`; domain and keyword row counts are both zero.
- Persistence: only the SerpBear app container was restarted. The SQLite and settings files persisted, login and dashboard checks passed again, and the container returned healthy.
- Scraping: the official `scrape_interval` setting is `never`, persisted across restart; `scraper_type` is `none`. No search, ads, SMTP, ProxyEmpire, or SERP provider credentials are configured. The image still runs its hourly failed-queue watcher; with no tracking data or failed queue it makes no scraping request.

## Limitations

- The Docker logs endpoint returned a Docker API permission error in this session, so startup logs could not be read. Migration completion was verified from `SequelizeMeta`, the SQLite integrity check, and the healthy application response.
- HTTP routes and empty-domain API state were verified. Browser-driven visual inspection of the hydrated empty-state text was unavailable because the browser action socket under `/run/user/1000` is read-only. Add Keyword requires a domain, so domain and keyword creation remain for manual testing as requested.

## Cloudflare Tunnel

- Target hostname: `serpbear.bewara.xyz`, forwarding to `http://127.0.0.1:3180`. The hostname had no existing A, AAAA, or CNAME record when checked; `bewara.xyz` is delegated to Cloudflare nameservers.
- Status: pending. Tunnel creation could not reach `api.cloudflare.com` because outbound DNS is blocked in the Codex sandbox. No tunnel credentials or DNS record were created, and the app remains bound to loopback only.
- To finish from the server shell as `kiwkiw`, run `bash /home/kiwkiw/projects/serpbear/setup-cloudflare-tunnel.sh`. It creates a fresh tunnel for SerpBear, routes only this hostname, updates `NEXT_PUBLIC_APP_URL`, restarts only the SerpBear app container, and installs/starts the dedicated systemd tunnel service. It does not use the OBL tunnel.
- After setup, check `sudo systemctl status serpbear-cloudflared.service` and `curl -I https://serpbear.bewara.xyz/login/`.

## Windows SSH Tunnel

In PowerShell, run this in a terminal and leave it open:

```powershell
ssh -p 2222 -N -L 3180:127.0.0.1:3180 kiwkiw@bewara-tea
```

If `bewara-tea` does not resolve from Windows, replace it with the server's SSH hostname or IP. Then open <http://localhost:3180> in a browser. Sign-in values are stored in the protected `.env` file on the server; this report does not include them.
