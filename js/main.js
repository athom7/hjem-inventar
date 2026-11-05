// Start-up, shared state and hash routing. Views get `ctx` and draw into <main id="view">; every change to
// the inventory goes through ctx.commit(), which saves to IndexedDB and redraws.

import { createDoc, validateDoc } from './model/inventory.js';
import { backupDue } from './model/stats.js';
import * as db from './data/db.js';
import { h } from './ui/dom.js';
import { renderHome } from './ui/planview.js';
import { renderPlanEdit } from './ui/planedit.js';
import { renderRoom } from './ui/room.js';
import { renderCapture } from './ui/capture.js';
import { renderTriage, resetTriage } from './ui/triage.js';
import { renderLists } from './ui/lists.js';
import { renderSettings } from './ui/settings.js';
import { exportBackup } from './ui/actions.js';

const VIEWS = { home: renderHome, plan: renderPlanEdit, room: renderRoom, capture: renderCapture, triage: renderTriage, lists: renderLists, settings: renderSettings };
const NAV_OF = { home: 'home', plan: 'home', room: 'home', capture: 'home', triage: 'triage', lists: 'lists', settings: 'settings' };
const PREFS_KEY = 'hjem-inventar-prefs';

const view = document.getElementById('view');
const titleEl = document.getElementById('title');
const backBtn = document.getElementById('back');
const bannersEl = document.getElementById('banners');
const toastEl = document.getElementById('toast');

let cleanup = null;
let renderedHash = null;
let saving = Promise.resolve();
let persistAsked = false;
let backupBannerHidden = false;

// Per-device conveniences (selected floor, filter). Not inventory data, so localStorage is fine.
function loadPrefs() {
  try {
    return JSON.parse(localStorage.getItem(PREFS_KEY)) ?? {};
  } catch {
    return {};
  }
}

const ctx = {
  doc: null,
  images: new Map(), // imageId → object URL of the stored floor-plan image
  prefs: loadPrefs(),
  installPrompt: null,

  commit(change) {
    const result = change(ctx.doc);
    save();
    render();
    return result;
  },
  replaceDoc(doc) {
    ctx.doc = doc;
    save();
    render();
  },
  go(hash) {
    if (location.hash === hash || (hash === '#/' && location.hash === '')) render();
    else location.hash = hash;
  },
  render,
  setTitle(text, backHash = null) {
    titleEl.textContent = text;
    document.title = text === 'Hjem-inventar' ? text : `${text} · Hjem-inventar`;
    backBtn.hidden = !backHash;
    backBtn.onclick = backHash ? () => { location.hash = backHash; } : null;
  },
  setPref(key, value, rerender = false) {
    ctx.prefs[key] = value;
    try {
      localStorage.setItem(PREFS_KEY, JSON.stringify(ctx.prefs));
    } catch { /* private mode: the choice just isn't remembered */ }
    if (rerender) render();
  },
  toast(message) {
    toastEl.textContent = message;
    toastEl.classList.add('show');
    clearTimeout(toastEl.timer);
    toastEl.timer = setTimeout(() => toastEl.classList.remove('show'), 4000);
  },
};

function save() {
  const doc = ctx.doc;
  saving = saving
    .then(() => db.saveDoc(doc))
    .catch(() => ctx.toast('Kunne ikke gemme. Er telefonens lager fuldt?'));
  if (!persistAsked) {
    persistAsked = true;
    db.requestPersist();
  }
}

function route() {
  const parts = location.hash.replace(/^#\/?/, '').split('/').filter(Boolean).map(decodeURIComponent);
  switch (parts[0]) {
    case 'room': return parts[2] === 'capture' ? ['capture', { roomId: parts[1] }] : ['room', { roomId: parts[1] }];
    case 'plan': return ['plan', { floorId: parts[1] }];
    case 'triage': return ['triage', { roomId: parts[1] ?? null }];
    case 'lists': return ['lists', { decision: parts[1] ?? 'trash' }];
    case 'settings': return ['settings', {}];
    default: return ['home', {}];
  }
}

function render() {
  const [name, params] = route();
  const sameView = renderedHash === location.hash;
  const pageScroll = sameView ? window.scrollY : 0;
  const planScroll = sameView ? view.querySelector('.plan-wrap') : null;
  const planPos = planScroll ? [planScroll.scrollLeft, planScroll.scrollTop] : null;

  cleanup?.();
  cleanup = null;
  if (name !== 'triage') resetTriage();
  renderedHash = location.hash;

  view.replaceChildren();
  renderBanners(name);
  const result = VIEWS[name](view, ctx, params);
  if (typeof result === 'function') cleanup = result;

  for (const a of document.querySelectorAll('[data-nav]')) {
    const current = a.dataset.nav === NAV_OF[name];
    a.classList.toggle('selected', current);
    if (current) a.setAttribute('aria-current', 'page');
    else a.removeAttribute('aria-current');
  }
  window.scrollTo(0, pageScroll);
  const wrap = view.querySelector('.plan-wrap');
  if (wrap && planPos) [wrap.scrollLeft, wrap.scrollTop] = planPos;
}

function renderBanners(name) {
  bannersEl.replaceChildren();
  if (name !== 'home' || !ctx.doc.items.length) return;
  const due = backupDue(ctx.doc);
  if (due.due && !backupBannerHidden) {
    bannersEl.append(banner(
      due.never ? `Du har ikke taget backup endnu, og der er ${ctx.doc.items.length} poster.` : `Det er ${due.daysSince} dage siden sidste backup.`,
      h('button', { type: 'button', class: 'btn btn-small btn-primary', text: 'Tag backup', onclick: () => exportBackup(ctx) }),
      () => { backupBannerHidden = true; render(); },
      true,
    ));
  }
  const standalone = matchMedia('(display-mode: standalone)').matches || navigator.standalone === true;
  if (!standalone && !ctx.prefs.installHintHidden) {
    bannersEl.append(banner(
      'Installér appen på hjemmeskærmen, så browseren ikke rydder dine data.',
      h('a', { class: 'btn btn-small', href: '#/settings', text: 'Sådan' }),
      () => ctx.setPref('installHintHidden', true, true),
    ));
  }
}

const banner = (text, action, onClose, warn = false) => h('div', { class: ['banner', warn && 'banner-warn'], role: 'status' },
  h('p', { text }), action,
  h('button', { type: 'button', class: 'btn btn-small btn-quiet', 'aria-label': 'Luk', text: '✕', onclick: onClose }));

addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault();
  ctx.installPrompt = e;
  if (route()[0] === 'settings') render();
});

async function start() {
  try {
    const stored = await db.loadDoc();
    ctx.doc = stored ? validateDoc(stored) : createDoc();
  } catch (err) {
    ctx.doc = createDoc();
    ctx.toast(`De gemte data kunne ikke åbnes: ${err.message}`);
  }
  for (const f of ctx.doc.floors) {
    if (!f.imageId) continue;
    try {
      const blob = await db.getImage(f.imageId);
      if (blob) ctx.images.set(f.imageId, URL.createObjectURL(blob));
    } catch { /* shown as "image missing" on the plan */ }
  }
  addEventListener('hashchange', render);
  render();
}

if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('./sw.js').catch(() => { /* still works online */ });
}

start();
