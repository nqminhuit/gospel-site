// Plain date-string helpers, safe for both server and client code (no
// 'server-only' import). Operates on 'YYYY-MM-DD' strings directly to avoid
// timezone round-trips through Date.

const DATE_RE = /^(\d{4})-(\d{2})-(\d{2})$/;

/** True only for a real calendar date, not just a "YYYY-MM-DD"-shaped string. */
export function isValidDateStr(str) {
  const m = DATE_RE.exec(str);
  if (!m) return false;
  const [, yStr, moStr, dStr] = m;
  const y = Number(yStr);
  const mo = Number(moStr);
  const d = Number(dStr);
  const date = new Date(y, mo - 1, d);
  return date.getFullYear() === y && date.getMonth() === mo - 1 && date.getDate() === d;
}

/** 'YYYY-MM-DD' -> 'DD/MM/YYYY' */
export function formatVi(dateStr) {
  const [y, m, d] = dateStr.split('-');
  return `${d}/${m}/${y}`;
}
