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
body.full { background: #F5F3EC; }
body.full #phone { border-radius: 0; box-shadow: none; }
#fail { display: none; position: fixed; inset: 0; padding: 24px; font: 15px/1.5 system-ui, sans-serif; color: #1B2B22; }
</style>
<script src="https://cdnjs.cloudflare.com/ajax/libs/react/18.3.1/umd/react.production.min.js"></script>
<script src="https://cdnjs.cloudflare.com/ajax/libs/react-dom/18.3.1/umd/react-dom.production.min.js"></script>
</head>
<body>
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
  // Fill the screen on a phone; show a phone-sized frame on anything bigger.
  function fit() {
    var w = window.innerWidth, h = window.innerHeight;
    var full = w < 600;
    document.body.classList.toggle('full', full);
    var s = full ? Math.min(w / 390, h / 844) : Math.min(1, (w - 64) / 390, (h - 64) / 844);
    phone.style.transform = 'scale(' + s + ')';
  }
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
