// Day: today as a short chain of cues, the week in hours (the honest view), park it, and the pull line.
// The real date first; day names, never week numbers.

import { esc, openSheet, closeSheet, toast } from '../ui.js';
import { KINDS, AUTO, STACK, blocksOn, weekHours, weekFeel, cues, tomorrowLine, parked, backWords, WAITS, span, fmtHours, sleepHours } from '../engines/week.js';
import { dateTop } from './home.js';
import { weekday, addDays } from '../engines/sebdate.js';

const COUNT = ['Nothing', 'One thing', 'Two things', 'Three things', 'Four things', 'Five things', 'Six things'];
const DAYS1 = ['M', 'T', 'W', 'T', 'F', 'S', 'S'], DAYN = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

export function render(ctx) {
  const { state: s, m } = ctx, chain = cues(s, m.day, ctx.focus(m.day), ctx.morningHabits(m.day)), p = parked(s, m.day), wk = weekHours(s, m.day);
  const chainHTML = chain.length
    ? `<div style="position:relative;margin-top:8px;padding-left:18px;border-left:2px solid rgba(255,255,255,.12);margin-left:4px">${chain.map(cueHTML).join('')}</div>`
    : `<div class="empty">Nothing here yet. That’s a fine place to start.<button class="link" data-act="plan">+ plan your week</button></div>`;
  const tom = tomorrowLine(s, m.day);
  return {
    sky: m.sky, html:
      `<div class="top">${dateTop(m.day)}<span class="r">today</span></div>` +
      `<div class="say" style="font-size:28px;margin-top:22px">${chain.length ? COUNT[Math.min(chain.length, 6)] + (chain.length > 6 ? '' : '') + ', in order.' : 'An open day.'}</div>` +
      chainHTML +
      (p.due.length ? `<div class="lbl">Parked for today</div>` + p.due.map(x => `<div class="pk"><div class="d">${esc(x.text)}</div><button class="w" data-act="unpark" data-id="${x.id}">done</button></div>`).join('') : '') +
      (tom ? `<div class="tmr">Tomorrow starts with <b>${tom.map(esc).join('</b>, then <b>')}</b>.</div>` : '') +
      `<p class="fine center" style="margin-top:18px">Feeling a pull? <button class="link" data-act="pull">Tap here</button>, no judgment.</p>` +
      weekCard(wk) +
      `<button class="calm" data-act="park" style="margin-top:14px"><i>✎</i>Something on your mind? Park it for later.</button>` +
      (p.waiting.length ? `<div class="lbl">Waiting, not lost</div>` + p.waiting.map(x => `<div class="pk"><div class="d">${esc(x.text)}</div><span class="w">${esc(backWords(x, m.day))}</span></div>`).join('') : ''),
  };
}

function cueHTML(c) {
  return `<div style="position:relative;margin-top:12px;padding:14px 16px;border-radius:20px;background:rgba(255,255,255,.06);border:1px solid rgba(255,255,255,.1)">` +
    `<span style="position:absolute;left:-17px;top:20px;width:10px;height:10px;border-radius:50%;background:${c.dot};box-shadow:0 0 10px ${c.dot}"></span>` +
    `<div style="display:flex;justify-content:space-between;align-items:baseline"><b style="font-size:15px">${esc(c.title)}</b><span style="font-size:12px;font-weight:800;color:#ffcf9e">${esc(c.right || '')}</span></div>` +
    c.lines.map(l => `<button data-act="cue" data-item="${esc(l.item)}" data-done="${l.done ? 1 : 0}" style="display:block;width:100%;margin-top:7px;font-size:13.5px;color:rgba(255,255,255,${l.done ? '.5' : '.78'});font-weight:600">${l.done ? '●' : '○'} ${esc(l.text)}</button>`).join('') + `</div>`;
}

/** The week in hours, stacked like the honest-week board: sleep at the bottom, free hours on top. */
function weekCard(wk) {
  const H = 170, any = wk.days.some(d => d.work + d.class + d.study + d.gym + d.reset + d.other > 0);
  const cols = wk.days.map((d, i) => `<div style="flex:1;text-align:center"><div style="height:${H}px;display:flex;flex-direction:column-reverse;border-radius:8px;overflow:hidden;gap:1px">` +
    STACK.filter(k => d[k] > 0).map(k => `<i style="display:block;height:${(d[k] / 24) * H}px;background:${(KINDS[k] || AUTO[k]).color};${k === 'free' ? 'opacity:.9' : ''}"></i>`).join('') +
    `</div><span class="fine" style="font-size:10.5px">${DAYN[i]}</span></div>`).join('');
  const legend = STACK.filter(k => wk.days.some(d => d[k] > 0)).map(k => `<span><u style="display:inline-block;width:9px;height:9px;border-radius:3px;margin-right:4px;vertical-align:-1px;background:${(KINDS[k] || AUTO[k]).color}"></u>${(KINDS[k] || AUTO[k]).name}</span>`).join('');
  return `<div class="next" style="margin-top:22px"><div style="display:flex;justify-content:space-between;align-items:baseline"><small>The week, in hours</small><button class="link" style="font-size:12.5px" data-act="plan">plan it</button></div>` +
    `<b style="font-family:var(--serif);font-weight:400;font-size:22px">${any ? weekFeel(wk) : 'Plan your week to see it.'}</b>` +
    `<div style="display:flex;gap:5px;margin-top:12px">${cols}</div>` +
    `<div style="display:flex;justify-content:space-between;margin-top:8px;font-size:13px;font-weight:700"><span>study <b>${fmtHours(wk.study)} hr</b></span><span>work <b>${fmtHours(wk.work)} hr</b></span><span>free <b style="color:#ffcf9e">${fmtHours(wk.free)} hr</b></span></div>` +
    `<div style="display:flex;flex-wrap:wrap;gap:10px;margin-top:10px;font-size:11px;color:rgba(255,255,255,.6);font-weight:700">${legend}</div></div>`;
}

/* ---------- Sheets ---------- */
function planSheet(ctx) {
  const blocks = Object.values(ctx.state.blocks).sort((a, b) => (a.days[0] ?? 9) - (b.days[0] ?? 9) || (a.from < b.from ? -1 : 1));
  const once = ctx.state.once.filter(b => b.date >= ctx.m.day);
  openSheet(`<div class="lbl">Your week</div><div class="say">Plan your hours</div>` +
    `<p class="fine" style="margin-top:6px">Your blocks repeat every week. Sleep, meals and free time are worked out for you (sleep from your wind-down and morning: ${fmtHours(sleepHours(ctx.state.settings))} hr).</p>` +
    (blocks.length + once.length ? [...blocks, ...once].map(b => `<button class="pk" style="width:100%;text-align:left" data-act="block" data-id="${b.id}"><span style="width:10px;height:10px;border-radius:50%;margin-top:5px;background:${(KINDS[b.kind] || KINDS.other).color}"></span>` +
      `<span class="d"><b>${esc(b.label || KINDS[b.kind].name)}</b><br><span class="fine">${b.date ? 'just ' + DAYN[weekday(b.date)] + ' ' + b.date.slice(5).replace('-', '/') : b.days.map(d => DAYN[d]).join(' · ')} · ${span(b)}</span></span><span class="w">edit</span></button>`).join('')
      : `<div class="empty" style="margin-top:12px">Nothing planned yet. Start with work, or a class.</div>`) +
    `<button class="pbtn" style="margin-top:16px" data-act="block">+ add a block</button>`);
}

function blockSheet(ctx, id) {
  const s = ctx.state, b = (id && (s.blocks[id] || s.once.find(x => x.id === id))) || { kind: 'work', days: [], from: '10:00', to: '20:00' };
  const days = b.date ? [weekday(b.date)] : b.days;
  openSheet(`<div class="lbl">${id ? 'Change a block' : 'Add a block'}</div><div class="say">${id ? esc(b.label || KINDS[b.kind].name) : 'What is it?'}</div>` +
    `<div class="opts" id="bkind">${Object.keys(KINDS).map(k => `<button class="opt${b.kind === k ? ' on' : ''}" data-act="pick" data-group="bkind" data-v="${k}">${KINDS[k].name}</button>`).join('')}</div>` +
    `<div class="lbl">Name it (optional)</div><input class="field" id="blabel" value="${esc(b.label || '')}" placeholder="the place, the class, anything">` +
    `<div class="lbl">Days</div><div style="display:flex;gap:7px" id="bdays">${DAYS1.map((d, i) => `<button data-act="toggle" data-v="${i}" class="${days.includes(i) ? 'on' : ''}" style="flex:1;height:44px;border-radius:14px;font-weight:800;font-size:14px;${days.includes(i) ? 'background:linear-gradient(180deg,#ffb37a,#e8875a);color:#2a1408' : 'background:rgba(255,255,255,.06);color:rgba(255,255,255,.5)'}">${d}</button>`).join('')}</div>` +
    `<div class="lbl">Hours</div><div style="display:flex;align-items:center;gap:10px"><input class="field" type="time" id="bfrom" value="${esc(b.from)}"><span class="fine">to</span><input class="field" type="time" id="bto" value="${esc(b.to)}"></div>` +
    `<div class="opts" id="bwhen"><button class="opt${b.date ? '' : ' on'}" data-act="pick" data-group="bwhen" data-v="every">every week</button><button class="opt${b.date ? ' on' : ''}" data-act="pick" data-group="bwhen" data-v="once">just this week</button></div>` +
    `<button class="pbtn" style="margin-top:18px" data-act="saveBlock" data-id="${esc(id || '')}">Keep it</button>` +
    (id ? `<p class="fine center" style="margin-top:14px"><button data-act="dropBlock" data-id="${esc(id)}">remove this block</button></p>` : ''));
}

function parkSheet() {
  openSheet(`<div class="lbl">Park it</div><div class="say">What’s on your mind?</div>` +
    `<textarea class="field serif" id="ptext" rows="3" maxlength="200" placeholder="it’ll wait for the right day" style="margin-top:14px;resize:none"></textarea>` +
    `<div class="lbl">It waits for</div><div class="opts" id="pwhen" style="margin-top:0">${Object.entries(WAITS).map(([k, v], i) => `<button class="opt${i === 0 ? ' on' : ''}" data-act="pick" data-group="pwhen" data-v="${k}">${v}</button>`).join('')}` +
    `<button class="opt" data-act="pick" data-group="pwhen" data-v="date">a date</button></div><input class="field" type="date" id="pdate" style="margin-top:10px;display:none">` +
    `<button class="pbtn" style="margin-top:16px" data-act="savePark">Park it</button>`);
}

function pullSheet(ctx) {
  let once = '';
  try { if (!localStorage.getItem('0_0-v2-pcc')) { localStorage.setItem('0_0-v2-pcc', '1'); once = `<p class="fine" style="margin-top:14px">If you ever want someone to talk to, PCC has free counseling for students. Just so you know it’s there.</p>`; } } catch {}
  openSheet(`<div class="lbl">A pull</div><div class="say">It rises and falls like a wave. This one will pass.</div>` +
    `<p class="fine" style="margin-top:8px">Nothing here is saved or counted.</p>` +
    `<div class="lbl">What do you need right now?</div><div class="opts" id="pneed" style="margin-top:0">${['rest', 'food', 'company', 'something to do'].map(n => `<button class="opt" data-act="need" data-v="${n}">${n}</button>`).join('')}</div>` +
    `<p class="fine" id="pneedline" style="margin-top:10px;min-height:20px"></p>` +
    `<button class="calm" data-act="breatheNow"><i>◎</i>One slow minute of breathing</button>` +
    `<div class="calm"><i>↗</i>A short walk. Phone in your pocket.</div>` + once);
}
const NEED = { rest: 'Lie down for ten minutes. Rest counts.', food: 'Eat something real. Pulls are louder on an empty stomach.', company: 'Text someone, or go where people are.', 'something to do': 'Pick up the guitar for one song.' };

/* ---------- Taps ---------- */
const pick = el => { el.parentElement.querySelectorAll('.opt').forEach(o => o.classList.toggle('on', o === el)); };
const picked = id => document.querySelector(`#${id} .opt.on`)?.dataset.v;
export const actions = {
  plan: ctx => planSheet(ctx),
  block: (ctx, el) => blockSheet(ctx, el.dataset.id),
  pick: (ctx, el) => { pick(el); if (el.dataset.group === 'pwhen') document.getElementById('pdate').style.display = el.dataset.v === 'date' ? 'block' : 'none'; },
  toggle: (ctx, el) => {
    const on = !el.classList.contains('on'); el.classList.toggle('on', on);
    el.style.cssText = el.style.cssText.replace(/background:[^;]+;color:[^;]+/, on ? 'background:linear-gradient(180deg,#ffb37a,#e8875a);color:#2a1408' : 'background:rgba(255,255,255,.06);color:rgba(255,255,255,.5)');
  },
  saveBlock: async (ctx, el) => {
    const kind = picked('bkind') || 'other', label = document.getElementById('blabel').value.trim();
    const days = [...document.querySelectorAll('#bdays .on')].map(b => +b.dataset.v);
    const from = document.getElementById('bfrom').value, to = document.getElementById('bto').value, when = picked('bwhen');
    if (!days.length) return toast('Pick at least one day.');
    if (!from || !to || to <= from) return toast('The end has to be after the start.');
    const id = el.dataset.id || 'b' + Date.now().toString(36);
    closeSheet();
    if (when === 'once') {
      const wkStart = weekHours(ctx.state, ctx.m.day).start;
      for (const d of days) {
        const date = addDays(wkStart, d);
        await ctx.write('block.once', { id: days.length > 1 ? id + '-' + d : id, kind, label, date, from, to });
      }
      if (ctx.state.blocks[id]) await ctx.write('block.remove', { id });
      toast('Planned for this week');
    } else await ctx.write('block.set', { id, kind, label, days, from, to }, 'Your week is planned', 'tick');
  },
  dropBlock: async (ctx, el) => { closeSheet(); await ctx.write('block.remove', { id: el.dataset.id }, 'Block removed'); },
  cue: async (ctx, el) => { await ctx.write('cue', { date: ctx.m.day, item: el.dataset.item, done: el.dataset.done !== '1' }, null, el.dataset.done === '1' ? null : 'tick'); },
  park: () => parkSheet(),
  savePark: async ctx => {
    const text = document.getElementById('ptext').value.trim(); if (!text) return toast('Write the thought first.');
    let until = picked('pwhen') || 'sunday';
    if (until === 'date') { until = document.getElementById('pdate').value; if (!until) return toast('Pick the date.'); }
    closeSheet(); await ctx.write('park', { text, until, on: ctx.m.day }, 'Parked. It’ll wait.', 'tick');
  },
  unpark: async (ctx, el) => { await ctx.write('park.done', { id: el.dataset.id }, 'Done', 'tick'); },
  pull: ctx => pullSheet(ctx),
  need: (ctx, el) => { pick(el); document.getElementById('pneedline').textContent = NEED[el.dataset.v]; },
  breatheNow: ctx => { closeSheet(); ctx.breathe(); },
};
