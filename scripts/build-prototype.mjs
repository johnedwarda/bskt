// Builds the interactive prototype as one standalone page: prototype/site/index.html.
// The sources are the design canvas's own files (prototype/src/*.dc.html, copied from the canvas);
// prototype/runtime.js renders them with React. Run: node scripts/build-prototype.mjs
import { readFileSync, readdirSync, mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..', 'prototype');
const srcDir = join(root, 'src');
const outDir = join(root, 'site');

// JSON that is safe inside an inline <script>
const js = (v) => JSON.stringify(v).replace(/</g, '\\u003c').replace(/\u2028/g, '\\u2028').replace(/\u2029/g, '\\u2029');

const sources = Object.fromEntries(
  readdirSync(srcDir)
    .filter((f) => f.endsWith('.dc.html'))
    .map((f) => [f.replace(/\.dc\.html$/, ''), readFileSync(join(srcDir, f), 'utf8')]),
);
const runtime = readFileSync(join(root, 'runtime.js'), 'utf8');

const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover, user-scalable=no">
<meta name="theme-color" content="#F5F3EC">
<title>bskt — interactive prototype</title>
<link rel="icon" href="data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 64 64%22%3E%3Crect width=%2264%22 height=%2264%22 rx=%2214%22 fill=%22%23111113%22/%3E%3Cg transform=%22translate%2813 9.5%29 scale%280.47%29 translate%28-2 -6%29%22%3E%3Cpath d=%22M14 34H26V84Q26 98 12 98H6V87H9Q14 87 14 82Z%22 fill=%22%23F6F6F3%22/%3E%3Ccircle cx=%2220%22 cy=%2218%22 r=%227.5%22 fill=%22%236A5CFF%22/%3E%3Cpath d=%22M35.5 57H73.5A19 19 0 1 0 69.1 69.2%22 fill=%22none%22 stroke=%22%23F6F6F3%22 stroke-width=%2211%22/%3E%3C/g%3E%3C/svg%3E">
<style>
html, body { margin: 0; height: 100%; overflow: hidden; overscroll-behavior: none; }
body { background: #E6E2D6; -webkit-tap-highlight-color: transparent; }
header { position: fixed; left: 0; top: 0; right: 0; z-index: 4; padding: 16px 20px; display: flex; align-items: center; gap: 10px;
  color: #1B2B22; font: 600 17px/1.2 system-ui, -apple-system, "Segoe UI", sans-serif; letter-spacing: -0.01em; }
header .je { width: 24px; height: 29px; display: block; flex: none; }
header h1 { margin: 0; font: inherit; white-space: nowrap; min-width: 0; }
@media (max-width: 389px) { header h1 .ip { display: none; } }
header h1 span { color: rgba(27, 43, 34, 0.6); font-weight: 400; }
@media (max-width: 519px) { header { padding: 12px 16px; font-size: 15px; } }
#stage { position: fixed; inset: 0; display: flex; align-items: center; justify-content: center; }
#phone { flex: none; width: 390px; height: 844px; transform-origin: 50% 50%; border-radius: 48px; overflow: hidden;
  background: #F5F3EC; box-shadow: 0 0 0 10px #1B2B22, 0 30px 80px rgba(27, 43, 34, 0.28); }
#back { margin-left: auto; flex: none; display: inline-flex; align-items: center; gap: 12px; height: 44px; padding: 0 6px 0 18px; border: 0;
  border-radius: 22px; background: color-mix(in srgb, #1B2B22 7%, transparent); color: #1B2B22; font-family: inherit; font-size: 15px; font-weight: 500; line-height: 1; letter-spacing: 0;
  cursor: pointer; -webkit-tap-highlight-color: transparent; transition: background 0.25s; }
#back:hover { background: color-mix(in srgb, #1B2B22 12%, transparent); }
#back .dot { width: 32px; height: 32px; border-radius: 16px; background: #3B2BEF; color: #FFFFFF; display: grid; place-items: center;
  transition: transform 0.3s cubic-bezier(0.2, 0.8, 0.2, 1); }
#back:hover .dot { transform: translateX(-3px); }
#back:active .dot { transform: scale(0.92); }
#back:focus-visible { outline: 2px solid #3B2BEF; outline-offset: 3px; }
@media (max-width: 519px) { #back { height: 40px; border-radius: 20px; padding: 0 6px 0 16px; gap: 10px; font-size: 14px; } #back .dot { width: 28px; height: 28px; border-radius: 14px; } }
@media (prefers-reduced-motion: reduce) { #back .dot { transition: none; } }
#fail { display: none; position: fixed; inset: 0; padding: 24px; font: 15px/1.5 system-ui, sans-serif; color: #1B2B22; }
</style>
<script src="https://cdnjs.cloudflare.com/ajax/libs/react/18.3.1/umd/react.production.min.js"></script>
<script src="https://cdnjs.cloudflare.com/ajax/libs/react-dom/18.3.1/umd/react-dom.production.min.js"></script>
</head>
<body>
<header>
  <svg class="je" viewBox="2 6 81 96" role="img" aria-label="John Edward"><path d="M14 34H26V84Q26 98 12 98H6V87H9Q14 87 14 82Z" fill="currentColor"/><circle cx="20" cy="18" r="7.5" fill="#6A5CFF"/><path d="M35.5 57H73.5A19 19 0 1 0 69.1 69.2" fill="none" stroke="currentColor" stroke-width="11"/></svg>
  <h1>bskt <span>· <span class="ip">interactive </span>prototype</span></h1>
  <button id="back" class="pill" type="button"><span>Back</span><span class="dot"><svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true"><path d="M11.5 7H2.5M6 3.5 2.5 7 6 10.5" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg></span></button>
</header>
<div id="stage"><div id="phone"></div></div>
<div id="fail">The prototype couldn't load. Check your connection and reload the page.</div>
<script>
${runtime}
</script>
<script>
(function () {
  if (!window.React || !window.ReactDOM || !window.DCRuntime) { document.getElementById('fail').style.display = 'block'; return; }
  var sources = ${js(sources)};
  Object.keys(sources).forEach(function (n) { DCRuntime.register(n, sources[n]); });
  var phone = document.getElementById('phone');
  var back = document.getElementById('back');
  // Always show the phone frame (10px border) scaled to fit below the header.
  var stage = document.getElementById('stage');
  var header = document.querySelector('header');
  function fit() {
    // the phone sits in the space below the header
    var hh = header.offsetHeight;
    stage.style.top = hh + 'px';
    var w = window.innerWidth, h = window.innerHeight - hh;
    var pad = w < 600 ? 40 : 64;
    var s = Math.min(1, (w - pad) / 410, (h - pad) / 864);
    phone.style.transform = 'scale(' + s + ')';
  }
  // Same as the browser's Back button; if this page was opened in a new tab, return to the page that linked here.
  back.addEventListener('click', function () {
    if (window.history.length > 1) { window.history.back(); return; }
    if (document.referrer) { window.location.href = document.referrer; return; }
    window.close();
  });
  fit();
  window.addEventListener('resize', fit);
  DCRuntime.mount('Prototype', phone);
})();
</script>
</body>
</html>
`;

mkdirSync(outDir, { recursive: true });
writeFileSync(join(outDir, 'index.html'), html);
console.log('wrote ' + join(outDir, 'index.html') + ' (' + Math.round(html.length / 1024) + ' KB)');
