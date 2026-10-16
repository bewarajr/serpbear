# SerpBear Ranking History Review

**Date:** 2026-10-14  
**Version reviewed:** Official SerpBear v3.1.0  
**Status: RANKING_HISTORY_FIX_REQUIRED**

## Root cause

Adding a keyword starts refreshAndUpdateKeywords immediately in pages/api/keywords.ts. With scraper_type=none, utils/scraper.ts has no scraper URL, leaves apiURL empty, and fetch(apiURL) fails URL parsing. The scraper catches that failure and returns an error result whose position is copied from the keyword’s current position.

In utils/refresh.ts, updateKeywordPosition unconditionally executes history[dateKey] = newPos before checking updatedKeyword.error. It then writes that history to SQLite. For a new keyword the preserved position is 0, producing a dated zero entry despite the scrape failure. The function does record lastUpdateError and leaves lastUpdated unchanged, but those fields do not prevent the history write.

Relevant local code: [keyword creation handler](/home/kiwkiw/projects/serpbear/pages/api/keywords.ts:113), [empty scraper URL and fetch](/home/kiwkiw/projects/serpbear/utils/scraper.ts:50), [failed result preserves current position](/home/kiwkiw/projects/serpbear/utils/scraper.ts:188), [failed-scrape branch](/home/kiwkiw/projects/serpbear/utils/scraper.ts:260), and [unconditional history update](/home/kiwkiw/projects/serpbear/utils/refresh.ts:82).

## Outcome comparison

| Scrape outcome | Returned result | v3.1.0 history behavior |
|---|---|---|
| Failed scrape | error is truthy; result carries the previous position, commonly 0 for a new keyword. | Incorrectly records the carried position for today. |
| Successful scrape, domain not found | Nonempty SERP results; error=false; calculated position is 0. | Records 0. This is supported by the returned SERP evidence, within the coverage the selected scrape strategy actually checked. |
| Successful scrape, domain found | error=false; calculated position is positive. | Records the positive position. |

The issue is specifically that the failure result is persisted as an observation. The valid successful-not-found result also uses 0, but it reaches the updater with error=false and has SERP evidence.

## Configuration and upstream review

No supported configuration found prevents the write. scrape_interval=never affects scheduled runs, while keyword creation calls refresh directly. scrape_retry=false changes retry-queue handling only; it does not guard history persistence. Leaving the scraper unset causes this failure path and still reaches the updater.

The official [v3.1.0 source](https://github.com/towfiqi/serpbear/blob/v3.1.0/utils/refresh.ts#L65-L99) and current [upstream main source](https://github.com/towfiqi/serpbear/blob/main/utils/refresh.ts#L65-L99) both unconditionally write the history entry. The [v3.1.0 release notes](https://github.com/towfiqi/serpbear/releases/tag/v3.1.0) list scraper error-handling changes but no correction to this history behavior. Targeted searches of the official repository did not find a matching public issue; this does not establish that no unindexed report exists.

## Isolated regression tests

Added [rankingHistory.test.ts](/home/kiwkiw/projects/serpbear/__tests__/rankingHistory.test.ts). It uses an in-memory model and mocks queue operations; it never invokes a scraper, network request, or database. The three cases assert that:

- failure preserves existing history and records the error;
- successful-not-found records 0;
- successful-found records the positive position.

The failure test expresses the required behavior and is expected to fail against the current implementation. Execution was attempted with the targeted Jest command, but this checkout has no installed Jest binary (jest: not found). No dependencies were installed. The failed-history case was independently reproduced in the prior isolated UAT.

## Recommended correction

A one-line guard in updateKeywordPosition is sufficient for the stated requirement:

    if (!updatedKeyword.error) {
       history[dateKey] = newPos;
    }

This preserves successful-not-found and successful-found observations while leaving history unchanged on scrape errors. Keep the existing position, last result, error recording, and retry behavior on the failure path.

There is no configuration-only workaround, and the inspected upstream main still contains the defect. A small source patch or an upstream fix is necessary. No application source was changed and no production database, container, or settings were modified.
