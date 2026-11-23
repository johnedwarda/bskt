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
<title>bskt prototype</title>
<style>
html, body { margin: 0; height: 100%; overflow: hidden; overscroll-behavior: none; }
body { background: #E6E2D6; -webkit-tap-highlight-color: transparent; }
#stage { position: fixed; inset: 0; display: flex; align-items: center; justify-content: center; }
#phone { flex: none; width: 390px; height: 844px; transform-origin: 50% 50%; border-radius: 48px; overflow: hidden;
  background: #F5F3EC; box-shadow: 0 0 0 10px #1B2B22, 0 30px 80px rgba(27, 43, 34, 0.28); }
#back { position: fixed; left: 0; top: 0; z-index: 5; width: 44px; height: 44px; margin: -22px 0 0 -22px; padding: 0; border: 0;
  border-radius: 50%; background: #1B2B22; color: #F5F3EC; display: grid; place-items: center; cursor: pointer;
  box-shadow: 0 0 0 3px #E6E2D6, 0 6px 16px rgba(27, 43, 34, 0.3); -webkit-tap-highlight-color: transparent;
  transition: transform 160ms cubic-bezier(0.2, 0.8, 0.2, 1); }
#back:hover { transform: scale(1.06); }
#back:active { transform: scale(0.94); }
#back:focus-visible { outline: 2px solid #A8432E; outline-offset: 3px; }
#fail { display: none; position: fixed; inset: 0; padding: 24px; font: 15px/1.5 system-ui, sans-serif; color: #1B2B22; }
</style>
<script src="https://cdnjs.cloudflare.com/ajax/libs/react/18.3.1/umd/react.production.min.js"></script>
<script src="https://cdnjs.cloudflare.com/ajax/libs/react-dom/18.3.1/umd/react-dom.production.min.js"></script>
</head>
<body>
<div id="stage"><div id="phone"></div></div>
<button id="back" type="button" aria-label="Back"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M15 5l-7 7 7 7"/></svg></button>
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
  // Always show the phone frame (10px border) scaled to fit, with the back button on its top-left corner.
  function fit() {
    var w = window.innerWidth, h = window.innerHeight;
    var pad = w < 600 ? 40 : 64;
    var s = Math.min(1, (w - pad) / 410, (h - pad) / 864);
    phone.style.transform = 'scale(' + s + ')';
    var r = phone.getBoundingClientRect();
    // centre of the button sits on the frame's outer corner arc, at 45 degrees (corner radius 48 + border 10)
    var k = (48 - 58 * Math.SQRT1_2) * s;
    back.style.left = (r.left + k) + 'px'; back.style.top = (r.top + k) + 'px';
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
