// The long view, opened from Grow: your sky, the year as a quilt, and letters to future you.
// Bigger, slower things. None of it is scored.

import { esc, openSheet, closeSheet, toast, stars } from '../ui.js';
import { starsOf, quilt, FEEL_COLOR, sealed, canOpen, opensWords } from '../engines/long.js';

let view = 'sky';
const MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
export const show = v => { view = v; };
const back = `<button class="link" data-act="tab" data-k="grow">‹ grow</button>`;

export function render(ctx) {
  if (view === 'year') return year(ctx);
  if (view === 'letters') return letters(ctx);
  return sky(ctx);
}

function sky(ctx) {
  const { state: s, m } = ctx, st = starsOf(s);
  const ln = (a, b, dash) => `<line x1="${a.x}" y1="${a.y}" x2="${b.x}" y2="${b.y}" stroke="rgba(200,194,255,${dash ? '.25' : '.4'})" stroke-width="1.2" ${dash ? 'stroke-dasharray="3 5"' : ''}/>`;
  let g = st.lit.slice(1).map((x, i) => ln(st.lit[i], x)).join('');
  if (st.lit.length && st.faint.length) g += ln(st.lit[st.lit.length - 1], st.faint[0], 1);
  g += st.faint.slice(1).map((x, i) => ln(st.faint[i], x, 1)).join('');
  g += st.lit.map(x => `<circle cx="${x.x}" cy="${x.y}" r="11" fill="rgba(255,240,210,.18)"/><circle cx="${x.x}" cy="${x.y}" r="4" fill="#fff"/><text x="${x.x}" y="${x.y + 22}" text-anchor="middle" font-size="11.5" font-weight="700" fill="rgba(255,255,255,.9)" font-family="system-ui">${esc(x.label)}</text><text x="${x.x}" y="${x.y + 35}" text-anchor="middle" font-size="9.5" font-weight="700" fill="rgba(255,255,255,.45)" font-family="system-ui">${esc(x.sub)}</text>`).join('');
  g += st.faint.map(x => `<circle cx="${x.x}" cy="${x.y}" r="4" fill="none" stroke="rgba(255,255,255,.4)" stroke-dasharray="2 2"/><text x="${x.x}" y="${x.y + 20}" text-anchor="middle" font-size="11" font-weight="700" fill="rgba(255,255,255,.4)" font-family="system-ui">${esc(x.label)}</text>`).join('');
  return { sky: 'night', html: `<div class="top"><span><b>Your sky</b></span><span>${back}</span></div>` +
    `<div class="say" style="font-size:26px;margin-top:18px">${st.lit.length ? 'Every habit you kept became a star.' : 'Your sky is still dark. That’s fine.'}</div>` +
    `<svg viewBox="0 0 346 480" style="width:100%;margin-top:8px">${g}</svg>` +
    `<p class="fine center" style="margin-top:4px">${st.lit.length ? 'It only grows. The faint ones are still ahead.' : 'Keep a habit, or reach a stop on the road, and the first star appears.'}</p>` +
    `<div class="opts" style="justify-content:center;margin-top:14px"><button class="opt" data-act="long" data-v="year">the year</button><button class="opt" data-act="long" data-v="letters">letters</button></div>` };
}

function year(ctx) {
  const { state: s, m } = ctx, y = +m.day.slice(0, 4), q = quilt(s, y, m.day), pick = ctx.memo.square;
  const rows = q.map((days, i) => `<div style="display:flex;align-items:center;gap:6px;margin-top:3px"><span style="width:26px;font-size:10px;font-weight:800;color:rgba(255,255,255,.4)">${MON[i]}</span>` +
    `<div style="flex:1;display:grid;grid-template-columns:repeat(31,1fr);gap:2px">${days.map(d => `<button data-act="square" data-d="${d.date}" style="aspect-ratio:1;border-radius:2.5px;background:${d.today ? '#fff' : d.feel ? FEEL_COLOR[d.feel] : d.future ? 'rgba(255,255,255,.06)' : d.grateful ? 'rgba(255,255,255,.3)' : 'rgba(255,255,255,.12)'};${d.feel ? 'opacity:.85' : ''}"></button>`).join('')}</div></div>`).join('');
  const p = pick ? (s.days || {})[pick] || {} : null;
  return { sky: 'night', html: `<div class="top"><span><b>${y}</b> · your year</span><span>${back}</span></div>` +
    `<div class="say" style="font-size:24px;margin-top:20px">The shape of a year.</div><div style="margin-top:12px">${rows}</div>` +
    `<div style="display:flex;gap:12px;flex-wrap:wrap;margin-top:12px;font-size:11.5px;color:rgba(255,255,255,.6);font-weight:700">${Object.entries(FEEL_COLOR).map(([k, c]) => `<span><u style="display:inline-block;width:10px;height:10px;border-radius:3px;background:${c};margin-right:5px"></u>${k}</span>`).join('')}</div>` +
    (p ? `<div class="next" style="margin-top:16px"><small>Tap a square · ${esc(pick)}</small><p style="font-family:var(--serif);font-size:16px;color:#fff;margin-top:6px">${p.grateful ? '“' + esc(p.grateful) + '”' : p.feel ? 'A ' + esc(p.feel) + ' day.' : 'Nothing written that day. That’s fine.'}</p></div>` : '') +
    `<p class="fine" style="margin-top:10px">No scores. Just what each day held. The evening close asks how a day felt.</p>` };
}

function letters(ctx) {
  const { state: s, m } = ctx, ls = s.letters || [];
  const env = l => canOpen(s, l, m.day)
    ? `<button class="env" data-act="openLetter" data-id="${l.id}" style="width:100%;text-align:left;margin-top:12px;padding:18px 18px 16px 70px;border-radius:20px;background:linear-gradient(180deg,#f3e9d6,#e6d6b8);color:#3a2e1c;position:relative"><span style="position:absolute;left:16px;top:18px;width:38px;height:38px;border-radius:50%;background:radial-gradient(circle at 40% 35%,#d9665a,#9c3328)"></span><b style="display:block;font-family:var(--serif);font-size:18px">${esc(l.title)}</b><small style="display:block;font-size:12px;font-weight:700;color:#7a6548;margin-top:3px">ready to open · tap</small></button>`
    : l.opened ? `<button class="calm" data-act="readLetter" data-id="${l.id}"><i>✉</i>${esc(l.title)}<span class="go">opened ${esc(l.opened)}</span></button>`
    : `<div style="position:relative;margin-top:12px;padding:18px 18px 16px 70px;border-radius:20px;background:linear-gradient(180deg,#f3e9d6,#e6d6b8);color:#3a2e1c"><span style="position:absolute;left:16px;top:18px;width:38px;height:38px;border-radius:50%;background:radial-gradient(circle at 40% 35%,#d9665a,#9c3328);box-shadow:inset 0 -3px 6px rgba(0,0,0,.25)"></span><b style="display:block;font-family:var(--serif);font-size:18px">${esc(l.title)}</b><small style="display:block;font-size:12px;font-weight:700;color:#7a6548;margin-top:3px">sealed · written ${esc(l.written)} · ${esc(opensWords(s, l))}</small></div>`;
  return { sky: 'dusk', html: `<div class="top"><span><b>Letters</b></span><span>${back}</span></div>` +
    `<div class="say" style="font-size:24px;margin-top:20px">Write to who you’re becoming.</div>` + ls.map(env).join('') +
    `<button data-act="writeLetter" style="display:block;width:100%;text-align:left;margin-top:12px;padding:18px 18px 16px 70px;border-radius:20px;background:rgba(255,255,255,.06);border:1px dashed rgba(255,255,255,.25);position:relative"><span style="position:absolute;left:16px;top:18px;width:38px;height:38px;border-radius:50%;border:2px dashed rgba(255,255,255,.3)"></span><b style="display:block;font-family:var(--serif);font-size:18px">Write a new letter…</b><small class="fine">pick when it opens: a date, a stop on the road, or a rough day</small></button>` +
    `<p class="fine" style="margin-top:16px">You can’t read them early. That’s the point.</p>` };
}

/* ---------- Sheets ---------- */
function writeSheet(ctx) {
  const stops = (ctx.state.road || []).filter(x => !x.reached);
  openSheet(`<div class="lbl">A letter to future you</div><input class="field serif" id="ltitle" placeholder="When the loan is paid off, In Lithuania…" style="font-size:18px">` +
    `<textarea class="field serif" id="ltext" rows="6" placeholder="Dear me," style="margin-top:10px;resize:none"></textarea>` +
    `<div class="lbl">It opens</div><div class="opts" id="lopen" style="margin-top:0"><button class="opt on" data-act="pick" data-v="date">on a date</button>${stops.length ? '<button class="opt" data-act="pick" data-v="stop">at a stop</button>' : ''}<button class="opt" data-act="pick" data-v="tide">on a rough day</button></div>` +
    `<input class="field" type="date" id="ldate" style="margin-top:10px">` +
    (stops.length ? `<select class="field" id="lstop" style="margin-top:10px">${stops.map(x => `<option value="${x.id}">${esc(x.text)}</option>`).join('')}</select>` : '') +
    `<button class="pbtn" style="margin-top:16px" data-act="sealLetter">Seal it</button><p class="fine">Once it’s sealed, you can’t read it until it opens.</p>`);
}
export function letterSheet(ctx, id) {
  const l = (ctx.state.letters || []).find(x => x.id === id);
  if (!l) return;
  openSheet(`<div class="lbl">A letter from you · written ${esc(l.written)}</div><div class="say">${esc(l.title)}</div>` +
    `<p style="font-family:var(--serif);font-size:17px;line-height:1.55;white-space:pre-wrap;margin-top:14px;color:#f3efff">${esc(l.text)}</p>`);
}

/* ---------- Taps ---------- */
export const actions = {
  long: (ctx, el) => { view = el.dataset.v; ctx.go('long'); },
  square: (ctx, el) => { ctx.memo.square = el.dataset.d; ctx.render(); },
  writeLetter: ctx => writeSheet(ctx),
  sealLetter: async ctx => {
    const title = document.getElementById('ltitle').value.trim(), text = document.getElementById('ltext').value.trim();
    if (!title || !text) return toast('A title and a few words.');
    const kind = document.querySelector('#lopen .opt.on')?.dataset.v || 'date';
    const value = kind === 'date' ? document.getElementById('ldate').value : kind === 'stop' ? document.getElementById('lstop').value : null;
    if (kind === 'date' && !value) return toast('Pick the date it opens.');
    closeSheet(); await ctx.write('letter.add', { id: 'l' + Date.now().toString(36), title, text, opens: { kind, value } }, 'Sealed', 'double');
  },
  openLetter: async (ctx, el) => { await ctx.write('letter.open', { id: el.dataset.id, date: ctx.m.day }, null, 'double'); letterSheet(ctx, el.dataset.id); },
  readLetter: (ctx, el) => letterSheet(ctx, el.dataset.id),
};
