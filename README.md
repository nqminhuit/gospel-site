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
  - `page.js`: Home page (Gospel of the day + calendar)
  - `layout.js`: Common layout
- **components/**: Reusable components (`GospelModal.jsx`, `CalendarSection.js`, `ErrorBoundary.js`)
- **public/**: Static assets (icons)
- **utils/**: Utility functions (fetching + caching Gospel data)

## Data source

Liturgical calendar and Gospel text are fetched from https://github.com/nqminhuit/liturgical-calendar:
- `resources/liturgical-calendar-<year>.json` and `resources/vietnam-liturgical-calendar-<year>.json`
- `resources/lectionary.json` (maps lectionary keys to Gospel references, one-time work reused every year)
- `resources/gospel.json` (full Gospel text keyed by reference)

## Deployment
Automatic deployment when pushing changes to the main branch

### Manual Deployment Steps
1. Build production:
 ```bash
 npm run build
 ```

2. Start server (dev):
 ```bash
 (cd out && python -m http.server 8000)
 ```

## Contributing

All contributions are welcome! Please create an issue or pull request.
