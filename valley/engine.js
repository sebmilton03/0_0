// 0_0 — valley engine. The math, and nothing else: no screens, no storage, no dates from the clock.
// Every function takes plain data and gives plain data back, so valley/test.html can check it.
//
// The idea in one breath: once a month the income account is split into jars. Bills fills up to
// what this month's bills plus the saving-ahead for big bills need, Gas and Misc top up to a cap,
// Personal gets a fixed refill, the Vault tops up to its cap. Whatever is left goes to the loan or
// the Roth first (your switch), then the other, then 75/25 into investing and fun.
'use strict';

const VE = (() => {
  const round2 = n => Math.round(n * 100) / 100;
  const pos = n => Math.max(0, n);
  const sum = a => a.reduce((t, x) => t + x, 0);
  const JARS = ['bills', 'gas', 'misc', 'personal', 'vault'];
  const WEEKS_PER_MONTH = 52 / 12;

  /* ---------- Months ----------
     A month is a 'YYYY-MM' string. No clocks, no time zones. */
  const ym = (y, m) => y + '-' + String(m + 1).padStart(2, '0');               // m is 0-11
  const parseYM = s => ({ y: +s.slice(0, 4), m: +s.slice(5, 7) - 1 });
  const monthNum = s => { const p = parseYM(s); return p.y * 12 + p.m; };
  const addMonths = (s, k) => { const t = monthNum(s) + k; return ym(Math.floor(t / 12), ((t % 12) + 12) % 12); };
  const monthsBetween = (a, b) => monthNum(b) - monthNum(a);                     // b − a
  const monthOfYear = s => parseYM(s).m;
  const yearOf = s => parseYM(s).y;
  const monthOfDay = iso => iso.slice(0, 7);                                     // '2026-10-15' → '2026-10'

  /* ---------- Days ----------
     Days as whole numbers since 1970 (same trick as Money): daylight saving can't move them. */
  const DAY = 864e5;
  const dayOf = iso => Date.UTC(+iso.slice(0, 4), +iso.slice(5, 7) - 1, +iso.slice(8, 10)) / DAY;
  const isoOf = d => new Date(d * DAY).toISOString().slice(0, 10);
  const daysInMonth = s => { const p = parseYM(s); return new Date(Date.UTC(p.y, p.m + 1, 0)).getUTCDate(); };
  const firstOf = s => s + '-01';

  /* ---------- Bills ----------
     Every bill has 12 amounts, Jan → Dec. Most are the same every month; car insurance might be
     $1,320 in March and September and $0 the rest. One bill can be the loan payment: its amount
     comes from the loan, so it's never typed twice.

     Bills sets aside the same amount every month (the year's bills ÷ 12). In months with big
     bills it pays out more than it gets, so it has to start those months with extra already saved.
       run[m]    = what you've set aside minus what's been paid, Jan through month m
       left[m]   = run[m] − the lowest run of the year + cushion   (what Bills holds after m's bills)
       target[m] = left[m] + due[m]                                (what Bills should hold on the 1st)
     The lowest point of the year then sits exactly at the cushion, never below. */
  function billAmounts(bill, loan) {
    if (bill.loan) return Array(12).fill(loan ? +loan.payment || 0 : 0);
    return bill.amounts.map(a => +a || 0);
  }
  function billPlan(bills, loan, cushion = 0) {
    const rows = bills.map(b => ({ id: b.id, name: b.name, loan: !!b.loan, amounts: billAmounts(b, loan) }));
    const due = Array.from({ length: 12 }, (_, m) => sum(rows.map(r => r.amounts[m])));
    const perMonth = sum(due) / 12;
    const run = []; let c = 0;
    for (let m = 0; m < 12; m++) { c += perMonth - due[m]; run.push(c); }
    const low = Math.min(...run);
    const left = run.map(r => r - low + cushion);
    const target = left.map((l, m) => l + due[m]);
    // The same thing bill by bill, so the "why" sheet can say what each big bill has saved so far.
    const perBill = rows.map(r => {
      const pm = sum(r.amounts) / 12, rr = []; let cc = 0;
      for (let m = 0; m < 12; m++) { cc += pm - r.amounts[m]; rr.push(cc); }
      const lo = Math.min(...rr);
      const flat = r.amounts.every(a => Math.abs(a - r.amounts[0]) < 0.005);
      return { id: r.id, name: r.name, loan: r.loan, perMonth: pm, flat, amounts: r.amounts, saved: rr.map(x => x - lo) };
    });
    return { due, perMonth, run, left, target, cushion, perBill };
  }

  // Why Bills needs what it needs on the 1st of month m (0-11): what's due, what's saved ahead, the cushion.
  function billsWhy(plan, m) {
    const dueItems = plan.perBill.filter(b => b.amounts[m] > 0).map(b => ({ id: b.id, name: b.name, loan: b.loan, amount: b.amounts[m] }));
    const ahead = plan.perBill.filter(b => !b.flat && b.saved[m] > 0.005).map(b => {
      let next = null;
      for (let k = 1; k <= 12; k++) if (b.amounts[(m + k) % 12] > 0) { next = (m + k) % 12; break; }
      const big = next == null ? 0 : b.amounts[next];
      let since = 0;   // months of saving since this bill was last paid
      for (let k = 0; k < 12; k++) { if (b.amounts[(m - k + 12) % 12] > 0) break; since++; }
      return { id: b.id, name: b.name, saved: b.saved[m], perMonth: b.perMonth, nextMonth: next, nextAmount: big, months: since, of: big / (b.perMonth || 1) };
    });
    const aheadTotal = plan.left[m] - plan.cushion;
    const shared = round2(aheadTotal - sum(ahead.map(a => a.saved)));   // 0 when big bills line up
    return { due: plan.due[m], dueItems, ahead, aheadTotal, shared, cushion: plan.cushion, target: plan.target[m] };
  }

  /* ---------- The split (Dam Day) ----------
     inp = {
       month:  'YYYY-MM',
       income: what's in the income account to split,
       bal:    { bills, gas, misc, personal, vault }   what each jar holds before moving anything,
       owed:   loan balance on the 1st, before this month's payment,
       rothUsed: Roth put in this calendar year before this month,
       iou:    money borrowed from other jars since the last split (Personal pays it back),
       extraBills: change to monthly bills from life events (projections only),
     }
     s = settings (see DATA in docs/valley-data.md). Returns every transfer and why. */
  function split(inp, s, plan = billPlan(s.bills, s.loan, s.jars.bills.cushion)) {
    const m = monthOfYear(inp.month);
    const loanPay = s.loan ? +s.loan.payment || 0 : 0;
    const hasLoanBill = s.bills.some(b => b.loan);
    // The last payment covers that month's interest too, so the loan really hits $0.
    const owedWithInterest = pos(inp.owed || 0) * (1 + (s.loan ? +s.loan.apr || 0 : 0) / 12);
    const carDue = hasLoanBill ? Math.min(loanPay, owedWithInterest) : 0;
    const extraBills = inp.extraBills || 0;
    const billsDue = plan.due[m] - (hasLoanBill ? loanPay : 0) + carDue + extraBills;
    const billsTarget = plan.target[m] - (hasLoanBill ? loanPay : 0) + carDue + extraBills;
    const B = pos(+inp.income || 0);
    const bal = inp.bal;
    const iou = pos(inp.iou || 0);
    const P = pos(+s.jars.personal.amount || 0);
    const iouCharged = Math.min(iou, P);

    const need = {
      bills: pos(billsTarget - bal.bills),
      gas: pos(s.jars.gas.cap - bal.gas),
      misc: pos(s.jars.misc.cap - bal.misc),
      personal: P - iouCharged,
      vault: pos(s.jars.vault.cap - bal.vault),
    };
    const give = {}; let rest = B;
    for (const j of JARS) { give[j] = Math.min(need[j], rest); rest -= give[j]; }
    const short = sum(JARS.map(j => need[j] - give[j]));
    const left = rest;

    const owedAfterPay = pos(owedWithInterest - carDue);
    const rothRoom = pos(s.extra.rothLimit - (inp.rothUsed || 0));
    let extraLoan, roth;
    if (s.extra.first === 'roth') { roth = Math.min(left, rothRoom); extraLoan = Math.min(left - roth, owedAfterPay); }
    else { extraLoan = Math.min(left, owedAfterPay); roth = Math.min(left - extraLoan, rothRoom); }
    const after = left - extraLoan - roth;
    const invest = after * s.extra.investShare;
    const fun = after - invest;

    return {
      month: inp.month, income: B, carDue, billsDue, billsTarget, need, give, short, left,
      rothRoom, owedAfterPay, extraLoan, roth, invest, fun, iouCharged, iouLeft: iou - iouCharged,
      toPersonal: give.personal + fun,
      total: sum(JARS.map(j => give[j])) + extraLoan + roth + invest + fun,
    };
  }

  // What the loan owes after a month: interest on what was owed on the 1st, minus what was paid.
  function loanStep(owed, apr, paid) {
    if (owed <= 0) return { owed: 0, interest: 0 };
    const interest = owed * apr / 12;
    const left = owed + interest - paid;
    return { owed: left < 0.005 ? 0 : left, interest };   // a fraction of a cent left over counts as paid
  }

  // When the loan is gone and how much interest it cost, paying `monthly` + any extra each month.
  function payoff(owed, apr, monthly, extra = 0, from = '2000-01') {
    let o = owed, k = 0, interest = 0;
    while (o > 0.005 && k < 600) {
      const st = loanStep(o, apr, Math.min(monthly, o * (1 + apr / 12)) + extra);
      interest += st.interest; o = st.owed; k++;
    }
    return { months: k, month: k ? addMonths(from, k - 1) : null, interest, never: k >= 600 };
  }

  /* ---------- Pay ----------
     $/hr is the average of your latest checks: take-home ÷ hours, same as Money. A raise shows fast. */
  function payRate(paychecks, n = 3) {
    const cs = paychecks.filter(c => c.hours > 0 && c.net > 0).slice().sort((a, b) => (a.date < b.date ? -1 : 1)).slice(-n);
    if (!cs.length) return null;
    const hours = sum(cs.map(c => c.hours)), net = sum(cs.map(c => c.net));
    return { rate: net / hours, checks: cs, hours, net };
  }
  // A pay schedule from one stub: paid every `every` days, for the period ending `lag` days before.
  function stub(payIso, fromIso, toIso) {
    if (!payIso || !fromIso || !toIso) return { error: 'Fill in all three dates off the stub.' };
    const pay = dayOf(payIso), a = dayOf(fromIso), b = dayOf(toIso);
    const every = b - a + 1, lag = pay - b;
    if (every !== 7 && every !== 14) return { error: 'The pay period should be 1 or 2 weeks long (it’s ' + every + ' days).' };
    if (lag < 0 || lag > 14) return { error: 'The pay date should be 0–14 days after the period ends.' };
    return { payDate: payIso, every, lag };
  }
  function nextPayday(sched, todayIso) {
    const anchor = dayOf(sched.payDate), t = dayOf(todayIso);
    return isoOf(anchor + (Math.floor((t - anchor) / sched.every) + 1) * sched.every);
  }
  function paydaysBetween(sched, aIso, bIso) {   // paydays with a < day ≤ b
    const anchor = dayOf(sched.payDate), a = dayOf(aIso), b = dayOf(bIso), out = [];
    for (let k = Math.floor((a - anchor) / sched.every) + 1; anchor + k * sched.every <= b; k++) out.push(isoOf(anchor + k * sched.every));
    return out;
  }
  function periodFor(sched, payIso) {            // the work days a payday pays for
    const p = dayOf(payIso);
    return { from: isoOf(p - sched.lag - sched.every + 1), to: isoOf(p - sched.lag) };
  }
  // The next check, roughly: hours logged in its period × $/hr, and what a full period would make.
  function nextCheck(sched, shifts, rate, hoursPerWeek, todayIso, timerHours = 0) {
    const pay = nextPayday(sched, todayIso), per = periodFor(sched, pay);
    const logged = sum(shifts.filter(x => x.date >= per.from && x.date <= per.to).map(x => +x.hours || 0)) +
      (todayIso >= per.from && todayIso <= per.to ? timerHours : 0);
    const full = hoursPerWeek * sched.every / 7;
    return { pay, from: per.from, to: per.to, logged, full, soFar: logged * rate, estimate: Math.max(logged, full) * rate, every: sched.every };
  }

  /* ---------- Life events ----------
     { kind: 'income', start, end?, amount }  take-home per month becomes `amount` (a new job)
     { kind: 'bills',  start, end?, amount }  monthly bills change by `amount` (−300 = insurance covered)
     { kind: 'once',   start, amount }        one month's income changes (−808 = a week off) */
  const active = (e, mo) => e.on !== false && mo >= e.start && (!e.end || mo <= e.end);
  function incomeFor(mo, baseIncome, events) {
    let inc = baseIncome;
    for (const e of events) if (e.kind === 'income' && active(e, mo)) inc = +e.amount;
    for (const e of events) if (e.kind === 'once' && e.on !== false && e.start === mo) inc += +e.amount;
    return inc;
  }
  // A bills event changes bills by its amount; an income event can carry a bills change too
  // (a new job whose health plan replaces the one you pay for).
  function billsChange(mo, events) {
    return sum(events.filter(e => active(e, mo)).map(e => e.kind === 'bills' ? +e.amount || 0 : e.kind === 'income' ? +e.bills || 0 : 0));
  }

  /* ---------- Projection ----------
     Runs the split month after month with expected income and expected spending.
     start = { month, income?, bal, owed, rothUsed: { [year]: amount }, roth, invest }
       start.income replaces the expected income for the first month (e.g. what's in the lake).
     opts  = { months, events, first (override the switch), funSpent (default true) } */
  function project(start, s, opts = {}) {
    const n = opts.months || 60, events = opts.events || [];
    const ss = opts.first ? { ...s, extra: { ...s.extra, first: opts.first } } : s;
    const plan = billPlan(ss.bills, ss.loan, ss.jars.bills.cushion);
    const g = ss.extra.growth / 12, apr = ss.loan ? ss.loan.apr : 0;
    let bal = { ...start.bal }, owed = start.owed || 0, roth = start.roth || 0, invest = start.invest || 0;
    const used = { ...(start.rothUsed || {}) };
    const rows = [];
    let mo = start.month;
    for (let i = 0; i < n; i++) {
      const y = yearOf(mo);
      const income = i === 0 && start.income != null ? start.income : incomeFor(mo, ss.income.monthly, events);
      const sp = split({ month: mo, income, bal, owed, rothUsed: used[y] || 0, iou: i === 0 ? start.iou || 0 : 0, extraBills: billsChange(mo, events) }, ss, plan);
      used[y] = (used[y] || 0) + sp.roth;
      const st = loanStep(owed, apr, sp.carDue + sp.extraLoan);
      const before = { ...bal };
      bal = {
        bills: bal.bills + sp.give.bills - sp.billsDue,
        gas: pos(bal.gas + sp.give.gas - ss.jars.gas.spend),
        misc: pos(bal.misc + sp.give.misc - ss.jars.misc.spend),
        personal: pos(bal.personal + sp.give.personal + (opts.funSpent === false ? sp.fun : 0) - (+ss.jars.personal.amount || 0)),
        vault: bal.vault + sp.give.vault,
      };
      roth = (roth + sp.roth) * (1 + g);
      invest = (invest + sp.invest) * (1 + g);
      const cash = sum(JARS.map(j => bal[j]));
      rows.push({ month: mo, income, split: sp, before, after: { ...bal }, owedStart: owed, owed: st.owed, interest: st.interest,
        roth, invest, cash, mmd: cash + roth + invest - st.owed });
      owed = st.owed;
      mo = addMonths(mo, 1);
    }
    return rows;
  }

  // The numbers people actually ask about, from a projection.
  function summarize(rows, until) {
    const sel = until ? rows.filter(r => r.month <= until) : rows;
    const last = sel[sel.length - 1];
    const paid = sel.find(r => r.owedStart > 0 && r.owed <= 0.005);
    let c = 0, pass = null;
    for (const r of sel) { c += r.split.roth + r.split.invest; if (!pass && c >= r.owed) pass = r.month; }
    return {
      payoff: paid ? paid.month : (sel.length && sel[0].owedStart <= 0 ? 'none' : null),
      loanMonths: sel.filter(r => r.split.carDue >= 100).length,
      interest: sum(sel.map(r => r.interest)),
      roth: sum(sel.map(r => r.split.roth)),
      invested: sum(sel.map(r => r.split.roth + r.split.invest)),
      value: last ? last.roth + last.invest : 0,
      mmd: last ? last.mmd : 0,
      positive: (sel.find(r => r.mmd >= 0) || {}).month || null,
      passOwed: pass,
      short: sel.filter(r => r.split.short > 0.5).map(r => ({ month: r.month, amount: r.split.short })),
      until: last ? last.month : null,
    };
  }

  /* ---------- Freedom meter ----------
     How many hours a week your life costs: what the jars need each month ÷ $/hr ÷ weeks a month. */
  function needs(s, owed = 1, extraBills = 0) {
    const plan = billPlan(s.bills, s.loan, s.jars.bills.cushion);
    const hasLoanBill = s.bills.some(b => b.loan);
    const loanPay = hasLoanBill && s.loan ? +s.loan.payment || 0 : 0;
    const bills = plan.perMonth - (owed > 0 ? 0 : loanPay) + extraBills;
    const parts = { bills, gas: +s.jars.gas.spend || 0, misc: +s.jars.misc.spend || 0, personal: +s.jars.personal.amount || 0 };
    return { parts, total: sum(Object.values(parts)), loanPay };
  }
  function freedom(s, rate, owed) {
    const n = needs(s, owed), hpw = +s.income.hoursPerWeek || 0;
    const hours = rate > 0 ? n.total / rate / WEEKS_PER_MONTH : null;
    const afterLoan = rate > 0 && owed > 0 ? (n.total - n.loanPay) / rate / WEEKS_PER_MONTH : hours;
    return { needs: n.total, parts: n.parts, rate, hours, hoursPerWeek: hpw, spare: hours == null ? null : hpw - hours, afterLoan, loanPay: n.loanPay };
  }
  const hoursFor = (monthlyNeeds, rate) => rate > 0 ? monthlyNeeds / rate / WEEKS_PER_MONTH : null;

  /* ---------- Personal ---------- */
  function wishPlan(w, fromMonth) {
    const months = Math.max(1, monthsBetween(fromMonth, w.by) + 1);   // refills left, counting this month's
    const left = pos((+w.price || 0) - (+w.saved || 0));
    return { months, left, monthly: left / months, done: left <= 0.005 };
  }
  function refill(s, wishes, fromMonth) {
    const P = +s.jars.personal.amount || 0;
    const subs = sum((s.subs || []).map(x => +x.amount || 0));
    const wish = wishes.map(w => ({ ...w, ...wishPlan(w, fromMonth) }));
    const toWishes = sum(wish.filter(w => !w.done).map(w => w.monthly));
    return { amount: P, subs, toWishes, free: P - subs - toWishes, wishes: wish };
  }
  function perDay(balance, todayIso, nextSplitIso) {
    const days = Math.max(1, dayOf(nextSplitIso) - dayOf(todayIso));
    return { days, perDay: balance / days };
  }

  return {
    JARS, WEEKS_PER_MONTH, round2,
    ym, parseYM, addMonths, monthsBetween, monthOfYear, yearOf, monthOfDay, dayOf, isoOf, daysInMonth, firstOf,
    billPlan, billsWhy, split, loanStep, payoff, payRate, stub, nextPayday, paydaysBetween, periodFor, nextCheck,
    incomeFor, billsChange, project, summarize, needs, freedom, hoursFor, wishPlan, refill, perDay,
  };
})();

if (typeof module !== 'undefined') module.exports = VE;
