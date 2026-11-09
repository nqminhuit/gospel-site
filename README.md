# Lời Chúa hằng ngày (Daily Gospel)

A small Next.js 15 / React 19 site that displays the daily Gospel reading (Tin Mừng), with a calendar to browse readings for other dates.

## Purpose

- Show a Gospel reference verified against the exact dated Vietnamese Vatican News page, not inferred from a calendar key
- Let visitors pick another date on the calendar to read that day's Gospel

## Installation and Running

### Requirements
- Node.js 24+
- npm or yarn

### Installation Steps
1. Clone the repository

2. Install dependencies:
   ```bash
   npm install
   ```

3. Run the development server:
   ```bash
   npm start
   ```

Open [http://localhost:3000](http://localhost:3000) in the browser to view the site.

## Project Structure

- **app/**: Next.js pages (app router)
  - `page.js`: Home page (Gospel of the day + calendar), server-rendered
  - `layout.js`: Common layout
- **components/**: Reusable components (`CalendarWrapper.jsx`, `CalendarSection.js`, `ErrorBoundary.js`)
- **lib/**: Server-only data access — reads and queries the committed SQLite database directly
- **public/**: Static assets (icons)
- **resources/bible.db**: the app's sole data source, committed to this repo (see "Data source" below)
- **scripts/vendor-bible-db.js**: refreshes `resources/bible.db` from a sibling checkout of `daily-bible`
- **scripts/check-readings.mjs**: daily health check for the committed database (see "Monitoring" below)
- **.github/scripts/sync-bible-db.sh**: CI-only re-sync of `resources/bible.db` from `daily-bible`
- **.github/scripts/commit-db.sh**: CI-only commit of a refreshed `resources/bible.db` to `master`

## Data source

The Gospel reading for any date is computed server-side by querying
`resources/bible.db` directly — a SQLite database committed to this repo, not
fetched over the network at runtime:
- `lib/bibleDb.js` opens `resources/bible.db` read-only
- `lib/refParser.js` ports [daily-bible](https://github.com/nqminhuit/daily-bible)'s Gospel-reference parsing (`internal/api/ref.go`) to resolve verse text
- `lib/reading.js` requires `daily_reading_sources` provenance matching the exact date, current ref, canonical dated source URL, and verification timestamp
- A celebration label is displayed only when a reviewed `celebration` is stored with the source; `lectionary_key` is an estimate and is not used to label the Mass
- The page links the exact source and explains that parish-specific celebrations or permitted reading alternatives may differ; Vietnamese language alone does not establish a Vietnamese national/diocesan calendar
- Confirm the target calendar before archive-wide repairs; unresolved local/source conflicts remain unavailable rather than silently choosing a normal weekday or Sunday

To update the reading data, run `npm run vendor-bible-db` (requires a sibling
checkout of `daily-bible`), commit the updated `resources/bible.db`, and
redeploy. The scheduled monitor below also syncs on a verification gap.

Dates without matching exact-date provenance show a graceful "not verified yet"
message, even if a legacy calendar-derived reference is present. Historical refs
are preserved upstream for audit, but need incremental verification before being
served again. Publish the new provenance-bearing snapshot together with this
frontend change. `npm test` covers rejection of legacy/stale/wrong-date sources
and suppression of predicted celebration labels.

## Monitoring

`resources/bible.db` is a fixed table (currently `2021-01-01` .. `2026-12-31`),
not a rolling window. A non-null reference is insufficient: missing verse text,
missing provenance, or a source/calendar conflict all make a reading unavailable.
The archive needs incremental verification; old predictions are not grandfathered
in as confirmed readings.

`.github/workflows/check-readings.yml` runs daily at 00:10 Asia/Ho_Chi_Minh. It
checks a **window of upcoming days**, not just today, since by the time today is
broken the site is already degraded. Then:

1. All readings have matching exact-date provenance and verse text → done, nothing happens.
2. Something missing → re-sync `resources/bible.db` from `daily-bible`'s master
   branch, check again, and commit the fresher database directly to `master`,
   which triggers a Vercel redeploy. No PR and no approval — a data refresh has
   nothing to review, and waiting on a merge is what let gaps reach the site.
3. Still missing after syncing → **fail the workflow** (email notification).
   `daily-bible` doesn't have those readings either, so its `Heal missing
   readings` workflow needs to crawl them.

So being merely out of date heals itself with no human in the loop, and you're
only notified when a person is actually needed. The site never fetches anything
at runtime — the sync runs in CI, and only after a check has already failed.

Run the check locally with `npm run check-readings`. Two knobs, both env vars:
- `LOOKAHEAD_DAYS` (default `2`) — how far ahead readings are required
- `CLIFF_WARN_DAYS` (default `45`) — how early to complain that the database is running out of dates

It reuses `lib/reading.js`, the same code path the page renders with, so a pass
means the site renders a source-verified reference. It verifies exact-date provenance, availability, and internal consistency
— whether a `gospel_ref` is the *correct* reference for a date is `daily-bible`'s
responsibility.

## Deployment
Automatic deployment when pushing changes to the main branch. This is a
server-rendered (SSR) app — production requires `next start` (or Vercel's
standard Next.js SSR deploy), not a static file server.

### Manual Deployment Steps
1. Build production:
 ```bash
 npm run build
 ```

2. Start server:
 ```bash
 npm start
 ```

## Contributing

All contributions are welcome! Please create an issue or pull request.
