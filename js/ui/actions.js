// Actions used from more than one view: adding a floor plan, loading the example home, export and backup.

import { h } from './dom.js';
import { ask, choose } from './dialog.js';
import * as db from '../data/db.js';
import { download, blobToDataUrl, dataUrlToBlob, imageAspect } from '../data/files.js';
import { toCSV, toBackup, fromBackup, fileStamp } from '../data/export.js';
import { addFloor, newId, markExported, mergeDocs } from '../model/inventory.js';
import { addDemo, DEMO_PLAN_URL } from '../model/demo.js';

// A button that opens the file picker. The <input> sits inside the <label>, so a tap opens it on every phone.
export function fileButton({ label, accept, onFile, kind = null }) {
  const input = h('input', {
    type: 'file', accept, class: 'visually-hidden',
    onchange: () => {
      const file = input.files?.[0];
      input.value = '';
      if (file) onFile(file);
    },
  });
  return h('label', { class: ['btn', kind && `btn-${kind}`, 'file-btn'] }, label, input);
}

export async function addPlanFromFile(ctx, file) {
  if (!file.type.startsWith('image/')) {
    ctx.toast('Vælg et billede (PNG eller JPG). Er plantegningen en PDF, så tag et skærmbillede af den først.');
    return;
  }
  const name = await ask({
    title: 'Ny plantegning',
    label: 'Hvilken etage er det?',
    value: ctx.doc.floors.length ? '' : 'Stueetage',
    placeholder: 'Fx Stueetage, 1. sal, Kælder',
    ok: 'Læg ind',
  });
  if (!name) return;
  const aspect = (await imageAspect(file)) ?? 0.75;
  const imageId = newId();
  await db.putImage(imageId, file);
  ctx.images.set(imageId, URL.createObjectURL(file));
  const floor = ctx.commit((doc) => addFloor(doc, { name, imageId, aspect }));
  ctx.setPref('floorId', floor.id);
  ctx.toast('Plantegningen er lagt ind. Træk nu en firkant over hvert rum.');
  ctx.go(`#/plan/${floor.id}`);
}

export async function loadDemo(ctx) {
  try {
    const blob = await (await fetch(DEMO_PLAN_URL)).blob();
    const imageId = newId();
    await db.putImage(imageId, blob);
    ctx.images.set(imageId, URL.createObjectURL(blob));
    const floor = ctx.commit((doc) => addDemo(doc, imageId));
    ctx.setPref('floorId', floor.id);
    ctx.toast('Eksempel-boligen er indlæst. Du kan slette den igen under Indstillinger.');
    ctx.go('#/');
  } catch {
    ctx.toast('Eksempel-boligen kunne ikke indlæses.');
  }
}

export function exportCSV(ctx) {
  download(`inventar-${fileStamp()}.csv`, toCSV(ctx.doc), 'text/csv;charset=utf-8');
}

export async function exportBackup(ctx) {
  const images = {};
  for (const f of ctx.doc.floors) {
    if (!f.imageId) continue;
    const blob = await db.getImage(f.imageId);
    if (blob) images[f.imageId] = await blobToDataUrl(blob);
  }
  ctx.commit((doc) => markExported(doc));
  download(`inventar-backup-${fileStamp()}.json`, toBackup(ctx.doc, images), 'application/json');
  ctx.toast('Backuppen er gemt. Læg filen et sikkert sted, fx i iCloud eller Google Drev.');
}

export async function importBackup(ctx, file) {
  let backup;
  try {
    backup = fromBackup(await file.text());
  } catch (err) {
    ctx.toast(err.message);
    return;
  }
  const mode = await choose({
    title: 'Gendan backup',
    message: `Backuppen indeholder ${backup.doc.rooms.length} rum og ${backup.doc.items.length} poster.`,
    options: [
      { value: 'merge', label: 'Flet ind', hint: 'Behold det, der er her, og tilføj backuppen. Det nyeste vinder.' },
      { value: 'replace', label: 'Erstat alt', hint: 'Det, der er her nu, slettes og erstattes af backuppen.', kind: 'danger' },
    ],
  });
  if (!mode) return;
  if (mode === 'replace') {
    await db.clearImages();
    for (const url of ctx.images.values()) URL.revokeObjectURL(url);
    ctx.images.clear();
  }
  for (const [id, url] of Object.entries(backup.images)) {
    const blob = await dataUrlToBlob(url);
    await db.putImage(id, blob);
    if (ctx.images.has(id)) URL.revokeObjectURL(ctx.images.get(id));
    ctx.images.set(id, URL.createObjectURL(blob));
  }
  ctx.replaceDoc(mode === 'replace' ? backup.doc : mergeDocs(ctx.doc, backup.doc));
  ctx.toast(mode === 'replace' ? 'Backuppen er gendannet.' : 'Backuppen er flettet ind.');
  ctx.go('#/');
}
