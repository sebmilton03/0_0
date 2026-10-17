// Backups: the whole log as one JSON file.
//
// Import checks the entire file before writing anything, then merges by id: events already here
// are left alone, new ones are added. So importing the same file twice changes nothing, and
// importing an old backup can never undo newer work.

import { stamp, canonical, EPHEMERAL } from './log.js';
import { today } from '../engines/sebdate.js';

const AT = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}[+-]\d{2}:\d{2}$/;
const ID = /^[0-9a-z]{12,}$/;

/** The backup object: { app, kind, v, exported, count, events }. */
export async function exportLog(log, now = new Date()) {
  const events = await log.all();
  return { app: '0_0', kind: 'log', v: 1, exported: stamp(now), count: events.length, events };
}
/** Matches *backup*.json, which .gitignore keeps out of the public repo. */
export const backupName = (now = new Date()) => '0_0-backup-' + today(now) + '.json';

/** Save the backup as a file on the phone. */
export function download(backup, name = backupName()) {
  const url = URL.createObjectURL(new Blob([JSON.stringify(backup)], { type: 'application/json' }));
  const a = Object.assign(document.createElement('a'), { href: url, download: name });
  document.body.append(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/** Check a backup (object or JSON text). Returns { events } or { error } in plain words. */
export function check(file) {
  let b = file;
  if (typeof b === 'string') { try { b = JSON.parse(b); } catch { return { error: 'This file isn’t JSON.' }; } }
  if (!b || b.app !== '0_0' || b.kind !== 'log') return { error: 'This isn’t a 0_0 backup.' };
  if (b.v !== 1) return { error: 'This backup is from a newer version of 0_0.' };
  if (!Array.isArray(b.events)) return { error: 'This backup has no events in it.' };
  if (b.count !== b.events.length) return { error: 'This backup looks cut off: it says ' + b.count + ' events but has ' + b.events.length + '.' };
  const seen = new Map();
  for (const [i, e] of b.events.entries()) {
    const where = 'Event ' + (i + 1);
    if (!e || typeof e !== 'object') return { error: where + ' is empty.' };
    if (Object.keys(e).sort().join() !== 'at,data,id,kind,source') return { error: where + ' has the wrong fields.' };
    if (typeof e.id !== 'string' || !ID.test(e.id)) return { error: where + ' has a bad id.' };
    if (typeof e.at !== 'string' || !AT.test(e.at)) return { error: where + ' has a bad time.' };
    if (typeof e.kind !== 'string' || !e.kind) return { error: where + ' has no kind.' };
    if (EPHEMERAL.has(e.kind)) return { error: where + ' is a kind that’s never saved.' };
    if (typeof e.source !== 'string') return { error: where + ' has no source.' };
    if (e.data === undefined) return { error: where + ' has no data.' };
    if (seen.has(e.id) && seen.get(e.id) !== canonical(e)) return { error: 'Two different events share the id ' + e.id + '.' };
    seen.set(e.id, canonical(e));
  }
  return { events: b.events.filter((e, i, all) => all.findIndex(x => x.id === e.id) === i) };
}

/**
 * Merge a backup into the log. Returns { added, same, conflicts } as counts, or { error }.
 * A conflict is an id that's here with different contents; the one here is kept.
 */
export async function importLog(log, file) {
  const c = check(file);
  if (c.error) return { error: c.error };
  const r = await log.insert(c.events);
  return { added: r.added.length, same: r.same.length, conflicts: r.conflicts.length, conflictIds: r.conflicts };
}

/** Ask the browser not to clear this site's storage when space runs low. Backups are still the real safety net. */
export async function persist() {
  try { return navigator.storage && navigator.storage.persist ? await navigator.storage.persist() : false; } catch { return false; }
}
