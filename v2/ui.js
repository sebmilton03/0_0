// Small shared pieces for every place: escaping, haptics, sheets, the undo toast and the stars.

export const $ = id => document.getElementById(id);
export const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

// Haptics as punctuation: a check is one light tick, done for today a soft double, Dam Day closed a slow three.
// Mistakes get nothing, ever.
export const HAPTIC = { tick: 10, double: [12, 90, 12], three: [30, 160, 30, 160, 30] };
export const buzz = p => { try { navigator.vibrate && navigator.vibrate(HAPTIC[p] || p); } catch {} };

/** calm.html's stars: the same seeded scatter, as an SVG behind the screen. */
export function stars(n, h = 520, seed = 3) {
  const r = () => (seed = (seed * 9301 + 49297) % 233280) / 233280;
  let s = '';
  for (let i = 0; i < n; i++) s += `<circle cx="${(r() * 390).toFixed(1)}" cy="${(r() * h).toFixed(1)}" r="${(0.5 + r() * 1.1).toFixed(2)}" fill="#fff" opacity="${(0.25 + r() * 0.6).toFixed(2)}"/>`;
  return `<svg class="stars" viewBox="0 0 390 844" preserveAspectRatio="xMidYMin slice">${s}</svg>`;
}

/* ---------- Sheets: rise over the screen, never a new page ---------- */
let sheetEl = null, onClose = null;
export const sheetOpen = () => !!sheetEl;
export function openSheet(html, { closed } = {}) {
  const layer = $('layer');
  closeSheet(true);
  layer.innerHTML = `<div class="scrim" data-act="close"></div><div class="sheet" role="dialog" aria-modal="true"><div class="grab"></div>${html}</div>`;
  const s = layer.querySelector('.sheet'), scrim = layer.querySelector('.scrim');
  sheetEl = s; onClose = closed || null;
  setTimeout(() => { scrim.classList.add('on'); s.classList.add('on'); }, 20);
  // Android back closes the sheet instead of leaving the app.
  history.pushState({ sheet: true }, '');
  let y0 = null;
  s.addEventListener('touchstart', e => { if (s.scrollTop <= 0) y0 = e.touches[0].clientY; }, { passive: true });
  s.addEventListener('touchmove', e => { if (y0 !== null) s.style.transform = `translateY(${Math.max(0, e.touches[0].clientY - y0)}px)`; }, { passive: true });
  s.addEventListener('touchend', e => { if (y0 === null) return; const dy = e.changedTouches[0].clientY - y0; y0 = null; s.style.transform = ''; if (dy > 90) closeSheet(); });
  return s;
}
export function closeSheet(now, fromBack) {
  if (!sheetEl) return;
  const layer = $('layer'), s = sheetEl, cb = onClose;
  sheetEl = null; onClose = null;
  if (!fromBack && history.state && history.state.sheet) history.back();
  if (now) layer.innerHTML = '';
  else { s.classList.remove('on'); layer.querySelector('.scrim')?.classList.remove('on'); setTimeout(() => { if (!sheetEl) layer.innerHTML = ''; }, 330); }
  if (cb) cb();
}
addEventListener('popstate', () => { if (sheetEl) closeSheet(false, true); });

/* ---------- Undo, never "are you sure?": a quiet six seconds ---------- */
let toastTimer;
export function toast(text, undoId) {
  let t = document.querySelector('.toast');
  if (!t) { t = document.createElement('div'); t.className = 'toast'; document.body.append(t); }
  t.innerHTML = esc(text) + (undoId ? ` <button data-undo="${esc(undoId)}">undo</button>` : '');
  setTimeout(() => t.classList.add('on'), 20);
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.remove('on'), 6000);
}
export const hideToast = () => document.querySelector('.toast')?.classList.remove('on');

/** Calm numbers: rounded everyday money ("about $3,600"), exact only when asked. */
export const money = (n, exact = false) => (n < 0 ? '−' : '') + '$' + Math.abs(n).toLocaleString('en-US', exact ? { minimumFractionDigits: 2, maximumFractionDigits: 2 } : { maximumFractionDigits: 0 });
/** Hours with halves, the way calm.html writes them: 32½. */
export function hrs(h) {
  const r = Math.round(h * 2) / 2, whole = Math.trunc(r);
  return (r < 0 ? '−' : '') + (Math.abs(whole) || (Math.abs(r) % 1 ? '' : '0')) + (Math.abs(r) % 1 ? '½' : '');
}
