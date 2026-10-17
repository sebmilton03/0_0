// The sky behind every screen follows the real sun, worked out offline.
// Sun math is the standard low-precision solar model (the one SunCalc uses): good to a minute or two.
// The sky itself is one of calm.html's skies, picked by the sun's height: dawn, day, dusk or night.
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

/** calm.html's skies. `top` is the status-bar colour. */
export const SKIES = {
  dawn: { top: '#0e1430', stars: [28, 330] },
  day: { top: '#14234a', stars: null },
  dusk: { top: '#120f2a', stars: [16, 200] },
  night: { top: '#090b1a', stars: [70, 844] },
  golden: { top: '#141a44', stars: [18, 260] },
  tide: { top: '#0e1430', stars: null },
  winddown: { top: '#0d0906', stars: null },
};

/** A pretend sun for when no place is set: up at 7:00, down at 18:30, 45° at its highest. */
function plainAltitude(now) {
  const h = now.getHours() + now.getMinutes() / 60, rise = 7, set = 18.5;
  return Math.sin(((h - rise) / (set - rise)) * Math.PI) * 45;   // below zero before sunrise and after sunset
}

/**
 * The sky for a moment. place = { lat, lon } or null. windDown = true after wind-down time.
 * Returns { phase, top, stars, altitude }: phase is 'dawn', 'day', 'dusk', 'night' or 'winddown'.
 */
export function sky(now = new Date(), place = null, windDown = false) {
  if (windDown) return { phase: 'winddown', ...SKIES.winddown, altitude: null };
  const alt = place ? sunAltitude(now.getTime(), place.lat, place.lon) : plainAltitude(now);
  const phase = alt < -6 ? 'night' : alt < 12 ? (now.getHours() < 12 ? 'dawn' : 'dusk') : 'day';
  return { phase, ...SKIES[phase], altitude: alt };
}
