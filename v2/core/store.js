// The current state is never saved. It's rebuilt by replaying the log from the first event,
// so it can't drift from what actually happened.
//
// Each app brings reducers: one small function per kind, (state, data, event) => new state.
// Kinds with no reducer are skipped (still kept in the log).
//
// Month checkpoints: at the end of a real calendar month, save a fingerprint of the state as it
// stood then (a short summary plus a hash). Later, rebuild that month from the log and check the
// hash still matches. If it doesn't, something in the log or the code changed the past.
// Checkpoints are written into the log too, as 'checkpoint' events, so backups carry them.

import { HIDDEN, CORRECTION, CHECKPOINT, canonical } from './log.js';

const META = new Set([HIDDEN, CORRECTION, CHECKPOINT]);
const byId = (a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0);
/** 'YYYY-MM' of an event, from its local time. */
export const monthOf = e => e.at.slice(0, 7);

/**
 * Work out what each event means after hides and corrections.
 * Returns the ordinary events still showing, oldest first, each with the data replay should use.
 */
export function effective(events) {
  const sorted = [...events].sort(byId), hiddenBy = new Set(), showing = new Set();
  // Newest first: a hide only ever points back in time, so by the time we reach an event,
  // every hide that could cover it has been decided.
  for (let i = sorted.length - 1; i >= 0; i--) {
    const e = sorted[i];
    if (hiddenBy.has(e.id)) continue;
    showing.add(e.id);
    if (e.kind === HIDDEN) hiddenBy.add(e.data.target);
  }
  const fixes = new Map();   // target id -> latest showing correction's data
  for (const e of sorted) if (e.kind === CORRECTION && showing.has(e.id)) fixes.set(e.data.target, e.data.data);
  return sorted.filter(e => !META.has(e.kind) && showing.has(e.id))
    .map(e => (fixes.has(e.id) ? { ...e, data: fixes.get(e.id), corrected: true } : e));
}

/** Replay events into a state. Same events in, same state out, every time. */
export function replay(events, reducers, init = {}) {
  let state = JSON.parse(JSON.stringify(init));
  for (const e of effective(events)) {
    const fn = reducers[e.kind];
    if (fn) { const next = fn(state, JSON.parse(JSON.stringify(e.data)), e); if (next !== undefined) state = next; }
  }
  return state;
}

/** SHA-256 of a value's canonical JSON, as hex. */
export async function hash(value) {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(canonical(value)));
  return Array.from(new Uint8Array(buf), b => b.toString(16).padStart(2, '0')).join('');
}

/** The events written in a month or before it. */
export const upTo = (events, month) => events.filter(e => monthOf(e) <= month);

/** A checkpoint for the end of a month: { month, count, lastId, summary, hash }. */
export async function makeCheckpoint(events, month, { reducers, init = {}, summarize = () => null }) {
  const upto = upTo(events, month).filter(e => e.kind !== CHECKPOINT).sort(byId);
  const state = replay(upto, reducers, init);
  return { month, count: upto.length, lastId: upto.length ? upto[upto.length - 1].id : null, summary: summarize(state), hash: await hash(state) };
}

/** Rebuild a checkpoint's month from the events and compare. */
export async function verifyCheckpoint(events, cp, app) {
  const again = await makeCheckpoint(events, cp.month, app);
  return { ok: again.hash === cp.hash, want: cp.hash, got: again.hash, count: again.count };
}

/**
 * The store for one log. `app` = { reducers, init, summarize }.
 */
export function createStore(log, app) {
  return {
    async state() { return replay(await log.all(), app.reducers, app.init); },
    /** Save a checkpoint for a finished month, as an event in the log. */
    async checkpoint(month, source = 'store') { return log.append(CHECKPOINT, await makeCheckpoint(await log.all(), month, app), source); },
    /** Check the latest checkpoint for a month. Returns null if there isn't one. */
    async verify(month) {
      const events = await log.all();
      const cp = events.filter(e => e.kind === CHECKPOINT && e.data.month === month).sort(byId).pop();
      return cp ? verifyCheckpoint(events, cp.data, app) : null;
    },
  };
}
