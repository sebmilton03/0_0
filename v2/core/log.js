// The event log: everything that happens in 0_0, written once and never changed.
//
// An event is { id, at, kind, data, source }.
//   id      sorts in the order events were written (time first), so replay order is just id order
//   at      local time with its offset, e.g. 2026-10-16T14:03:22.120-05:00
//   kind    what happened ('shift', 'hidden', …)
//   data    the details, plain JSON
//   source  who wrote it ('money', 'import', …)
//
// Nothing is ever updated or deleted. Fixing something writes a new event:
//   correct(id, data)  a 'correction' event; replay uses its data instead of the original's
//   hide(id)           a 'hidden' event; replay skips the target
//   undo(id)           hides that event. Undoing a hide brings its target back; undoing a
//                      correction brings the old data back. So undo is just another event too.
// Ephemeral kinds (breathing, low-tide basics) are never written at all.
//
// It lives in IndexedDB under its own database name, so it can't touch the v1 apps' data.

export const DB_NAME = '0_0-v2-log';
const STORE = 'events';
export const HIDDEN = 'hidden', CORRECTION = 'correction', CHECKPOINT = 'checkpoint';
export const EPHEMERAL = new Set(['ephemeral', 'breathe', 'low-tide']);

const pad = (n, w = 2) => String(n).padStart(w, '0');
/** Local time with its offset from UTC, so the same moment can't be read two ways. */
export function stamp(d = new Date()) {
  const off = -d.getTimezoneOffset(), a = Math.abs(off);
  return pad(d.getFullYear(), 4) + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()) + 'T' + pad(d.getHours()) + ':' +
    pad(d.getMinutes()) + ':' + pad(d.getSeconds()) + '.' + pad(d.getMilliseconds(), 3) + (off < 0 ? '-' : '+') + pad(Math.floor(a / 60)) + ':' + pad(a % 60);
}

// Ids: milliseconds, then a counter for events in the same millisecond, then a random tail so two
// phones never make the same id. All base 36 and fixed width, so sorting the strings sorts by time.
let lastMs = 0, seq = 0;
export function newId(ms = Date.now()) {
  if (ms <= lastMs) { ms = lastMs; seq++; } else { lastMs = ms; seq = 0; }
  const tail = Array.from(crypto.getRandomValues(new Uint8Array(4)), b => (b % 36).toString(36)).join('');
  return ms.toString(36).padStart(9, '0') + seq.toString(36).padStart(3, '0') + tail;
}

/** Plain JSON with object keys in sorted order: the same value always gives the same text. */
export function canonical(v) {
  if (Array.isArray(v)) return '[' + v.map(canonical).join(',') + ']';
  if (v && typeof v === 'object') return '{' + Object.keys(v).sort().filter(k => v[k] !== undefined).map(k => JSON.stringify(k) + ':' + canonical(v[k])).join(',') + '}';
  return JSON.stringify(v === undefined ? null : v);
}
function freeze(v) { if (v && typeof v === 'object') { Object.values(v).forEach(freeze); Object.freeze(v); } return v; }
const req = r => new Promise((ok, no) => { r.onsuccess = () => ok(r.result); r.onerror = () => no(r.error); });
const done = tx => new Promise((ok, no) => { tx.oncomplete = () => ok(); tx.onerror = tx.onabort = () => no(tx.error); });

/**
 * Open the log. `now` lets tests set the clock; the app leaves it alone.
 * Returns an object with no way to change or remove an event: only add.
 */
export async function openLog(name = DB_NAME, { now = () => new Date() } = {}) {
  const open = indexedDB.open(name, 1);
  open.onupgradeneeded = () => open.result.createObjectStore(STORE, { keyPath: 'id' });
  const db = await req(open);

  async function write(e) {
    const tx = db.transaction(STORE, 'readwrite');
    tx.objectStore(STORE).add(e);   // add, never put: an id that's already there is an error, not an overwrite
    await done(tx);
    return freeze(e);
  }

  const log = {
    name,
    /** Write one event. Returns it, or null for an ephemeral kind (nothing written). */
    async append(kind, data = {}, source = 'app') {
      if (typeof kind !== 'string' || !kind) throw new Error('An event needs a kind.');
      if (EPHEMERAL.has(kind)) return null;
      const d = now();
      return write({ id: newId(d.getTime()), at: stamp(d), kind, data: JSON.parse(JSON.stringify(data)), source: String(source) });
    },
    async correct(id, data, source = 'app') { await need(id); return log.append(CORRECTION, { target: id, data }, source); },
    async hide(id, source = 'app') { await need(id); return log.append(HIDDEN, { target: id }, source); },
    undo(id, source = 'app') { return log.hide(id, source); },

    async get(id) { const tx = db.transaction(STORE); const e = await req(tx.objectStore(STORE).get(id)); return e ? freeze(e) : null; },
    /** Every event, oldest first. */
    async all() { const tx = db.transaction(STORE); return (await req(tx.objectStore(STORE).getAll())).map(freeze); },
    async count() { const tx = db.transaction(STORE); return req(tx.objectStore(STORE).count()); },

    /**
     * For backup import: add events that came from a file, keeping their ids. One transaction, so a
     * failure part-way writes nothing. An id that's already here is left alone: 'same' if it matches,
     * 'conflict' if it doesn't (the event here is kept, never overwritten).
     */
    async insert(events) {
      const tx = db.transaction(STORE, 'readwrite'), st = tx.objectStore(STORE), out = { added: [], same: [], conflicts: [] };
      for (const e of events) {
        const have = await req(st.get(e.id));
        if (!have) { st.add(e); out.added.push(e.id); }
        else (canonical(have) === canonical(e) ? out.same : out.conflicts).push(e.id);
      }
      await done(tx);
      return out;
    },
    close() { db.close(); },
  };
  async function need(id) { if (!(await log.get(id))) throw new Error('No event ' + id); }
  return log;
}

/** Remove a whole log database. Only the tests use this, on their own throwaway databases. */
export function dropLog(name) {
  if (name === DB_NAME) throw new Error('Refusing to remove the real log.');
  const r = indexedDB.deleteDatabase(name);
  return new Promise((ok, no) => {
    r.onsuccess = () => ok(); r.onerror = () => no(r.error);
    r.onblocked = () => no(new Error(name + ' is still open somewhere, so it can’t be removed.'));
  });
}
