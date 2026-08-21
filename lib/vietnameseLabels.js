import 'server-only';

// Generic fallback wording — ported verbatim from the old app/page.js
// getSundayLabel().
const SEASON_NAMES = {
  advent: 'Mùa Vọng',
  christmas: 'Mùa Giáng Sinh',
  ordinary: 'Mùa Thường Niên',
  lent: 'Mùa Chay',
  easter: 'Mùa Phục Sinh',
};

const WEEKDAY_NAMES = {
  sun: 'Chúa Nhật',
  mon: 'Thứ Hai',
  tue: 'Thứ Ba',
  wed: 'Thứ Tư',
  thu: 'Thứ Năm',
  fri: 'Thứ Sáu',
  sat: 'Thứ Bảy',
};

// Verified against https://github.com/nqminhuit/liturgical-calendar's own
// "name" overrides (resources/liturgical-calendar-<year>.json, 2023-2026):
// that data only ever sets a special name for Ash Wednesday and Holy Week
// weekdays — the 19 other "fixed celebration" dates (Christmas, Assumption,
// etc.) get no special name there either and fall through to the generic
// label below, so no fixed-date name table is needed here.
const LENT_WEEKDAY_NAMES = {
  wed_0: 'Thứ Tư Lễ Tro',
  mon_6: 'Thứ Hai Tuần Thánh',
  tue_6: 'Thứ Ba Tuần Thánh',
  wed_6: 'Thứ Tư Tuần Thánh',
  thu_6: 'Thánh Lễ Tiệc Ly - Chúa Giêsu Lập Bí Tích Thánh Thể',
  fri_6: 'Tưởng Niệm Cuộc Thương Khó Chúa Giêsu',
  sat_6: 'Lễ Vọng Phục Sinh',
};

function genericLabel({ season, weekOfSeason, weekday, sundayCycle, weekdayCycle }) {
  let label = WEEKDAY_NAMES[weekday];
  if (weekOfSeason !== 0) label += ` tuần ${weekOfSeason}`;
  label += ` ${SEASON_NAMES[season]}`;
  if (weekday === 'sun' || season === 'ordinary') {
    label += ` năm ${weekday === 'sun' ? sundayCycle : weekdayCycle}`;
  }
  return label;
}

/**
 * @param {ReturnType<import('./lectionaryKey').parseLectionaryKey>} parsed
 * @returns {string}
 */
export function getVietnameseLabel(parsed) {
  const { isEasterSunday, season, weekOfSeason, weekday, sundayCycle } = parsed;

  if (isEasterSunday) return `Chúa Nhật Phục Sinh - Năm ${sundayCycle}`;

  if (season === 'lent' && weekOfSeason === 6 && weekday === 'sun') {
    return `Chúa Nhật Lễ Lá - Năm ${sundayCycle}`;
  }
  if (season === 'lent' && (weekOfSeason === 0 || weekOfSeason === 6)) {
    const special = LENT_WEEKDAY_NAMES[`${weekday}_${weekOfSeason}`];
    if (special) return special;
  }

  return genericLabel(parsed);
}
