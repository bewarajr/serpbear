# SerpBear Hourly Enterkomputer dan Fastwork Pilot

**Status pilot live V2 (historis): `LIVE_PILOT_FAILED`**  
**Status pilot live 15-minute V1 (Production, 16 Oktober 2026): `LIVE_15M_PILOT_PARTIAL`** — Run `ec65ea43-d743-4316-a6bb-aeaf72511705` selesai tiga siklus dan berhenti otomatis; Enterkomputer teramati tiga kali, Fastwork tidak memperoleh observasi provider.  
**Production image saat pilot:** commit `f60a5f9a558638dbcea858460d174fe5b15123fc`, image `sha256:873e9a2dba19b34ed27a22efd78f5f2c6876b016ea0a0431162a93243db50b20`; pilot kini nonaktif.  
**Status deployment Manual Refresh Guard (tahap sebelumnya):** `MANUAL_REFRESH_GUARD_DEPLOYMENT_SUCCESS` — commit `685a25a8653455a136649546405a1fca8e24ab39`, image `sha256:5e3f405a54522fd8e8a5e9ba163a281a063c3d61508871bc8e4946d49beb720e`. Pilot saat deployment itu disabled.  
**Pilot V2 (historis):** kode V2 telah dideploy; pilot dihentikan secara terdokumentasi pada 18:23 WIB sebelum siklus pertama setelah dua refresh manual di luar run tercatat. Tidak ada siklus pilot V2 yang berjalan.  
**Target yang disetujui:** Enterkomputer keyword ID 19 dan Fastwork keyword ID 17.  
**Tanggal update:** 16 Oktober 2026

## Ringkasan

Investigasi terdahulu mengonfirmasi Production memakai volume SQLite yang diharapkan dan berisi 2 domain / 2 keyword; alasan hilangnya record lama tidak dapat dipastikan lebih jauh dari bukti log. Operator kini secara eksplisit menyetujui perubahan scope Enterkomputer dari ID 14 yang hilang ke record aktif ID 19. Tidak ada domain atau keyword Production yang dibuat, dipulihkan, dihapus, atau diubah.

Kandidat V2 memakai ID 19 dan 17, lulus validasi offline dan Mock Runtime UAT tiga siklus, lalu dideploy dengan approval `APPROVE_DEPLOY_HOURLY_PILOT_CODE_V2`. Pilot live V2 diaktifkan dengan approval terpisah `APPROVE_ENTERKOMPUTER_FASTWORK_HOURLY_PILOT_V2`. Pemeriksaan menemukan dua refresh `manual` untuk target pilot setelah aktivasi dan sebelum slot pertama. Audit tidak menyimpan identitas client/orang yang memicu tindakan itu. Guard backend untuk refresh manual kini diimplementasikan dan lulus offline serta UAT terisolasi; Production tetap memakai image sebelumnya sampai ada approval deployment baru.

Bagian setelah **V2 Candidate Update** mempertahankan catatan investigasi dan hasil V1 sebagai konteks historis. Setiap status, target, image, atau approval V1 yang berbeda telah disupersesi oleh hasil V2 di bawah.

## V2 Candidate Update (status otoritatif)

### Target dan Production preflight

Operator menyetujui target existing berikut; aplikasi tidak membuat ulang atau mengganti record:

| Keyword ID | Domain ID / nilai tersimpan | Keyword | Country | Device tersimpan | Posisi / URL tersimpan |
|---:|---|---|---|---|---|
| 19 | 11 / `www.enterkomputer.com/simulasi` | `simulasi rakit pc` | `ID` | `mobile` | 1 / `https://www.enterkomputer.com/simulasi/` |
| 17 | 10 / `fastwork.id/web-design/landing-page` | `Jasa Pembuatan Landing Page, Mulai Rp 100.000` | `ID` | `mobile` | 1 / `https://fastwork.id/web-design/landing-page` |

Preflight Production tepat sebelum deployment mengonfirmasi container sehat pada image sebelumnya `sha256:6c8eca5d61b6ffbee30501e632c9a87ee11d8f6a47c511c13f77557f0a19e675`, DB aktif `/app/data/database.sqlite` pada volume `serpbear-official-data`, serta 2 domain / 2 keyword. ID 19 dan 17 beserta domain ID, domain/path, keyword, dan country cocok dengan scope. Ranking History tersedia untuk keduanya; Refresh Audit berisi 21 record; lock dan failed queue kosong; `PRAGMA integrity_check=ok`; provider Serper, `scrape_interval=never`, dan retry `false`. Tidak ada refresh atau request provider saat preflight.

Field `device=mobile` dicatat sebagai konfigurasi tersimpan saja. Adapter Serper tidak mengirim pemilih device eksplisit sehingga hasil pilot tidak akan disebut verifikasi SERP mobile/desktop.

### Kode kandidat dan image

- Basis kandidat sebelumnya: `f8cdcce791975d8ca18e554516e4ae566587ec3f`.
- Commit V2: `022dede323b2e4e7b45cf3a7c93091f9a5e55bf3` (`fix(hourly-pilot): target active keyword records`). Working tree kandidat bersih.
- Diff: 9 file, 174 penambahan dan 23 penghapusan.
- Tag image baru: `serpbear-hourly-pilot-v2:20261015-v1`.
- Image ID baru: `sha256:f3942cd54b7df2297cfb123664f1658142af25ceb739be943ebeed7b1f7c608b`.
- Image V1 tetap tersimpan terpisah sebagai `sha256:84a862106ab55cbbf7bf2008a558f61d3379b5d21a6b758f72ee670760f7a23c`; image lama tidak ditimpa.
- File berubah: policy pilot, validasi pilot, skrip arm, default migrasi/model, adapter Serper untuk URL mock test-only, serta tes policy/migrasi/integrasi Serper.
- Validasi sebelum request: ID keyword, domain ID dan string domain/path, teks keyword, serta country harus cocok persis. ID 14 tidak termasuk allowlist. Set target tersimpan harus tepat `[19,17]`.
- Scheduler tetap memakai `cron.js`, endpoint internal terautentikasi, Refresh Audit, Single-Flight Lock, dan Request Budget Guard. Pilihan mock endpoint hanya aktif jika `SERPBEAR_HOURLY_PILOT_TEST_MODE=true`; default adapter tetap `https://google.serper.dev/search`.
- Batas tetap 1 request Basic per keyword per slot, 2 per siklus, 3 siklus, maksimum 6 request, penghentian otomatis setelah siklus ketiga, dan expiry 4 jam. Pilot default `enabled=0`; tidak mengubah global schedule atau retry.

### Offline validation

| Pemeriksaan | Hasil |
|---|---|
| Jest lengkap | 20 suites, 85 tes lulus |
| TypeScript `tsc --noEmit` | lulus |
| ESLint `npm run lint` | lulus, tanpa warning/error ESLint |
| Next.js `npm run build` | berhasil; route `/api/hourly-pilot` terbentuk |
| Docker build | berhasil untuk tag V2 di atas |
| Policy / migration | hanya `[19,17]` diterima; ID 14 dan ID tak terduga ditolak; default mati; unique slot dan batas 3/6 berlaku |
| Serper offline | 401/403/429 tidak menulis observasi palsu; ranking/history valid diperbarui; endpoint mock hanya tersedia di mode test; matched URL aktual dipertahankan |
| Matching | URL same-host lain diterima melalui hostname fallback; URL aktual tetap tersimpan. Perangkat tidak menjadi parameter request |
| Settings dan kredensial | global Never/retry disabled dipertahankan; credential tidak ditaruh di URL atau log/audit |

Build menampilkan peringatan Browserslist/Tailwind yang sudah ada; build tetap berhasil. Tidak ada upgrade Next.js.

### Isolated Mock Runtime UAT

UAT dijalankan dari image V2 dengan dua container, network Docker `internal=true`, tanpa port host, serta volume SQLite bernama khusus UAT. Container app hanya memasang volume tersebut; mock menerima request hanya melalui alias internal `mock-serper`. UAT memakai `APIKEY`, `SECRET`, dan key Serper sintetis; tidak ada Production secret, mount Production, atau jalur egress eksternal. Setelah bukti dikumpulkan, container, network, dan volume UAT dibersihkan; image kandidat tetap ada.

Migrasi dijalankan pada SQLite sintetis dengan record dasar dan berhasil membuat audit, lock, pilot config, serta cycle table. Data sintetis berisi ID 19 dan 17 dengan identitas yang disetujui serta keyword tak terpilih ID 20. Saat app dan cron mulai dalam keadaan pilot disabled, endpoint app merespons HTTP 200 dan mock masih mencatat 0 request. Worker cron tetap berjalan setelah restart; tidak ada refresh langsung pada startup.

| Siklus | Slot simulasi UTC | Mulai aktual WIB | Selesai aktual WIB | ID 19: audit / posisi / URL | ID 17: audit / posisi / URL | Request |
|---:|---|---|---|---|---|---:|
| 1 | 15 Okt 12:00 | 16:47:37.768 | 16:47:38.024 | `4b6b7f73-6eeb-456e-b368-0288bc363865`, completed / 1 / `https://www.enterkomputer.com/simulasi` | `9fecde65-bd88-4f42-b738-f3aaaa38c033`, completed / 1 / `https://fastwork.id/other-listing` | 2 |
| 2 | 15 Okt 13:00 | 16:47:45.767 | 16:47:46.038 | `9cf481f0-f9fb-4386-beb0-3b2a6775a223`, completed / 1 / `https://www.enterkomputer.com/simulasi` | `5f2bd784-9c55-46a2-b4a1-9f8476517556`, completed / 1 / `https://fastwork.id/other-listing` | 2 |
| 3 | 15 Okt 14:00 | 16:48:20.737 | 16:48:21.004 | `ca6f4dc4-f9ba-4331-aa93-a368c4b97598`, completed / 1 / `https://www.enterkomputer.com/simulasi` | `33a458a7-d3b2-422c-8dbd-ee0df6e12855`, completed / 1 / `https://fastwork.id/other-listing` | 2 |

Waktu actual di tabel adalah timestamp eksekusi UAT, bukan jadwal Production. Worker memakai slot simulasi `12:00`, `13:00`, dan `14:00 UTC`; ketiganya mengirim tepat dua request mock. Total diterima mock: **6**, ditolak: **0**; probe slot keempat menghasilkan HTTP 409 `cycle_limit`, dan jumlah tetap enam.

Rincian hasil runtime:

- Semua enam Refresh Audit bertanda `trigger_source=hourly_pilot`, `actor_category=internal_service`, `status=completed`, `outbound_request_count=1`, provider `2xx`, dan `position_after=1`.
- Ranking History mempertahankan nilai tanggal sebelumnya dan menyimpan posisi 1 pada `2026-10-15` untuk ID 19 dan 17. ID 20 tetap pada posisi 7 dengan URL/history sebelumnya dan tanpa audit pilot.
- Fastwork mock sengaja mengembalikan `https://fastwork.id/other-listing`; ini membuktikan pencocokan hostname yang telah disetujui, bukan ranking exact landing page.
- Enterkomputer mock mengembalikan `https://www.enterkomputer.com/simulasi`. URL aktual berada pada path yang dimaksud, tetapi comparator lama dapat fallback ke hostname (termasuk perbedaan trailing slash), jadi UAT tidak mengklaim jaminan exact-page matching.
- Percobaan refresh ID 19 saat lock sintetis hidup menghasilkan audit `skipped/concurrent_refresh`, 0 request; lock kemudian dibersihkan. Percobaan slot yang sama menghasilkan `duplicate_slot` tanpa request.
- Container direstart setelah dua siklus. Sesudah restart app HTTP 200, config/counter dan dua slot sebelumnya tetap tersimpan, dan tidak ada request langsung. Siklus ketiga melengkapi total enam request.
- Sesudah siklus ketiga, config nonaktif dengan `cycle_count=3`, `request_count=6`, `stop_reason=cycle_limit`. Probe slot keempat diblokir. Probe budget dengan `request_count=6` juga menghasilkan `request_budget_exhausted` dan mock tetap enam. Expiry lampau otomatis menonaktifkan config dengan `stop_reason=expired`.
- Global `scrape_interval=never`, retry `false`, failed queue kosong, refresh lock kosong, SQLite `integrity_check=ok`. Audit/cycle dan stream log tidak mengandung tiga credential sintetis yang dipakai.
- Response mock seluruhnya sintetis; konsumsi kredit Serper aktual **nol**. Batas live tetap enam request maksimum, estimasi sekitar enam standard query credits dan tidak dijamin.

### Hasil deployment Production (snapshot sebelum aktivasi live, 15 Oktober 2026)

Deployment disetujui dengan `APPROVE_DEPLOY_HOURLY_PILOT_CODE_V2`. Source commit `022dede323b2e4e7b45cf3a7c93091f9a5e55bf3`; image `sha256:f3942cd54b7df2297cfb123664f1658142af25ceb739be943ebeed7b1f7c608b` (`serpbear-hourly-pilot-v2:20261015-v1`). Container kandidat dibuat pada 15 Oktober 2026 pukul 16:58:51 WIB. Hanya service Compose `app` yang direcreate dan referensi image pada `compose.official.yml` yang diperbarui. Image dan tag Production sebelumnya tetap tersedia untuk rollback.

| Pemeriksaan | Hasil setelah deployment |
|---|---|
| Backup sebelum deploy | Salinan terlindungi `/var/backups/serpbear/serpbear-prod-predeploy-v2-20261015T095714Z.sqlite` (direktori `0700`, file `0600`), 139264 byte; SHA-256 `83ed41c922ead3e3dcc011f3dbcc8484da2fc9f35e27b725e231d029e1444b94`. Hash cocok dengan salinan `/tmp`; snapshot SQLite API konsisten, integrity `ok`, 2 domain, 2 keyword, 21 audit, 0 lock |
| Container / image | `serpbear-official-app`, running dan healthy; image ID sesuai kandidat; volume `serpbear-official-data:/app/data` tetap terpasang |
| App dan cron | Next.js server dan `node cron.js` berjalan; health endpoint lokal HTTP 200 |
| Migrasi | `1760486400000-add-hourly-pilot-state.js` tercatat; hanya tabel config/cycle pilot baru ditambahkan |
| Pilot config saat deployment | `enabled=0`, target `[19,17]`, max 3 siklus / 6 request, counter 0; cycle table kosong. Aktivasi terpisah terjadi kemudian; status terkini ada di bagian live results |
| Global settings | `scrape_interval=never`, `scrape_retry=false`, provider `serper`, request budget global 1, failed queue kosong; mode test dan endpoint mock tidak disetel di environment atau `.env.local` |
| SQLite dan data lama | `integrity_check=ok`; 2 domain, 2 keyword, 21 Refresh Audit, 0 refresh lock. Hash seluruh row domain, keyword (termasuk Ranking History), audit, dan lock sama persis sebelum/sesudah deployment. ID 17/19 dan URL tersimpan tetap utuh |
| Refresh setelah deploy | Audit tetap 21 row dan pilot cycle 0; tidak ada refresh atau request Serper/Google yang dijalankan oleh deployment |
| Rollback | Image/tag lama tetap tersedia: `sha256:6c8eca5d61b6ffbee30501e632c9a87ee11d8f6a47c511c13f77557f0a19e675` / `serpbear-refresh-safety-candidate:20261014-v2`. Rollback: kembalikan referensi `image:` di `compose.official.yml` ke tag lama, lalu jalankan `docker compose -f compose.official.yml up -d --no-deps --pull never app`. Migrasi pilot bersifat additive; backup terlindungi ada di `/var/backups/serpbear` |

Verifikasi browser memakai session bernama. URL Production `https://serpbear.bewara.xyz` menampilkan halaman login Cloudflare Access karena session browser tidak memiliki autentikasi Access. Browser kemudian membuka origin Production `http://127.0.0.1:3180/` dan menampilkan judul **SerpBear** serta halaman login aplikasi; dashboard terautentikasi tidak dibuka. Screenshot halaman login tersimpan di `/tmp/serpbear-v2-production-browser.png`.

Pada saat snapshot deployment, aktivasi live masih menunggu approval terpisah. Aktivasi aktual dan hasil sementara dicatat pada bagian berikut.

### Risiko dan batas klaim

- Hasil mock tidak memperkirakan ranking Google Production atau perubahan posisi antarjam.
- Fastwork memakai hostname matching; landing-page exact rank tidak dapat disimpulkan dari URL hasil lain pada host yang sama.
- Enterkomputer menyimpan path `/simulasi`, tetapi matcher masih dapat fallback ke hostname; URL per siklus wajib disimpan dan exact-page accuracy tidak dijamin.
- Serper adapter tidak menargetkan device eksplisit; stored `mobile` bukan bukti mobile SERP.
- Perkiraan enam credit adalah estimasi; billed query count/provider behavior dapat berbeda.
- Snapshot live pada 18:15 WIB menunjukkan scheduler aktif sebelum slot pertama, tetapi dua refresh manual di luar run tercatat. Setelah operator mengizinkan stop terdokumentasi, run dihentikan pada 18:23 WIB; klasifikasi dan detail ada di bagian hasil Production (`LIVE_PILOT_FAILED`).

## LIVE HOURLY PILOT V2 — PRODUCTION RESULTS

### A. Activation

- Approval: `APPROVE_ENTERKOMPUTER_FASTWORK_HOURLY_PILOT_V2`.
- Run ID: `573beda3-6b8f-472f-b5ea-bf40b6318a57`.
- Activated: `2026-10-15T11:05:18.412Z` / `2026-10-15 18:05:18.412 WIB`.
- Expiry: `2026-10-15T15:05:18.412Z` / `2026-10-15 22:05:18.412 WIB` (4 jam dari aktivasi).
- Target allowlist: ID 19 (`www.enterkomputer.com/simulasi`, `simulasi rakit pc`, country `ID`) dan ID 17 (`fastwork.id/web-design/landing-page`, `Jasa Pembuatan Landing Page, Mulai Rp 100.000`, country `ID`). Maksimum 3 siklus dan 6 request total; maksimum satu Basic request per keyword tiap siklus; retry nonaktif.
- Slot otomatis berikutnya (WIB): 15 Okt 19:00, 20:00, dan 21:00. Padanan UTC: 12:00, 13:00, dan 14:00. Tidak ada catch-up slot yang terlewat.
- Cron mendaftarkan job pada log `2026-10-15T11:06:00.019Z` (`18:06:00.019 WIB`): `hourly job registered; no startup refresh executed`. Tidak ada restart container saat aktivasi.
- Baseline: 2 domain, 2 keyword, Refresh Audit 21 row; ID 19 posisi 1, URL `https://www.enterkomputer.com/simulasi/`, history `{"2026-10-15":1}`; ID 17 posisi 1, URL `https://fastwork.id/web-design/landing-page`, history `{"2026-10-15":1}`. Target, country, dan domain IDs 11/10 cocok.
- Provider `serper`; credential terenkripsi berhasil didekripsi secara lokal tanpa ditampilkan. Audit terakhir yang tersedia untuk kedua target mencatat HTTP `2xx`; tidak dikirim request validasi tambahan.
- Browser check Production menampilkan Cloudflare Access sign-in. Tidak ada sesi Access terautentikasi yang digunakan dan tidak ada bypass; dashboard authenticated tidak terverifikasi.
- Pada aktivasi, cycle table kosong, counter `0/0`, audit 21, lock kosong, dan `integrity_check=ok`; aktivasi tidak memicu refresh langsung. Pemeriksaan read-only berikutnya pada 18:15 WIB mendapati dua row Audit tambahan dari trigger `manual`, dijelaskan di bawah.

### B. Execution Results

Pemeriksaan read-only dilakukan pada `18:15 WIB` sebelum slot pertama. Cron job telah terdaftar, tetapi belum ada cycle row atau Refresh Audit dengan `trigger_source=hourly_pilot`. Setelah dua refresh manual di luar run ditemukan, operator mengizinkan stop terdokumentasi; pilot dihentikan pada `18:23:09 WIB`, masih sebelum slot 19:00. Jadi tidak ada ranking atau matched URL dari siklus pilot. Tabel berikut mencatat bahwa semua tiga slot dibatalkan sebelum eksekusi.

| Cycle | Scheduled WIB | Actual WIB | Keyword ID | Position Before | Position After | Matched URL | HTTP Status | Request Count | Audit Status |
|---:|---|---|---:|---|---|---|---|---:|---|
| 1 | 19:00 | — (dihentikan sebelum slot) | 19 | baseline 1 | — | — | — | 0 | tidak ada pilot audit |
| 1 | 19:00 | — (dihentikan sebelum slot) | 17 | baseline 1 | — | — | — | 0 | tidak ada pilot audit |
| 2 | 20:00 | — (run telah dihentikan) | 19 | baseline 1 | — | — | — | 0 | tidak ada pilot audit |
| 2 | 20:00 | — (run telah dihentikan) | 17 | baseline 1 | — | — | — | 0 | tidak ada pilot audit |
| 3 | 21:00 | — (run telah dihentikan) | 19 | baseline 1 | — | — | — | 0 | tidak ada pilot audit |
| 3 | 21:00 | — (run telah dihentikan) | 17 | baseline 1 | — | — | — | 0 | tidak ada pilot audit |

**Aktivitas di luar run:** dua audit manual selesai sebelum slot pertama. ID 19: refresh `00f30b10-8ec7-4380-9929-ccdd43b13893`, `11:12:49.567Z–11:12:51.050Z` (`18:12:49.567–18:12:51.050 WIB`), HTTP category `2xx`, 1 request, posisi `1 → 1`, URL tersimpan `https://www.enterkomputer.com/simulasi/`. ID 17: refresh `c1bf605a-fc0c-4151-8dcd-5eaeb982e919`, `11:12:56.683Z–11:12:58.208Z` (`18:12:56.683–18:12:58.208 WIB`), HTTP category `2xx`, 1 request, posisi `1 → 1`, URL tersimpan `https://fastwork.id/web-design/landing-page`. Keduanya memiliki `trigger_source=manual` dan `actor_category=authenticated_user`; audit tidak mencatat identitas aktor. Refresh ini bukan bagian dari run ID pilot. Audit menyimpan kategori status provider, bukan kode HTTP numerik; `page_metadata` juga tidak memuat URL, sehingga URL di atas dibaca dari field keyword `url` setelah refresh.

### C. Budget

- Siklus pilot dicoba: 0; siklus pilot selesai: 0.
- Counter persisten run: `request_count=0/6`. Refresh Audit menunjukkan dua outbound request Serper `manual` di luar run sesudah aktivasi (satu per target); jumlah request aplikasi yang tercatat sejak aktivasi adalah 2. Pilot budget counter tidak menghitung trigger manual, sehingga jika dibiarkan aktif run masih dapat menambah enam request di luar dua request tersebut. Pilot dihentikan sebelum slot pertama.
- Perkiraan query credit terpakai: sekitar 2 credit standar berdasarkan dua request manual; provider billing aktual tidak tersedia dan estimasi tidak dijamin.
- Pemakaian kredit aktual dari sisi provider tidak tersedia secara independen.
- Error provider pada dua audit manual: tidak ada (`2xx`). Tidak ada request pilot maupun siklus terlewati.

### D. Automatic Shutdown

- Sebelum stop: `enabled=1`, `cycle_count=0`, `request_count=0`, `stop_reason=NULL`. Stop terdokumentasi diterapkan pada `18:23 WIB`, segera setelah pemeriksaan pukul `18:23:09 WIB` memastikan tidak ada cycle `started` atau refresh lock. Timestamp stop terpisah tidak disimpan. Setelah stop: `enabled=0`, `cycle_count=0`, `request_count=0`, `stop_reason=operator_stop`; expiry `22:05:18 WIB` tidak perlu menunggu. Hanya state pilot yang diperbarui; tidak ada refresh.
- Cycle table tetap kosong; tidak ada siklus keempat. Auto-stop `cycle_limit` atau `expired` tidak diuji karena pilot dihentikan manual sebelum slot pertama.
- Global `scrape_interval=never`, retry `false`, failed queue kosong, refresh lock kosong, SQLite integrity `ok`. Data tetap 2 domain / 2 keyword; history kedua target masih `{"2026-10-15":1}`. Posisi tetap 1, tetapi `lastUpdated` diperbarui oleh dua refresh manual di atas.
- Tidak dilakukan restart. Status `enabled=0` persisten pada pemeriksaan pascastop; perilaku setelah restart dan auto-stop otomatis tidak diuji.

### E. Ranking Analysis

Baseline kedua keyword adalah posisi 1. Belum ada observasi pilot per siklus. Dua refresh manual di luar run mempertahankan posisi 1 dan URL yang tersimpan; keduanya tidak dapat menggantikan siklus terjadwal dalam perbandingan. `device=mobile` adalah nilai tersimpan; Serper tidak menerima selector device eksplisit. Fastwork dipantau pada hostname `fastwork.id`; URL selain landing-page path tetap dapat dihitung sebagai hostname match. Enterkomputer matcher dapat fallback ke hostname, sehingga URL per siklus diperlukan sebelum membuat klaim exact-page. Ranking History hanya menyimpan satu nilai per tanggal; gunakan Refresh Audit untuk membedakan observasi intrahari.

### F. Status dan inspeksi aman

**`LIVE_PILOT_FAILED`** — sebelum siklus pertama, Audit mencatat dua refresh manual di luar run setelah aktivasi. Identitas aktor tidak diketahui dan tidak diatribusikan. Setelah operator mengizinkan stop terdokumentasi, config run dinonaktifkan pada 18:23 WIB dengan `stop_reason=operator_stop`. Tidak ada slot 19:00/20:00/21:00 yang berjalan, tidak ada siklus keempat, dan batas expiry tidak perlu menunggu. Jangan menjalankan refresh atau mengaktifkan ulang tanpa approval baru.

Perintah berikut hanya membuka SQLite read-only dan aman untuk memeriksa hasil kelak:

```bash
docker exec serpbear-official-app node -e 'const s=require("sqlite3"),d=new s.Database("/app/data/database.sqlite",s.OPEN_READONLY),q=[["integrity","PRAGMA integrity_check",[]],["pilot","SELECT enabled,run_id,target_keyword_ids,max_cycles,max_requests,cycle_count,request_count,started_at,expires_at,stop_reason FROM hourly_pilot_config",[]],["cycles","SELECT slot_key,cycle_number,scheduled_at,started_at,ended_at,status,outbound_request_count,error_category,results FROM hourly_pilot_cycle ORDER BY scheduled_at",[]],["pilot_audit","SELECT refresh_id,keyword_id,trigger_source,start_time,end_time,status,outbound_request_count,provider_http_status_category,error_category,position_before,position_after,page_metadata FROM refresh_audit WHERE keyword_id IN (17,19) AND trigger_source=? ORDER BY start_time",["hourly_pilot"]],["ranking","SELECT ID,position,url,lastUpdated,history FROM keyword WHERE ID IN (17,19) ORDER BY ID",[]]];let n=q.length;for(const [name,sql,p] of q)d.all(sql,p,(e,r)=>{console.log(name+"="+JSON.stringify(e?{error:e.message}:r));if(!--n)d.close()});'
```

---

## Investigasi gangguan pilot V2 — refresh manual sebelum slot pertama

**Status investigasi: `PILOT_INTERRUPTION_CAUSE_UNRESOLVED`.** Mekanisme teknisnya diketahui: dua permintaan masuk ke `POST /api/refresh` dan diberi `trigger_source=manual`. Client/orang yang memulai request tidak dapat dipastikan dari log yang tersedia; tidak ada atribusi kepada individu.

### Temuan Audit dan log

| Keyword | Refresh ID | Waktu UTC / WIB | Trigger / actor category | Hasil | Request | Posisi | URL hasil tersimpan |
|---:|---|---|---|---|---:|---:|---|
| 19 | `00f30b10-8ec7-4380-9929-ccdd43b13893` | `11:12:49.567–11:12:51.050Z` / `18:12:49.567–18:12:51.050 WIB` | `manual` / `authenticated_user` | completed, provider `2xx` | 1 | 1 → 1 | `https://www.enterkomputer.com/simulasi/` |
| 17 | `c1bf605a-fc0c-4151-8dcd-5eaeb982e919` | `11:12:56.683–11:12:58.208Z` / `18:12:56.683–18:12:58.208 WIB` | `manual` / `authenticated_user` | completed, provider `2xx` | 1 | 1 → 1 | `https://fastwork.id/web-design/landing-page` |

Refresh Audit juga mencatat `requested_pages=[1]` dan satu outbound request untuk setiap event. Kode HTTP numerik dan URL tidak disimpan pada audit row; URL di tabel dibaca dari field keyword setelah refresh. Pada log aplikasi, `POST /api/refresh` terjadi pada `11:12:49.489Z` dan `11:12:56.625Z`; masing-masing diikuti log SERP sukses untuk keyword ID 19 dan 17. Di antaranya ada `GET /api/keywords` sebelum/sesudah POST. ID 19 selesai sekitar enam detik sebelum ID 17 mulai, jadi dua refresh ini tidak tumpang tindih.

Log hanya mencatat method dan path, tanpa query string, user ID, IP, atau user-agent. Pencarian journal lokal `serpbear-cloudflared.service` untuk jendela tersebut tidak menghasilkan entri. Tidak ditemukan log access tambahan yang dapat mengidentifikasi client.

### Jalur pemanggil dan batas atribusi

V2 source yang diperiksa adalah commit `022dede323b2e4e7b45cf3a7c93091f9a5e55bf3`. Di `pages/api/refresh.ts:31-80`, POST yang lolos autentikasi menetapkan source menjadi `retry` hanya jika `source=retry` dan actor adalah internal service; selain itu source menjadi `manual`. Route ini tidak memeriksa status pilot.

UI memiliki aksi yang memanggil endpoint yang sama: **Refresh Keyword** memanggil `refreshkeyword([ID])` (`components/keywords/Keyword.tsx:202-206`), lalu `services/keywords.tsx:137-147` melakukan `POST /api/refresh?id=<ids>` tanpa header internal-service. **Reload All Serps** juga memakai hook tersebut dengan `id=all&domain=...` (`components/domains/DomainHeader.tsx:108-115`). Karena query string tidak dicatat, log tidak membedakan tombol per-keyword, tombol per-domain, atau client lain.

`verifyUser.ts:16-53` menerima sesi JWT cookie atau API key untuk route ini dan hanya mencatat method/path. `actorCategoryFromAuthorization` menandai exact `Bearer APIKEY` sebagai `internal_service`; kategori lain tercatat `authenticated_user` (`utils/refreshAudit.ts:15-19`). Jadi audit menyingkirkan klasifikasi internal-service yang biasa dipakai worker, tetapi tidak membedakan sesi browser dari API client lain yang memakai sesi terautentikasi. Pola GET `/api/keywords` konsisten dengan UI terbuka, bukan bukti bahwa UI yang memicu POST.

Otomasi bawaan yang diperiksa tidak cocok dengan audit ini: retry cron memakai `source=retry` dan API key, sedangkan pilot worker menggunakan `/api/hourly-pilot` dan source `hourly_pilot`. Otomasi eksternal yang memanggil `/api/refresh` menggunakan sesi pengguna tetap akan tercatat sebagai `manual`. **Mekanisme trigger diketahui; asal client tepatnya belum diketahui.**

### Scheduler dan klasifikasi interupsi

- Log mencatat pendaftaran job pada `2026-10-15T11:06:00.019Z` (`18:06:00.019 WIB`): `hourly job registered; no startup refresh executed`. Sesudah itu worker membaca status melalui `GET /api/hourly-pilot` tiap menit. Log sampai setelah stop tidak menunjukkan `[HOURLY_PILOT_SLOT]`; cycle table run ini kosong.
- `cron.js` membentuk job hourly dari ekspresi `0 0 */1 * * *` tanpa opsi timezone (`cron.js:82-85,139-143`). Runtime container memakai timezone `UTC`; tick pada 12:00, 13:00, 14:00 UTC setara dengan 19:00, 20:00, 21:00 WIB. Croner memakai timezone lokal jika opsi timezone tidak diberikan; runtime yang terukur adalah UTC.
- Discovery poll berhenti mendaftarkan job ketika status `enabled=false` (`cron.js:58-65,163-170`). Jika callback slot terlanjur dipanggil setelah pilot disabled, `executeHourlyPilotSlot` mengembalikan status disabled sebelum membuat cycle (`utils/hourlyPilot.ts:179-202`; `utils/hourlyPilotPolicy.ts:59-70`).
- Run dihentikan operator pada 18:23 WIB, sebelum slot 19:00 WIB. Ini adalah **pilot aborted before first scheduled execution**, bukan **scheduler execution failure**. Job sudah terdaftar, tetapi belum mencapai waktu eksekusi. Pemeriksaan read-only pukul 19:02 WIB setelah slot pertama menunjukkan config tetap disabled, cycle table kosong, dan tidak ada `POST /api/hourly-pilot` atau `[HOURLY_PILOT_SLOT]` setelah stop. Ini sesuai perilaku worker untuk pilot yang telah disabled. Jika tetap enabled, kode akan memanggil endpoint pilot pada tick jam berikutnya.
- Auto-stop `cycle_limit` atau `expired` **belum diverifikasi**: run berhenti dengan `operator_stop` dan tidak ada siklus yang selesai.

### Isolasi refresh dan pengaruh ke ranking

- Single-Flight membuat lock per `keyword_id` selama satu refresh, lalu melepasnya setelah selesai (`utils/refreshLock.ts:48-85`, `utils/refresh.ts:95-115,147-150`). Ini mencegah refresh serentak untuk keyword sama, bukan refresh sepanjang jendela pilot. Kedua event terjadi berurutan.
- Manual route tidak mengirim `reserveRequest` ke fungsi refresh. Counter persisten hanya dinaikkan oleh callback yang disediakan jalur pilot (`utils/refresh.ts:109-115`; `utils/hourlyPilot.ts:152-176,258-265`). Karena itu kedua request masuk Audit, tetapi `request_count` pilot tetap 0.
- Refresh sukses menulis posisi, URL, `lastResult`, history tanggal berjalan, dan `lastUpdated` (`utils/refresh.ts:161-202`). Posisi tetap 1, tetapi refresh manual mengubah observasi tersimpan sebelum slot pilot. Audit membedakan `manual` dari `hourly_pilot`; history harian tidak membedakan observasi intrahari.

### Mitigasi minimum

**Opsi A disarankan: tolak refresh manual target ID 19/17 selama pilot aktif, di backend.** Setelah route menyelesaikan daftar keyword dari `id` atau domain, periksa config pilot dan tolak request yang menyentuh target allowlist sebelum scraper atau lock dipanggil. Cakup juga `id=all&domain=...` berdasarkan keyword hasil query. Balas `409`; catat penolakan sebagai Audit `skipped` dengan nol outbound request tanpa menyimpan credential atau identitas sensitif. UI dapat memberi pesan bahwa pilot sedang berjalan, tetapi backend harus menjadi kontrol. Jalur worker `hourly_pilot` tetap diizinkan. Preflight arm juga harus memastikan target tidak sedang `updating` dan tidak memegang lock.

Opsi A paling kecil dan paling menjaga observasi terjadwal: ia mencegah perubahan ranking dan tidak mengambil jatah pilot. **Opsi B, budget bersama, layak tetapi lebih luas.** Ia memerlukan reservasi transaksional pada batas sebelum request untuk semua trigger relevan; counter sekarang terikat pada cycle dan tidak bisa langsung dipakai oleh manual route. Budget bersama membatasi jumlah request, tetapi manual refresh masih dapat mengubah ranking dan menghabiskan jatah sehingga siklus berikutnya tidak lengkap. Jika batas enam harus mencakup semua request Serper di Production, bukan hanya target pilot, guard bersama di batas jaringan akan menjadi defense-in-depth yang lebih luas daripada koreksi minimum A.

### Retest terpisah

- Jangan aktifkan ulang run lama. Pertahankan status historis `LIVE_PILOT_FAILED`; config saat ini `enabled=0`, `cycle_count=0`, `request_count=0`, `stop_reason=operator_stop`.
- Implementasikan guard A setelah approval perubahan kode, lalu validasi offline/mock: cookie session dan API client ditolak untuk target saat pilot aktif; ID langsung dan domain `id=all` dicakup; nol request/counter saat ditolak; worker `hourly_pilot` tetap berjalan; lock, budget, retry, schedule Never, expiry, dan auto-stop tetap aman.
- Setelah UAT, minta approval terpisah untuk deployment koreksi dan aktivasi live retest. Jalankan preflight Production baru, gunakan run ID baru dan slot dihitung dari waktu aktivasi aktual. Pertahankan tiga siklus/enam request maksimum dan tanpa refresh manual selama retest.
- Scheduler V2 dapat digunakan kembali setelah koreksi backend dideploy; tidak ada bukti kegagalan registrasi atau cron timing. Auto-stop belum diuji oleh run ini.

**PILOT_INTERRUPTION_CAUSE_UNRESOLVED** — penyebab kontrol diketahui (route manual tidak diisolasi dari target pilot), tetapi sumber client/orang yang memulai dua request tidak dapat ditentukan dari bukti yang ada.

## Catatan historis investigasi V1

Hasil investigasi database terdahulu: `PRODUCTION_DB_CONFIRMED_DATA_CHANGED`. Volume dan file SQLite Production saat itu terkonfirmasi sesuai; log menunjukkan perubahan record melalui operasi API, tetapi tidak mencatat row/aktor yang dapat memastikan penyebab ID 14 hilang. Operator kemudian menyetujui target ID 19 sebagai perubahan scope V2. Data lama di bawah dipertahankan sebagai histori dan bukan status kandidat terbaru.

## Snapshot Production historis sebelum deployment V2

Pemeriksaan pada 15 Oktober 2026 tidak memicu refresh dan tidak mengubah Production.

| Pemeriksaan | Hasil |
|---|---|
| Image Production | `sha256:6c8eca5d61b6ffbee30501e632c9a87ee11d8f6a47c511c13f77557f0a19e675` (belum berubah) |
| Container | `serpbear-official-app`, running dan healthy; ID `56d540c7a3af`; dibuat `2026-10-14T12:26:33Z` |
| Compose project/config | `serpbear-official`, `/home/kiwkiw/projects/serpbear/compose.official.yml` |
| Volume | `serpbear-official-data`, dibuat `2026-10-13T17:22:19+07:00`, mounted ke `/app/data` |
| DB aktif | `/app/data/database.sqlite`, 139264 byte; mtime `2026-10-15T08:57:40.727Z`; file descriptor proses server menunjuk file ini |
| Proses | `node server.js` dan `node cron.js` berjalan |
| Provider | `serper` |
| Global Schedule / retry | `never` / `false` |
| Strategy saat ini | `basic`; satu halaman/request per keyword |
| Domain / keyword saat ini | **2 / 2** |
| Retry queue / refresh locks | 0 / 0 |
| Refresh Audit | 21 record; tabel ini mencatat refresh, bukan operasi delete |
| SQLite integrity | `ok` |
| SQLite sequence | domain `11`, keyword `19`; ID tertinggi pernah dialokasikan, bukan bukti tunggal penghapusan |
| Pilot tables | belum ada; migrasi candidate belum dijalankan |

### Target pilot dan record aktif

| Target | Domain / keyword | Device | Posisi | URL tersimpan / kondisi |
|---|---|---|---:|---|
| Enterkomputer ID 14 | **Tidak ada row saat ini**; riwayat aplikasi mengidentifikasi `store.enterkomputer.com`, `EnterStore : PC Gaming | Laptop Gaming` | tidak tersimpan lagi; catatan pilot sebelumnya menyebut `mobile` namun tidak dapat diverifikasi dari file saat ini | historis 1 | log SERP menunjukkan `https://store.enterkomputer.com/`; bukan nilai dari row aktif |
| Fastwork ID 17 | domain ID 10 / `fastwork.id/web-design/landing-page`; `Jasa Pembuatan Landing Page, Mulai Rp 100.000` | `mobile` | 1 | `https://fastwork.id/web-design/landing-page` |
| Enterkomputer ID 19 | domain ID 11 / `www.enterkomputer.com/simulasi`; `simulasi rakit pc` | `mobile` | 1 | `https://www.enterkomputer.com/simulasi/` |

Keyword ID 15 juga tidak ada saat ini. Audit menyimpan event create ID 14 pada `2026-10-15T02:34:03.747Z` dan ID 15 pada `02:34:05.352Z`. Log aplikasi mengaitkan dua refresh pembuatan dengan `EnterStore : PC Gaming | Laptop Gaming`, masing-masing position 1 pada URL `https://store.enterkomputer.com/`. ID 14 memiliki refresh manual pada `03:24:50Z`, selesai position 1. Device ID 14/15 dan row history lengkap tidak tersedia lagi di database aktif atau backup yang ditemukan.

ID 17 dan ID 19 adalah dua keyword aktif pada dua domain aktif, keduanya posisi 1 dengan history `{"2026-10-15":1}`. ID 17 dibuat `2026-10-15T06:33:08.995Z` dan terakhir diperbarui `08:57:40.719Z`; ID 19 dibuat `07:23:24.491Z` dan terakhir diperbarui `07:23:25.508Z`. Nilai `domain.keywordCount` pada kedua domain saat ini `0` walaupun tiap domain memiliki satu row keyword; hitungan aktual di atas berasal dari tabel `keyword`.

Konfirmasi operator untuk Fastwork tetap cocok dengan ID 17: seluruh hostname `fastwork.id` cukup, dan URL aktual harus dicatat. Untuk Enterkomputer, ID 19 adalah kandidat pengganti yang tersedia, tetapi domain/keyword-nya berbeda dari target ID 14 yang disetujui.

### Rekomendasi target pilot

Jangan ubah allowlist kandidat saat ini. Bila operator tidak dapat menyediakan sumber pemulihan untuk ID 14 dan menerima perubahan target secara eksplisit, kandidat pengganti yang sudah ada adalah **ID 19** bersama Fastwork **ID 17**. Itu mengubah target Enterkomputer dari `store.enterkomputer.com` / `EnterStore : PC Gaming | Laptop Gaming` menjadi `www.enterkomputer.com/simulasi` / `simulasi rakit pc`; diperlukan approval perubahan scope dan kandidat kode/UAT baru. Jangan membuat ulang ID 14 atau menganggap ID 19 ekuivalen tanpa persetujuan.

## Identitas database, perubahan record, dan tunnel

### Identitas Production

- Label Compose container menunjuk project `serpbear-official`, service `app`, file Compose di path project yang diharapkan. Compose memakai volume bernama `serpbear-official-data` pada `/app/data`; Docker volume menunjuk ke `/var/lib/docker/volumes/serpbear-official-data/_data`.
- `database/database.ts` memakai storage relatif `./data/database.sqlite`; working directory server `/app`, dan file descriptor proses aktif menunjuk `/app/data/database.sqlite`. Ini mengonfirmasi aplikasi membaca file dari volume yang diharapkan.
- Tidak ada bukti container memakai file SQLite atau volume lain. SQLite `integrity_check` bernilai `ok`.

### Riwayat domain dan operasi delete

| Waktu UTC | Bukti di log |
|---|---|
| 15 Okt 2026 02:25–02:32 | endpoint domain melaporkan 4 lalu 5 domain |
| 15 Okt 2026 02:33:10–02:33:38 | empat `DELETE /api/domains`; setelahnya GET domain melaporkan 1 lalu 2 domain. Ini terjadi sebelum ID 14/15 dibuat dan tidak menjelaskan hilangnya ID tersebut secara langsung |
| 15 Okt 2026 02:34:03 | audit create ID 14 dan 15; log refresh menampilkan EnterStore dan URL `store.enterkomputer.com` |
| 15 Okt 2026 06:32–07:22 | GET domain melaporkan 3 lalu 4 domain; domain ID 10 dan 11 ditambahkan pada periode ini |
| 15 Okt 2026 07:23:47 | `DELETE /api/domains`; GET berikutnya melaporkan 4 domain |
| 15 Okt 2026 07:42:52 dan 07:43:07 | dua `DELETE /api/domains` tambahan |
| 15 Okt 2026 09:08:51 | GET domain melaporkan 2; snapshot SQLite saat ini juga berisi 2 domain dan 2 keyword |

Handler `DELETE /api/domains` menjalankan `Domain.destroy` dan `Keyword.destroy` untuk domain dalam request. Dua delete endpoint terjadi setelah empat domain tercatat, lalu log berikutnya mencatat dua domain. Ini merupakan penjelasan paling didukung untuk perubahan jumlah domain/keyword melalui aplikasi. Namun, log tidak mencatat parameter domain, row yang terhapus, atau status sukses. Log `DELETE /api/keywords` yang mencatat parameter hanya menunjukkan ID 5 dan ID 4; tidak ada bukti delete keyword langsung untuk ID 14/15. Tidak tersedia audit operasi SQL langsung, sehingga record tertentu yang dihapus tidak dapat dipastikan.

Refresh Audit berisi 21 peristiwa refresh, termasuk create ID 14/15 dan manual refresh ID 14. `actor_category=authenticated_user` bukan identitas akun. Audit ini tidak mencatat penghapusan dan tidak cukup untuk mengaitkan tindakan dengan pengguna tertentu.

### Rute Cloudflare

- Config tunnel `serpbear.bewara.xyz` mengarah ke `http://127.0.0.1:3180`.
- System service `serpbear-cloudflared.service` aktif sejak 13 Okt 2026 19:52 WIB dan menjalankan config tersebut. Unit versi `--user` tidak aktif; unit system-level inilah yang aktif.
- Compose memetakan host `127.0.0.1:3180` ke port 3000 container. GET lokal origin menghasilkan HTTP 200; GET hostname publik menghasilkan HTTP 302 ke Cloudflare Access login.
- Journal tunnel mencatat koneksi Cloudflare yang registered dan request masuk dengan `ingressRule=0`, `originService=http://127.0.0.1:3180`, mengonfirmasi trafik dirutekan ke origin ini. Satu request GET berakhir karena client membatalkan koneksi. Log juga berisi timeout QUIC sementara dan reconnect; service tetap aktif.
- Bukti ini mengonfirmasi jalur tunnel ke origin Production. Tidak ada perubahan tunnel atau kebijakan Cloudflare dilakukan.

### Backup yang tersedia

| Backup | Waktu file UTC | Domain / keyword | Integrity | Catatan |
|---|---|---:|---|---|
| `serpbear-predeploy-20261014T050431Z.sqlite` | 14 Okt 05:04 | 0 / 0 | `ok` | tidak berisi target |
| `serpbear-security-phase1-predeploy-20261014T062715Z.sqlite` | 14 Okt 06:27 | 0 / 0 | `ok` | tidak berisi target |
| `serpbear-tar-runtime-predeploy-20261014T085036Z.sqlite` | 14 Okt 08:50 | 0 / 0 | `ok` | tidak berisi target |
| `serpbear-serper-adapter-predeploy-20261014T102116Z.sqlite` | 14 Okt 10:21 | 0 / 0 | `ok` | tidak berisi target |
| `serpbear-refresh-safety-predeploy-20261014T121800Z.sqlite` | 14 Okt 12:18 | 1 / 1 | `ok` | domain ID 3 / `mahjongjp88untouchable.com`, keyword ID 2; bukan target pilot |

Tidak ada backup yang ditemukan berisi 4 domain/7 keyword, ID 14, atau target ID 17/19. Direktori volume aktif dan repo tidak memiliki salinan SQLite backup tambahan. Backup lama tidak direstore.

## Scheduler dan pengaman

- Candidate memakai proses `cron.js` yang sudah berjalan dan cron hourly terpisah dari global refresh cron. Job hanya didaftarkan ketika pilot persisten berstatus aktif. Startup/restart membaca status, tetapi tidak langsung menjalankan refresh.
- Worker hanya memanggil endpoint `/api/hourly-pilot` dengan Bearer API key internal. Endpoint menolak permintaan tanpa autentikasi internal; tidak ada endpoint penjadwalan tanpa autentikasi.
- Allowlist ID 14 dan 17 beserta domain/keyword-nya divalidasi sebelum siklus. Domain/keyword yang berubah membuat pilot gagal tertutup.
- Setiap keyword dijalankan satu per satu dengan strategy `basic`, budget satu request, tanpa fallback multi-halaman, dan retry dipaksa nonaktif pada salinan settings pilot. Settings global tidak ditulis.
- `hourly_pilot_config` menyimpan run ID, expiry, jumlah siklus yang diklaim, dan jumlah request yang sudah direservasi. `hourly_pilot_cycle` menyimpan slot UTC dengan unique key sehingga slot tidak dapat dijalankan dua kali, termasuk setelah restart.
- Counter request direservasi secara transaksional tepat sebelum request jaringan. Batas DB: maksimum dua per siklus dan enam per run. Siklus yang gagal tetap memakai jatah siklus; tidak ada retry otomatis. Kegagalan satu keyword tidak memicu request tambahan dan dicatat di audit.
- Refresh tetap melewati Refresh Audit, Single-Flight Lock, dan Request Budget Guard yang ada. Posisi/history hanya diperbarui setelah response provider valid.
- Setelah siklus ketiga selesai, config dinonaktifkan dengan `stop_reason=cycle_limit`. Expiry empat jam juga menonaktifkan pilot jika batas waktu tercapai lebih dulu.
- Pada snapshot V1 ini, kandidat belum dideploy/diaktifkan. Snapshot tersebut bersifat historis; deployment, aktivasi, dan hasil V2 terbaru dicatat di bagian atas.

### Slot Production yang diperkirakan

Tidak ada slot Production yang ditetapkan atau dijalankan. Jadwal baru dihitung setelah approval aktivasi live diterima dan waktu aktivasi diketahui.

## Validasi offline

Semua pemeriksaan berikut selesai di candidate checkout berbasis source Production `53a349f15f6e0e569d9a5d9765f3c9651ec9e008`.

| Pemeriksaan | Hasil |
|---|---|
| TypeScript `tsc --noEmit` | lulus |
| Jest | 20 suite, 81 tes lulus |
| Tes policy pilot | slot UTC, allowlist tepat, batas 3/6, expiry lulus |
| Tes migrasi SQLite | row default nonaktif, batas per-siklus, unique siklus, integrity lulus |
| Tes Serper/offline | provider 401/403/429 tidak menulis observasi rank palsu; history tetap terjaga |
| ESLint | lulus, tanpa warning/error ESLint |
| Build Next.js/Docker | berhasil; route `/api/hourly-pilot` terbangun |

Build menampilkan peringatan Browserslist/Tailwind yang sudah ada pada proyek; build tetap berhasil.

## Mock Runtime UAT

UAT memakai image candidate `serpbear-hourly-pilot-uat:20261015-v3`, SQLite sintetis sendiri, credential/API key sintetis, mock Serper, dan network Docker `internal: true`. Tidak ada port host yang dipublikasikan; egress container diblokir dan `fetch` hanya mengizinkan mock serta loopback. Volume dan container UAT telah dihentikan dan dibersihkan setelah hasil dikumpulkan.

UAT menguji startup dan restart proses Docker dengan jam simulasi; **timestamp slot simulasi bukan waktu SERP live**.

| Siklus | Slot simulasi UTC | Mulai aktual UAT (WIB) | Selesai aktual UAT (WIB) | Request |
|---:|---|---|---|---:|
| 1 | 15 Okt, 08:00 | 15:22:38 | 15:22:41 | 2 |
| 2 | 15 Okt, 09:00 | 15:23:21 | 15:23:24 | 2 |
| 3 | 15 Okt, 10:00 | 15:23:36 | 15:23:39 | 2 |

### Refresh Audit dan hasil mock

| Siklus | Keyword ID | Refresh ID | Audit (WIB, mulai → selesai) | Request | Posisi sintetis | Matched URL sintetis |
|---:|---:|---|---|---:|---:|---|
| 1 | 14 | `5d36d93e-3ccb-4fec-ae7d-78bc5bc478a1` | completed (15:22:38.727 → 15:22:40.003) | 1 | 1 | `https://store.enterkomputer.com/` |
| 1 | 17 | `bf4f44e3-e673-476c-b9a6-16d31bd63a60` | completed (15:22:40.022 → 15:22:41.278) | 1 | 2 | `https://fastwork.id/other-listing` |
| 2 | 14 | `1d1ceb4a-bebc-49ba-a32e-ee155d1e7ba0` | completed (15:23:21.814 → 15:23:23.083) | 1 | 1 | `https://store.enterkomputer.com/` |
| 2 | 17 | `7a5bb2cc-4441-49d8-ab73-cb8a96269fe7` | completed (15:23:23.094 → 15:23:24.316) | 1 | 2 | `https://fastwork.id/other-listing` |
| 3 | 14 | `fd117109-f2a9-4b1e-885f-d0641bab0415` | completed (15:23:36.805 → 15:23:38.054) | 1 | 1 | `https://store.enterkomputer.com/` |
| 3 | 17 | `e3806232-eef8-41d9-becc-2e3797499a13` | completed (15:23:38.087 → 15:23:39.370) | 1 | 2 | `https://fastwork.id/other-listing` |

Fastwork sengaja menerima URL sintetis `.../other-listing` karena hostname matching telah disetujui; ini memperlihatkan mengapa URL aktual dicatat dan bukan klaim exact-page.

### Hasil UAT tambahan

- Startup worker tidak mengirim request. Endpoint pilot tanpa API key mengembalikan 401.
- Probe refresh bersamaan untuk ID 14 ditolak sebagai `concurrent_refresh`; jumlah request mock tidak bertambah. Percobaan slot berulang ditolak sebagai `duplicate_slot`.
- Setelah container direstart setelah siklus pertama, slot yang sudah selesai ditolak lagi sebagai duplicate; tidak ada refresh langsung dan counter tersimpan.
- Keenam mock request memakai page 1, satu request per keyword/siklus. Header hanya berisi credential sintetis dan key tidak muncul pada URL.
- Setelah siklus ketiga: `enabled=0`, `cycle_count=3`, `request_count=6`, `stop_reason=cycle_limit`. Menunggu slot simulasi berikutnya tidak menghasilkan request ketujuh.
- Percobaan dengan counter budget sudah 6 ditolak sebagai `request_budget_exhausted`; jumlah request mock tetap 6.
- Config dengan expiry lampau dinonaktifkan melalui pemeriksaan status dengan `stop_reason=expired`.
- Keyword sintetis tak terpilih (ID 20) tidak berubah dan tidak memiliki audit pilot. ID audit pilot hanya 14 dan 17.
- SQLite `integrity_check=ok`; Global Schedule `never`, retry `false`, dan `failed_queue=[]`.

## Batas kredit

- Anggaran maksimum Production: **6 request Search API Basic** (maksimum 2 per siklus × 3 siklus).
- Perkiraan konsumsi: sekitar **6 query credit** standar; provider dapat menagih atau mengukur berbeda.
- Mock UAT tidak mengonsumsi kredit Serper. Tidak ada request ke Serper live pada pekerjaan ini.

## Source candidate, backup, dan rollback

- Commit source candidate: `f8cdcce791975d8ca18e554516e4ae566587ec3f` (`feat(cron): add bounded hourly pilot scheduler`).
- Image candidate terverifikasi lokal: `sha256:84a862106ab55cbbf7bf2008a558f61d3379b5d21a6b758f72ee670760f7a23c`. Image ini digunakan untuk Mock Runtime UAT dan belum dipasang di Production.
- Migrasi baru menambah tabel config/cycle; tidak mengubah record domain/keyword atau tabel ranking lama.
- Backup baru untuk deployment **belum dibuat**. Lima backup lama yang tersedia diringkas pada bagian investigasi; tak satu pun memuat data target. Jika deployment dilanjutkan setelah scope diklarifikasi, buat backup online konsisten melalui Node `sqlite3` API ke nama file baru pada volume `/app/data`, verifikasi `PRAGMA integrity_check` dan logical snapshot, lalu salin ke penyimpanan terpisah sebelum mengganti image.
- Jika deployment bermasalah sebelum aktivasi, kembalikan tag image Compose ke digest Production sebelumnya; tabel tambahan boleh dibiarkan karena bersifat additive. Jika pilot sempat diaktifkan, hentikan dulu dengan `UPDATE hourly_pilot_config SET enabled = 0, stop_reason = 'operator_stop' WHERE id = 1` memakai akses DB operator. Pulihkan backup hanya setelah app dihentikan, hapus file WAL/SHM lama, lalu verifikasi integrity sebelum app dijalankan lagi.
- Script arm kandidat memeriksa nilai global `scrape_interval=never`, retry nonaktif, credential Serper tersedia, dan pasangan keyword/domain persis. Script hanya akan mengaktifkan config jika diberi token persetujuan operator `APPROVE_ENTERKOMPUTER_FASTWORK_HOURLY_PILOT`; script ini belum dijalankan pada Production.

## Approval dan status Production

**Deployment approval:** diberikan dengan `APPROVE_DEPLOY_HOURLY_PILOT_CODE`; deployment tetap ditahan setelah investigasi mengonfirmasi ID 14 hilang dari DB aktif.  
**Approval aktivasi recurring live pilot:** belum diberikan.  
**Production mutation/deploy/live request:** tidak dilakukan. Compose tidak diubah, container tidak direstart, migrasi tidak dijalankan, dan tidak ada request Serper/Google.

Kandidat rollback tetap image Production lama `sha256:6c8eca5d61b6ffbee30501e632c9a87ee11d8f6a47c511c13f77557f0a19e675`; konfigurasi Compose masih menunjuk tag `serpbear-refresh-safety-candidate:20261014-v2`. Karena tidak ada deployment, rollback tidak diperlukan. Verifikasi browser Production pascadeployment belum dapat diminta sebagai pemeriksaan hasil deployment.

## Risiko yang masih berlaku

- Posisi Google dapat berubah antar jam dan hasil UAT sintetis bukan estimasi ranking Production.
- Database Production yang diperiksa tidak memiliki row ID 14. Audit dan log historis mengonfirmasi ID tersebut pernah ada dan menempati posisi 1, tetapi domain/device/history lengkap tidak dapat dipulihkan dari backup yang ditemukan.
- DB identity telah dikonfirmasi; jumlah aktif 2 domain/2 keyword. Log menunjukkan operasi delete domain melalui API sebelum jumlah turun dari empat ke dua, tetapi parameter dan aktor tidak tercatat. Ini memblokir deployment sampai operator menyetujui target Enterkomputer yang berlaku atau menyediakan sumber pemulihan lain.
- Fastwork sengaja memakai hostname matching, sehingga matched URL dapat berupa halaman lain pada `fastwork.id`.
- Pada record Fastwork ID 17, URL tersimpan adalah landing-page URL; pilot yang disetujui tetap hanya mengklaim hostname match dan akan mencatat matched URL aktual.
- Batas perangkat tetap berlaku: adapter tidak mengirim device selector eksplisit ke Serper; pilot tidak membandingkan SERP mobile/desktop.
- Pemakaian kredit aktual dapat berbeda dari estimasi enam query credit.

Rekomendasi pada laporan V1 ini—menunggu keputusan tentang ID 14—telah disupersesi oleh persetujuan operator untuk memakai ID 19 dan hasil V2 di bagian atas.

## Status setelah aktivasi, sebelum slot pertama (historis)

Pada snapshot awal 18:08 WIB, status sementara adalah `LIVE_PILOT_ACTIVATED_PENDING_COMPLETION`: deployment dan aktivasi berhasil, tetapi belum ada slot yang jatuh tempo. Status itu telah disupersesi oleh hasil read-only dan stop terdokumentasi di **LIVE HOURLY PILOT V2 — PRODUCTION RESULTS**: `LIVE_PILOT_FAILED`. Cloudflare Access membatasi verifikasi dashboard Production tanpa sesi terautentikasi.

## MANUAL_REFRESH_GUARD — IMPLEMENTATION AND UAT

**Status: `MANUAL_REFRESH_GUARD_READY`.** Kandidat guard berhasil melewati validasi offline, Docker build, dan Isolated Mock Runtime UAT. Kandidat ini belum dipasang di Production dan tidak mengaktifkan pilot live.

### Root cause dan implementasi

Interupsi live V2 terjadi karena dua request `POST /api/refresh` diberi `trigger_source=manual` dan dapat memperbarui target pilot selagi pilot aktif. Single-Flight Lock hanya mencegah dua refresh keyword yang sama berjalan bersamaan; request manual tidak memakai counter pilot dan dapat mengubah ranking di luar observasi terjadwal. Sumber client yang mengirim kedua request tetap tidak diketahui.

Kandidat menambahkan guard minimal dengan perilaku berikut:

- `pages/api/refresh.ts` menyelesaikan ID keyword terlebih dahulu, termasuk hasil query `id=all&domain=...`, lalu membaca konfigurasi pilot SQLite dan allowlist `target_keyword_ids` yang tersimpan. Request yang menyentuh target aktif ditolak dengan HTTP `409` dan `code: HOURLY_PILOT_ACTIVE` sebelum settings, scraper, atau lock refresh dipanggil.
- `utils/refresh.ts` memeriksa ulang seluruh batch sebelum menjalankan refresh. Jika batch berisi target yang dilindungi, seluruh batch ditolak tanpa refresh parsial. Jalur cron, pembuatan keyword, retry, dan caller backend lain yang melewati helper bersama ikut dilindungi.
- `utils/refreshLock.ts` membaca ulang konfigurasi pilot dan membuat lock di satu transaksi SQLite `IMMEDIATE`. Ini menutup race antara preflight batch dan aktivasi. Aktivasi memakai transaksi `IMMEDIATE` serta menolak jika target masih punya lock atau `updating=1`; pemeriksaan ini ada pada skrip arm dan fungsi aktivasi backend.
- Hanya konteks internal worker `hourly_pilot` dengan actor `internal_service` yang dikecualikan. `/api/refresh` tidak menerima klaim source dari query sebagai jalur pilot: `source=hourly_pilot` menjadi manual, sedangkan trigger retry internal tetap ditolak untuk target aktif.
- Audit menggunakan pola yang sudah ada: setiap keyword terlindungi pada request yang ditolak dicatat `status=skipped`, `error_category=hourly_pilot_active`, posisi before/after sama, dan `outbound_request_count=0`. Config/counter pilot tidak berubah.

### Kandidat source dan image

- Basis: V2 commit `022dede323b2e4e7b45cf3a7c93091f9a5e55bf3`.
- Commit guard: `685a25a8653455a136649546405a1fca8e24ab39` (`test(refresh): prove pilot guard uses stored allowlist`). Commit sebelumnya dalam kandidat menambahkan guard API/lock; working tree bersih setelah commit.
- Tag image: `serpbear-hourly-manual-refresh-guard-v2:20261015-v2`.
- Immutable image ID: `sha256:5e3f405a54522fd8e8a5e9ba163a281a063c3d61508871bc8e4946d49beb720e`.
- Diff source dan test terhadap basis V2: 12 file berubah, 521 penambahan / 30 penghapusan.
- File: `pages/api/refresh.ts`, `utils/hourlyPilotRefreshGuard.ts`, `utils/refresh.ts`, `utils/refreshLock.ts`, `utils/hourlyPilot.ts`, `scripts/activate-hourly-pilot.js`, serta 6 file test guard/lock/ranking/Serper.
- Tidak ada migration atau perubahan schema untuk guard ini. Tidak ada Next.js upgrade, perubahan Compose Production, atau source lain di luar scope.

### Offline validation

| Pemeriksaan | Hasil |
|---|---|
| Full Jest | 23 suites, 102 tests lulus |
| TypeScript `tsc --noEmit` | lulus |
| ESLint `npm run lint` | lulus tanpa warning/error ESLint |
| Next.js production build | lulus; route `/api/refresh` dan `/api/hourly-pilot` terbentuk |
| Docker build | lulus; image ID di atas |
| API manual ID 19 dan 17 saat pilot mati | diizinkan; target lain juga diizinkan |
| Pilot aktif: manual ID 19/17, retry, spoofed `source=hourly_pilot` | HTTP 409 `HOURLY_PILOT_ACTIVE`; helper refresh tidak dijalankan |
| Bulk dua target / domain batch campuran | ditolak atomik sebelum scrape; tidak ada refresh parsial |
| Batch helper dan audit | tidak ada scrape/update; audit `skipped`, nol request; posisi tetap |
| Stored allowlist / konfigurasi rusak | allowlist SQLite dipakai; konfigurasi aktif malformed gagal tertutup |
| Single-Flight | tes lock lulus; aktivasi menolak lock target aktif |

Peringatan build yang terlihat hanya data Browserslist yang tertinggal dan konfigurasi Tailwind `purge/content` lama; tidak menggagalkan build.

### Isolated Mock Runtime UAT

UAT menggunakan image kandidat, SQLite volume khusus `serpbear-manual-refresh-guard-uat-data`, API key/Serper key sintetis, mock Serper internal, dan network Docker `internal=true`. Tidak ada port host yang dipublikasikan, Production volume/secrets tidak dipasang, dan `NODE_OPTIONS` memasang egress guard; pemeriksaan fetch ke host eksternal diblok sebelum koneksi dibuat. Container Next.js dan `cron.js` terlihat sehat. Sesudah bukti diambil, container, network, dan volume UAT sudah dihapus. Image kandidat tetap tersimpan lokal.

| Skenario runtime | Bukti |
|---|---|
| Startup dengan pilot mati | HTTP app 200; `enabled=0`, `cycle_count=0`, `request_count=0`; mock menerima 0 request |
| Refresh manual ketika mati | ID 19, 17, dan ID tak terpilih 20 mendapat HTTP 200 dan masing-masing 1 request mock |
| Aktivasi saat target punya lock | Skrip aktivasi keluar tanpa mengaktifkan pilot; config tetap disabled |
| Manual ID 19 dan ID 17 saat aktif | HTTP 409 untuk keduanya |
| Bulk ID 19+17 dan domain batch ID 17+ID 21 | HTTP 409; seluruh operasi ditolak sebelum scraping |
| Retry dan `source=hourly_pilot` buatan pemanggil | HTTP 409; API route tetap mengklasifikasikan request sebagai non-pilot |
| Audit penolakan aktif | 7 audit `skipped`, masing-masing nol outbound request, posisi before/after tidak berubah |
| Provider setelah penolakan | Delta request mock 0 |
| Keyword tak terpilih saat pilot aktif | ID 20 mendapat HTTP 200 dan satu request mock |
| Single-Flight runtime | Lock hidup yang disisipkan untuk ID 19 menghasilkan audit `skipped/concurrent_refresh`, nol outbound request |
| Aktivasi tanpa lock | Skrip arm berhasil untuk config sintetis `[19,17]`, tiga cycle, enam batas request |
| Siklus 1, 2, 3 | Slot simulasi `12:00`, `13:00`, `14:00 UTC` (`19:00`, `20:00`, `21:00 WIB`); semua `completed`, masing-masing 2 request (ID 19 satu + ID 17 satu); 6 request mock total |
| Restart sesudah siklus 1 | Tidak ada request saat startup; replay slot tersimpan ditolak `duplicate_slot`; count provider tetap 2, lalu siklus 2 dan 3 berjalan |
| Ranking/mock matched URL | ID 19 posisi 1: `https://www.enterkomputer.com/simulasi`; ID 17 posisi 1: `https://fastwork.id/other-listing`; URL Fastwork berbeda dari landing-page path namun sesuai hostname scope |
| Batas dan stop | Setelah siklus 3: `enabled=0`, `cycle_count=3`, `request_count=6`, `stop_reason=cycle_limit`; setelah menunggu lebih dari satu interval, mock tetap 6 dan tidak ada siklus keempat |
| Expiry safeguard | Probe sintetis terpisah dengan expiry lampau dinonaktifkan oleh API status sebagai `expired`, tanpa request provider |
| Setelah pilot berhenti | Refresh manual ID 19 kembali HTTP 200 dan menghasilkan satu mock request pada fase pemeriksaan terpisah |
| DB/settings akhir sebelum volume dibersihkan | `PRAGMA integrity_check=ok`; global `scrape_interval=never`, retry `false`, failed queue kosong; semua refresh lock selesai |
| Kredensial | Mock hanya mencatat kecocokan key sintetis dan page; key tidak berada di URL dan tidak muncul pada audit |

Semua enam request pilot memakai page 1. Audit mencatat enam refresh `hourly_pilot` yang selesai; histori dan posisi sintetis tersimpan. Probe manual sesudah stop dan refresh setup sebelum pilot adalah fase terpisah, bukan bagian dari jatah pilot enam request. Pengujian akhir expiry dilakukan pada config sintetis terpisah setelah snapshot auto-stop `cycle_limit`; seluruh data kemudian dibuang bersama volume UAT.

Ada satu pembacaan SQLite dari controller UAT yang sempat menerima `SQLITE_BUSY` bersamaan dengan penulisan cycle. Worker tetap menyelesaikan cycle ketiga; pembacaan diulang dengan busy timeout dan integritas akhir `ok`. Log cron juga menunjukkan satu probe status awal sebelum Next server mulai menerima koneksi; polling berikutnya berhasil, tidak ada request startup, dan worker mengeksekusi seluruh slot simulasi.

### Deployment dan retest (rencana kandidat; sekarang dilaksanakan)

Rencana deployment berikut telah dilaksanakan setelah approval `APPROVE_DEPLOY_HOURLY_PILOT_MANUAL_GUARD`. Bukti aktual ada di bagian **MANUAL_REFRESH_GUARD — PRODUCTION DEPLOYMENT** di bawah. Deployment code tidak mengizinkan aktivasi pilot live.

Rollback yang disiapkan: kembalikan hanya image service SerpBear ke image sebelumnya `sha256:f3942cd54b7df2297cfb123664f1658142af25ceb739be943ebeed7b1f7c608b`, lalu recreate service `app` tanpa dependency. Guard tidak mengubah schema sehingga restore database tidak semestinya diperlukan. Backup deployment disimpan sampai rollback window selesai.

Aktivasi live retest tetap memerlukan approval terpisah setelah deployment. Gunakan run ID baru, target existing ID 19 dan 17, tiga siklus maksimum/enam request maksimum, expiry empat jam, tanpa retry atau refresh-all. Pilot tidak diaktifkan dalam deployment ini.

Pada saat bagian implementasi/UAT ini disusun, Production belum diubah. Deployment yang kemudian disetujui dan diverifikasi dicatat terpisah di bawah. Status interupsi live V2 tetap historis `LIVE_PILOT_FAILED`; guard Production hanya memperbaiki control gap dan tidak mengubah hasil run tersebut.

## MANUAL_REFRESH_GUARD — PRODUCTION DEPLOYMENT

**Status: `MANUAL_REFRESH_GUARD_DEPLOYMENT_SUCCESS`.** Deployment kode selesai pada 16 Oktober 2026. Tidak ada aktivasi pilot maupun refresh live.

### Approval dan image

- Approval: `APPROVE_DEPLOY_HOURLY_PILOT_MANUAL_GUARD`.
- Source commit: `685a25a8653455a136649546405a1fca8e24ab39`.
- Image tag: `serpbear-hourly-manual-refresh-guard-v2:20261015-v2`.
- Image ID Production setelah deploy: `sha256:5e3f405a54522fd8e8a5e9ba163a281a063c3d61508871bc8e4946d49beb720e`.
- Image Production sebelumnya/rollback: `serpbear-hourly-pilot-v2:20261015-v1`, `sha256:f3942cd54b7df2297cfb123664f1658142af25ceb739be943ebeed7b1f7c608b`.
- Container dibuat pada `2026-10-16 00:53:58 UTC` (`07:53:58 WIB`). Compose hanya mendefinisikan service `app`; hanya `serpbear-official-app` yang direcreate dengan `--no-deps`. Volume `serpbear-official-data:/app/data` dan port localhost `127.0.0.1:3180` tetap sama.
- Tidak ada migration/schema change pada diff guard. Tidak ada service Docker lain yang diubah.

### Preflight dan backup

- Preflight baca-saja pada `2026-10-16 00:52:46 UTC` (`07:52:46 WIB`) mengonfirmasi container lama sehat, image rollback yang disetujui, volume database yang diharapkan, serta keyword ID 19 dan ID 17 sesuai target.
- ID 19: domain ID 11 `www.enterkomputer.com/simulasi`, keyword `simulasi rakit pc`, country `ID`, ranking 1.
- ID 17: domain ID 10 `fastwork.id/web-design/landing-page`, keyword `Jasa Pembuatan Landing Page, Mulai Rp 100.000`, country `ID`, ranking 1.
- Baseline: 2 domain, 2 keyword, 23 Refresh Audit rows, 0 lock aktif, 0 cycle tersimpan. Ranking History kedua keyword adalah `{"2026-10-15":1}`.
- Global `scrape_interval=never`, `scrape_retry=false`, retry queue kosong, provider `serper` dipilih, credential konfigurasi provider terisi (nilainya tidak dibaca/ditampilkan), `NODE_ENV=production`, dan tidak ada field mock/test pada settings. Validitas key ke provider tidak diuji karena tidak mengirim request.
- Pilot sebelum deploy tetap `enabled=0`, run ID `573beda3-6b8f-472f-b5ea-bf40b6318a57`, target `[19,17]`, `cycle_count=0`, `request_count=0`, `stop_reason=operator_stop`.
- Backup konsisten disimpan di `/var/backups/serpbear/serpbear-manual-guard-predeploy-20261016T005246Z.sqlite`, mode `600`, 139,264 byte. SHA-256: `d19912acdef1eb683603e0f6ab2f5b04405a2a860a63126d79ac5f746bbf439f`. Checksum staging dan file tersimpan identik; salinan retained lulus `PRAGMA integrity_check=ok` dan berisi 2 domain, 2 keyword, 23 audit, pilot disabled.

### Verifikasi setelah deploy

- Container `serpbear-official-app` running dan `healthy` pada image ID yang disetujui; Docker mount tetap `serpbear-official-data` ke `/app/data`.
- Proses `node server.js` (Next.js) dan `node cron.js` aktif. Health check container berhasil.
- SQLite `integrity_check=ok`; domain/keyword tetap 2/2, Refresh Audit tetap 23, active lock 0, pilot cycle 0. Tidak ada audit refresh/cycle baru saat startup; ini konsisten dengan tidak adanya refresh otomatis.
- ID 17 dan 19 mempertahankan domain, keyword, country, ranking 1, URL tersimpan, `lastUpdated`, dan Ranking History baseline. Pilot tetap `enabled=0`, target `[19,17]`, counter 0/0, `stop_reason=operator_stop`.
- Global schedule tetap Never, retry tetap Disabled, failed queue kosong, provider tetap `serper`, mock/test mode tidak aktif. Tidak ada request Serper.dev atau Google yang dijalankan oleh deployment.
- Pencarian pola `SQLITE_BUSY`, `SQLITE_LOCKED`, dan `database is locked` pada log 20 menit terakhir tidak menemukan kejadian. Probe `PRAGMA busy_timeout` pada koneksi inspeksi SQLite melaporkan 1000 ms; pemeriksaan baca-saja pascadeploy berhasil. Ini tidak menggantikan uji beban tulis bersamaan.
- Browser Production memakai profile Brave Default yang tersedia, tetapi diarahkan ke sign-in Cloudflare Access. Tidak ada sesi autentikasi yang tersedia di browser; dashboard terautentikasi **tidak dapat diverifikasi**. Access tidak dilewati. Container health dan HTTP health route internal tetap sehat.

### Rollback dan status pilot

Rollback image saja (tidak ada perubahan schema atau ranking): kembalikan `image` pada `compose.official.yml` ke `serpbear-hourly-pilot-v2:20261015-v1`, lalu jalankan `docker compose -f compose.official.yml up -d --no-deps --force-recreate app`. Backup konsisten di atas tersedia jika diperlukan, tetapi tidak ada alasan untuk restore database berdasarkan hasil verifikasi ini.

`MANUAL_REFRESH_GUARD_DEPLOYMENT_SUCCESS` hanya mencakup kode. Pilot tetap Disabled. Aktivasi Live Hourly Monitoring membutuhkan approval operator baru; status historis run sebelumnya tetap `LIVE_PILOT_FAILED`.

## 15-MINUTE PILOT — CANDIDATE AND MOCK UAT

**Status: `15_MINUTE_PILOT_READY`.** Kandidat 15 menit lolos pemeriksaan offline, build, dan acceptance Mock Runtime UAT. Candidate belum di-deploy ke Production; pilot live tetap tidak aktif dan tidak ada request Serper.dev/Google.

### Baseline Production yang diverifikasi

- `serpbear-official-app` running/healthy pada image `sha256:5e3f405a54522fd8e8a5e9ba163a281a063c3d61508871bc8e4946d49beb720e`, sama dengan identitas Manual Refresh Guard pada deployment report.
- Source baseline worktree adalah commit `685a25a8653455a136649546405a1fca8e24ab39`. Kandidat sebelumnya ada pada commit ini dan tidak mengubah container Production.
- Database Production, Compose, settings, ranking, retry, dan scheduler tidak dimutasi. Verifikasi akhir setelah UAT tetap menunjukkan container Production `running healthy` pada image yang sama.

### Spesifikasi dan implementasi

- Cron pilot menggunakan enam field `0 */15 * * * *`, timezone `Asia/Jakarta`, setiap 15 menit. Slot penyimpanan dibulatkan ke awal quarter-hour UTC; WIB tidak mengubah batas menit ini.
- Saat job berhasil didaftarkan, worker mencatat tiga slot WIB berikutnya dari `Cron.nextRuns()`. Karena registrasi menunggu polling status authenticated, slot pertama selalu slot quarter-hour berikutnya setelah registrasi; slot yang terlewat tidak dikejar. Startup hanya memeriksa status, tidak menjalankan refresh.
- UAT timer maju 15 menit per langkah dan mengambil offset dari jumlah siklus yang telah diklaim agar restart tidak mengulang slot selesai. Pengaman database menolak slot duplikat dan siklus lain yang masih `started`; transaksi claim menggunakan `IMMEDIATE`.
- Batas tetap 3 siklus, 2 request per siklus, 6 request per run, dan expiry 90 menit. Satu sumber konstanta dipakai oleh cron worker, backend policy, dan activation script. Approval token activation V2 lama tidak dipakai ulang; script kandidat mensyaratkan `APPROVE_ENTERKOMPUTER_FASTWORK_15_MINUTE_PILOT_V1`.
- Migrasi tambahan `1792108800000-archive-hourly-pilot-runs.js` menyalin config run terminal yang sudah ada ke tabel append-only `hourly_pilot_run_history` sebelum state singleton dipakai run baru. Run ID lama unik dan tidak ditimpa; siklus serta Refresh Audit lama tetap utuh. Migrasi dibackfill untuk config disabled yang sudah memiliki `run_id`, termasuk run historis `operator_stop` Production.
- Target tidak berubah: ID 19/domain ID 11 `www.enterkomputer.com/simulasi`, `simulasi rakit pc`, ID; ID 17/domain ID 10 `fastwork.id/web-design/landing-page`, `Jasa Pembuatan Landing Page, Mulai Rp 100.000`, ID. Fastwork tetap hostname matching. Worker menyimpan URL hasil aktual; Enterkomputer memakai path lalu fallback hostname sesuai matching existing.
- Manual Refresh Guard tetap membaca allowlist pilot tersimpan. Manual, retry, spoofed source, dan bulk non-pilot untuk target aktif tetap ditolak sebelum provider call. Setelah auto-stop guard dilepas. Global `scrape_interval=never` dan retry disabled tidak berubah.

### Kandidat source dan image

- Commit: `f60a5f9a558638dbcea858460d174fe5b15123fc` (`feat(hourly-pilot): support 15-minute monitoring`).
- Tag: `serpbear-hourly-15-minute-pilot:candidate-20261016`.
- Immutable Docker image ID: `sha256:873e9a2dba19b34ed27a22efd78f5f2c6876b016ea0a0431162a93243db50b20`.
- Perubahan mencakup slot/schedule policy, `cron.js`, backend pilot cycle/expiry/arsip run, activation script, model/migrasi run history, dan tes policy/migrasi. Total 11 file berubah; tidak ada perubahan Docker Compose Production atau Next.js version.
- Rollback code: kembalikan hanya image service SerpBear ke Manual Refresh Guard `sha256:5e3f405a54522fd8e8a5e9ba163a281a063c3d61508871bc8e4946d49beb720e`. Migrasi run history bersifat additive; rollback tidak menjalankan `db:migrate:undo` dan tidak menghapus tabel histori.

### Offline validation

| Pemeriksaan | Hasil |
|---|---|
| Full Jest | 23 suites, 105 tes lulus |
| TypeScript `tsc --noEmit` | lulus |
| ESLint `npm run lint` | lulus tanpa warning/error ESLint |
| Next.js production build | lulus |
| Docker build dari source commit di atas | lulus; image ID cocok dengan kandidat |
| Slot quarter-hour dan batas registrasi | tes helper dan Croner membuktikan slot berikutnya setelah waktu registrasi; slot tepat pada batas maju ke quarter berikutnya |
| Target, allowlist, budget/cycle caps, expiry | tes policy mencakup ID 19/17, allowlist, 3 cycle, 6 request total, 2 per cycle, serta expiry 90 menit |
| Provider errors/no retry, 401/403/429, audit/history, request budget | suite Serper integration, audit, lock, ranking history, dan budget lulus |
| Duplicate/persistence | constraint `slot_key` dan `(run_id, cycle_number)` tetap aktif; run archive migration lulus dengan status historis terjaga |
| Manual Refresh Guard | suite API/bulk/lock lulus untuk manual, retry, spoofed source, penolakan bulk atomik, serta nol request pada operasi terblokir |

Warnings build terbatas pada data Browserslist/Tailwind lama yang telah ada dan tidak menghentikan build. Jest juga mengeluarkan warning React `act(...)` dari tes footer yang sudah ada; seluruh tes lulus.

### Isolated Mock Runtime UAT

Acceptance run memakai container kandidat, volume SQLite khusus, mock Serper internal, kredensial sintetis, jaringan Docker `internal=true`, tanpa port host, tanpa Production volume/secrets, dan tanpa egress eksternal. Migration runner menerapkan migrasi lama serta migrasi arsip run baru dengan sukses. Server Next.js dan `cron.js` hidup; startup saat pilot disabled menghasilkan 0 request mock.

Acceptance run ID: `af6ae76c-a751-4fb5-8466-479fd5dca3d4`. Timestamp slot berikut adalah waktu simulasi UAT, bukan jadwal Production. Timestamp UAT start/expiry disetel sintetis supaya tiga slot contoh berada di dalam jendela 90 menit.

| Siklus | Slot simulasi WIB | Keyword ID | Posisi awal → akhir | Matched URL mock | HTTP / audit | Request |
|---|---:|---:|---:|---|---|---:|
| 1 | 09:00 | 19 | 8 → 1 | `https://www.enterkomputer.com/simulasi?mock_cycle=1` | 2xx / completed | 1 |
| 1 | 09:00 | 17 | 6 → 2 | `https://fastwork.id/portfolio/mock-cycle-2` | 2xx / completed | 1 |
| 2 | 09:15 | 19 | 1 → 1 | `https://www.enterkomputer.com/simulasi?mock_cycle=3` | 2xx / completed | 1 |
| 2 | 09:15 | 17 | 2 → 2 | `https://fastwork.id/portfolio/mock-cycle-4` | 2xx / completed | 1 |
| 3 | 09:30 | 19 | 1 → 1 | `https://www.enterkomputer.com/simulasi?mock_cycle=5` | 2xx / completed | 1 |
| 3 | 09:30 | 17 | 2 → 2 | `https://fastwork.id/portfolio/mock-cycle-6` | 2xx / completed | 1 |

Fastwork URLs mock berbeda dari `/web-design/landing-page`; hasil membuktikan hostname matching saja. Enterkomputer mock URL berada di `/simulasi`. Tidak ada klaim device-specific.

Acceptance run final: `enabled=0`, `cycle_count=3`, `request_count=6`, `stop_reason=cycle_limit`; keenam request tercatat di Refresh Audit sebagai `hourly_pilot`, masing-masing 1 outbound dan HTTP category `2xx`. Setelah siklus ketiga, tidak ada siklus keempat atau request tambahan. Ranking History menyimpan nilai tanggal terbaru, sedangkan audit/cycle menyimpan enam observasi intraday.

Restart UAT setelah siklus kedua mempertahankan count dan tidak mengulang dua slot yang selesai; siklus ketiga berjalan pada slot berikutnya. Restart terpisah setelah auto-stop mempertahankan `enabled=0`; sesudah menunggu interval simulasi, mock tetap enam request. Keyword sintetis tak terpilih ID 20 tetap pada ranking 4, URL, dan `lastUpdated` semula. SQLite berakhir dengan `PRAGMA integrity_check=ok`, lock kosong, global schedule `never`, retry `false`.

Selama run aktif, empat operasi non-pilot (manual ID 19 dengan `source=hourly_pilot`, retry ID 17, bulk domain ID 19, dan bulk IDs 19+17) semuanya HTTP 409 `HOURLY_PILOT_ACTIVE`. Lima audit terkait berstatus `skipped`, masing-masing nol outbound, dan ranking/counter pilot tidak berubah akibat penolakan. Setelah stop, probe manual untuk ID 19 bukan lagi 409; probe dihentikan oleh setting provider sintetis `never` dengan HTTP 400 sebelum request, sehingga total acceptance run tetap enam.

Expiry diuji terpisah dengan run sintetis yang memiliki selisih start/expiry tepat 90 menit; trigger pada deadline menghasilkan `reason=expired`, menonaktifkan run, dan nol request. Dua POST worker serentak ketika ada cycle sintetis berstatus `started` sama-sama menerima `cycle_in_progress`, nol request. Sepuluh GET status bersamaan mengembalikan HTTP 200 dan integritas SQLite tetap `ok`.

**Catatan harness tambahan:** setelah acceptance run, satu percobaan tambahan untuk memeriksa reaktivasi memakai run ID baru bergerak otomatis karena timer UAT dipercepat 5 detik. Sebelum fixture concurrent dapat disisipkan, worker menyelesaikan run sintetis kedua. Percobaan fixture kemudian mengubah counter DB UAT secara langsung setelah run aktif dan gagal pada unique cycle; karena manipulasi tersebut, snapshot counter run kedua tidak dipakai sebagai bukti budget. Mock menerima 12 request kumulatif dari dua run ID terpisah (enam pada acceptance run, enam pada run tambahan), tidak ada satu run normal yang melebihi tiga siklus/enam request. Seluruh UAT volume/container/network telah dihapus. Acceptance run pertama tetap memiliki bukti konsisten 3 siklus/6 request dan menjadi dasar status READY. Jangan melakukan counter reset ad hoc pada UAT aktif.

Satu status poll cron pada boot UAT awal sempat mencoba sebelum Next.js siap dan mencatat `ECONNREFUSED`; polling berikutnya sukses. Tidak ada refresh startup dan tidak ada request yang ikut terpicu.

### Deployment dan aktivasi yang memerlukan approval baru

Candidate ini belum di-deploy. Deployment selanjutnya memerlukan approval code terpisah, misalnya `APPROVE_DEPLOY_SERPBEAR_15_MINUTE_PILOT_CODE`. Rencana deploy: ulangi preflight Production dan verifikasi ID 19/17; backup SQLite konsisten di persistent protected storage dengan checksum dan integrity; deploy hanya service SerpBear; biarkan pilot disabled dan mock mode mati; periksa migrasi/backfill run lama, health Next.js/cron, database integrity, settings, audit/locks, dan dashboard dengan sesi browser terautentikasi. Jika gagal, kembalikan image Manual Refresh Guard di atas; jangan rollback migrasi dengan menghapus histori.

Live activation membutuhkan approval berbeda: `APPROVE_ENTERKOMPUTER_FASTWORK_15_MINUTE_PILOT_V1`. Approval tersebut harus mencakup target IDs 19/17, tiga siklus 15-menit, maksimum enam request aplikasi, expiry 90 menit, tanpa retry/refresh-all, dan jadwal WIB yang baru dihitung setelah waktu aktivasi aktual diketahui. Tidak ada jadwal Production atau request live yang dibuat dalam pekerjaan ini.

### Risiko dan batas tersisa

- Bukti ranking adalah synthetic UAT; kandidat belum diuji terhadap Google/Serper live. Biaya kredit live diperkirakan sekitar enam query standar per run, tetapi tidak dijamin.
- Fastwork menggunakan hostname matching dan dapat menyimpan URL lain pada `fastwork.id`; ini bukan bukti ranking halaman landing-page secara exact. Enterkomputer juga dapat fallback ke hostname menurut matching existing. URL aktual harus diperiksa tiap siklus live.
- Tabel arsip run menambah schema Production pada deployment mendatang; backup dan rehearsal migrasi tetap diperlukan. Rollback code harus mempertahankan tabel/data tambahan.
- Jadwal Production tetap belum dihitung karena waktu aktivasi belum diketahui. Periksa tiga `nextSlotsWIB` yang dicatat cron setelah scheduler berhasil terdaftar.
- Status historis pilot V2 `LIVE_PILOT_FAILED` tetap berlaku dan tidak diubah oleh kandidat ini.

## DEPLOYMENT — 15-MINUTE PILOT CODE (16 Oktober 2026)

### Approval dan deployment

Deployment dilakukan dengan approval `APPROVE_DEPLOY_SERPBEAR_15_MINUTE_PILOT_CODE`. Source commit yang diverifikasi adalah `f60a5f9a558638dbcea858460d174fe5b15123fc`; immutable image kandidat adalah `sha256:873e9a2dba19b34ed27a22efd78f5f2c6876b016ea0a0431162a93243db50b20`. Image sebelumnya untuk rollback adalah Manual Refresh Guard `sha256:5e3f405a54522fd8e8a5e9ba163a281a063c3d61508871bc8e4946d49beb720e` (`serpbear-hourly-manual-refresh-guard-v2:20261015-v2`).

Preflight Production menunjukkan container lama sehat pada image rollback tersebut, dengan mount `serpbear-official-data:/app/data`. Keyword ID 19 tetap `www.enterkomputer.com/simulasi` / `simulasi rakit pc` / `ID`; ID 17 tetap `fastwork.id/web-design/landing-page` / `Jasa Pembuatan Landing Page, Mulai Rp 100.000` / `ID`. Posisi keduanya 1; URL, history tanggal `2026-10-15`, dan `lastUpdated` dicatat sebelum deployment. Terdapat 2 domain dan 2 keyword.

Backup konsisten dibuat memakai SQLite online backup dan disimpan permanen di `/var/backups/serpbear/serpbear-pre-15m-deploy-20261016T0208Z.sqlite` dengan mode `600`. Ukurannya 139264 byte; SHA-256 `d19912acdef1eb683603e0f6ab2f5b04405a2a860a63126d79ac5f746bbf439f`; pemeriksaan file backup menghasilkan `PRAGMA integrity_check=ok`. Snapshot berisi 2 domain, 2 keyword, 23 Refresh Audit, 0 pilot cycle, dan run lama disabled.

Compose Production yang tersimpan tidak diubah. Deployment memakai override sementara di `/tmp` dan perintah Compose dibatasi ke service `app` dengan `--no-deps --force-recreate --pull never`. Waktu container kandidat mulai: `2026-10-16T02:09:30.507Z` (09:09:30 WIB). Tidak ada service lain yang direcreate.

### Migrasi arsip run

Entrypoint berhasil menjalankan migrasi `1792108800000-archive-hourly-pilot-runs.js`; nama migrasi tercatat di `SequelizeMeta`. Run lama `573beda3-6b8f-472f-b5ea-bf40b6318a57` tersimpan pada `hourly_pilot_run_history` dengan target `[19,17]`, batas 3 siklus/6 request, `cycle_count=0`, `request_count=0`, dan `stop_reason=operator_stop`. Data run aktif lama tetap utuh. Migrasi bersifat additive; prosedur rollback memakai image lama dan mempertahankan tabel arsip.

### Verifikasi setelah deploy

- Container ID baru `0c2796cc4a50cf3e506ecfd53513af5b4d450d7aac98628a07dc2cc3ab660b3f`, image tepat sesuai digest kandidat, status `running / healthy`.
- `node server.js` dan `node cron.js` berjalan. Healthcheck Next.js lulus; volume dan port lokal Production tetap sama.
- `PRAGMA integrity_check=ok`; tetap 2 domain dan 2 keyword. Identitas, posisi, URL, history, dan `lastUpdated` ID 19/17 sama dengan baseline.
- Refresh Audit tetap 23 dengan waktu terakhir yang sama; pilot cycle tetap 0; lock 0; `keyword.updating=1` berjumlah 0.
- Pilot tetap `enabled=0`, run ID historis sama, target `[19,17]`, count 0/0, `stop_reason=operator_stop`. Global schedule `never`, retry `false`, mock/test mode mati, dan failed queue kosong.
- Marker `HOURLY_PILOT_ACTIVE` ditemukan dalam handler refresh hasil build Production. Guard tidak diuji dengan refresh live.

Tidak ada refresh yang terpicu saat startup/restart: setelah migrasi, log cron hanya menunjukkan polling status `GET /api/hourly-pilot`; tidak ada POST worker, audit baru, cycle baru, perubahan ranking, atau pemakaian budget. Poll status pertama sempat menerima `ECONNREFUSED` sebelum Next.js siap, lalu GET status berhasil setelah server mendengarkan port 3000. Candidate `cron.js` hanya membaca status saat startup, tidak menjalankan refresh saat startup; konfigurasi disabled tidak mendaftarkan jadwal pilot. Aktivasi run baru tetap memerlukan prosedur aktivasi eksplisit dan approval live terpisah.

### Rollback dan status

Jika health, migrasi, atau verifikasi data gagal, kembalikan hanya service `app` ke image Manual Refresh Guard di atas dengan override Compose sementara. Jangan menghapus migrasi atau tabel arsip; migrasi `down` memang no-op untuk mempertahankan histori. Backup permanen terverifikasi tersedia jika dibutuhkan untuk pemulihan database.

`15_MINUTE_PILOT_DEPLOYMENT_SUCCESS` — kode 15-minute pilot ter-deploy dan tervalidasi. Pilot live tidak diaktifkan dan tidak ada request Serper/Google yang dijalankan. Aktivasi live memerlukan approval baru.

## LIVE 15-MINUTE PILOT V1 — PRODUCTION RESULTS

### A. Aktivasi dan preflight

- Approval: `APPROVE_ENTERKOMPUTER_FASTWORK_15_MINUTE_PILOT_V1`.
- Run ID: `ec65ea43-d743-4316-a6bb-aeaf72511705`.
- Aktivasi: `2026-10-16T02:25:01.285Z` / 09:25:01 WIB.
- Expiry: `2026-10-16T03:55:01.285Z` / 10:55:01 WIB (90 menit).
- Target allowlist `[19,17]`; maksimum 3 siklus dan 6 request; retry mati.
- Preflight cocok dengan image/commit 15-minute yang disetujui; provider Serper terkonfigurasi, mock/test mati, global schedule `never`, retry `false`, retry queue dan refresh lock kosong. Pilot Disabled sebelum aktivasi.
- Slot cron yang terdaftar dan dijalankan: 09:30, 09:45, dan 10:00 WIB. Tidak ada request pada aktivasi atau startup.
- Baseline: ID19 dan ID17 masing-masing posisi 1; 2 domain/2 keyword. Run lama `573beda3-6b8f-472f-b5ea-bf40b6318a57` tetap tersimpan dengan `operator_stop` dan hitungan 0/0.

### B. Hasil per siklus

Waktu aktual berikut mengacu ke Refresh Audit Production. Untuk ID17, posisi 1→1 adalah nilai tersimpan sebelum/sesudah kegagalan; itu bukan observasi ranking baru. `—` berarti provider tidak dipanggil dan tidak ada matched URL.

| Siklus | Slot WIB | Aktual WIB | Keyword ID | Posisi sebelum → sesudah | Matched URL aktual | HTTP provider | Request Serper | Refresh Audit |
|---|---|---|---:|---|---|---|---:|---|
| 1 | 09:30 | 09:30:00.144 | 19 | 1 → 1 | `https://www.enterkomputer.com/simulasi/` | 2xx | 1 | completed |
| 1 | 09:30 | 09:35:01.955 | 17 | 1 → 1 (tersimpan; tidak teramati) | — | tidak ada | 0 | failed, `scrape_error` |
| 2 | 09:45 | 09:45:00.112 | 19 | 1 → 1 | `https://www.enterkomputer.com/simulasi/` | 2xx | 1 | completed |
| 2 | 09:45 | 09:50:01.581 | 17 | 1 → 1 (tersimpan; tidak teramati) | — | tidak ada | 0 | failed, `scrape_error` |
| 3 | 10:00 | 10:00:00.104 | 19 | 1 → 1 | `https://www.enterkomputer.com/simulasi/` | 2xx | 1 | completed |
| 3 | 10:00 | 10:05:01.743 | 17 | 1 → 1 (tersimpan; tidak teramati) | — | tidak ada | 0 | failed, `scrape_error` |

ID17 tetap menyimpan URL sebelumnya `https://fastwork.id/web-design/landing-page`; URL itu bukan hasil pencocokan pilot ini. Refresh Audit ID19: `477bd564-de89-47f8-9330-1ff246ad201f`, `53b1c9c2-7617-4dcf-bd81-8c2506e1dd16`, `9cf921df-0a3f-44f8-aa83-d450f654a70e`. Refresh Audit ID17: `36a97ea6-8c65-4085-abf6-9722630558cf`, `859e65d2-0b6e-43e2-b1f5-c621db743c47`, `8c39b4f7-9df0-4ffa-a72a-531e9229a877`.

Waktu penutupan siklus pada tabel pilot: siklus 1 `09:40:01.999 WIB`, siklus 2 `09:55:01.607 WIB`, siklus 3 `10:10:01.760 WIB`.

### C. Budget dan penyebab kegagalan Fastwork

- Tiga siklus terjadwal dicoba; semuanya berstatus `failed` karena salah satu target gagal.
- Total outbound Search API: **3** (ID19 satu per siklus; ID17 nol). Batas 6 tidak terlampaui; tidak ada retry.
- Perkiraan konsumsi sekitar 3 standard query credits, bukan angka billing terverifikasi. Data kredit aktual provider tidak tersedia.
- Konfigurasi Production `scrape_delay=300000` ms. Jalur refresh menunggu sekitar lima menit antar-target, lebih lama dari timeout header worker cron dan ambang stale-cycle. Log mencatat `HeadersTimeoutError`; status siklus sementara ditandai `worker_interrupted`. Proses server kemudian menyelesaikan batch dan menulis audit ID17, tetapi request budget guard menolak reservasi target kedua; `lastUpdateError` ID17 menunjukkan `pilot_request_budget_exhausted`. Tidak ada request Serper untuk Fastwork. Siklus final tersimpan sebagai `one_or_more_keyword_refreshes_failed`.
- Scheduler menjalankan ketiga slot terdaftar. Kegagalan ini adalah ketidakcocokan waktu worker/refresh dengan konfigurasi delay, bukan bukti bahwa cron tidak berjalan.

### D. Auto-stop dan integritas

- Setelah siklus ketiga: `enabled=0`, `cycle_count=3`, `request_count=3`, `stop_reason=cycle_limit`. Run baru diarsipkan; run historis sebelumnya tetap tersimpan.
- Setelah slot berikutnya 10:15 WIB lewat, konfigurasi tetap nonaktif, tabel hanya memiliki tiga siklus untuk run ini, dan log sejak pemeriksaan akhir hanya berisi GET status—tidak ada POST worker atau siklus/request keempat.
- Global schedule `never`; retry `false`; tidak ada refresh lock; `PRAGMA integrity_check=ok`.
- Data tetap 2 domain dan 2 keyword. ID19 tetap posisi 1 dengan URL Enterkomputer yang cocok; ID17 tetap posisi tersimpan 1/URL lama, `updating=0`. Tidak ada perubahan atau penghapusan domain/keyword.
- Jumlah Refresh Audit total berubah dari baseline 23 menjadi 29, tepat enam audit run ini. Ranking History ID19 bertambah `2026-10-16:1`; history ID17 tetap `2026-10-15:1` karena tidak ada observasi provider.

### E. Analisis ranking dan status

Ranking ID19 stabil di posisi 1 pada ketiga observasi, dengan URL cocok `www.enterkomputer.com/simulasi/`; URL ini sesuai dengan target Enterkomputer. Fastwork hostname matching tidak teruji karena tidak ada hasil provider, sehingga tidak ada kesimpulan ranking untuk ID17. Nilai device tersimpan tidak membuktikan SERP perangkat tertentu.

**`LIVE_15M_PILOT_PARTIAL`** — tiga slot berjalan dan auto-stop, request tetap di bawah batas, lock kosong, serta SQLite utuh. Pilot tidak menyelesaikan observasi dua target karena Fastwork gagal pada semua siklus akibat jalur worker/guard di atas. Jangan ulangi atau aktifkan pilot tanpa perbaikan yang divalidasi dan approval aktivasi baru. Perbaikan minimum yang disarankan adalah memastikan refresh pilot tidak terkena jeda scrape lima menit per keyword dan worker tidak menandai siklus aktif sebagai stale sebelum handler selesai; validasi offline/mock terlebih dahulu.
