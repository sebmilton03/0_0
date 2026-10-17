// What v2 remembers, rebuilt from the log. One small function per kind of event.
// Undo is never handled here: the log hides the event and replay simply skips it.

export const APP = {
  init: { settings: {}, places: [], tabs: [], ticks: {}, checkins: {}, sleep: {}, days: {}, sayings: [], archived: null,
    blocks: {}, once: [], skips: [], cues: {}, parked: [] },
  reducers: {
    // { name, wake, windDown, payday, place: { lat, lon, label }, words }
    settings: (s, d) => ({ ...s, settings: { ...s.settings, ...d } }),
    'place.add': (s, d) => (s.places.includes(d.key) ? s : { ...s, places: [...s.places, d.key] }),
    'place.remove': (s, d) => ({ ...s, places: s.places.filter(k => k !== d.key) }),
    // The bottom bar: day, money, grow, study join it one at a time.
    'tab.add': (s, d) => (s.tabs.includes(d.key) ? s : { ...s, tabs: [...s.tabs, d.key] }),
    'tab.remove': (s, d) => ({ ...s, tabs: s.tabs.filter(k => k !== d.key) }),
    // A weekly tick (home reset, meal prep) on a date.
    tick: (s, d) => ({ ...s, ticks: { ...s.ticks, [d.pillar]: [...(s.ticks[d.pillar] || []), d.date] } }),
    // An answer to a weekly question (People: 'yes' or 'no').
    checkin: (s, d) => ({ ...s, checkins: { ...s.checkins, [d.pillar]: [...(s.checkins[d.pillar] || []), { date: d.date, answer: d.answer }] } }),
    sleep: (s, d) => ({ ...s, sleep: { ...s.sleep, [d.date]: d.how } }),
    gratitude: (s, d) => ({ ...s, days: { ...s.days, [d.date]: { ...s.days[d.date], grateful: d.text } } }),
    'day.done': (s, d) => ({ ...s, days: { ...s.days, [d.date]: { ...s.days[d.date], done: true } } }),
    // Your own sayings, brought in from your file or typed. { text, kind: 'mantra' | 'advice' | 'saying' }
    'saying.add': (s, d, e) => (s.sayings.some(x => x.text === d.text) ? s : { ...s, sayings: [...s.sayings, { id: e.id, text: d.text, kind: d.kind || 'saying' }] }),
    // Day: your blocks. Weekly: { id, kind, label, days: [0-6], from: 'HH:MM', to: 'HH:MM' }. A change is a new block.set.
    'block.set': (s, d) => ({ ...s, blocks: { ...s.blocks, [d.id]: d } }),
    'block.remove': (s, d) => { const b = { ...s.blocks }; delete b[d.id]; return { ...s, blocks: b, once: s.once.filter(x => x.id !== d.id) }; },
    // Just this week: { id, kind, label, date, from, to }. And dropping one day of a weekly block: { id, date }.
    'block.once': (s, d) => ({ ...s, once: [...s.once.filter(x => x.id !== d.id), d] }),
    'block.skip': (s, d) => ({ ...s, skips: [...s.skips, { id: d.id, date: d.date }] }),
    // A line in today's chain, ticked or unticked: { date, item, done }.
    cue: (s, d) => ({ ...s, cues: { ...s.cues, [d.date]: { ...s.cues[d.date], [d.item]: !!d.done } } }),
    // Park it: { text, until: 'sunday' | 'monday' | 'free' | 'damday' | 'YYYY-MM-DD', on: date }. Done: { id }.
    park: (s, d, e) => ({ ...s, parked: [...s.parked, { id: e.id, text: d.text, until: d.until, on: d.on }] }),
    'park.done': (s, d) => ({ ...s, parked: s.parked.map(p => (p.id === d.id ? { ...p, done: true } : p)) }),
    // A copy of what the v1 apps had saved, taken once, quietly. Kept so nothing is lost; places bring in what they need.
    'v1-archive': (s, d, e) => ({ ...s, archived: { at: e.at, id: e.id, keys: Object.keys(d.keys || {}) } }),
  },
  summarize: s => ({ places: s.places.length, days: Object.keys(s.days).length, sleep: Object.keys(s.sleep).length }),
};

/** The keys the v1 apps keep in this site's storage. Read once, for the archive; never again. */
export const V1_KEYS = ['0_0-money-v1', '0_0-valley-v1', '0_0-study-v1', 'plus-one-v1', 'plus-one-trackers-v1',
  '0_0-line-valley', '0_0-line-study', 'plus-one-line'];

/**
 * Read a sayings file (markdown: '## Heading' then '- line' items). Returns [{ text, kind }].
 * Sections named like "Build note" are skipped. Runs on the phone; the file never enters the repo.
 */
export function parseSayings(md) {
  const out = []; let kind = 'saying', skip = false;
  for (const raw of String(md).split(/\r?\n/)) {
    const line = raw.trim(), h = /^#{1,6}\s+(.*)$/.exec(line);
    if (h) { const t = h[1].toLowerCase(); skip = /note|build/.test(t); kind = /mantra/.test(t) ? 'mantra' : /advice/.test(t) ? 'advice' : 'saying'; continue; }
    const li = /^[-*]\s+(.+)$/.exec(line);
    if (li && !skip) out.push({ text: li[1].trim(), kind });
  }
  return out;
}
