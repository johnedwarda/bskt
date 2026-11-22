# Prototype

The interactive prototype from the design canvas, as a standalone web page.

- `src/*.dc.html`: the canvas files, copied as they are (`Prototype.dc.html`, and `Illo.dc.html` for the item pictures). To update, copy the new versions from the canvas over these.
- `runtime.js`: a small runtime that renders the canvas's component format with React.
- `node scripts/build-prototype.mjs` builds `site/index.html`, a single page that runs offline apart from React and the fonts.

Pushing changes here to `main` publishes the page to GitHub Pages (`.github/workflows/prototype.yml`).
