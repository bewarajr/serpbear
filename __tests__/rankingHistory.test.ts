import { updateKeywordPosition } from '../utils/refresh';
import { removeFromRetryQueue, retryScrape } from '../utils/scraper';

jest.mock('../utils/scraper', () => ({
   removeFromRetryQueue: jest.fn().mockResolvedValue(undefined),
   retryScrape: jest.fn().mockResolvedValue(undefined),
   scrapeKeywordWithStrategy: jest.fn(),
}));

const currentDateKey = () => {
   const date = new Date();
   return `${date.getFullYear()}-${date.getMonth() + 1}-${date.getDate()}`;
};

const makeKeyword = (initial: { position: number, history: Record<string, number> }) => {
   const row: any = {
      ID: 27,
      keyword: 'synthetic regression keyword',
      domain: 'example.com',
      device: 'desktop',
      country: 'us',
      city: '',
      position: initial.position,
      url: '',
      updating: true,
      sticky: false,
      tags: '[]',
      history: JSON.stringify(initial.history),
      lastResult: '[]',
      lastUpdated: '2026-10-13T12:00:00.000Z',
      lastUpdateError: 'false',
   };
   const model: any = {
      get: jest.fn(() => ({ ...row })),
      update: jest.fn(async (values) => {
         Object.assign(row, values);
         return model;
      }),
   };
   return { model, row };
};

describe('ranking history records only completed scrape outcomes', () => {
   beforeEach(() => {
      jest.clearAllMocks();
      jest.useFakeTimers();
      jest.setSystemTime(new Date('2026-10-14T12:00:00.000Z'));
      jest.spyOn(console, 'log').mockImplementation(() => undefined);
   });

   afterEach(() => {
      jest.useRealTimers();
      jest.restoreAllMocks();
   });

   it('does not append history after a failed scrape', async () => {
      const initialHistory = { '2026-10-13': 4 };
      const { model, row } = makeKeyword({ position: 0, history: initialHistory });

      await updateKeywordPosition(model, {
         ID: 27,
         keyword: row.keyword,
         position: 0,
         url: '',
         result: [],
         error: 'Failed to parse URL from',
      } as any, { scraper_type: 'none', scrape_retry: false } as any);

      expect(JSON.parse(row.history)).toEqual(initialHistory);
      expect(row.position).toBe(0);
      expect(JSON.parse(row.lastUpdateError).error).toBe('Failed to parse URL from');
      expect(removeFromRetryQueue).toHaveBeenCalledWith(27);
   });

   it('records zero when a successful SERP response does not contain the domain', async () => {
      const { model, row } = makeKeyword({ position: 0, history: {} });

      await updateKeywordPosition(model, {
         ID: 27,
         keyword: row.keyword,
         position: 0,
         url: '',
         result: [{ position: 1, url: 'https://other.example/', title: 'Other result' }],
         error: false,
      } as any, { scraper_type: 'test-fixture', scrape_retry: false } as any);

      expect(JSON.parse(row.history)).toEqual({ [currentDateKey()]: 0 });
      expect(row.position).toBe(0);
      expect(row.lastUpdateError).toBe('false');
   });

   it('records the positive position when a successful SERP response contains the domain', async () => {
      const { model, row } = makeKeyword({ position: 0, history: {} });

      await updateKeywordPosition(model, {
         ID: 27,
         keyword: row.keyword,
         position: 7,
         url: 'https://example.com/page',
         result: [{ position: 7, url: 'https://example.com/page', title: 'Example result' }],
         error: false,
      } as any, { scraper_type: 'test-fixture', scrape_retry: false } as any);

      expect(JSON.parse(row.history)).toEqual({ [currentDateKey()]: 7 });
      expect(row.position).toBe(7);
      expect(row.lastUpdateError).toBe('false');
   });

   it('preserves an existing same-day observation across repeated failures', async () => {
      const initialHistory = { '2026-10-13': 9, [currentDateKey()]: 4 };
      const { model, row } = makeKeyword({ position: 7, history: initialHistory });
      const failure = {
         ID: 27,
         keyword: row.keyword,
         position: 7,
         url: '',
         result: [],
         error: 'temporary scraper error',
      } as any;

      await updateKeywordPosition(model, failure, { scraper_type: 'none', scrape_retry: false } as any);
      await updateKeywordPosition(model, failure, { scraper_type: 'none', scrape_retry: false } as any);

      expect(JSON.parse(row.history)).toEqual(initialHistory);
   });

   it('keeps error reporting and retry scheduling when retries are enabled', async () => {
      const initialHistory = { '2026-10-13': 9 };
      const { model, row } = makeKeyword({ position: 7, history: initialHistory });
      const lastUpdated = row.lastUpdated;

      await updateKeywordPosition(model, {
         ID: 27,
         keyword: row.keyword,
         position: 7,
         url: '',
         result: [],
         error: 'provider timeout',
      } as any, { scraper_type: 'serpapi', scrape_retry: true } as any);

      expect(JSON.parse(row.history)).toEqual(initialHistory);
      expect(row.position).toBe(7);
      expect(row.lastUpdated).toBe(lastUpdated);
      expect(JSON.parse(row.lastUpdateError)).toMatchObject({
         error: 'provider timeout',
         scraper: 'serpapi',
      });
      expect(retryScrape).toHaveBeenCalledWith(27);
      expect(removeFromRetryQueue).not.toHaveBeenCalled();
   });
});
