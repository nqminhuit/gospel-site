# Lời Chúa hằng ngày (Daily Gospel)

A small Next.js 15 / React 19 site that displays the daily Gospel reading (Tin Mừng), with a calendar to browse readings for other dates.

## Purpose

- Show the Gospel of the day, taken from the liturgical calendar
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

## Data source

The Gospel reading for any date is computed server-side by querying
`resources/bible.db` directly — a SQLite database committed to this repo, not
fetched over the network at runtime:
- `lib/bibleDb.js` opens `resources/bible.db` read-only
- `lib/refParser.js` ports [daily-bible](https://github.com/nqminhuit/daily-bible)'s Gospel-reference parsing (`internal/api/ref.go`) to resolve verse text
- `lib/lectionaryKey.js` / `lib/vietnameseLabels.js` port the `lectionary_key` grammar (`internal/lectionary/types.go`) into a Vietnamese liturgical-day label

To update the reading data, run `npm run vendor-bible-db` (requires a sibling
checkout of `daily-bible`), commit the updated `resources/bible.db`, and
redeploy — there is no automatic/scheduled refresh.

Dates with no crawled Gospel reference yet in `daily-bible` show a graceful "not available" message.

## Monitoring

`resources/bible.db` is a fixed table (currently `2021-01-01` .. `2026-12-31`),
not a rolling window, and roughly a third of its dates have no Gospel reference
crawled upstream yet. Both failure modes are silent — the site just renders
"Chưa có dữ liệu".

`.github/workflows/check-readings.yml` runs daily at 00:10 Asia/Ho_Chi_Minh and
fails the workflow (email notification) when data is missing, so it can be
refreshed *before* visitors hit the gap. It checks a **window of upcoming
days**, not just today, since by the time today is broken the site is already
degraded. It fetches nothing and commits nothing.

Run it locally with `npm run check-readings`. Two knobs, both env vars:
- `LOOKAHEAD_DAYS` (default `14`) — how far ahead readings are required
- `CLIFF_WARN_DAYS` (default `45`) — how early to complain that the database is running out of dates

It reuses `lib/reading.js`, the same code path the page renders with, so a pass
means the site renders. It verifies availability and internal consistency only
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
