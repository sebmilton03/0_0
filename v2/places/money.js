// Money: a feeling first, then a range, then breathing room in hours. The day you can work less,
// the trade made visible, the vault in months of life, fun money per day, and Dam Day itself,
// one transfer at a time. Everyday numbers are rounded; exact cents only on Dam Day.

import { esc, openSheet, closeSheet, toast, buzz, money, hrs } from '../ui.js';
import { view, FEEL, trade, damPlan, afterDam, fromValley, lastBalance, POCKETS, EMPTY, engine } from '../engines/money.js';
import { weekHours, blocksOn } from '../engines/week.js';
import { addDays, weekday } from '../engines/sebdate.js';
import { monthFacts, named } from '../engines/tide.js';

const MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const MONTH = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const DOW = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const COLOR = { income: '#b9bfd9', bills: '#8fb8ff', gas: '#ffb37a', misc: '#9fe6b8', personal: '#ffd59a', vault: '#b9a8ff' };
const CAPTION = {
  income: () => 'where pay lands', bills: () => 'fills to what bills need',
  gas: j => 'tops up to ' + money(+j.cap || 0), misc: j => 'tops up to ' + money(+j.cap || 0),
  personal: j => money(+j.amount || 0) + ' a month, minus borrowing', vault: j => 'tops up to ' + money(+j.cap || 0),
};
let screen = 'home';   // 'home' or 'dam'
const M = s => s.money || EMPTY;

/** Work hours a week from Day's blocks, if any are planned. */
export function workWeek(s, day) { const w = weekHours(s, day).work; return w > 0 ? w : null; }
export function moneyView(s, day) { try { return view(s, day, workWeek(s, day)); } catch { return { ready: false }; } }

export function render(ctx) {
  const { state: s, m } = ctx, v = moneyView(s, m.day);
  if (!v.ready) return setup(ctx);
  if (screen === 'dam' && !v.dam.done) return damScreen(ctx, v);
  if (v.dam.done && !(s.months || {})[v.dam.month] && screen !== 'later') return monthClose(ctx, v);
  if (screen !== 'later') screen = 'home';
  const f = v.feeling, room = v.room;
  const lines = {
    steady: `Life this month costs about <b>${hrs(v.lifeHours)} hours</b> of work. You’re on track for <b>${hrs(v.planned)}</b>, so <b>${hrs(room)} hours are extra</b>.`,
    tight: `Life this month costs about <b>${hrs(v.lifeHours)} hours</b> of work. You’re on track for <b>${hrs(v.planned)}</b>: covered, with <b>${hrs(room)}</b> to spare.`,
    short: `Life this month costs about <b>${hrs(v.lifeHours)} hours</b> of work. You’re on track for <b>${hrs(v.planned)}</b>, so you’re <b>${hrs(-room)} hours short</b>. The vault can carry it, or a shift or two.`,
    unknown: 'Log a paycheck and the hours show up here.',
  };
  const src = `<button class="fine" data-act="hoursWeek" style="display:block;text-align:left;margin-top:6px">About ${money(v.income.lo)}${v.income.hi - v.income.lo > 50 ? '–' + money(v.income.hi).slice(1) : ''} coming in: ${hrs(v.perWeek)} hr a week${workWeek(s, m.day) ? ' (from Day)' : ''} × ${v.rate ? money(v.rate, true) + '/hr take-home' : 'your pay'}. <span class="link">change</span></button>`;
  const miss = ctx.memo.miss || 0, missRoom = room - miss * avgShift(s, m.day);
  const whatIf = `<div class="next" style="margin-top:12px"><small>What if I miss shifts this month?</small>` +
    `<div class="opts">${[0, 1, 2, 3, 4].map(n => `<button class="opt${miss === n ? ' on' : ''}" data-act="whatIf" data-v="${n}">${n ? n + (n === 1 ? ' shift' : ' shifts') : 'none'}</button>`).join('')}</div>` +
    (miss ? `<p style="margin-top:8px">${missRoom >= 0 ? `Still covered, with ${hrs(missRoom)} hours extra.` : `${hrs(-missRoom)} hours short (about ${money(-missRoom * (v.rate || 0))}). The vault can carry it.`}</p>` : '') + `</div>`;
  const wl = v.workLess, t = v.loan ? trade(s, v, avgShift(s, m.day)) : null;
  const damLine = v.dam.done ? 'Dam Day is done. Next month starts clean.' : v.dam.open ? `Dam Day · ${v.dam.days === 0 ? 'today' : 'you can split early'}` : `Dam Day · ${dayName(v.dam.date)} · ${v.dam.days} days`;
  return {
    sky: m.sky, html:
      `<div class="top"><span><b>Money</b></span><span>this month</span></div>` +
      `<div class="say" style="font-size:30px;margin-top:24px">${FEEL[f]}</div>` +
      `<p class="fine" style="font-size:14px;margin-top:8px;color:rgba(255,255,255,.75)">${lines[f]}</p>` + (f !== 'unknown' ? src + whatIf : '') +
      (v.dam.open ? `<button class="done peachy" data-act="damOpen" style="margin-top:16px">The dam can open · start Dam Day</button>` : '') +
      (wl ? `<div class="next" style="margin-top:18px"><small>The day you can work less</small>
        <div style="display:flex;align-items:flex-end;gap:14px;margin-top:10px">
          <div style="flex:1"><div style="height:64px;border-radius:10px;background:linear-gradient(180deg,#ffcf9e,#e8875a)"></div><div class="fine" style="margin-top:6px">now<br><b style="font-size:15px">${hrs(wl.now)} hr/wk</b></div></div>
          ${wl.afterLoan != null ? `<div style="flex:1"><div style="height:${Math.max(16, 64 * wl.afterLoan / wl.now)}px;border-radius:10px;background:linear-gradient(180deg,#ffcf9e88,#e8875a88)"></div><div class="fine" style="margin-top:6px">after ${esc(M(s).loan.name || 'the loan')}<br><b style="font-size:15px">≈ ${hrs(wl.afterLoan)} hr/wk</b></div></div>` : ''}
          <div style="flex:1"><div style="height:44px;border-radius:10px;border:1.5px dashed rgba(255,207,158,.6)"></div><div class="fine" style="margin-top:6px">cheaper living<br><b style="font-size:15px">someday</b></div></div>
        </div>${wl.afterLoan != null ? `<p style="margin-top:10px">About ${hrs(wl.now - wl.afterLoan)} hours back every week, for school.</p>` : ''}</div>` : '') +
      (t ? `<button class="calm" data-act="trade" style="margin-top:12px"><i>⇄</i><span>Pick up a shift? ${esc(cap(M(s).loan.name || 'the loan'))} goes sooner, but study time shrinks. <span class="link">See the trade</span></span></button>` : '') +
      `<button class="calm" data-act="${v.dam.open ? 'damOpen' : 'damInfo'}"><i>◷</i>${esc(damLine)}</button>` +
      `<button class="calm" data-act="vault"><i>⛨</i>${v.vault && v.vault.months != null ? `Vault: you’re safe for ${about(v.vault.months)}` : 'Vault: type what’s in it to see your months of life'}</button>` +
      `<button class="calm" data-act="fun"><i>☺</i>${v.personal ? `Fun money: ${money(Math.max(0, v.personal.balance))}, about ${money(Math.max(0, v.personal.perDay))} a day` : 'Fun money: type what’s in Personal'}</button>` +
      `<div class="lbl">The parts</div>` +
      `<button class="calm" data-act="bills"><i>☰</i>Bills<span class="go">${money(M(s).bills.reduce((t, b) => t + b.amounts.reduce((a, x) => a + x, 0), 0) / 12)}/mo ›</span></button>` +
      `<button class="calm" data-act="pockets"><i>◫</i>Your pockets<span class="go">›</span></button>` +
      `<button class="calm" data-act="paycheck"><i>$</i>Paychecks${v.rate ? ` · ${money(v.rate)}/hr` : ''}<span class="go">log one ›</span></button>`,
  };
}
const monthsWords = n => (n >= 1.75 ? Math.round(n) + ' months' : n >= 0.75 ? 'a month' : 'a few weeks');
const about = n => (n >= 0.75 ? 'about ' : '') + monthsWords(n);
const cap = x => String(x).charAt(0).toUpperCase() + String(x).slice(1);
const dayName = iso => DOW[weekday(iso)] + ' ' + MON[+iso.slice(5, 7) - 1] + ' ' + +iso.slice(8);
function avgShift(s, day) {
  const w = blocksOn(s, day).concat(...[1, 2, 3, 4, 5, 6].map(i => blocksOn(s, addDays(day, i)))).filter(b => b.kind === 'work');
  return w.length ? w.reduce((t, b) => t + b.hours, 0) / w.length : 8;
}

/* ---------- Setup: starts blank; bring in from Valley, or set it up here ---------- */
function setup(ctx) {
  const has = ctx.state.archived && ctx.state.archived.keys.includes('0_0-valley-v1');
  return { sky: ctx.m.sky, html:
    `<div class="top"><span><b>Money</b></span><span>set up</span></div>` +
    `<div class="say" style="font-size:30px;margin-top:24px">Money, in hours.</div>` +
    `<p class="fine" style="font-size:14px;margin-top:8px;color:rgba(255,255,255,.75)">How much of your week life costs, how much is breathing room, and Dam Day one transfer at a time.</p>` +
    (has ? `<button class="done warm" data-act="fromValley" style="margin-top:22px">Bring in from Valley</button><p class="fine center" style="margin-top:8px">Copies your pockets, bills, loan and paychecks. Valley keeps working as it is.</p><div class="lbl">Or set it up here</div>`
      : `<div class="empty">Nothing here yet. That’s a fine place to start.<span class="link" style="display:block">Three small steps, below.</span></div>`) +
    `<button class="calm" data-act="pockets"><i>◫</i>Your pockets<span class="go">›</span></button>` +
    `<button class="calm" data-act="bills"><i>☰</i>Your bills${M(ctx.state).bills.length ? ' · ' + M(ctx.state).bills.length : ''}<span class="go">›</span></button>` +
    `<button class="calm" data-act="paycheck"><i>$</i>A paycheck${M(ctx.state).paychecks.length ? ' · ' + M(ctx.state).paychecks.length : ''}<span class="go">›</span></button>` };
}

/* ---------- Dam Day: type the balances, then one transfer at a time ---------- */
function typedToday(s, day) {
  const out = {};
  for (const j of POCKETS) { const b = M(s).balances.filter(x => x.jar === j && x.date === day).pop(); if (b) out[j] = b.value; }
  return Object.keys(out).length === POCKETS.length ? out : null;
}
function damScreen(ctx, v) {
  const { state: s, m } = ctx, J = M(s).jars, typed = typedToday(s, m.day);
  const top = `<div class="top"><span><b>${dayName(m.day)}</b></span><span>Dam Day <button class="link" data-act="damClose" style="margin-left:8px">later</button></span></div>`;
  if (!typed) {
    return { sky: 'dusk', html: top + `<div class="say" style="font-size:30px;margin-top:24px">The dam is ready.</div>` +
      `<p class="fine" style="margin-top:6px">Open your bank app and type what each pocket holds right now. Nothing is pre-filled: typing it is checking it.</p>` +
      POCKETS.map(j => `<div class="lbl" style="margin-top:14px"><span style="display:inline-block;width:9px;height:9px;border-radius:50%;background:${COLOR[j]};margin-right:6px"></span>${esc(J[j].name)}${J[j].bank ? ' · ' + esc(J[j].bank) : ''}</div><input class="field" inputmode="decimal" data-jar="${j}" placeholder="$0.00">`).join('') +
      `<button class="done peachy" data-act="damType" style="margin-top:20px">Work out the transfers</button>` };
  }
  const plan = damPlan(s, v, typed), moved = (M(s).moves[v.dam.month] || {}), i = plan.steps.findIndex(x => !(x.key in moved));
  const dots = plan.steps.map((x, k) => `<i style="display:inline-block;width:${k === i ? 22 : 10}px;height:10px;border-radius:5px;margin-right:6px;background:${x.key in moved ? '#9fe6b8' : k === i ? '#ffcf9e' : 'rgba(255,255,255,.15)'}"></i>`).join('');
  const done = plan.steps.filter(x => x.key in moved).map(x => `<div class="calm"><i>✓</i>${esc(x.from)} → ${esc(x.to)} · ${money(x.amount, true)}</div>`).join('');
  if (i < 0) {
    return { sky: 'dusk', html: top + `<div class="say" style="font-size:30px;margin-top:24px">That’s every transfer.</div>` +
      `<p class="fine" style="margin-top:6px">Close the dam and ${MONTH[+v.dam.splitMonth.slice(5) - 1]} starts clean.</p>` + done +
      `<button class="done warm" data-act="damDone" style="margin-top:20px">Close the dam</button>` };
  }
  const st = plan.steps[i], next = plan.steps.slice(i + 1).map(x => x.to + ' ' + money(x.amount));
  return { sky: 'dusk', html: top + `<div class="say" style="font-size:30px;margin-top:24px">The dam is open.</div>` +
    `<p class="fine" style="margin-top:6px">One transfer at a time, in your bank app. Take your time.</p>` +
    `<div style="margin-top:16px">${dots}<span class="fine" style="margin-left:4px">${i + 1} of ${plan.steps.length}</span></div>` +
    (plan.short > 0.5 ? `<div class="next" style="background:rgba(255,213,154,.08);border-color:rgba(255,213,154,.3)"><small style="color:#ffd59a">Gentle heads-up</small><b style="font-size:16px">${money(plan.short)} short this time.</b><p>The pockets near the end fill less. Nothing breaks.</p></div>` : '') +
    `<div style="margin-top:16px;padding:22px 20px;border-radius:24px;background:rgba(255,255,255,.07);border:1px solid rgba(255,207,158,.4)">` +
    `<small style="font-size:11px;font-weight:800;letter-spacing:1.4px;color:rgba(255,255,255,.55)">MOVE</small><div style="font-size:40px;font-weight:800;margin-top:4px">${money(st.amount, true)}</div>` +
    `<div style="font-size:15px;font-weight:700;color:rgba(255,255,255,.8);margin-top:4px">${esc(st.from)} → ${esc(st.to)}</div>` +
    `<button class="done peachy" data-act="damMove" data-key="${st.key}" data-amount="${st.amount}" style="margin-top:16px">Done</button></div>` +
    (done ? `<div class="lbl">Done</div>${done}` : '') +
    (next.length ? `<p class="fine center" style="margin-top:12px">Next: ${esc(next.slice(0, 2).join(', then '))}${next.length > 2 ? ', and the rest' : ''}.</p>` : '') };
}

/* ---------- The month close: four facts and one sentence to name it. Nothing scored. ---------- */
function monthClose(ctx, v) {
  const s = ctx.state, f = monthFacts(s, v.dam.month), mi = +v.dam.month.slice(5) - 1, past = named(s).slice(0, 4);
  const loanName = M(s).loan ? M(s).loan.name || 'the loan' : null;
  return { sky: 'dusk', html:
    `<div class="top"><span><b>${dayName(ctx.m.day)}</b></span><span>month end · Dam Day</span></div>` +
    `<div style="font-family:var(--serif);font-size:52px;line-height:1;margin-top:20px">${MONTH[mi]},<br>closed.</div>` +
    `<div class="facts"><div><b>${f.hours ? Math.round(f.hours) + ' hr' : '—'}</b><span>worked (from your checks)</span></div>` +
    `<div><b>${f.loanMoved ? '−' + money(f.loanMoved) : '—'}</b><span>${loanName ? esc(loanName) + ' moved' : 'extra to the loan'}</span></div>` +
    `<div><b>${f.habitDays}</b><span>days a habit happened</span></div><div><b>${f.grateful}</b><span>grateful lines</span></div></div>` +
    `<div class="grat" style="border-style:dashed;margin-top:18px"><small>Name this month</small><input id="mname" maxlength="80" placeholder="the month I…"></div>` +
    (past.length ? `<div class="lbl" style="margin-top:20px">Months behind you</div>` + past.map(([mo, x]) => `<div style="display:flex;justify-content:space-between;padding:9px 2px;border-bottom:1px solid rgba(255,255,255,.07);font-size:13.5px"><span style="color:rgba(255,255,255,.5);font-weight:700">${MON[+mo.slice(5) - 1]}</span><em style="font-family:var(--serif);color:rgba(255,255,255,.85)">${esc(x.name)}</em></div>`).join('') : '') +
    `<button class="done warm" data-act="closeMonth" style="margin-top:18px">Close ${MONTH[mi]}</button>` +
    `<button class="calm" data-act="export"><i>⇩</i>Save a backup while you’re here</button>` +
    `<p class="fine center" style="margin-top:10px">${MONTH[(mi + 1) % 12]} starts clean. <button class="link" data-act="closeLater">later</button></p>` };
}

/* ---------- Sheets ---------- */
const nth = d => d + (d % 10 === 1 && d !== 11 ? 'st' : d % 10 === 2 && d !== 12 ? 'nd' : d % 10 === 3 && d !== 13 ? 'rd' : 'th');
function rhythmWords(b) {
  if (b.loan) return 'monthly';
  const ms = b.amounts.map((a, i) => (a > 0 ? i : -1)).filter(i => i >= 0);
  return ms.length === 12 ? 'monthly' : ms.length ? ms.map(i => MON[i]).join(' · ') : 'no months picked';
}
function billsSheet(ctx) {
  const s = ctx.state, m = M(s), v = moneyView(s, ctx.m.day);
  const plan = m.bills.length ? engine().billPlan(m.bills, m.loan, +m.jars.bills.cushion || 0) : null;
  const next = +v.dam.splitMonth.slice(5) - 1, has = lastBalance(m, 'bills');
  const rows = m.bills.slice().sort((a, b) => (a.day || 99) - (b.day || 99)).map(b => {
    const amt = b.loan && m.loan ? +m.loan.payment || 0 : Math.max(...b.amounts);
    const sub = (b.day ? 'comes out on the ' + nth(b.day) + ' · ' : '') + rhythmWords(b) + (b.loan && m.loan ? ' · ' + money(+m.loan.owed) + ' left to pay' : '') + (b.bareMin ? ' · bare minimum' : '');
    return `<button class="pk" style="width:100%;text-align:left" data-act="bill" data-id="${esc(b.id)}"><span class="d"><b>${esc(b.name)}</b><br><span class="fine">${esc(sub)}</span></span><b>${money(amt)}</b></button>`;
  }).join('');
  openSheet(`<div class="lbl">Bills</div><div class="say">${m.bills.length ? 'Bills run in the background.' : 'No bills yet.'}</div>` +
    (plan ? `<p class="fine" style="margin-top:6px">Bills should hold <b>${money(plan.target[next])}</b> after Dam Day, for ${MONTH[next]}${has ? `. It had <b>${money(has.value)}</b> on ${dayName(has.date)}` : ''}. Big bills are saved ahead a little each month.</p>` : '') +
    rows + `<div class="opts" style="margin-top:14px"><button class="pbtn" data-act="bill">+ add a bill</button>${m.loan ? '' : '<button class="opt" data-act="bill" data-loan="1">+ a loan</button>'}</div>` +
    `<p class="fine" style="margin-top:10px">Saving up for something, or an odd bill? Add it in the month you need it: Bills sets a little aside every month until then.</p>`);
}
function billSheet(ctx, id, asLoan) {
  const m = M(ctx.state), b = m.bills.find(x => x.id === id) || { name: '', amounts: Array(12).fill(0), loan: !!asLoan };
  const isLoan = !!b.loan, l = m.loan || {};
  const on = isLoan ? Array(12).fill(true) : b.amounts.map(a => a > 0);
  const amt = isLoan ? l.payment ?? '' : (Math.max(...b.amounts) || '');
  const chips = MON.map((n, i) => `<button class="opt${on[i] ? ' on' : ''}" data-act="month" data-i="${i}" style="padding:8px 0;width:calc(25% - 6px);text-align:center">${n}</button>`).join('');
  openSheet(`<div class="lbl">${id ? 'Change' : 'Add'} ${isLoan ? 'a loan' : 'a bill'}</div><input class="field serif" id="bname" value="${esc(isLoan ? l.name || b.name.replace(/ payment$/, '') : b.name)}" placeholder="${isLoan ? 'name it (the car, say)' : 'what it is'}" style="font-size:22px">` +
    `<div class="grid2"><div><div class="lbl">${isLoan ? 'Payment a month' : 'Amount'}</div><input class="field" id="bamt" inputmode="decimal" value="${esc(amt)}" placeholder="$0" style="font-weight:800"></div>` +
    `<div><div class="lbl">Day it comes out</div><input class="field" id="bday" inputmode="numeric" value="${esc(b.day || '')}" placeholder="1–31"></div></div>` +
    (isLoan ? `<div class="grid2"><div><div class="lbl">Left to pay</div><input class="field" id="lowed" inputmode="decimal" value="${esc(l.owed ?? '')}" placeholder="$0"></div><div><div class="lbl">Rate (APR %)</div><input class="field" id="lapr" inputmode="decimal" value="${esc(l.apr != null ? +(l.apr * 100).toFixed(3) : '')}" placeholder="6.5"></div></div>`
      : `<div class="lbl">Months it comes out</div><div class="opts" id="bmonths" style="margin-top:0;gap:6px">${chips}</div>` +
        `<div class="opts" style="margin-top:8px">${[['all', 'every month'], ['2', 'every 2'], ['3', 'every 3'], ['6', 'every 6'], ['1', 'once a year'], ['none', 'clear']].map(([k, t]) => `<button class="opt" data-act="every" data-v="${k}" style="padding:6px 11px;font-size:12.5px">${t}</button>`).join('')}</div>`) +
    `<label class="calm" style="margin-top:14px"><input type="checkbox" id="bbare"${b.bareMin || (isLoan && !id) ? ' checked' : ''} style="width:20px;height:20px"> Part of the bare minimum</label>` +
    `<button class="pbtn" style="margin-top:16px" data-act="saveBill" data-id="${esc(id || '')}" data-loan="${isLoan ? 1 : ''}">Keep it</button>` +
    (id ? `<p class="fine center" style="margin-top:12px"><button data-act="${isLoan ? 'dropLoan' : 'dropBill'}" data-id="${esc(id)}">${isLoan ? 'it’s paid off · remove it' : 'remove this bill'}</button></p>` : ''));
}
function pocketsSheet(ctx) {
  const m = M(ctx.state), J = m.jars;
  openSheet(`<div class="lbl">Your pockets</div><div class="say">Where money lives.</div><p class="fine" style="margin-top:6px">Same pockets as your bank, in the order Dam Day fills them.</p>` +
    POCKETS.map(k => { const b = lastBalance(m, k);
      return `<button class="pk" style="width:100%;text-align:left;align-items:center" data-act="pocket" data-k="${k}"><span style="width:12px;height:12px;border-radius:50%;background:${COLOR[k]}"></span><span class="d"><b>${esc(J[k].name)}</b>${J[k].bank ? ' · ' + esc(J[k].bank) : ''}<br><span class="fine">${esc(CAPTION[k](J[k]))}${b ? ' · had ' + money(b.value) + ' on ' + dayName(b.date) : ''}</span></span><span class="w">edit</span></button>`; }).join('') +
    `<button class="next" data-act="extra" style="text-align:left;width:100%"><small>Whatever’s left</small><b style="font-size:16px">${m.extra.first === 'roth' ? 'The Roth first, then ' + esc(m.loan ? m.loan.name || 'the loan' : 'the loan') : esc(cap(m.loan ? m.loan.name || 'the loan' : 'the loan')) + ' first, then the Roth'}, then ${Math.round(m.extra.investShare * 100)}% invest · ${100 - Math.round(m.extra.investShare * 100)}% fun</b><p>Tap to change the order or the split.</p></button>`);
}
const FIELDS = { bills: [['cushion', 'Cushion (what it keeps at its lowest)']], gas: [['cap', 'Tops up to'], ['spend', 'Spends a month']], misc: [['cap', 'Tops up to'], ['spend', 'Spends a month']], personal: [['amount', 'Refill every month']], vault: [['cap', 'Full at (your safety net)']], income: [] };
function pocketSheet(ctx, k) {
  const j = M(ctx.state).jars[k], b = lastBalance(M(ctx.state), k);
  openSheet(`<div class="lbl">Pocket</div><div class="grid2"><input class="field serif" id="pname" value="${esc(j.name)}" placeholder="name"><input class="field" id="pbank" value="${esc(j.bank || '')}" placeholder="bank’s label, like S01"></div>` +
    `<div class="lbl">What it has now${b ? ' (it had ' + money(b.value) + ' on ' + dayName(b.date) + ')' : ''}</div><input class="field" inputmode="decimal" id="pbal" placeholder="type it from your bank app">` +
    FIELDS[k].map(([f, l]) => `<div class="lbl">${l}</div><input class="field" inputmode="decimal" data-f="${f}" value="${esc(j[f] ?? '')}" placeholder="$0">`).join('') +
    `<button class="pbtn" style="margin-top:16px" data-act="savePocket" data-k="${k}">Keep it</button>`);
}
function extraSheet(ctx) {
  const x = M(ctx.state).extra;
  openSheet(`<div class="lbl">Whatever’s left</div><div class="say">Where the leftover goes.</div>` +
    `<div class="lbl">First</div><div class="opts" id="xfirst" style="margin-top:0"><button class="opt${x.first !== 'roth' ? ' on' : ''}" data-act="pick" data-v="loan">the loan</button><button class="opt${x.first === 'roth' ? ' on' : ''}" data-act="pick" data-v="roth">the Roth</button></div>` +
    `<div class="grid2"><div><div class="lbl">Roth limit a year</div><input class="field" inputmode="decimal" id="xroth" value="${esc(x.rothLimit)}"></div><div><div class="lbl">Invest share %</div><input class="field" inputmode="decimal" id="xinv" value="${esc(Math.round(x.investShare * 100))}"></div></div>` +
    `<p class="fine">After the loan and the Roth, the rest splits into investing and fun money.</p><button class="pbtn" style="margin-top:10px" data-act="saveExtra">Keep it</button>`);
}
function paycheckSheet(ctx) {
  const m = M(ctx.state), last = m.paychecks.slice().sort((a, b) => (a.date < b.date ? -1 : 1)).slice(-3).reverse();
  const usual = [...new Set(last.map(c => c.hours))].slice(0, 2);
  openSheet(`<div class="lbl">A paycheck</div><div class="say">Two numbers off the stub.</div>` +
    `<div class="lbl">Pay date</div><input class="field" type="date" id="cdate" value="${esc(ctx.m.day)}">` +
    `<div class="lbl">Take-home</div><input class="field" inputmode="decimal" id="cnet" placeholder="$0.00" style="font-size:22px;font-weight:800;text-align:center">` +
    `<div class="lbl">Hours</div><div style="display:flex;gap:10px;align-items:center"><input class="field" inputmode="decimal" id="chrs" value="${esc(usual[0] ?? '')}" placeholder="0" style="font-size:22px;font-weight:800;text-align:center;flex:1">` +
    `<div class="opts" style="margin:0">${['−1', '+1', ...usual.map(String)].map(x => `<button class="opt" data-act="step" data-v="${x}">${x}</button>`).join('')}</div></div>` +
    `<button class="pbtn" style="margin-top:16px" data-act="savePaycheck">Keep it</button>` +
    (last.length ? `<div class="lbl">The last ${last.length}</div>` + last.map(c => `<div class="calm"><i>$</i>${dayName(c.date)} · ${money(c.net)} for ${c.hours} hr<span class="go">${money(c.net / c.hours, true)}/hr</span></div>`).join('') + `<p class="fine" style="margin-top:8px">$/hr is the average of the last three, so a raise shows up fast.</p>` : ''));
}
function funSheet(ctx) {
  const v = moneyView(ctx.state, ctx.m.day), p = v.personal, J = M(ctx.state).jars;
  openSheet(`<div class="lbl">${esc(J.personal.name)} · your fun money</div>` +
    (p ? `<div class="say" style="font-size:40px">${money(Math.max(0, p.balance))}</div><p class="fine" style="margin-top:6px">About ${money(Math.max(0, p.perDay))} a day until the dam opens on ${dayName(p.until)}.</p>`
      : `<div class="say">What’s in ${esc(J.personal.name)} right now?</div>`) +
    (p ? `<div class="opts" style="margin-top:14px">${[-20, -10, -5, 5, 10, 20].map(n => `<button class="opt" data-act="nudgeFun" data-v="${n}">${n < 0 ? '−' : '+'}$${Math.abs(n)}</button>`).join('')}</div>` : '') +
    `<div class="lbl">${p ? 'Or type the new balance' : 'Type it from your bank app'}</div><div style="display:flex;gap:8px"><input class="field" inputmode="decimal" id="fbal" placeholder="$0"><button class="pbtn" data-act="saveFunBal">Keep</button></div>`);
}
function vaultSheet(ctx) {
  const v = moneyView(ctx.state, ctx.m.day), x = v.vault, m = M(ctx.state);
  const bare = m.bills.filter(b => b.bareMin).map(b => b.name);
  openSheet(`<div class="lbl">${esc(m.jars.vault.name)} · your safety net</div>` +
    (x && x.months != null ? `<div class="say" style="font-size:34px">You’re safe.</div><div class="facts"><div><b>${monthsWords(x.months)}</b><span>of normal life</span></div><div><b>${x.bareMonths ? monthsWords(x.bareMonths) : '—'}</b><span>if you go bare</span></div></div>` +
      (x.cap ? `<div class="lbl">Toward full</div><div style="position:relative;height:16px;border-radius:8px;background:rgba(255,255,255,.07)"><i style="position:absolute;left:0;top:0;bottom:0;width:${Math.min(100, x.balance / x.cap * 100)}%;border-radius:8px;background:linear-gradient(90deg,#8fb8ff,#b9a8ff)"></i></div><p class="fine" style="margin-top:6px">Full at ${money(x.cap)}.${x.balance >= x.cap ? ' Nothing to do here.' : ''}</p>` : '')
      : `<div class="say">What’s in the vault?</div>`) +
    `<div class="calm" style="margin-top:14px"><i>✎</i>${bare.length ? 'Bare minimum: ' + esc(bare.join(', ')) + ', plus gas and misc.' : 'Mark bills as “bare minimum” in Bills to see the bare months.'}</div>` +
    `<div class="lbl">Type a fresh balance</div><div style="display:flex;gap:8px"><input class="field" inputmode="decimal" id="vbal" placeholder="$0"><button class="pbtn" data-act="saveVault">Keep</button></div>`);
}
function tradeSheet(ctx) {
  const s = ctx.state, v = moneyView(s, ctx.m.day), sh = avgShift(s, ctx.m.day), t = trade(s, v, sh);
  if (!t) return;
  openSheet(`<div class="lbl">The trade, made visible</div><div class="say">One more shift a week.</div>` +
    `<div class="facts"><div><b>${t.sooner} month${t.sooner === 1 ? '' : 's'}</b><span>sooner, ${esc(M(s).loan.name || 'the loan')} gone</span></div><div><b>−${hrs(t.studyLost)} hr</b><span>a week for study and rest</span></div></div>` +
    `<p class="fine" style="margin-top:14px">About ${money(t.extra)} more a month goes to the loan. Both are fine choices; this just shows what each one costs.</p>`);
}

/* ---------- Taps ---------- */
const num = id => { const v = String(document.getElementById(id)?.value || '').replace(/[$,\s]/g, ''); return v === '' ? NaN : +v; };
const pick = el => el.parentElement.querySelectorAll('.opt').forEach(o => o.classList.toggle('on', o === el));
export const actions = {
  pick: (ctx, el) => pick(el),
  bills: ctx => billsSheet(ctx),
  bill: (ctx, el) => billSheet(ctx, el.dataset.id, el.dataset.loan),
  pockets: ctx => pocketsSheet(ctx),
  pocket: (ctx, el) => pocketSheet(ctx, el.dataset.k),
  extra: ctx => extraSheet(ctx),
  paycheck: ctx => paycheckSheet(ctx),
  fun: ctx => funSheet(ctx),
  vault: ctx => vaultSheet(ctx),
  trade: ctx => tradeSheet(ctx),
  damInfo: ctx => { const v = moneyView(ctx.state, ctx.m.day); openSheet(`<div class="lbl">Dam Day</div><div class="say">The dam opens in ${v.dam.days} days.</div><p class="fine" style="margin-top:6px">${dayName(v.dam.date)}, the last day of the month. It can open up to a week early, once the last check of the month has landed.</p><div class="lbl">What it will do</div><div class="calm"><i>✓</i>Bills ready for ${MONTH[+v.dam.splitMonth.slice(5) - 1]}</div><div class="calm"><i>✓</i>${esc(M(ctx.state).jars.gas.name)} and ${esc(M(ctx.state).jars.misc.name)} filled back up</div><div class="calm"><i>☺</i>Fun money for the month</div><div class="calm"><i>→</i>The rest to ${esc(M(ctx.state).loan ? M(ctx.state).loan.name || 'the loan' : 'the Roth')}</div><p class="fine center" style="margin-top:12px">On the day, it shows each transfer, one at a time.</p>`); },
  damOpen: ctx => { closeSheet(true); screen = 'dam'; ctx.render(); window.scrollTo(0, 0); },
  damClose: ctx => { screen = 'home'; ctx.render(); },
  damType: async ctx => {
    const vals = {};
    for (const el of document.querySelectorAll('[data-jar]')) { const v = String(el.value).replace(/[$,\s]/g, ''); if (v === '' || isNaN(+v)) return toast('Type every pocket. 0 is fine.'); vals[el.dataset.jar] = +v; }
    for (const [jar, value] of Object.entries(vals)) await ctx.log.append('balance', { date: ctx.m.day, jar, value }, 'money');
    await ctx.refresh();
  },
  damMove: async (ctx, el) => { const v = moneyView(ctx.state, ctx.m.day); await ctx.write('dam.move', { month: v.dam.month, key: el.dataset.key, amount: +el.dataset.amount }, 'Done', 'tick'); window.scrollTo(0, 0); },
  damDone: async ctx => {
    const v = moneyView(ctx.state, ctx.m.day), typed = typedToday(ctx.state, ctx.m.day), plan = damPlan(ctx.state, v, typed);
    screen = 'home';
    await ctx.write('dam.done', { month: v.dam.month, date: ctx.m.day, after: afterDam(typed, plan) }, 'The dam is closed', 'three');
  },
  closeMonth: async ctx => {
    const v = moneyView(ctx.state, ctx.m.day), name = document.getElementById('mname')?.value.trim() || '';
    await ctx.log.append('month.close', { month: v.dam.month, name }, 'money');
    // (The month's checkpoint is saved once the month has really ended; see start() in app.js.)
    screen = 'home'; await ctx.refresh(); toast(name ? '“' + name + '”' : 'Closed. A new month.');
  },
  closeLater: ctx => { screen = 'later'; ctx.render(); },
  fromValley: async ctx => {
    const arc = (await ctx.log.all()).filter(e => e.kind === 'v1-archive').pop();
    const keys = arc ? arc.data.keys : {}, data = fromValley(keys['0_0-valley-v1']);
    if (!data) return toast('Couldn’t read Valley’s data.');
    // Money v1's checks join the same list (one paycheck list), matched by pay date.
    try {
      const mv = JSON.parse(keys['0_0-money-v1'] || 'null'), lag = mv && mv.sources && mv.sources[0] ? mv.sources[0].lag : null, have = new Set(data.paychecks.map(c => c.date));
      if (mv && lag != null) for (const e of mv.events || []) if (e.type === 'check' && e.value > 0 && e.hours > 0) { const d = addDays(e.end, lag); if (!have.has(d)) { data.paychecks.push({ id: e.id, date: d, net: +e.value, hours: +e.hours }); have.add(d); } }
    } catch {}
    await ctx.write('money.import', data, 'Brought in from Valley', 'tick');
  },
  saveBill: async (ctx, el) => {
    const m = M(ctx.state), isLoan = !!el.dataset.loan, id = el.dataset.id || (isLoan ? 'loan' : 'bill' + Date.now().toString(36));
    const name = document.getElementById('bname').value.trim() || (isLoan ? 'Loan' : 'Bill'), a = num('bamt');
    const dayV = num('bday'), day = dayV >= 1 && dayV <= 31 ? Math.round(dayV) : null, bareMin = document.getElementById('bbare').checked;
    if (!(a >= 0)) return toast('Type the amount.');
    const v0 = moneyView(ctx.state, ctx.m.day);
    if (isLoan) {
      // A loan is a bill with a balance: its payment comes out of Bills; what's left to pay shrinks on Dam Day.
      const owed = num('lowed'), apr = num('lapr');
      if (!(owed >= 0) || !(apr >= 0) || apr > 40) return toast('Check the numbers. Type 6.5 for 6.5%.');
      closeSheet();
      await ctx.log.append('loan.set', { loan: { name, owed, payment: a, apr: apr / 100, asOf: ctx.m.day } }, 'money');
      await ctx.write('bill.set', { id, name: name + ' payment', amounts: Array(12).fill(0), loan: true, bareMin, day });
    } else {
      const on = [...document.querySelectorAll('#bmonths .opt')].map(b => b.classList.contains('on'));
      if (!on.some(Boolean)) return toast('Pick at least one month.');
      closeSheet();
      await ctx.write('bill.set', { id, name, amounts: on.map(x => (x ? a : 0)), loan: false, bareMin, day });
    }
    const v1 = moneyView(ctx.state, ctx.m.day);
    if (v0.ready && v1.ready && v0.lifeHours != null) { const d = v1.lifeHours - v0.lifeHours; toast(Math.abs(d) < 0.5 ? 'Kept' : `About ${hrs(Math.abs(d))} ${d > 0 ? 'more' : 'fewer'} hours of work a month`); } else toast('Kept');
  },
  month: (ctx, el) => el.classList.toggle('on'),
  every: (ctx, el) => {
    const v = el.dataset.v, start = (+ctx.m.day.slice(5, 7)) % 12;   // next month
    document.querySelectorAll('#bmonths .opt').forEach((b, i) => {
      const k = (i - start + 12) % 12;
      b.classList.toggle('on', v === 'all' ? true : v === 'none' ? false : k % +v === 0 && (v !== '1' || k === 0));
    });
  },
  dropBill: async (ctx, el) => { closeSheet(); await ctx.write('bill.remove', { id: el.dataset.id }, 'Bill removed'); },
  savePocket: async (ctx, el) => {
    const set = { name: document.getElementById('pname').value.trim() || EMPTY.jars[el.dataset.k].name, bank: document.getElementById('pbank').value.trim() };
    for (const i of document.querySelectorAll('[data-f]')) { const v = String(i.value).replace(/[$,\s]/g, ''); set[i.dataset.f] = v === '' ? 0 : +v; if (isNaN(set[i.dataset.f])) return toast('Numbers only, please.'); }
    const bal = num('pbal');
    closeSheet();
    if (bal >= 0) await ctx.log.append('balance', { date: ctx.m.day, jar: el.dataset.k, value: bal }, 'money');
    await ctx.write('pocket.set', { key: el.dataset.k, set }, 'Kept');
  },
  nudgeFun: async (ctx, el) => {
    const p = moneyView(ctx.state, ctx.m.day).personal; if (!p) return;
    closeSheet(); await ctx.write('balance', { date: ctx.m.day, jar: 'personal', value: Math.max(0, Math.round((p.balance + +el.dataset.v) * 100) / 100) }, 'Fun money ' + money(Math.max(0, p.balance + +el.dataset.v)));
  },
  whatIf: (ctx, el) => { ctx.memo.miss = +el.dataset.v; ctx.render(); },   // a what-if: shown, never saved
  hoursWeek: ctx => {
    const m = M(ctx.state), fromDay = workWeek(ctx.state, ctx.m.day);
    openSheet(`<div class="lbl">Hours a week</div><div class="say">${fromDay ? hrs(fromDay) + ' hours, from Day.' : 'Your usual week.'}</div>` +
      `<p class="fine" style="margin-top:6px">${fromDay ? 'Your shifts planned in Day set this. Change them there.' : 'Until you plan your shifts in Day, Money uses this.'} Pay per hour is take-home ÷ hours from your last three checks.</p>` +
      (fromDay ? '' : `<input class="field" id="hweek" inputmode="decimal" value="${esc(m.income.hoursPerWeek || '')}" style="font-size:22px;font-weight:800;text-align:center;margin-top:12px"><div class="opts">${[20, 30, 32, 40].map(n => `<button class="opt" data-act="setWeek" data-v="${n}">${n}</button>`).join('')}</div><button class="pbtn" style="margin-top:12px" data-act="setWeek">Keep it</button>`));
  },
  setWeek: async (ctx, el) => { const v = el.dataset.v ? +el.dataset.v : num('hweek'); if (!(v > 0)) return toast('Type the hours.'); closeSheet(); await ctx.write('income.set', { hoursPerWeek: v }, v + ' hours a week'); },
  dropLoan: async ctx => {
    closeSheet();
    const m = M(ctx.state), l = m.loan, v = moneyView(ctx.state, ctx.m.day), pay = l ? +l.payment || 0 : 0;
    const back = v.rate ? pay / v.rate / engine().WEEKS_PER_MONTH : null;
    await ctx.log.append('loan.set', { loan: null }, 'money');
    await ctx.log.append('bill.remove', { id: (m.bills.find(b => b.loan) || {}).id }, 'money');
    // A milestone gets a real moment: what it gave back, in money and in hours.
    await ctx.write('milestone', { id: 'loan-' + ctx.m.day, title: (l && l.name ? l.name.charAt(0).toUpperCase() + l.name.slice(1) : 'The loan') + ' is paid off.', date: ctx.m.day,
      facts: [[money(pay), 'a month, yours again'], ...(back ? [['≈ ' + hrs(back) + ' hr', 'a week, back for school']] : [])] }, null, 'three');
    ctx.go('home');
  },
  saveExtra: async ctx => {
    const roth = num('xroth'), inv = num('xinv');
    if (!(roth >= 0) || !(inv >= 0 && inv <= 100)) return toast('Check the numbers.');
    closeSheet(); await ctx.write('extra.set', { first: document.querySelector('#xfirst .opt.on')?.dataset.v || 'loan', rothLimit: roth, investShare: inv / 100 }, 'Kept');
  },
  step: (ctx, el) => { const i = document.getElementById('chrs'), v = el.dataset.v; i.value = v === '−1' ? Math.max(0, (+i.value || 0) - 1) : v === '+1' ? (+i.value || 0) + 1 : v; },
  savePaycheck: async ctx => {
    const date = document.getElementById('cdate').value, net = num('cnet'), hours = num('chrs');
    if (!date || !(net > 0) || !(hours > 0)) return toast('The date, take-home and hours.');
    closeSheet(); await ctx.write('paycheck', { date, net, hours }, 'Paycheck kept', 'tick');
  },
  saveFunBal: async ctx => { const v = num('fbal'); if (!(v >= 0)) return; closeSheet(); await ctx.write('balance', { date: ctx.m.day, jar: 'personal', value: v }, 'Kept'); },
  saveVault: async ctx => { const v = num('vbal'); if (!(v >= 0)) return; closeSheet(); await ctx.write('balance', { date: ctx.m.day, jar: 'vault', value: v }, 'Kept'); },
};
