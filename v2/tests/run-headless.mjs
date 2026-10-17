// Runs the test pages in headless Chrome and prints each result line. No packages needed.
//   node v2/tests/run-headless.mjs            (from the repo folder)
// It serves the repo on localhost itself and uses a throwaway Chrome profile, so it never sees
// the live site's data. Set CHROME=path\to\chrome.exe if Chrome isn't in the usual place.
// Exit code 0 = everything green.

import { createServer } from 'node:http';
import { readFile, mkdtemp, rm } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { spawn } from 'node:child_process';
import { join, extname, resolve, dirname } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const PAGES = ['money/test.html', 'valley/test.html', 'v2/tests/test.html'];
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.json': 'application/json', '.png': 'image/png', '.css': 'text/css' };
const CHROME = process.env.CHROME || [
  'C:/Program Files/Google/Chrome/Application/chrome.exe', 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', '/usr/bin/google-chrome', '/usr/bin/chromium',
].find(existsSync);
if (!CHROME) { console.error('No Chrome found. Set CHROME to its path.'); process.exit(2); }

const server = createServer(async (req, res) => {
  const path = join(ROOT, decodeURIComponent(new URL(req.url, 'http://x').pathname));
  if (!path.startsWith(ROOT)) { res.writeHead(403).end(); return; }
  let body;
  try { body = await readFile(path); } catch { res.writeHead(404).end(); return; }
  res.writeHead(200, { 'Content-Type': TYPES[extname(path)] || 'application/octet-stream', 'Cache-Control': 'no-store' }).end(body);
});
await new Promise(r => server.listen(0, '127.0.0.1', r));
const base = 'http://localhost:' + server.address().port + '/';

const profile = await mkdtemp(join(tmpdir(), '0_0-tests-'));
const port = 9300 + Math.floor(Math.random() * 500);
const chrome = spawn(CHROME, ['--headless=new', '--disable-gpu', '--no-first-run', `--remote-debugging-port=${port}`, `--user-data-dir=${profile}`, 'about:blank'], { stdio: 'ignore' });
const sleep = ms => new Promise(r => setTimeout(r, ms));

let failed = 0;
try {
  let tabs;
  for (let i = 0; i < 75 && !tabs; i++) { await sleep(200); try { tabs = await (await fetch(`http://127.0.0.1:${port}/json`)).json(); } catch {} }
  const ws = new WebSocket(tabs.find(t => t.type === 'page').webSocketDebuggerUrl);
  await new Promise(r => (ws.onopen = r));
  let n = 0; const wait = {};
  ws.onmessage = e => { const m = JSON.parse(e.data); if (m.id && wait[m.id]) { wait[m.id](m.result); delete wait[m.id]; } };
  const cdp = (method, params = {}) => new Promise(r => { const id = ++n; wait[id] = r; ws.send(JSON.stringify({ id, method, params })); });
  const evaluate = async js => (await cdp('Runtime.evaluate', { expression: js, returnByValue: true })).result.value;

  for (const page of PAGES) {
    await cdp('Page.navigate', { url: base + page });
    let sum = '';
    for (let i = 0; i < 150; i++) {   // up to 30 s
      await sleep(200);
      sum = await evaluate(`(() => { const s = document.getElementById('sum'); const t = s ? s.textContent : '';
        return /check|fail/i.test(t) && (document.body.dataset.done || !document.querySelector('script[type=module]')) ? t : ''; })()`);
      if (sum) break;
    }
    const bad = await evaluate(`[...document.querySelectorAll('li.bad')].map(li => li.textContent)`) || [];
    const ok = sum && /^All \d+ checks pass$/.test(sum);
    if (!ok) failed++;
    console.log((ok ? 'PASS ' : 'FAIL ') + page.padEnd(22) + (sum || 'no result (timed out)'));
    for (const b of bad) console.log('     ' + b);
  }
  ws.close();
} finally {
  chrome.kill(); server.close();
  await sleep(300); await rm(profile, { recursive: true, force: true }).catch(() => {});
}
process.exit(failed ? 1 : 0);
