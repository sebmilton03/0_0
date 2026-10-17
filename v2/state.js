// What v2 remembers, rebuilt from the log. One small function per kind of event.
// Undo is never handled here: the log hides the event and replay simply skips it.

export const APP = {
  init: { settings: {}, places: [], ticks: {}, sleep: {}, days: {}, sayings: [], archived: null },
  reducers: {
    // { name, wake, windDown, payday, place: { lat, lon, label }, words }
    settings: (s, d) => ({ ...s, settings: { ...s.settings, ...d } }),
    'place.add': (s, d) => (s.places.includes(d.key) ? s : { ...s, places: [...s.places, d.key] }),
    'place.remove': (s, d) => ({ ...s, places: s.places.filter(k => k !== d.key) }),
    // A weekly tick (home reset, meal prep) on a date.
    tick: (s, d) => ({ ...s, ticks: { ...s.ticks, [d.pillar]: [...(s.ticks[d.pillar] || []), d.date] } }),
    sleep: (s, d) => ({ ...s, sleep: { ...s.sleep, [d.date]: d.how } }),
    gratitude: (s, d) => ({ ...s, days: { ...s.days, [d.date]: { ...s.days[d.date], grateful: d.text } } }),
    'day.done': (s, d) => ({ ...s, days: { ...s.days, [d.date]: { ...s.days[d.date], done: true } } }),
    'saying.add': (s, d, e) => ({ ...s, sayings: [...s.sayings, { id: e.id, text: d.text }] }),
    // A copy of what the v1 apps had saved, taken once, quietly. Nothing reads it yet; it's kept so nothing is lost.
    'v1-archive': (s, d, e) => ({ ...s, archived: { at: e.at, keys: Object.keys(d.keys || {}) } }),
  },
  summarize: s => ({ places: s.places.length, days: Object.keys(s.days).length, sleep: Object.keys(s.sleep).length }),
};

/** The keys the v1 apps keep in this site's storage. */
export const V1_KEYS = ['0_0-money-v1', '0_0-valley-v1', '0_0-study-v1', 'plus-one-v1', 'plus-one-trackers-v1',
  '0_0-line-valley', '0_0-line-study', 'plus-one-line'];
