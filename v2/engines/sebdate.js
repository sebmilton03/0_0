// Dates for 0_0. Pure functions, local time only.
//
// A date is a plain 'YYYY-MM-DD' string. Under the hood every date is a whole day number
// (days since 1970-01-01), worked out with integer math, never with Date objects or UTC.
// So a daylight-saving change can't shift a date: there are no hours here to lose or gain.
// The only place a Date is read is today(), and it reads the phone's local calendar date.
//
// The real calendar is the default view. Weeks run Monday to Sunday.
// The Seb calendar sits alongside it: a 28-day month that starts on a payday Monday.

const pad = (n, w = 2) => String(n).padStart(w, '0');
const mod = (a, b) => ((a % b) + b) % b;

/* ---------- Day numbers ----------
   Howard Hinnant's days_from_civil / civil_from_days: exact for any Gregorian date. */
function dayFromYmd(y, m, d) {
  y -= m <= 2 ? 1 : 0;
  const era = Math.floor(y / 400), yoe = y - era * 400;
  const doy = Math.floor((153 * (m + (m > 2 ? -3 : 9)) + 2) / 5) + d - 1;
  const doe = yoe * 365 + Math.floor(yoe / 4) - Math.floor(yoe / 100) + doy;
  return era * 146097 + doe - 719468;
}
function ymdFromDay(z) {
  z += 719468;
  const era = Math.floor(z / 146097), doe = z - era * 146097;
  const yoe = Math.floor((doe - Math.floor(doe / 1460) + Math.floor(doe / 36524) - Math.floor(doe / 146096)) / 365);
  const doy = doe - (365 * yoe + Math.floor(yoe / 4) - Math.floor(yoe / 100));
  const mp = Math.floor((5 * doy + 2) / 153);
  const d = doy - Math.floor((153 * mp + 2) / 5) + 1, m = mp < 10 ? mp + 3 : mp - 9;
  return { y: yoe + era * 400 + (m <= 2 ? 1 : 0), m, d };
}

const ISO = /^(\d{4})-(\d{2})-(\d{2})$/;
export function dayOf(iso) {
  const p = ISO.exec(iso);
  if (!p) throw new Error('Not a date: ' + iso);
  const y = +p[1], m = +p[2], d = +p[3];
  if (m < 1 || m > 12 || d < 1 || d > daysInMonth(y, m)) throw new Error('Not a date: ' + iso);
  return dayFromYmd(y, m, d);
}
export function isoOf(day) { const { y, m, d } = ymdFromDay(day); return pad(y, 4) + '-' + pad(m) + '-' + pad(d); }
export const ymd = (y, m, d) => pad(y, 4) + '-' + pad(m) + '-' + pad(d);
export const addDays = (iso, n) => isoOf(dayOf(iso) + n);
export const daysBetween = (a, b) => dayOf(b) - dayOf(a);   // b minus a

/** Today's date on this phone, in local time. */
export function today(now = new Date()) { return ymd(now.getFullYear(), now.getMonth() + 1, now.getDate()); }

/* ---------- The real calendar (the default view) ---------- */
export const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
export const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
export const isLeap = y => (y % 4 === 0 && y % 100 !== 0) || y % 400 === 0;
export const daysInMonth = (y, m) => [31, isLeap(y) ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31][m - 1];
/** 0 = Monday â€¦ 6 = Sunday. 1970-01-01 was a Thursday. */
export const weekday = iso => mod(dayOf(iso) + 3, 7);

/** Dam Day: the last day of the real calendar month. */
export const damDay = (y, m) => ymd(y, m, daysInMonth(y, m));
export function isDamDay(iso) { const [y, m, d] = iso.split('-').map(Number); return d === daysInMonth(y, m); }

/** The Monday-to-Sunday week a date sits in. */
export function weekOf(iso) {
  const start = addDays(iso, -weekday(iso));
  return { start, end: addDays(start, 6), days: Array.from({ length: 7 }, (_, i) => addDays(start, i)) };
}
/** Every week that touches a calendar month, for a week-by-week view of it. */
export function weeksOfMonth(y, m) {
  const out = [];
  for (let w = weekOf(ymd(y, m, 1)); w.start <= damDay(y, m); w = weekOf(addDays(w.start, 7))) out.push(w);
  return out;
}

/** Everything about a date in the real calendar. */
export function calendar(iso) {
  const [y, m, d] = iso.split('-').map(Number), wd = weekday(iso);
  return { iso, year: y, month: m, day: d, weekday: wd, weekdayName: WEEKDAYS[wd], monthName: MONTHS[m - 1],
    daysInMonth: daysInMonth(y, m), damDay: damDay(y, m), isDamDay: d === daysInMonth(y, m), week: weekOf(iso) };
}

/* ---------- Paydays ----------
   Settings hold one known payday (a Monday); paydays repeat every 14 days from it, both ways.
   Sample: { payday: '2026-10-12' }. The real one comes from setup on the phone, never the code. */
export const PAY_EVERY = 14;
export function checkSettings(s) {
  if (!s || !ISO.test(s.payday || '')) return 'Settings need a payday, like 2026-10-12.';
  dayOf(s.payday);
  if (weekday(s.payday) !== 0) return 'The payday has to be a Monday.';
  return null;
}
function anchor(s) { const e = checkSettings(s); if (e) throw new Error(e); return dayOf(s.payday); }

export const isPayday = (iso, s) => mod(dayOf(iso) - anchor(s), PAY_EVERY) === 0;
/** The payday on or before a date. */
export const paydayOnOrBefore = (iso, s) => isoOf(dayOf(iso) - mod(dayOf(iso) - anchor(s), PAY_EVERY));
/** The next payday after a date (not counting the date itself). */
export const nextPayday = (iso, s) => addDays(paydayOnOrBefore(iso, s), PAY_EVERY);
/** The paydays that land in a real calendar month. Usually 2, sometimes 3. */
export function paydaysInMonth(y, m, s) {
  const out = [], end = damDay(y, m);
  for (let p = paydayOnOrBefore(ymd(y, m, 1), s); p <= end; p = addDays(p, PAY_EVERY)) if (p >= ymd(y, m, 1)) out.push(p);
  return out;
}

/* ---------- The Seb calendar ----------
   A Seb year starts on the payday Monday nearest Jan 1. If two are equally near (7 days each
   side, first in 2035), the earlier one wins. A Seb month is 28 days, so it holds exactly two
   paydays. 13 months is 364 days, a day or two short of a real year, so every few decades a year
   runs 378 days instead; its last 14 days are a short month 14. */
export const SEB_MONTH = 28;
export function sebYearStart(year, s) {
  const jan1 = dayOf(ymd(year, 1, 1)), r = mod(jan1 - anchor(s), PAY_EVERY);
  return isoOf(r <= PAY_EVERY - r ? jan1 - r : jan1 + (PAY_EVERY - r));
}
/** Where a date sits in the Seb calendar. */
export function seb(iso, s) {
  let year = +iso.slice(0, 4);
  if (iso < sebYearStart(year, s)) year--;
  else if (iso >= sebYearStart(year + 1, s)) year++;
  const start = sebYearStart(year, s), yearLength = daysBetween(start, sebYearStart(year + 1, s));
  const i = daysBetween(start, iso), month = Math.floor(i / SEB_MONTH) + 1;
  const monthStart = addDays(start, (month - 1) * SEB_MONTH);
  return { iso, year, month, day: i - (month - 1) * SEB_MONTH + 1, dayOfYear: i + 1, yearStart: start, yearLength,
    monthStart, monthLength: Math.min(SEB_MONTH, yearLength - (month - 1) * SEB_MONTH), payday: isPayday(iso, s) };
}

/** The whole picture for a date. The real calendar comes first; Seb is there when settings are. */
export function describe(iso, s) {
  return { ...calendar(iso), payday: s ? isPayday(iso, s) : null, seb: s ? seb(iso, s) : null };
}
