// Habits, one at a time. A habit has steps ("phone outside the bedroom, 14 nights"), and you move to
// the next step when you say you've reached it. Misses do nothing: no streaks, nothing resets.
// A day counts when its line was ticked (in Grow, or in Day's chain: they're the same line).
// Pure: state in, plain words and numbers out.

export const item = id => 'h:' + id;

/** A preset, not a person: the sleep habit from the plan. Its words can be changed on the phone. */
export const SLEEP_PRESET = {
  name: 'Sleep', cue: 'wind', why: 'Rested days make pulls weaker and study easier.',
  steps: [{ text: 'Phone charges outside the bedroom', n: 14 }, { text: 'Lights out by 11:30', n: 21 }, { text: '8 hours most nights', n: 30 }],
};
export const MORNING_PRESET = { name: 'Good morning', cue: 'morning', why: 'A small first thing, every day.', steps: [{ text: 'Write “good morning” in the notebook', n: 14 }, { text: 'Good morning, plus one line', n: 21 }] };

/** The dates a habit was done, oldest first. */
export function doneDates(s, id) {
  const k = item(id);
  return Object.keys(s.cues || {}).filter(d => s.cues[d][k]).sort();
}

/** Where a habit stands today: its step, how many days counted toward it, and whether it's reached. */
export function progress(s, h, date) {
  const step = h.steps[Math.min(h.step || 0, h.steps.length - 1)] || { text: h.name, n: 0 };
  const count = doneDates(s, h.id).filter(d => d >= (h.stepFrom || '0000') && d <= date).length;
  return { step, index: h.step || 0, of: h.steps.length, count, n: step.n, reached: step.n > 0 && count >= step.n,
    doneToday: !!((s.cues || {})[date] || {})[item(h.id)], last: (h.step || 0) >= h.steps.length - 1,
    next: h.steps[(h.step || 0) + 1] || null };
}

export const habits = s => Object.values(s.habits || {});
export const focusOf = s => habits(s).find(h => h.status === 'focus') || null;
export const byStatus = (s, st) => habits(s).filter(h => h.status === st);

/** The line a habit adds to Day's chain: { id, text, right } (tonight's one thing). */
export function cueLine(s, h, date) {
  const p = progress(s, h, date);
  return { id: h.id, text: p.step.text, right: p.n ? p.count + ' of ' + p.n : '' };
}
