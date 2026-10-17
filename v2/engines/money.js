// Money in hours. The split itself is Valley's engine (valley/engine.js, its 94 checks), loaded as-is
// with a <script> tag before this module: it defines the global VE. Nothing here copies its math.
// This file turns v2's money state into what Money says: a feeling, a range, breathing room in hours,
// the day you can work less, the vault in months, fun money per day, and Dam Day one transfer at a time.

import { damDay, daysBetween, addDays } from './sebdate.js';

/* global VE */
export function engine() {
  try { return VE; } catch { throw new Error('valley/engine.js must load before v2 (it holds the split math).'); }
}

/** Money as v2 keeps it: the same shapes Valley's engine reads, so it can run them unchanged. */
export const EMPTY = {
  jars: {
    income: { name: 'Income', bank: '' },
    bills: { name: 'Bills', bank: '', cushion: 100 },
    gas: { name: 'Gas', bank: '', cap: 0, spend: 0 },
    misc: { name: 'Misc', bank: '', cap: 0, spend: 0 },
    personal: { name: 'Personal', bank: '', amount: 0 },
    vault: { name: 'Vault', bank: '', cap: 0 },
  },
  bills: [], loan: null, extra: { first: 'loan', rothLimit: 7500, investShare: 0.75, growth: 0.06 },
  income: { monthly: 0, hoursPerWeek: 0 }, pay: null, paychecks: [], balances: [], moves: {}, damDone: [], spent: [], ious: [], imported: null,
};
export const POCKETS = ['income', 'bills', 'gas', 'misc', 'personal', 'vault'];

/** Has Money got enough to talk? A bill and either a paycheck or an expected income. */
export const ready = m => !!m && m.bills.length > 0 && (m.paychecks.length > 0 || +m.income.monthly > 0);

/** The last typed balance of a pocket, and when. Nothing is pre-filled; this is only what you typed. */
export function lastBalance(m, jar) {
  const b = m.balances.filter(x => x.jar === jar).sort((a, c) => (a.date < c.date ? -1 : 1)).pop();
  return b ? { value: +b.value, date: b.date } : null;
}

/** $/hr from the last 3 checks, as a range: tips move it. */
export function payRange(m) {
  const VEe = engine(), r = VEe.payRate(m.paychecks);
  if (!r) return null;
  const each = r.checks.map(c => c.net / c.hours);
  return { rate: r.rate, lo: Math.min(...each), hi: Math.max(...each), checks: r.checks.length };
}

/**
 * Everything Money says, for a day. workWeek = hours of work planned a week (from Day), or null.
 */
export function view(s, today, workWeek = null) {
  const m = s.money || EMPTY, VEe = engine(), WPM = VEe.WEEKS_PER_MONTH;
  if (!ready(m)) return { ready: false };
  const pr = payRange(m);
  const rate = pr ? pr.rate : (+m.income.monthly > 0 && +m.income.hoursPerWeek > 0 ? m.income.monthly / (m.income.hoursPerWeek * WPM) : null);
  const owed = m.loan ? +m.loan.owed || 0 : 0;
  const life = VEe.needs(m, owed).total;                       // a month of life: bills (saving ahead for big ones), gas, misc, personal
  const loanPay = m.loan && m.bills.some(b => b.loan) ? +m.loan.payment || 0 : 0;
  const perWeek = workWeek != null && workWeek > 0 ? workWeek : +m.income.hoursPerWeek || 0;
  const planned = perWeek * WPM;                                // hours of work a month
  const lifeHours = rate ? life / rate : null;                  // hours of work a month that life costs
  const room = lifeHours == null ? null : planned - lifeHours;  // breathing room, in hours a month
  const incomeLo = pr ? planned * pr.lo : +m.income.monthly, incomeHi = pr ? planned * pr.hi : +m.income.monthly;
  const feeling = room == null ? 'unknown' : room >= 10 ? 'steady' : room >= 0 ? 'tight' : 'short';

  // Dam Day: the last day of this month; it splits for next month.
  const [y, mo] = today.split('-').map(Number), dam = damDay(y, mo), month = today.slice(0, 7);
  const splitMonth = VEe.addMonths(month, 1), done = m.damDone.includes(month), days = daysBetween(today, dam);
  // Valley lets the dam open up to 7 days early ("split early").
  const open = !done && days <= 7;

  const vaultBal = lastBalance(m, 'vault');
  const bareBills = m.bills.filter(b => b.bareMin).reduce((t, b) => t + b.amounts.reduce((a, x) => a + (+x || 0), 0) / 12, 0);
  const bare = bareBills + (+m.jars.gas.spend || 0) + (+m.jars.misc.spend || 0);
  const vault = vaultBal ? { balance: vaultBal.value, months: life > 0 ? vaultBal.value / life : null, bareMonths: bare > 0 ? vaultBal.value / bare : null, cap: +m.jars.vault.cap || 0 } : null;

  // Fun money per day until the dam opens: Personal as last typed, minus what you logged since.
  const pb = lastBalance(m, 'personal');
  const spentSince = pb ? m.spent.filter(x => x.date >= pb.date).reduce((t, x) => t + (+x.amount || 0), 0) : 0;
  // Once this month's dam is closed (even early), fun money lasts until next month's Dam Day.
  const nextDam = done ? damDay(mo === 12 ? y + 1 : y, mo === 12 ? 1 : mo + 1) : dam;
  const personal = pb ? { balance: pb.value - spentSince, ...VEe.perDay(pb.value - spentSince, today, addDays(nextDam, 1)), asOf: pb.date, until: nextDam } : null;
  const iou = m.ious.filter(x => !x.paid).reduce((t, x) => t + (+x.amount || 0), 0);

  const loan = m.loan && owed > 0 ? { ...m.loan, owed, payoff: VEe.payoff(owed, +m.loan.apr || 0, +m.loan.payment || 0, 0, splitMonth) } : null;
  return {
    ready: true, rate, range: pr ? { lo: pr.lo, hi: pr.hi } : null, life, lifeHours, planned, perWeek, room, feeling,
    income: { lo: incomeLo, hi: incomeHi },
    workLess: rate ? { now: life / rate / WPM, afterLoan: loanPay ? (life - loanPay) / rate / WPM : null } : null,
    dam: { date: dam, days, month, splitMonth, done, open }, vault, personal, iou, loan,
  };
}

/**
 * When the loan is paid off, if the extra hours this month keep going to it (Dam Day sends the leftover
 * to the loan first, unless the Roth is first). And what taking hours off today does to that date.
 * Returns null without a loan. { month: 'YYYY-MM', months, perMonth, extra, delayDays(h) }.
 */
export function payoffPlan(s, v) {
  const m = s.money, VEe = engine();
  if (!v.loan || !v.rate) return null;
  let extra = Math.max(0, v.room || 0) * v.rate;                         // money beyond what life costs, a month
  if (m.extra.first === 'roth') extra = Math.max(0, extra - (+m.extra.rothLimit || 0) / 12);
  const pay = +m.loan.payment || 0, p = VEe.payoff(v.loan.owed, +m.loan.apr || 0, pay, extra, v.dam.splitMonth);
  const perMonth = pay + extra;
  return { month: p.month, months: p.months, never: p.never, perMonth, extra,
    // An hour off is an hour's take-home that doesn't reach the loan: a one-time push, in days.
    delayDays: h => (perMonth > 0 ? Math.round(h * v.rate / perMonth * 30.4) : null) };
}

/** Breathing room in words, for the pillar and the top of Money. */
export const FEEL = {
  steady: 'Money feels steady.',
  tight: 'Money is tight, but covered.',
  short: 'This month is short.',
  unknown: 'Money is waiting on a paycheck.',
};

/** An extra shift, made visible: the loan goes sooner, but the week loses study time. */
export function trade(s, v, shiftHours) {
  const m = s.money, VEe = engine();
  if (!v.loan || !v.rate) return null;
  const extra = shiftHours * v.rate * VEe.WEEKS_PER_MONTH;   // one more shift a week, every week
  const base = VEe.payoff(v.loan.owed, +m.loan.apr || 0, +m.loan.payment || 0, 0), more = VEe.payoff(v.loan.owed, +m.loan.apr || 0, +m.loan.payment || 0, extra);
  return { sooner: base.months - more.months, monthsNow: base.months, monthsWith: more.months, studyLost: shiftHours, extra };
}

/**
 * Dam Day, worked out by Valley's split from the balances you type today.
 * typed = { income, bills, gas, misc, personal, vault }. Returns the split and the transfers, in order.
 */
export function damPlan(s, v, typed) {
  const m = s.money, VEe = engine();
  const used = m.balances.filter(b => b.jar === 'roth' && b.date.slice(0, 4) === v.dam.splitMonth.slice(0, 4)).reduce((t, b) => t + (+b.value || 0), 0);
  const sp = VEe.split({ month: v.dam.splitMonth, income: +typed.income || 0, bal: { bills: +typed.bills || 0, gas: +typed.gas || 0, misc: +typed.misc || 0, personal: +typed.personal || 0, vault: +typed.vault || 0 },
    owed: v.loan ? v.loan.owed : 0, rothUsed: used, iou: v.iou }, m);
  const J = m.jars, name = k => (J[k] && J[k].name) || k;
  const steps = [
    ['bills', sp.give.bills, name('bills')], ['gas', sp.give.gas, name('gas')], ['misc', sp.give.misc, name('misc')],
    ['personal', sp.toPersonal, name('personal')], ['vault', sp.give.vault, name('vault')],
    ['loan', sp.extraLoan, m.loan ? m.loan.name || 'the loan' : 'the loan'], ['roth', sp.roth, 'Roth'], ['invest', sp.invest, 'investing'],
  ].filter(([, amt]) => amt > 0.005).map(([key, amount, to]) => ({ key, amount: VEe.round2(amount), from: name('income'), to }));
  return { split: sp, steps, short: sp.short };
}

/** What each pocket holds after Dam Day's transfers, for the record. */
export function afterDam(typed, plan) {
  const g = plan.split.give;
  return { income: VE_round(+typed.income - plan.steps.reduce((t, x) => t + x.amount, 0)), bills: VE_round(+typed.bills + g.bills), gas: VE_round(+typed.gas + g.gas), misc: VE_round(+typed.misc + g.misc),
    personal: VE_round(+typed.personal + plan.split.toPersonal), vault: VE_round(+typed.vault + g.vault) };
}
const VE_round = n => Math.round(n * 100) / 100;

/**
 * Bring in from Valley (v1): read the archived Valley data and return what Money keeps.
 * Runs on the phone, once, when you tap it. Real numbers never pass through the repo.
 */
export function fromValley(json) {
  let v; try { v = typeof json === 'string' ? JSON.parse(json) : json; } catch { return null; }
  if (!v || !v.jars || !Array.isArray(v.bills)) return null;
  const jars = {};
  for (const k of POCKETS) jars[k] = { ...EMPTY.jars[k], ...(v.jars[k] || {}) };
  return {
    jars, bills: v.bills.map(b => ({ id: b.id, name: b.name, amounts: (b.amounts || []).map(Number), loan: !!b.loan })),
    loan: v.loan ? { name: v.loan.name, owed: +v.loan.owed, apr: +v.loan.apr, payment: +v.loan.payment, asOf: v.loan.asOf } : null,
    extra: { ...EMPTY.extra, ...(v.extra || {}) }, income: { monthly: +(v.income || {}).monthly || 0, hoursPerWeek: +(v.income || {}).hoursPerWeek || 0 },
    pay: v.pay || null, paychecks: (v.paychecks || []).map(c => ({ id: c.id, date: c.date, net: +c.net, hours: +c.hours })),
    balances: (v.balances || []).map(b => ({ date: b.date, jar: b.jar, value: +b.value })),
  };
}

/** Twelve monthly amounts for a bill: monthly, every 6 months, yearly or once, starting in a month (0-11). */
export function amountsFor(amount, rhythm, startMonth) {
  const a = Array(12).fill(0), n = +amount || 0;
  if (rhythm === 'monthly') return a.fill(n);
  if (rhythm === 'six') { a[startMonth] = n; a[(startMonth + 6) % 12] = n; return a; }
  a[startMonth] = n;   // yearly, or once (a once-off is kept for its month; it's removed after)
  return a;
}
