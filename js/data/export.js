// Export formats. Pure functions (no DOM): CSV for Excel, a full JSON backup, and plain text for a list.

import { labelOf } from '../model/decisions.js';
import { findFloor, itemsIn, validateDoc } from '../model/inventory.js';
import { orderedRooms } from '../model/stats.js';

export const BACKUP_APP = 'hjem-inventar';
export const BACKUP_VERSION = 1;

// Danish Excel expects semicolons and needs a BOM to read æøå as UTF-8.
const BOM = '﻿';

export function csvField(value) {
  let s = String(value ?? '');
  if (/^[=+\-@]/.test(s)) s = `'${s}`; // never let a cell be read as a formula
  return /[";\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export function toCSV(doc) {
  const rows = [['Etage', 'Rum', 'Ting', 'Antal', 'Beslutning', 'Note']];
  for (const room of orderedRooms(doc)) {
    const floor = room.floorId ? findFloor(doc, room.floorId)?.name ?? '' : '';
    for (const item of itemsIn(doc, room.id)) rows.push([floor, room.name, item.name, item.qty, labelOf(item.decision), item.note]);
  }
  return BOM + rows.map((r) => r.map(csvField).join(';')).join('\r\n') + '\r\n';
}

// images: { [imageId]: dataUrl } – the floor plans, so a backup restores everything on a new phone.
export function toBackup(doc, images = {}, now = Date.now()) {
  return JSON.stringify({ app: BACKUP_APP, version: BACKUP_VERSION, exportedAt: new Date(now).toISOString(), doc, images });
}

export function fromBackup(text) {
  let raw;
  try {
    raw = JSON.parse(text);
  } catch {
    throw new Error('Filen kan ikke læses. Er det en backup fra Hjem-inventar?');
  }
  if (raw?.app !== BACKUP_APP) throw new Error('Filen er ikke en backup fra Hjem-inventar.');
  if (raw.version > BACKUP_VERSION) throw new Error('Backuppen er fra en nyere version af appen. Opdatér appen først.');
  const doc = validateDoc(raw.doc);
  const wanted = new Set(doc.floors.map((f) => f.imageId).filter(Boolean));
  const images = {};
  for (const [id, url] of Object.entries(raw.images ?? {})) {
    if (wanted.has(id) && typeof url === 'string' && url.startsWith('data:image/')) images[id] = url;
  }
  return { doc, images };
}

// "Smid ud – 7 ting" followed by the items per room, ready to paste into a message or a note.
export function listAsText(groups, decision) {
  const total = groups.reduce((s, g) => s + g.things, 0);
  const lines = [`${labelOf(decision)} – ${total} ting`];
  for (const g of groups) {
    lines.push('', g.room.name);
    for (const i of g.items) lines.push(`- ${i.qty > 1 ? `${i.qty} × ` : ''}${i.name}${i.note ? ` (${i.note})` : ''}`);
  }
  return lines.join('\n');
}

export const fileStamp = (now = Date.now()) => new Date(now).toISOString().slice(0, 10);
