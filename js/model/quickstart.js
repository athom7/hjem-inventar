// Quick start: suggest a home's rooms from the numbers in BBR (or the sales prospectus), so the walk-through can
// start before there is a floor plan. Rooms are marked on the plan later. Pure functions, no DOM.
//
// Note: in BBR, "værelser" counts every habitable room – living rooms as well as bedrooms – but not the kitchen,
// bathrooms or hall. So 5 værelser is typically a living room, a bedroom and three more rooms.

import { roomNameKey } from './inventory.js';

export const MAX_COUNT = 20;

// Typical rooms besides the habitable ones, in the order they are offered. `on` = selected by default.
export const EXTRA_ROOMS = [
  { name: 'Køkken', on: true },
  { name: 'Entré', on: true },
  { name: 'Gang' },
  { name: 'Bryggers' },
  { name: 'Kontor' },
  { name: 'Carport' },
  { name: 'Garage' },
  { name: 'Skur' },
  { name: 'Kælder' },
  { name: 'Loft' },
];

export const DEFAULT_EXTRAS = EXTRA_ROOMS.filter((r) => r.on).map((r) => r.name);

const clampCount = (n) => {
  const v = Math.round(Number(n));
  return Number.isFinite(v) ? Math.min(Math.max(v, 0), MAX_COUNT) : 0;
};

// Room names in walking order: entrance, living room, kitchen, bedroom, other rooms, bathrooms, then the rest.
export function suggestRooms({ livingRooms = 0, bathrooms = 0, extras = DEFAULT_EXTRAS } = {}) {
  const rooms = clampCount(livingRooms);
  const baths = clampCount(bathrooms);
  const chosen = new Set(extras);
  const names = [];
  if (chosen.has('Entré')) names.push('Entré');
  if (rooms >= 1) names.push('Stue');
  if (chosen.has('Køkken')) names.push('Køkken');
  if (rooms >= 2) names.push('Soveværelse');
  for (let i = 1; i <= rooms - 2; i++) names.push(`Værelse ${i}`);
  if (baths === 1) names.push('Badeværelse');
  for (let i = 1; baths > 1 && i <= baths; i++) names.push(`Badeværelse ${i}`);
  for (const r of EXTRA_ROOMS) {
    if (r.name !== 'Entré' && r.name !== 'Køkken' && chosen.has(r.name)) names.push(r.name);
  }
  return names;
}

// The names that do not exist as rooms yet, so quick start can run again without duplicates.
// Same rule as addRooms() in inventory.js, so the preview shows exactly what will be created.
export function newRoomNames(doc, names) {
  const existing = new Set(doc.rooms.map((r) => roomNameKey(r.name)));
  const seen = new Set();
  return names.filter((n) => {
    const k = roomNameKey(n);
    if (!k || existing.has(k) || seen.has(k)) return false;
    seen.add(k);
    return true;
  });
}
