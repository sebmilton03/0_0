// Grow: one focus habit at a time, a small companion that rides along, the back burner,
// kept habits out of sight, and where you're going as a road with stops. Nothing is scored.

import { esc, openSheet, closeSheet, toast } from '../ui.js';
import { SLEEP_PRESET, MORNING_PRESET, progress, focusOf, byStatus, item } from '../engines/steps.js';

export function render(ctx) {
  const { state: s, m } = ctx, f = focusOf(s), along = byStatus(s, 'along'), burner = byStatus(s, 'backburner'), kept = byStatus(s, 'kept');
  const top = `<div class="top"><span><b>Growing</b></span><span>one thing at a time</span></div>`;
  if (!f && !along.length && !burner.length) {
    return { sky: m.sky, html: top + `<div class="say" style="font-size:28px;margin-top:22px">One habit at a time.</div>` +
      `<p class="fine" style="margin-top:6px">Slow, steady, permanent. You move to the next step when you say you’ve reached it, and a missed day never resets anything.</p>` +
      `<button class="done pink" data-act="presetSleep" style="margin-top:22px">Start with sleep</button>` +
      `<p class="fine center" style="margin-top:8px">Phone charges outside the bedroom, 14 nights. Then lights out by 11:30. Then 8 hours.</p>` +
      `<button class="calm" data-act="newHabit" style="margin-top:16px"><i>+</i>Something else</button>` + roadHTML(s) + longView() };
  }
  let body = '';
  if (f) {
    const p = progress(s, f, m.day);
    const dots = Array.from({ length: p.n }, (_, i) => `<i style="height:12px;border-radius:6px;background:${i < p.count ? '#ffb3dc' : 'rgba(255,255,255,.1)'}"></i>`).join('');
    body += `<div class="lbl" style="margin-top:24px">${esc(f.name)} · step ${p.index + 1} of ${p.of}</div>` +
      `<div class="say" style="font-size:28px;margin-top:4px">${esc(p.step.text)}</div>` +
      (p.n ? `<div style="display:grid;grid-template-columns:repeat(7,1fr);gap:6px;margin-top:16px">${dots}</div>` +
        `<p class="fine" style="margin-top:8px">${p.count} of ${p.n} ${f.cue === 'wind' ? 'nights' : 'days'}${p.next ? ' · then ' + esc(p.next.text.charAt(0).toLowerCase() + p.next.text.slice(1)) : ''}</p>` : '') +
      (p.doneToday ? `<button class="done" data-act="habitUndo" data-id="${f.id}" style="margin-top:16px">Done ${f.cue === 'wind' ? 'tonight' : 'today'} ✓</button>`
        : `<button class="done pink" data-act="habitDid" data-id="${f.id}" style="margin-top:16px">I did it ${f.cue === 'wind' ? 'tonight' : 'today'}</button>`) +
      (p.reached ? `<div class="next" style="background:rgba(255,179,220,.08);border-color:rgba(255,179,220,.3)"><small style="color:#ffb3dc">You reached it</small><b style="font-size:16px">${p.last ? 'That was the last step.' : 'Ready for step ' + (p.index + 2) + '?'}</b><p>${p.last ? 'It becomes a kept habit, out of sight.' : esc(p.next.text) + '. Only when it feels true.'}</p><div class="opts"><button class="opt" data-act="reached" data-id="${f.id}">I reached it</button></div></div>` : '') +
      (f.why ? `<div class="calm" style="margin-top:12px"><i>♡</i>${esc(f.why)}</div>` : '');
  }
  for (const h of along) {
    const p = progress(s, h, m.day);
    body += `<div class="lbl">Riding along</div><button class="calm" data-act="${p.doneToday ? 'habitUndo' : 'habitDid'}" data-id="${h.id}"><i>${p.doneToday ? '✓' : '✎'}</i><span>${esc(p.step.text)}<br><span class="fine">${p.n ? p.count + ' of ' + p.n : ''}${p.doneToday ? ' · done today' : ' · tap when it’s done'}</span></span></button>`;
  }
  if (burner.length) body += `<div class="lbl">On the back burner</div>` + burner.map(h => `<div class="pk"><div class="d">${esc(h.name)}<br><span class="fine">${esc(h.steps[h.step || 0].text)}</span></div><button class="w" data-act="makeFocus" data-id="${h.id}">focus</button></div>`).join('');
  body += `<button class="calm" data-act="newHabit" style="margin-top:14px"><i>+</i>A new habit (it waits on the back burner)</button>`;
  if (!along.length) body += `<button class="calm" data-act="presetMorning"><i>✎</i>Add “good morning” to ride along</button>`;
  return { sky: m.sky, html: top + body + roadHTML(s) + longView() +
    (kept.length ? `<p class="fine center" style="margin-top:16px">${kept.length} kept habit${kept.length === 1 ? '' : 's'} live out of sight · <button class="link" data-act="kept">open</button></p>` : '') };
}
const longView = () => `<div class="lbl">The long view</div>` +
  `<button class="calm" data-act="long" data-v="sky"><i>✦</i>Your sky<span class="go">›</span></button>` +
  `<button class="calm" data-act="long" data-v="year"><i>▦</i>The year, as a quilt<span class="go">›</span></button>` +
  `<button class="calm" data-act="long" data-v="letters"><i>✉</i>Letters to future you<span class="go">›</span></button>`;

function roadHTML(s) {
  const r = s.road || [], ni = r.findIndex(x => !x.reached);
  return `<div class="lbl">Where I’m going</div>` + (r.length ? `<div style="position:relative;padding-left:24px">` +
    `<div style="position:absolute;left:7px;top:10px;bottom:10px;width:2px;background:rgba(255,255,255,.15)"></div>` +
    r.map((x, i) => { const st = x.reached ? 'd' : i === ni ? 'n' : 'l';
      return `<button data-act="stop" data-id="${x.id}" style="position:relative;display:block;width:100%;padding:8px 0;font-size:14.5px;font-weight:${st === 'n' ? 800 : 600};color:${st === 'l' ? 'rgba(255,255,255,.5)' : '#fff'}">` +
        `<span style="position:absolute;left:-22px;top:12px;width:12px;height:12px;border-radius:50%;background:${st === 'd' ? '#9fe6b8' : st === 'n' ? '#ffd59a' : 'rgba(255,255,255,.15)'};${st === 'n' ? 'box-shadow:0 0 12px #ffd59a' : ''}"></span>${esc(x.text)}${st === 'n' ? ' <span style="font-size:11px;color:#ffd59a">next</span>' : ''}</button>`; }).join('') + `</div>`
    : `<div class="empty" style="margin-top:0">A road with stops: the vault full, the loan gone, OSU. Add the first one.</div>`) +
    `<p class="fine center" style="margin-top:8px"><button class="link" data-act="addStop">+ a stop</button></p>`;
}

/* ---------- Sheets ---------- */
function habitSheet() {
  openSheet(`<div class="lbl">A new habit</div><input class="field serif" id="hname" placeholder="what it is" style="font-size:22px">` +
    `<div class="lbl">When</div><div class="opts" id="hcue" style="margin-top:0"><button class="opt on" data-act="pick" data-v="morning">in the morning</button><button class="opt" data-act="pick" data-v="wind">winding down</button></div>` +
    `<div class="lbl">Steps, one per line (“text, days”)</div><textarea class="field" id="hsteps" rows="3" placeholder="Gym once a week, 4&#10;Gym twice a week, 8"></textarea>` +
    `<p class="fine">Leave steps empty for a habit with one step and no count.</p><button class="pbtn" style="margin-top:10px" data-act="saveHabit">Keep it</button>`);
}
function stopSheet(ctx, id) {
  const x = (ctx.state.road || []).find(r => r.id === id);
  if (!x) return openSheet(`<div class="lbl">A stop on the road</div><input class="field serif" id="stext" placeholder="the vault full, OSU, a degree…" style="font-size:20px"><button class="pbtn" style="margin-top:14px" data-act="saveStop">Add it</button>`);
  openSheet(`<div class="lbl">A stop on the road</div><div class="say">${esc(x.text)}</div><p class="fine" style="margin-top:6px">${x.reached ? 'Reached on ' + esc(x.reached) + '.' : 'Not yet. It waits on the road.'}</p>` +
    `<div class="opts">${x.reached ? '' : `<button class="opt" data-act="reachStop" data-id="${x.id}">I reached it</button>`}<button class="opt" data-act="dropStop" data-id="${x.id}">take it off the road</button></div>`);
}
function keptSheet(ctx) {
  openSheet(`<div class="lbl">Kept</div><div class="say">Out of sight, still yours.</div>` +
    byStatus(ctx.state, 'kept').map(h => `<div class="calm"><i>✓</i><span>${esc(h.name)}<br><span class="fine">${esc(h.steps[h.steps.length - 1].text)}${h.keptOn ? ' · kept since ' + esc(h.keptOn) : ''}</span></span></div>`).join(''));
}

/* ---------- Taps ---------- */
const newId = p => p + Date.now().toString(36);
export const actions = {
  pick: (ctx, el) => el.parentElement.querySelectorAll('.opt').forEach(o => o.classList.toggle('on', o === el)),
  presetSleep: async ctx => { await ctx.write('habit.add', { id: newId('sleep'), ...SLEEP_PRESET, status: 'focus', date: ctx.m.day }, 'Sleep is your focus', 'tick'); },
  presetMorning: async ctx => { await ctx.write('habit.add', { id: newId('gm'), ...MORNING_PRESET, status: 'along', date: ctx.m.day }, '“Good morning” rides along', 'tick'); },
  newHabit: () => habitSheet(),
  saveHabit: async ctx => {
    const name = document.getElementById('hname').value.trim(); if (!name) return toast('Name it first.');
    const cue = document.querySelector('#hcue .opt.on')?.dataset.v || 'morning';
    const steps = document.getElementById('hsteps').value.split('\n').map(l => l.trim()).filter(Boolean).map(l => { const m = /^(.*?)[,·]\s*(\d+)\s*$/.exec(l); return m ? { text: m[1].trim(), n: +m[2] } : { text: l, n: 0 }; });
    const hasFocus = !!focusOf(ctx.state);
    closeSheet(); await ctx.write('habit.add', { id: newId('h'), name, cue, steps: steps.length ? steps : [{ text: name, n: 0 }], status: hasFocus ? 'backburner' : 'focus', date: ctx.m.day }, hasFocus ? 'On the back burner' : 'Your focus now', 'tick');
  },
  habitDid: async (ctx, el) => { await ctx.write('cue', { date: ctx.m.day, item: item(el.dataset.id), done: true }, 'Counted', 'tick'); },
  habitUndo: async (ctx, el) => { await ctx.write('cue', { date: ctx.m.day, item: item(el.dataset.id), done: false }); },
  reached: async (ctx, el) => { await ctx.write('habit.reached', { id: el.dataset.id, date: ctx.m.day }, 'Next step. Slow and steady.', 'double'); },
  makeFocus: async (ctx, el) => { await ctx.write('habit.status', { id: el.dataset.id, status: 'focus', date: ctx.m.day }, 'Your focus now'); },
  kept: ctx => keptSheet(ctx),
  addStop: ctx => stopSheet(ctx, null),
  stop: (ctx, el) => stopSheet(ctx, el.dataset.id),
  saveStop: async ctx => { const t = document.getElementById('stext').value.trim(); if (!t) return; closeSheet(); await ctx.write('stop.add', { id: newId('s'), text: t }, 'On the road'); },
  reachStop: async (ctx, el) => {
    closeSheet();
    const x = (ctx.state.road || []).find(r => r.id === el.dataset.id), letter = (ctx.state.letters || []).find(l => !l.opened && l.opens && l.opens.kind === 'stop' && l.opens.value === el.dataset.id);
    await ctx.log.append('stop.reached', { id: el.dataset.id, date: ctx.m.day }, 'grow');
    // A milestone gets a moment, and a letter sealed for it opens.
    await ctx.write('milestone', { id: 'stop-' + el.dataset.id, title: x ? x.text.replace(/\.$/, '') + '.' : 'You reached it.', facts: [], date: ctx.m.day, letter: letter ? letter.id : null }, null, 'three');
    ctx.go('home');
  },
  dropStop: async (ctx, el) => { closeSheet(); await ctx.write('stop.remove', { id: el.dataset.id }, 'Taken off the road'); },
};
