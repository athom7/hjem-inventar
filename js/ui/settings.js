// Settings: floor plans, backup and export, installing on the phone, and starting over.

import { h, fmt, plural } from './dom.js';
import { ask, confirmDialog } from './dialog.js';
import { fileButton, addPlanFromFile, loadDemo, exportCSV, exportBackup, importBackup } from './actions.js';
import * as db from '../data/db.js';
import { renameFloor, removeFloor, roomsOn, createDoc } from '../model/inventory.js';
import { houseStats } from '../model/stats.js';

const dateDa = (ms) => new Date(ms).toLocaleDateString('da-DK', { day: 'numeric', month: 'long', year: 'numeric' });

export function renderSettings(view, ctx) {
  ctx.setTitle('Indstillinger');
  const { doc } = ctx;
  const st = houseStats(doc);

  // --- floor plans ---
  view.append(h('section', { class: 'panel' },
    h('h2', { text: 'Plantegninger' }),
    h('p', { class: 'muted', text: 'Ét billede pr. etage. Har du plantegningen som PDF, så tag et skærmbillede af den og vælg billedet.' }),
    doc.floors.length
      ? h('ul', { class: 'floor-list' }, doc.floors.map((f) => h('li', { class: 'floor-row' },
        ctx.images.get(f.imageId) ? h('img', { class: 'thumb', src: ctx.images.get(f.imageId), alt: '' }) : h('span', { class: 'thumb' }),
        h('div', { class: 'grow' }, h('strong', { text: f.name }), h('small', { class: 'muted', text: plural(roomsOn(doc, f.id).length, 'rum', 'rum') })),
        h('div', { class: 'row-actions' },
          h('a', { class: 'btn btn-small', href: `#/plan/${f.id}`, text: 'Markér rum' }),
          h('button', { type: 'button', class: 'btn btn-small', text: 'Omdøb', onclick: () => rename(ctx, f) }),
          h('button', { type: 'button', class: 'btn btn-small btn-danger', text: 'Slet', onclick: () => removePlan(ctx, f) })))))
      : null,
    h('div', { class: 'actions' },
      fileButton({ label: '+ Læg plantegning ind', accept: 'image/*', kind: 'primary', onFile: (file) => addPlanFromFile(ctx, file) }),
      doc.floors.some((f) => f.name === 'Eksempel-bolig') ? null : h('button', { type: 'button', class: 'btn btn-quiet', text: 'Prøv med en eksempel-bolig', onclick: () => loadDemo(ctx) }))));

  // --- rooms ---
  view.append(h('section', { class: 'panel' },
    h('h2', { text: 'Rum' }),
    h('p', { class: 'muted', text: 'Opret husets rum på én gang ud fra antal værelser og badeværelser i BBR-meddelelsen. Rum, der findes i forvejen, springes over.' }),
    h('div', { class: 'actions' }, h('a', { class: 'btn', href: '#/quickstart', text: 'Hurtigstart: opret rum' }))));

  // --- backup and export ---
  view.append(h('section', { class: 'panel' },
    h('h2', { text: 'Backup og eksport' }),
    h('p', { class: 'muted', text: doc.meta.lastExportAt ? `Sidste backup: ${dateDa(doc.meta.lastExportAt)}.` : 'Du har ikke taget backup endnu.' }),
    h('p', { text: 'Alt ligger kun på denne telefon. Tag en backup af og til, og læg filen et sikkert sted.' }),
    h('div', { class: 'actions' },
      h('button', { type: 'button', class: 'btn btn-primary', text: 'Tag backup', disabled: !doc.rooms.length, onclick: () => exportBackup(ctx) }),
      h('button', { type: 'button', class: 'btn', text: 'Eksportér til Excel (CSV)', disabled: !doc.items.length, onclick: () => exportCSV(ctx) }),
      fileButton({ label: 'Gendan backup …', accept: 'application/json,.json', onFile: (file) => importBackup(ctx, file) }))));

  // --- install ---
  const standalone = matchMedia('(display-mode: standalone)').matches || navigator.standalone === true;
  view.append(h('section', { class: 'panel' },
    h('h2', { text: 'Installér på telefonen' }),
    standalone
      ? h('p', { text: 'Appen er installeret. Den virker også uden netværk.' })
      : [
        h('p', { text: 'Installér appen på hjemmeskærmen. Så åbner den som en app, virker uden netværk, og browseren rydder ikke dine data.' }),
        ctx.installPrompt
          ? h('button', { type: 'button', class: 'btn btn-primary', text: 'Installér', onclick: () => install(ctx) })
          : h('ul', { class: 'steps' },
            h('li', {}, h('strong', { text: 'iPhone (Safari): ' }), 'tryk på Del-knappen og vælg »Føj til hjemmeskærm«.'),
            h('li', {}, h('strong', { text: 'Android (Chrome): ' }), 'åbn menuen ⋮ og vælg »Installér app« eller »Føj til startskærm«.')),
      ],
    h('p', { class: 'muted', 'data-persist': '' }, 'Tjekker lagring …')));
  db.isPersisted().then((ok) => {
    const p = view.querySelector('[data-persist]');
    if (p) p.textContent = ok ? 'Browseren har lovet at gemme dine data permanent.' : 'Browseren har ikke lovet at gemme permanent endnu – installér appen og tag backup.';
  });

  // --- start over ---
  view.append(h('section', { class: 'panel' },
    h('h2', { text: 'Start forfra' }),
    h('p', { class: 'muted', text: `Der er ${plural(st.rooms, 'rum', 'rum')} og ${plural(doc.items.length, 'post', 'poster')} i inventaret.` }),
    h('button', { type: 'button', class: 'btn btn-danger', text: 'Slet alt', disabled: !doc.rooms.length && !doc.floors.length, onclick: () => wipe(ctx) })));

  view.append(h('p', { class: 'about muted' }, 'Hjem-inventar · dine data forlader aldrig telefonen, medmindre du selv eksporterer dem.'));
}

async function rename(ctx, floor) {
  const name = await ask({ title: 'Omdøb etage', label: 'Navn', value: floor.name, ok: 'Gem' });
  if (name) ctx.commit((doc) => renameFloor(doc, floor.id, name));
}

async function removePlan(ctx, floor) {
  const n = roomsOn(ctx.doc, floor.id).length;
  const ok = await confirmDialog({
    title: `Slet plantegningen ${floor.name}?`,
    message: n ? `${plural(n, 'rum', 'rum')} og deres ting bliver liggende under »Uden etage«, men markeringerne på tegningen forsvinder.` : null,
    ok: 'Slet',
    danger: true,
  });
  if (!ok) return;
  const imageId = ctx.commit((doc) => removeFloor(doc, floor.id));
  if (imageId) {
    await db.deleteImage(imageId);
    URL.revokeObjectURL(ctx.images.get(imageId));
    ctx.images.delete(imageId);
  }
}

async function install(ctx) {
  const prompt = ctx.installPrompt;
  ctx.installPrompt = null;
  await prompt.prompt();
  ctx.render();
}

async function wipe(ctx) {
  const first = await confirmDialog({ title: 'Slet alt?', message: 'Alle rum, ting og plantegninger slettes fra telefonen.', ok: 'Slet alt', danger: true });
  if (!first) return;
  const second = await confirmDialog({ title: 'Er du helt sikker?', message: `${fmt(ctx.doc.items.length)} poster forsvinder. Det kan ikke fortrydes uden en backup.`, ok: 'Ja, slet alt', danger: true });
  if (!second) return;
  await db.clearImages();
  for (const url of ctx.images.values()) URL.revokeObjectURL(url);
  ctx.images.clear();
  ctx.replaceDoc(createDoc());
  ctx.toast('Alt er slettet.');
  ctx.go('#/');
}
