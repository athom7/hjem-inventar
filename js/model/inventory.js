// The inventory document: floors (each with a floor-plan image), rooms (with marked areas on the plan) and items.
// Pure functions that change the document in place. No DOM and no storage: the UI calls these and then saves.
//
// doc = {
//   version, meta: { createdAt, lastExportAt },
//   floors: [{ id, name, imageId, aspect, updatedAt }],            aspect = image height / width
//   rooms:  [{ id, name, floorId, areas: [{ x, y, w, h }], updatedAt }],   areas in plan coordinates 0..1
//   items:  [{ id, roomId, name, qty, decision, note, createdAt, updatedAt }],
// }

import { isDecision } from './decisions.js';
import { clampRect, isUsableRect } from './plan.js';

export const DOC_VERSION = 1;
const MAX_NAME = 120;
const MAX_NOTE = 500;
const MAX_QTY = 9999;

export function newId() {
  if (globalThis.crypto?.randomUUID) return globalThis.crypto.randomUUID();
  return `id-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

export function createDoc(now = Date.now()) {
  return { version: DOC_VERSION, meta: { createdAt: now, lastExportAt: null }, floors: [], rooms: [], items: [] };
}

// ---------- helpers ----------

const cleanName = (name) => String(name ?? '').replace(/\s+/g, ' ').trim().slice(0, MAX_NAME);
const cleanNote = (note) => String(note ?? '').trim().slice(0, MAX_NOTE);

export function cleanQty(qty) {
  const n = Math.round(Number(qty));
  return Number.isFinite(n) ? Math.min(Math.max(n, 1), MAX_QTY) : 1;
}

function required(name, what) {
  const n = cleanName(name);
  if (!n) throw new Error(`${what} skal have et navn.`);
  return n;
}

function mustFind(list, id, what) {
  const found = list.find((x) => x.id === id);
  if (!found) throw new Error(`${what} findes ikke (${id}).`);
  return found;
}

export const findFloor = (doc, id) => doc.floors.find((f) => f.id === id) ?? null;
export const findRoom = (doc, id) => doc.rooms.find((r) => r.id === id) ?? null;
export const findItem = (doc, id) => doc.items.find((i) => i.id === id) ?? null;
export const roomsOn = (doc, floorId) => doc.rooms.filter((r) => r.floorId === floorId);
export const itemsIn = (doc, roomId) => doc.items.filter((i) => i.roomId === roomId);

// ---------- floors ----------

export function addFloor(doc, { name, imageId = null, aspect = 0.75 }) {
  const floor = { id: newId(), name: required(name, 'Etagen'), imageId, aspect: cleanAspect(aspect), updatedAt: Date.now() };
  doc.floors.push(floor);
  return floor;
}

export function renameFloor(doc, id, name) {
  const floor = mustFind(doc.floors, id, 'Etagen');
  floor.name = required(name, 'Etagen');
  floor.updatedAt = Date.now();
}

// Rooms on a removed floor keep their items but lose their position on the plan.
// Returns the image id so the caller can delete the stored image.
export function removeFloor(doc, id) {
  const floor = mustFind(doc.floors, id, 'Etagen');
  doc.floors = doc.floors.filter((f) => f.id !== id);
  for (const room of roomsOn(doc, id)) {
    room.floorId = null;
    room.areas = [];
    room.updatedAt = Date.now();
  }
  return floor.imageId;
}

function cleanAspect(aspect) {
  const a = Number(aspect);
  return Number.isFinite(a) && a > 0.05 && a < 20 ? a : 0.75;
}

// ---------- rooms ----------

export function addRoom(doc, { name, floorId = null }) {
  if (floorId !== null) mustFind(doc.floors, floorId, 'Etagen');
  const room = { id: newId(), name: required(name, 'Rummet'), floorId, areas: [], updatedAt: Date.now() };
  doc.rooms.push(room);
  return room;
}

// Rooms made before there was a floor plan (quick start) move onto a floor. Their marking starts empty either way.
// Returns the rooms that moved.
export function adoptLooseRooms(doc, floorId) {
  mustFind(doc.floors, floorId, 'Etagen');
  const loose = doc.rooms.filter((r) => r.floorId === null);
  for (const room of loose) setRoomFloor(doc, room.id, floorId);
  return loose;
}

// Case-insensitive key for comparing room names ("køkken" and "Køkken" are the same room).
export const roomNameKey = (name) => cleanName(name).toLocaleLowerCase('da-DK');

// Several rooms at once (quick start). Names that already exist, or repeat, are skipped. Returns the new rooms.
export function addRooms(doc, names, floorId = null) {
  const taken = new Set(doc.rooms.map((r) => roomNameKey(r.name)));
  const created = [];
  for (const name of names) {
    const k = roomNameKey(name);
    if (!k || taken.has(k)) continue;
    taken.add(k);
    created.push(addRoom(doc, { name, floorId }));
  }
  return created;
}

export function renameRoom(doc, id, name) {
  const room = mustFind(doc.rooms, id, 'Rummet');
  room.name = required(name, 'Rummet');
  room.updatedAt = Date.now();
}

// Moving a room to another floor clears its marked areas: they belonged to the old plan.
export function setRoomFloor(doc, id, floorId) {
  const room = mustFind(doc.rooms, id, 'Rummet');
  if (floorId !== null) mustFind(doc.floors, floorId, 'Etagen');
  if (room.floorId === floorId) return;
  room.floorId = floorId;
  room.areas = [];
  room.updatedAt = Date.now();
}

// Removing a room removes its items too (the UI asks first).
export function removeRoom(doc, id) {
  mustFind(doc.rooms, id, 'Rummet');
  doc.rooms = doc.rooms.filter((r) => r.id !== id);
  doc.items = doc.items.filter((i) => i.roomId !== id);
}

export function addArea(doc, roomId, rect) {
  const room = mustFind(doc.rooms, roomId, 'Rummet');
  const area = clampRect(rect);
  if (!isUsableRect(area)) throw new Error('Firkanten er for lille.');
  room.areas.push(area);
  room.updatedAt = Date.now();
  return area;
}

export function removeArea(doc, roomId, index) {
  const room = mustFind(doc.rooms, roomId, 'Rummet');
  room.areas.splice(index, 1);
  room.updatedAt = Date.now();
}

// ---------- items ----------

// `entries` are what the parser (and the preview) produce: { name, qty, decision? }. Blank names are skipped.
export function addItems(doc, roomId, entries) {
  mustFind(doc.rooms, roomId, 'Rummet');
  const now = Date.now();
  const created = [];
  for (const e of entries) {
    const name = cleanName(e.name);
    if (!name) continue;
    const item = {
      id: newId(),
      roomId,
      name,
      qty: cleanQty(e.qty),
      decision: isDecision(e.decision) ? e.decision : 'undecided',
      note: cleanNote(e.note),
      createdAt: now,
      updatedAt: now,
    };
    doc.items.push(item);
    created.push(item);
  }
  return created;
}

export function updateItem(doc, id, patch) {
  const item = mustFind(doc.items, id, 'Tingen');
  if ('name' in patch) item.name = required(patch.name, 'Tingen');
  if ('qty' in patch) item.qty = cleanQty(patch.qty);
  if ('decision' in patch) item.decision = isDecision(patch.decision) ? patch.decision : 'undecided';
  if ('note' in patch) item.note = cleanNote(patch.note);
  if ('roomId' in patch) item.roomId = mustFind(doc.rooms, patch.roomId, 'Rummet').id;
  item.updatedAt = Date.now();
  return item;
}

export const setDecision = (doc, id, decision) => updateItem(doc, id, { decision });

export function removeItem(doc, id) {
  doc.items = doc.items.filter((i) => i.id !== id);
}

export function markExported(doc, now = Date.now()) {
  doc.meta.lastExportAt = now;
}

// ---------- validation and merge (used by import) ----------

const isObj = (x) => x !== null && typeof x === 'object' && !Array.isArray(x);
const num = (x, fallback) => (Number.isFinite(Number(x)) && x !== null && x !== '' ? Number(x) : fallback);
const str = (x) => (typeof x === 'string' && x ? x : null);

// Turns untrusted JSON into a clean document. Throws if it is not an inventory at all;
// otherwise drops or repairs what is broken (unknown decisions, items in missing rooms, bad areas).
export function validateDoc(raw) {
  if (!isObj(raw) || !Array.isArray(raw.rooms) || !Array.isArray(raw.items)) {
    throw new Error('Filen er ikke et inventar fra Hjem-inventar.');
  }
  const now = Date.now();
  const floors = (Array.isArray(raw.floors) ? raw.floors : []).filter(isObj).flatMap((f) => {
    const id = str(f.id);
    const name = cleanName(f.name);
    return id && name ? [{ id, name, imageId: str(f.imageId), aspect: cleanAspect(f.aspect), updatedAt: num(f.updatedAt, now) }] : [];
  });
  const floorIds = new Set(floors.map((f) => f.id));

  const rooms = raw.rooms.filter(isObj).flatMap((r) => {
    const id = str(r.id);
    const name = cleanName(r.name);
    if (!id || !name) return [];
    const floorId = floorIds.has(r.floorId) ? r.floorId : null;
    const areas = floorId && Array.isArray(r.areas) ? r.areas.filter(isObj).map(clampRect).filter(isUsableRect) : [];
    return [{ id, name, floorId, areas, updatedAt: num(r.updatedAt, now) }];
  });
  const roomIds = new Set(rooms.map((r) => r.id));

  const items = raw.items.filter(isObj).flatMap((i) => {
    const id = str(i.id);
    const name = cleanName(i.name);
    if (!id || !name || !roomIds.has(i.roomId)) return [];
    return [{
      id,
      roomId: i.roomId,
      name,
      qty: cleanQty(i.qty),
      decision: isDecision(i.decision) ? i.decision : 'undecided',
      note: cleanNote(i.note),
      createdAt: num(i.createdAt, now),
      updatedAt: num(i.updatedAt, now),
    }];
  });

  const meta = isObj(raw.meta) ? raw.meta : {};
  return {
    version: DOC_VERSION,
    meta: { createdAt: num(meta.createdAt, now), lastExportAt: num(meta.lastExportAt, null) },
    floors: dedupe(floors),
    rooms: dedupe(rooms),
    items: dedupe(items),
  };
}

function dedupe(list) {
  const seen = new Set();
  return list.filter((x) => !seen.has(x.id) && seen.add(x.id));
}

// Merge a backup into the current document: everything from both, and where the same thing exists in both,
// the most recently changed version wins.
export function mergeDocs(current, incoming) {
  const pick = (a, b) => {
    const byId = new Map(a.map((x) => [x.id, x]));
    for (const x of b) {
      const mine = byId.get(x.id);
      if (!mine || x.updatedAt > mine.updatedAt) byId.set(x.id, x);
    }
    return [...byId.values()];
  };
  const minOrNull = (a, b) => (a === null ? b : b === null ? a : Math.min(a, b));
  const maxOrNull = (a, b) => (a === null ? b : b === null ? a : Math.max(a, b));
  return validateDoc({
    meta: {
      createdAt: minOrNull(current.meta.createdAt, incoming.meta.createdAt),
      lastExportAt: maxOrNull(current.meta.lastExportAt, incoming.meta.lastExportAt),
    },
    floors: pick(current.floors, incoming.floors),
    rooms: pick(current.rooms, incoming.rooms),
    items: pick(current.items, incoming.items),
  });
}
