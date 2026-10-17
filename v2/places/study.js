// Study: a target that fits the week, a timer, blocks from the calendar with an honest heads-up,
// and the list (a thing can hold things, as deep as it goes). Overdue goes amber, never red.

import { esc, openSheet, closeSheet, toast, hrs } from '../ui.js';
import { FITS_NOW, S, week, runningMins, children, counts, isDone, classOf, dueState } from '../engines/study.js';
import { span } from '../engines/week.js';
import { weekday } from '../engines/sebdate.js';
import { blockSheet } from './day.js';

const DOW = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'], DAYN = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
let open = null;   // the list item you're inside (null = the top)

export function render(ctx) {
  const { state: s, m } = ctx, st = S(s), w = week(s, m.day), now = m.now.getTime(), run = runningMins(st, now);
  const top = `<div class="top"><span><b>Study</b></span><span>this week</span></div>`;
  if (!w.target) {
    const has = ctx.state.archived && ctx.state.archived.keys.includes('0_0-study-v1') && !st.imported;
    return { sky: m.sky, html: top + `<div class="say" style="font-size:28px;margin-top:22px">A target that fits.</div>` +
      `<p class="fine" style="margin-top:6px">With four shifts, about ${FITS_NOW} hours a week fits and still leaves a real free day. Twenty fits once a shift frees up. You can change it any week.</p>` +
      `<button class="done" data-act="setTarget" data-v="${FITS_NOW}" style="margin-top:20px;background:linear-gradient(180deg,#b9a8ff,#8a7ae0);color:#1a1240;border:0">${FITS_NOW} hours a week</button>` +
      `<div class="opts" style="justify-content:center">${[8, 10, 15, 20].map(h => `<button class="opt" data-act="setTarget" data-v="${h}">${h}</button>`).join('')}</div>` +
      (has ? `<button class="calm" data-act="fromStudy" style="margin-top:18px"><i>↧</i>Bring in your hours and list from the old Study</button>` : '') };
  }
  const pct = Math.min(100, w.hours / w.target * 100), planPct = Math.min(100 - pct, Math.max(0, (w.planned - w.blocks.filter(b => b.done).reduce((t, b) => t + b.hours, 0)) / w.target * 100));
  const tasks = st.tasks || [];
  const list = children(tasks, open).sort((a, b) => (isDone(tasks, a) - isDone(tasks, b)) || ((a.due || '9') < (b.due || '9') ? -1 : 1));
  const crumb = open ? tasks.find(t => t.id === open) : null;
  return { sky: m.sky, html: top +
    `<div class="say" style="font-size:28px;margin-top:22px">${w.done ? 'The week is done.' : hrs(w.hours) + ' of ' + w.target + ' hours.'}</div>` +
    `<div style="position:relative;height:14px;border-radius:7px;background:rgba(255,255,255,.08);margin-top:16px"><i style="position:absolute;left:0;top:0;bottom:0;width:${pct}%;border-radius:7px;background:#b9a8ff"></i>` +
    (planPct > 0 ? `<i style="position:absolute;left:${pct}%;top:2px;bottom:2px;width:${planPct}%;border-radius:5px;border:1.5px dashed #b9a8ff"></i>` : '') + `</div>` +
    (st.running ? `<button class="done" data-act="stopTimer" style="margin-top:16px;background:linear-gradient(180deg,#b9a8ff,#8a7ae0);color:#1a1240;border:0">Studying · ${Math.floor(run / 60)}:${String(run % 60).padStart(2, '0')} · stop</button>`
      : w.done ? '' : `<button class="done" data-act="startTimer" style="margin-top:16px">Start studying</button>`) +
    `<p class="fine center" style="margin-top:8px"><button class="link" data-act="addTime">+ add time by hand</button> · <button class="link" data-act="target">${w.target} hr target</button></p>` +
    (!w.done && w.unplanned > 0.5 ? `<div class="next" style="margin-top:16px;background:rgba(255,213,154,.08);border-color:rgba(255,213,154,.3)"><small style="color:#ffd59a">Gentle heads-up</small><b style="font-size:16px">${hrs(w.unplanned)} hours aren’t on the calendar.</b><p>${w.openDay ? DAYN[weekday(w.openDay)] + ' is wide open. Want to place a block?' : 'Want to place a block?'}</p><div class="opts"><button class="opt" data-act="placeBlock" data-d="${w.openDay ? weekday(w.openDay) : ''}">place a block</button></div></div>` : '') +
    (w.blocks.length ? `<div class="lbl">Blocks · from the calendar</div>` + w.blocks.map(b => `<div class="pk"><div class="d">${esc(b.label || 'Study')}<br><span class="fine" style="font-size:12px">${DOW[weekday(b.date)]} · ${span(b)} · ${hrs(b.hours)} hr</span></div><span class="w">${b.done ? 'done' : b.past ? 'missed, that’s okay' : b.date === m.day ? 'today' : 'next'}</span></div>`).join('') : '') +
    `<div class="lbl">${crumb ? `<button data-act="up" class="link" style="letter-spacing:0">‹ back</button> · ${esc(crumb.title)}` : 'The list'}</div>` +
    (list.length ? list.map(t => row(tasks, t, m.day)).join('') : `<div class="empty" style="margin-top:0">Nothing here yet. That’s a fine place to start.</div>`) +
    `<p class="fine center" style="margin-top:10px"><button class="link" data-act="addTask">+ add ${crumb ? 'inside ' + esc(crumb.title) : 'a thing'}</button></p>` };
}

function row(tasks, t, day) {
  const c = counts(tasks, t.id), done = isDone(tasks, t), due = dueState(t, day), cls = classOf(tasks, t);
  const tag = due === 'overdue' ? `<span class="w" style="background:rgba(255,213,154,.15);color:#ffd59a">overdue</span>` : due === 'today' ? `<span class="w">today</span>` : t.due ? `<span class="w" style="background:none;color:rgba(255,255,255,.45)">${esc(t.due.slice(5).replace('-', '/'))}</span>` : '';
  return `<div class="pk" style="align-items:center;${done ? 'opacity:.5' : ''}"><button data-act="tickTask" data-id="${t.id}" data-done="${done ? 1 : 0}" aria-label="tick" style="font-size:18px;width:26px">${done ? '●' : '○'}</button>` +
    `<button class="d" data-act="openTask" data-id="${t.id}" style="text-align:left">${esc(t.title)}${cls ? `<br><span class="fine" style="font-size:12px">${esc(cls)}${c ? ' · ' + c.done + ' of ' + c.of : ''}</span>` : c ? `<br><span class="fine" style="font-size:12px">${c.done} of ${c.of}</span>` : ''}</button>${tag}</div>`;
}

/* ---------- Sheets ---------- */
function taskSheet(ctx, id) {
  const tasks = S(ctx.state).tasks, t = tasks.find(x => x.id === id) || { title: '', cls: '', due: '', doOn: '', pri: '' };
  openSheet(`<div class="lbl">${id ? 'Edit' : open ? 'Add inside ' + esc(tasks.find(x => x.id === open)?.title || '') : 'Add a thing'}</div><input class="field serif" id="ttitle" value="${esc(t.title)}" placeholder="Final study, Chapter 4, problems 1–20…" style="font-size:20px">` +
    `<div class="grid2"><div><div class="lbl">Class</div><input class="field" id="tcls" value="${esc(t.cls)}" placeholder="${esc(open ? classOf(tasks, tasks.find(x => x.id === open)) || 'carries down' : 'e.g. Chem')}"></div><div><div class="lbl">Priority</div><select class="field" id="tpri">${['', 'high', 'low'].map(p => `<option${t.pri === p ? ' selected' : ''}>${p}</option>`).join('')}</select></div></div>` +
    `<div class="grid2"><div><div class="lbl">Due</div><input class="field" type="date" id="tdue" value="${esc(t.due)}"></div><div><div class="lbl">Do it on</div><input class="field" type="date" id="tdo" value="${esc(t.doOn)}"></div></div>` +
    `<button class="pbtn" style="margin-top:16px" data-act="saveTask" data-id="${esc(id || '')}">Keep it</button>` +
    (id ? `<p class="fine center" style="margin-top:12px"><button data-act="dropTask" data-id="${esc(id)}">remove it (and what’s inside)</button></p>` : ''));
}
function timeSheet(ctx) {
  openSheet(`<div class="lbl">Add time by hand</div><div class="say">Forgot to start the timer?</div>` +
    `<div class="opts">${[15, 30, 45, 60, 90].map(n => `<button class="opt" data-act="addMins" data-v="${n}">+${n} min</button>`).join('')}<button class="opt" data-act="addMins" data-v="-15">−15 min</button></div>` +
    `<p class="fine" style="margin-top:10px">It goes on today.</p>`);
}
function targetSheet(ctx) {
  const w = week(ctx.state, ctx.m.day);
  openSheet(`<div class="lbl">Weekly target</div><div class="say">${w.target} hours a week.</div><p class="fine" style="margin-top:6px">About ${FITS_NOW} fits with four shifts; 20 fits once a shift frees up.</p>` +
    `<div class="opts">${[8, 10, 12, 15, 20].map(h => `<button class="opt${h === w.target ? ' on' : ''}" data-act="setTarget" data-v="${h}">${h} hr</button>`).join('')}</div>`);
}

/* ---------- Taps ---------- */
const newId = () => 't' + Date.now().toString(36);
export const actions = {
  setTarget: async (ctx, el) => { closeSheet(); await ctx.write('study.target', { hours: +el.dataset.v }, el.dataset.v + ' hours a week', 'tick'); },
  target: ctx => targetSheet(ctx),
  startTimer: async ctx => { await ctx.write('study.start', { at: ctx.m.now.getTime() }, null, 'tick'); },
  stopTimer: async ctx => {
    const st = S(ctx.state), raw = Math.round((ctx.m.now.getTime() - st.running) / 60000), mins = runningMins(st, ctx.m.now.getTime());
    await ctx.write('study.stop', { date: ctx.m.day, mins }, raw > mins ? 'Capped at 8 hours (it was probably left running)' : mins + ' minutes, kept', 'tick');
  },
  addTime: ctx => timeSheet(ctx),
  addMins: async (ctx, el) => { closeSheet(); await ctx.write('study.add', { date: ctx.m.day, mins: +el.dataset.v }, (+el.dataset.v > 0 ? '+' : '') + el.dataset.v + ' minutes'); },
  placeBlock: (ctx, el) => blockSheet(ctx, null, { kind: 'study', days: el.dataset.d === '' ? [] : [+el.dataset.d], from: '13:00', to: '16:00' }),
  addTask: ctx => taskSheet(ctx, null),
  openTask: (ctx, el) => { const tasks = S(ctx.state).tasks; if (children(tasks, el.dataset.id).length) { open = el.dataset.id; ctx.render(); } else taskSheet(ctx, el.dataset.id); },
  up: ctx => { const t = S(ctx.state).tasks.find(x => x.id === open); open = t ? t.parent || null : null; ctx.render(); },
  tickTask: async (ctx, el) => { const done = el.dataset.done !== '1'; await ctx.write('task.done', { id: el.dataset.id, done }, done ? 'Ticked' : null, done ? 'tick' : null); },
  saveTask: async (ctx, el) => {
    const title = document.getElementById('ttitle').value.trim(); if (!title) return toast('Name it first.');
    const set = { title, cls: document.getElementById('tcls').value.trim(), pri: document.getElementById('tpri').value, due: document.getElementById('tdue').value, doOn: document.getElementById('tdo').value };
    closeSheet();
    if (el.dataset.id) await ctx.write('task.edit', { id: el.dataset.id, set }, 'Kept');
    else await ctx.write('task.add', { id: newId(), parent: open, ...set }, 'Added', 'tick');
  },
  dropTask: async (ctx, el) => { closeSheet(); await ctx.write('task.remove', { id: el.dataset.id }, 'Removed'); },
  fromStudy: async ctx => {
    const arc = (await ctx.log.all()).filter(e => e.kind === 'v1-archive').pop();
    let v; try { v = JSON.parse(arc.data.keys['0_0-study-v1']); } catch {}
    if (!v) return toast('Couldn’t read the old Study.');
    await ctx.write('study.import', { days: v.days || {}, tasks: (v.tasks || []).map(t => ({ id: t.id, title: t.title, cls: t.cls || '', due: t.due || '', doOn: t.doOn || '', pri: t.pri || '', parent: t.parent || null, done: !!t.done })) }, 'Brought in from Study', 'tick');
  },
};
