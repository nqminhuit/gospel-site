import 'server-only';

// Ported from daily-bible's internal/lectionary/types.go DayInfo.lectionaryKey().
// Grammar is a strict positional template:
//   easter_sunday_{A|B|C}
//   {season}_{week}_{weekday}_{MM-DD}[_{I|II}]   (fixed/date-tagged, never on Sunday)
//   {season}_{week}_sun_{A|B|C}
//   {season}_{week}_{weekday}[_{I|II}]           (cycle suffix only when season === 'ordinary')

const EASTER_SUNDAY_RE = /^easter_sunday_(?<cycle>[ABC])$/;
const KEY_RE =
  /^(?<season>advent|christmas|lent|easter|ordinary)_(?<week>\d+)_(?<weekday>sun|mon|tue|wed|thu|fri|sat)(?:_(?<monthday>\d{2}-\d{2}))?(?:_(?<cycle>II|I|[ABC]))?$/;

/**
 * @param {string} key e.g. "ordinary_20_fri_II", "easter_sunday_A"
 * @returns {{isEasterSunday:boolean, season:string, weekOfSeason:number, weekday:string, monthDay:string, sundayCycle:string, weekdayCycle:string}}
 */
export function parseLectionaryKey(key) {
  let m = EASTER_SUNDAY_RE.exec(key);
  if (m) {
    return {
      isEasterSunday: true,
      season: 'easter',
      weekOfSeason: 1,
      weekday: 'sun',
      monthDay: '',
      sundayCycle: m.groups.cycle,
      weekdayCycle: '',
    };
  }

  m = KEY_RE.exec(key);
  if (!m) throw new Error(`unrecognized lectionary_key: ${key}`);
  const { season, week, weekday, monthday, cycle } = m.groups;
  const isSunday = weekday === 'sun';
  return {
    isEasterSunday: false,
    season,
    weekOfSeason: Number(week),
    weekday,
    monthDay: monthday || '',
    sundayCycle: isSunday ? cycle || '' : '',
    weekdayCycle: !isSunday ? cycle || '' : '',
  };
}
