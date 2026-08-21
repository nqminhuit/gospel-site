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
- **lib/**: Server-only data access — downloads and queries `daily-bible`'s SQLite database directly
- **public/**: Static assets (icons)

## Data source

The Gospel reading for any date is computed live, server-side, by querying
[daily-bible](https://github.com/nqminhuit/daily-bible)'s SQLite database
(`resources/bible.db`) directly:
- `lib/bibleDbSource.js` downloads and caches a local copy of `bible.db` (TTL-based refresh, no build-time or git-commit step involved)
- `lib/refParser.js` ports `daily-bible`'s Gospel-reference parsing (`internal/api/ref.go`) to resolve verse text
- `lib/lectionaryKey.js` / `lib/vietnameseLabels.js` port the `lectionary_key` grammar (`internal/lectionary/types.go`) into a Vietnamese liturgical-day label

Dates with no crawled Gospel reference yet in `daily-bible` show a graceful "not available" message.

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
