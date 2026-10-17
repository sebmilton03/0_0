// The sky behind every screen follows the real sun, worked out offline.
// Sun math is the standard low-precision solar model (the one SunCalc uses): good to a minute or two.
// Times come back as real moments (milliseconds); the screens show them in local time.
// With no place set, the sky uses a plain 7:00 sunrise and 18:30 sunset.

const RAD = Math.PI / 180, DAY = 864e5, J1970 = 2440588, J2000 = 2451545, OBLIQ = RAD * 23.4397;
const toDays = ms => ms / DAY - 0.5 + J1970 - J2000;
const fromJulian = j => (j + 0.5 - J1970) * DAY;
const declination = l => Math.asin(Math.sin(OBLIQ) * Math.sin(l));
const rightAscension = l => Math.atan2(Math.sin(l) * Math.cos(OBLIQ), Math.cos(l));
const meanAnomaly = d => RAD * (357.5291 + 0.98560028 * d);
function eclipticLongitude(M) {
  const C = RAD * (1.9148 * Math.sin(M) + 0.02 * Math.sin(2 * M) + 0.0003 * Math.sin(3 * M));
  return M + C + RAD * 102.9372 + Math.PI;
}

/** The sun's height above the horizon, in degrees, at a moment and place. */
export function sunAltitude(ms, lat, lon) {
  const d = toDays(ms), L = eclipticLongitude(meanAnomaly(d)), phi = RAD * lat;
  const H = RAD * (280.16 + 360.9856235 * d) + RAD * lon - rightAscension(L), dec = declination(L);
  return Math.asin(Math.sin(phi) * Math.sin(dec) + Math.cos(phi) * Math.cos(dec) * Math.cos(H)) / RAD;
}

/**
 * Sunrise, noon and sunset for a local date ('YYYY-MM-DD') at a place.
 * Returns moments in ms, or null for rise/set on days the sun never crosses the horizon.
 */
export function sunTimes(iso, lat, lon) {
  const [y, m, dd] = iso.split('-').map(Number);
  const lw = -RAD * lon, phi = RAD * lat, J0 = 0.0009;
  const d = toDays(new Date(y, m - 1, dd, 12).getTime());
  const n = Math.round(d - J0 - lw / (2 * Math.PI));
  const ds = J0 + lw / (2 * Math.PI) + n, M = meanAnomaly(ds), L = eclipticLongitude(M), dec = declination(L);
  const transit = a => J2000 + a + 0.0053 * Math.sin(M) - 0.0069 * Math.sin(2 * L);
  const noon = transit(ds);
  const cosW = (Math.sin(-0.833 * RAD) - Math.sin(phi) * Math.sin(dec)) / (Math.cos(phi) * Math.cos(dec));
  if (cosW < -1 || cosW > 1) return { rise: null, noon: fromJulian(noon), set: null };
  const set = transit(J0 + (Math.acos(cosW) + lw) / (2 * Math.PI) + n);
  return { rise: fromJulian(noon - (set - noon)), noon: fromJulian(noon), set: fromJulian(set) };
}

/* ---------- The sky's colours ----------
   Keyed by the sun's height. Mornings run indigo to peach, days are blue, evenings dusk into violet,
   nights are deep navy with stars. After wind-down the whole thing turns warm and dim instead. */
const MORNING = [   // [sun altitude, top, bottom]
  [-18, '#0b0d1f', '#171a36'], [-6, '#1c1f4d', '#5b4a7a'], [0, '#2a2f6b', '#c98a78'],
  [8, '#33417f', '#e8a87e'], [20, '#2d5394', '#8fb0d8'], [40, '#24589e', '#6d97cf'],
];
const EVENING = [
  [-18, '#0b0d1f', '#171a36'], [-6, '#16183f', '#3d2f5e'], [0, '#22265a', '#a0627a'],
  [8, '#2b3a78', '#d89a78'], [20, '#2d5394', '#8fb0d8'], [40, '#24589e', '#6d97cf'],
];
const WIND_DOWN = { top: '#120c08', bottom: '#2a1a10', stars: false, phase: 'winddown' };

const hex = h => [1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16));
const mix = (a, b, t) => '#' + hex(a).map((v, i) => Math.round(v + (hex(b)[i] - v) * t).toString(16).padStart(2, '0')).join('');
function blend(stops, alt) {
  if (alt <= stops[0][0]) return { top: stops[0][1], bottom: stops[0][2] };
  for (let i = 1; i < stops.length; i++) {
    const [a1, t1, b1] = stops[i - 1], [a2, t2, b2] = stops[i];
    if (alt <= a2) { const t = (alt - a1) / (a2 - a1); return { top: mix(t1, t2, t), bottom: mix(b1, b2, t) }; }
  }
  const last = stops[stops.length - 1];
  return { top: last[1], bottom: last[2] };
}

/** A pretend sun for when no place is set: up at 7:00, down at 18:30, 45° at its highest. */
function plainAltitude(now) {
  const h = now.getHours() + now.getMinutes() / 60, rise = 7, set = 18.5;
  return Math.sin(((h - rise) / (set - rise)) * Math.PI) * 45;   // below zero before sunrise and after sunset
}

/**
 * The sky for a moment. place = { lat, lon } or null. windDown = true after wind-down time.
 * Returns { top, bottom, stars, phase, altitude }.
 */
export function sky(now = new Date(), place = null, windDown = false) {
  if (windDown) return { ...WIND_DOWN, altitude: null };
  const alt = place ? sunAltitude(now.getTime(), place.lat, place.lon) : plainAltitude(now);
  const morning = now.getHours() < 12, c = blend(morning ? MORNING : EVENING, alt);
  const phase = alt < -6 ? 'night' : alt < 8 ? (morning ? 'dawn' : 'dusk') : 'day';
  return { ...c, stars: alt < -4, phase, altitude: alt };
}
