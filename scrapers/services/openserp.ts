import countries from '../../utils/countries';

/**
 * OpenSERP scraper for SerpBear — https://github.com/karust/openserp (MIT)
 *
 * OpenSERP is a self-hosted SERP API: no API keys, no per-search billing.
 * Default endpoint: http://127.0.0.1:7000
 *
 * Engine choice is deliberate. Verified against karust/openserp:latest (API v2.2.0)
 * on 2026-10-14:
 *   duck      -> 200, clean target URLs, 100 results in one request   [DEFAULT]
 *   google    -> 200, but every url is `google.com/goto?url=...`      [unusable for rank tracking]
 *   bing      -> 200, but returned results unrelated to the query     [broken in this image]
 *   ecosia    -> 403   yandex -> 429
 * `duck` is therefore the only engine that can be trusted for rank positions today.
 *
 * CONFIG: SerpBear exposes exactly one free-text credential field (`settings.scaping_api`).
 * OpenSERP needs no key, so that field holds the BASE URL of your instance instead,
 * e.g. `http://127.0.0.1:7000` or `http://openserp:7000`. Leave it blank to use the default.
 */

interface OpenSERPResult {
   rank: number,
   type?: string,
   title: string,
   url: string,
}

const OPENSERP_ENGINE = 'duck';
const OPENSERP_DEFAULT_BASE = 'http://127.0.0.1:7000';

/** Google can hand back obfuscated `google.<tld>/goto?url=...` hops; those would make every
 *  result look like it belongs to google.com and silently corrupt every stored position. */
const isRedirectHop = (url: string): boolean => /^https?:\/\/[^/]*google\.[a-z.]+\/goto/i.test(url);

const openserp:ScraperSettings = {
   id: 'openserp',
   name: 'OpenSERP (self-hosted)',
   website: 'github.com/karust/openserp',
   allowsCity: false,
   // OpenSERP accepts limit up to 100 and paginates internally, so one request is enough.
   nativePagination: true,
   headers: () => {
      return { Accept: 'application/json' };
   },
   scrapeURL: (keyword, settings, _countryData, pagination) => {
      const base = (settings.scaping_api || OPENSERP_DEFAULT_BASE).trim().replace(/\/+$/, '');
      const country = keyword.country || 'US';
      const lang = countries[country] ? countries[country][2] : 'en';
      const p = pagination || { start: 0, num: 10, page: 1 };
      const start = p.start ? `&start=${p.start}` : '';
      return `${base}/${OPENSERP_ENGINE}/search`
         + `?text=${encodeURIComponent(keyword.keyword)}`
         + `&limit=${p.num}${start}`
         + `&lang=${encodeURIComponent(lang)}`
         + `&region=${country}`
         + '&format=json';
   },
   resultObjectKey: 'results',
   serpExtractor: (content) => {
      const extractedResult = [];
      const results: OpenSERPResult[] = (typeof content === 'string') ? JSON.parse(content) : content as OpenSERPResult[];

      for (const { rank, type, title, url } of results) {
         // OpenSERP returns ads alongside organic hits; ads have no meaningful rank position.
         if (type && type !== 'organic') { continue; }
         if (!title || !url || isRedirectHop(url)) { continue; }
         extractedResult.push({
            title,
            url,
            position: rank,
         });
      }
      return extractedResult;
   },
};

export default openserp;
