// Rules from CLAUDE.md that are easy to break by accident: no colours in JavaScript, both colour schemes
// complete, the layering, every state class styled, and a service-worker cache list that covers every file.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { DECISIONS, DECIDED_IDS } from '../js/model/decisions.js';

const root = new URL('..', import.meta.url).pathname;
const read = (p) => readFileSync(join(root, p), 'utf8');

function files(dir, ext = '') {
  return readdirSync(join(root, dir)).flatMap((f) => {
    const p = join(dir, f);
    if (statSync(join(root, p)).isDirectory()) return files(p, ext);
    return p.endsWith(ext) ? [p] : [];
  });
}

test('no colour values in JavaScript: colours belong to css/app.css', () => {
  const colour = /#[0-9a-fA-F]{3,8}(?![0-9a-zA-Z_])|\brgba?\(|\bhsla?\(/;
  const styleProp = /['"]?(fill|stroke|color|background|backgroundColor|borderColor)['"]?\s*:\s*['"`]|\.style\.(fill|stroke|color|background)/;
  for (const f of [...files('js', '.js'), 'sw.js']) {
    read(f).split('\n').forEach((line, i) => {
      assert.ok(!colour.test(line), `${f}:${i + 1} has a colour value: ${line.trim()}`);
      assert.ok(!styleProp.test(line), `${f}:${i + 1} sets a colour property: ${line.trim()}`);
    });
  }
});

test('the pure layers do not touch the browser', () => {
  const browser = /\b(document|window|indexedDB|localStorage|navigator|fetch)\b\s*[.(]/;
  for (const f of [...files('js/model', '.js'), ...files('js/parse', '.js'), 'js/data/export.js']) {
    read(f).split('\n').forEach((line, i) => {
      if (line.trim().startsWith('//')) return;
      assert.ok(!browser.test(line), `${f}:${i + 1} uses a browser API: ${line.trim()}`);
    });
  }
});

test('only db.js uses IndexedDB', () => {
  for (const f of files('js', '.js').filter((f) => !f.endsWith('data/db.js'))) {
    assert.ok(!/\bindexedDB\b/.test(read(f)), `${f} uses IndexedDB directly`);
  }
});

test('light and dark scheme define every colour token the stylesheet uses', () => {
  const css = read('css/app.css');
  const blockAfter = (marker) => {
    const at = css.indexOf(marker);
    assert.ok(at >= 0, `missing ${marker}`);
    const start = css.indexOf(':root {', at);
    return css.slice(start, css.indexOf('}', start));
  };
  const defined = (text) => new Set([...text.matchAll(/(--[a-z0-9-]+)\s*:/g)].map((m) => m[1]));
  const light = defined(blockAfter('/* Hjem-inventar'));
  const dark = defined(blockAfter('@media (prefers-color-scheme: dark)'));
  const used = new Set([...css.matchAll(/var\((--[a-z0-9-]+)/g)].map((m) => m[1]));
  for (const t of used) {
    assert.ok(light.has(t), `light scheme is missing ${t}`);
    assert.ok(dark.has(t), `dark scheme is missing ${t}`);
  }
  assert.deepEqual([...light].sort(), [...dark].sort(), 'both schemes define the same tokens');
});

test('every state class JavaScript sets has a style', () => {
  const css = read('css/app.css');
  const classes = [
    'room-empty', 'room-open', 'room-done',
    ...DECISIONS.map((d) => `dec-${d.id}`),
    ...DECIDED_IDS.map((id) => `filter-${id}`),
    'level-0', 'level-1', 'level-2', 'level-3', 'selected',
  ];
  for (const c of classes) assert.ok(css.includes(`.${c}`), `css/app.css has no style for .${c}`);
});

test('every decision has a Danish label and hint', () => {
  for (const d of DECISIONS) {
    assert.ok(d.labelDa?.length > 1, `${d.id} has no labelDa`);
    assert.ok(d.hintDa?.length > 5, `${d.id} has no hintDa`);
  }
});

test('the service worker caches every file the app needs, and only files that exist', () => {
  const sw = read('sw.js');
  const list = sw.slice(sw.indexOf('const ASSETS = ['), sw.indexOf('];', sw.indexOf('const ASSETS = [')));
  const assets = new Set([...list.matchAll(/'\.\/([^']*)'/g)].map((m) => m[1]));
  const needed = ['index.html', 'manifest.webmanifest', ...['js', 'css', 'icons', 'demo'].flatMap((d) => files(d))];
  for (const f of needed) assert.ok(assets.has(f), `sw.js ASSETS is missing ./${f}`);
  for (const a of assets) if (a) assert.ok(existsSync(join(root, a)), `sw.js lists ./${a}, which does not exist`);
});

test('manifest and index.html point to files that exist', () => {
  const manifest = JSON.parse(read('manifest.webmanifest'));
  assert.equal(manifest.lang, 'da');
  for (const icon of manifest.icons) assert.ok(existsSync(join(root, icon.src)), `manifest icon ${icon.src} is missing`);
  const html = read('index.html');
  for (const [, ref] of html.matchAll(/(?:href|src)="([^"#:]+)"/g)) assert.ok(existsSync(join(root, ref)), `index.html refers to missing ${ref}`);
});

// docs/ holds README screenshots, and they must only show the fictional example home.
test('no real personal data: no images outside icons/ and docs/', () => {
  const allowed = (f) => f.startsWith('icons/') || f.startsWith('docs/') || f.startsWith('.git');
  const images = files('.', '').filter((f) => /\.(png|jpe?g|webp|heic|pdf)$/i.test(f) && !allowed(f));
  assert.deepEqual(images, [], 'an image outside icons/ and docs/ – is a real floor plan committed by mistake?');
});
