// Everything the overview shows is computed here, so the UI only draws. "Things" counts quantity
// (two lamps = 2), "posts" counts entries (the decision unit).

import { DECISION_IDS, DECIDED_IDS } from './decisions.js';
import { itemsIn } from './inventory.js';

const DAY_MS = 24 * 60 * 60 * 1000;
export const BACKUP_REMINDER_DAYS = 14;

const emptyCounts = () => Object.fromEntries(DECISION_IDS.map((id) => [id, 0]));

function summarize(items) {
  const byDecision = emptyCounts();
  for (const i of items) byDecision[i.decision] += i.qty;
  const things = items.reduce((s, i) => s + i.qty, 0);
  const undecidedPosts = items.filter((i) => i.decision === 'undecided').length;
  return { posts: items.length, things, undecided: byDecision.undecided, undecidedPosts, byDecision, state: stateOf(items.length, undecidedPosts) };
}

// empty = not walked through yet, open = something still to decide, done = everything decided.
export function stateOf(posts, undecidedPosts) {
  if (posts === 0) return 'empty';
  return undecidedPosts > 0 ? 'open' : 'done';
}

export const roomStats = (doc, roomId) => summarize(itemsIn(doc, roomId));
export const houseStats = (doc) => ({ ...summarize(doc.items), rooms: doc.rooms.length });

// Share of things that have a decision, 0..1. An empty house counts as 0.
export const progressOf = (stats) => (stats.things ? (stats.things - stats.undecided) / stats.things : 0);

// Intensity bucket for the filter view: 0 = none, 1..3 = up to a third, two thirds, or more of the busiest room.
export function levelOf(value, max) {
  if (!value || !max) return 0;
  const r = value / max;
  return r <= 1 / 3 ? 1 : r <= 2 / 3 ? 2 : 3;
}

// Things with `decision` per room, plus the largest count (for levelOf).
export function filterCounts(doc, decision) {
  const counts = new Map(doc.rooms.map((r) => [r.id, 0]));
  for (const i of doc.items) if (i.decision === decision) counts.set(i.roomId, (counts.get(i.roomId) ?? 0) + i.qty);
  return { counts, max: Math.max(0, ...counts.values()) };
}

// Rooms in display order: by floor (in the floors' order, rooms without a floor last), then as created.
export function orderedRooms(doc) {
  const floorIndex = new Map(doc.floors.map((f, i) => [f.id, i]));
  const rank = (r) => (r.floorId === null ? doc.floors.length : floorIndex.get(r.floorId) ?? doc.floors.length);
  return doc.rooms.map((r, i) => ({ r, i })).sort((a, b) => rank(a.r) - rank(b.r) || a.i - b.i).map((x) => x.r);
}

// One list per decision, grouped by room: what to bring to the recycling centre, what to put up for sale, etc.
export function listByDecision(doc, decision) {
  const groups = [];
  for (const room of orderedRooms(doc)) {
    const items = itemsIn(doc, room.id).filter((i) => i.decision === decision);
    if (items.length) groups.push({ room, items, things: items.reduce((s, i) => s + i.qty, 0) });
  }
  return groups;
}

// Undecided items for triage, in walking order (floor, room, then as they were spoken). Optionally one room only.
export function triageQueue(doc, roomId = null) {
  const rooms = roomId ? doc.rooms.filter((r) => r.id === roomId) : orderedRooms(doc);
  return rooms.flatMap((r) => itemsIn(doc, r.id).filter((i) => i.decision === 'undecided').sort((a, b) => a.createdAt - b.createdAt));
}

// Distribution bar segments: decided first, undecided last, empty segments left out.
export function segments(stats) {
  return [...DECIDED_IDS, 'undecided'].filter((id) => stats.byDecision[id] > 0).map((id) => ({ decision: id, things: stats.byDecision[id] }));
}

// The browser may delete data of a site that is not installed, so remind about a backup now and then.
export function backupDue(doc, now = Date.now(), days = BACKUP_REMINDER_DAYS) {
  if (!doc.items.length) return { due: false, daysSince: null };
  const since = doc.meta.lastExportAt ?? doc.meta.createdAt;
  const daysSince = Math.floor((now - since) / DAY_MS);
  return { due: daysSince >= days, daysSince, never: doc.meta.lastExportAt === null };
}
