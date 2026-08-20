const GOSPEL_URL = 'https://raw.githubusercontent.com/nqminhuit/liturgical-calendar/refs/heads/master/resources/gospel.json';
const GOSPEL_CACHE_KEY = 'gospel_json_cache_v1';
let _gospelMemoryCache = null;

// Generated daily by a scheduled GitHub Action from https://github.com/nqminhuit/daily-bible
export async function fetchGospelToday() {
  const res = await fetch(`/gospel-today.json?t=${Date.now()}`);
  if (!res.ok) {
    throw new Error(`Failed to fetch gospel-today.json: ${res.status} ${res.statusText}`);
  }
  return res.json();
}

export async function fetchGospelsCached({ ttlMs = 180000 } = {}) {
  // Return memory cache if still present
  if (_gospelMemoryCache) {
    return _gospelMemoryCache;
  }

  const now = Date.now()
  // Try localStorage
  try {
    const raw = localStorage.getItem(GOSPEL_CACHE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed && parsed.timestamp && (now - parsed.timestamp) < ttlMs && parsed.data) {
        _gospelMemoryCache = parsed.data;
        return _gospelMemoryCache;
      }
    }
  } catch (e) {
    console.warn('Failed reading gospel cache', e);
  }

  // Fetch from network
  const res = await fetch(`${GOSPEL_URL}?t=${now}`);
  if (!res.ok) {
    throw new Error(`Failed to fetch gospel.json: ${res.status} ${res.statusText}`);
  }
  const data = await res.json();
  _gospelMemoryCache = data;

  // Persist to localStorage
  try {
    localStorage.setItem(GOSPEL_CACHE_KEY, JSON.stringify({ timestamp: now, data }));
  } catch (e) {
    console.warn('Failed to write gospel cache', e);
  }

  return _gospelMemoryCache;
}
