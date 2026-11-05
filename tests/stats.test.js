// What the overview shows: room state, counts, filter levels, lists, triage order and the backup reminder.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createDoc, addFloor, addRoom, addItems } from '../js/model/inventory.js';
import {
  roomStats, houseStats, stateOf, levelOf, filterCounts, listByDecision, triageQueue, segments, progressOf, backupDue, orderedRooms,
} from '../js/model/stats.js';

function house() {
  const doc = createDoc(0);
  const ground = addFloor(doc, { name: 'Stueetage' });
  const upstairs = addFloor(doc, { name: '1. sal' });
  const bed = addRoom(doc, { name: 'Soveværelse', floorId: upstairs.id });
  const kitchen = addRoom(doc, { name: 'Køkken', floorId: ground.id });
  const loose = addRoom(doc, { name: 'Skur' });
  const empty = addRoom(doc, { name: 'Bryggers', floorId: ground.id });
  addItems(doc, kitchen.id, [
    { name: 'Stole', qty: 6, decision: 'sell' },
    { name: 'Brødrister', decision: 'trash' },
    { name: 'Gryder', qty: 3 },
  ]);
  addItems(doc, bed.id, [{ name: 'Seng', decision: 'keep' }, { name: 'Gammelt tøj', decision: 'trash', qty: 4 }]);
  addItems(doc, loose.id, [{ name: 'Cykel' }]);
  return { doc, ground, upstairs, bed, kitchen, loose, empty };
}

test('room state: empty, open (something undecided), done', () => {
  const { doc, bed, kitchen, empty } = house();
  assert.equal(roomStats(doc, empty.id).state, 'empty');
  assert.equal(roomStats(doc, kitchen.id).state, 'open');
  assert.equal(roomStats(doc, bed.id).state, 'done');
  assert.equal(stateOf(0, 0), 'empty');
});

test('counts are things (quantity), split by decision', () => {
  const { doc, kitchen } = house();
  const s = roomStats(doc, kitchen.id);
  assert.equal(s.posts, 3);
  assert.equal(s.things, 10);
  assert.equal(s.undecided, 3);
  assert.equal(s.undecidedPosts, 1);
  assert.deepEqual(s.byDecision, { keep: 0, trash: 1, donate: 0, sell: 6, undecided: 3 });
  assert.equal(progressOf(s), 0.7);
  assert.deepEqual(segments(s), [{ decision: 'trash', things: 1 }, { decision: 'sell', things: 6 }, { decision: 'undecided', things: 3 }]);
  const h = houseStats(doc);
  assert.equal(h.things, 16);
  assert.equal(h.rooms, 4);
});

test('filter levels show where there is most of a decision', () => {
  const { doc, bed, kitchen, empty } = house();
  const { counts, max } = filterCounts(doc, 'trash');
  assert.equal(counts.get(bed.id), 4);
  assert.equal(counts.get(kitchen.id), 1);
  assert.equal(counts.get(empty.id), 0);
  assert.equal(max, 4);
  assert.deepEqual([0, 1, 2, 3, 4].map((v) => levelOf(v, 4)), [0, 1, 2, 3, 3]);
  assert.equal(levelOf(5, 0), 0);
});

test('rooms are ordered by floor, rooms without a floor last', () => {
  const { doc } = house();
  assert.deepEqual(orderedRooms(doc).map((r) => r.name), ['Køkken', 'Bryggers', 'Soveværelse', 'Skur']);
});

test('lists per decision are grouped by room in walking order', () => {
  const { doc } = house();
  const groups = listByDecision(doc, 'trash');
  assert.deepEqual(groups.map((g) => [g.room.name, g.things]), [['Køkken', 1], ['Soveværelse', 4]]);
  assert.deepEqual(listByDecision(doc, 'donate'), []);
});

test('triage queue holds undecided items in walking order, optionally for one room', () => {
  const { doc, kitchen } = house();
  assert.deepEqual(triageQueue(doc).map((i) => i.name), ['Gryder', 'Cykel']);
  assert.deepEqual(triageQueue(doc, kitchen.id).map((i) => i.name), ['Gryder']);
});

test('backup reminder after 14 days without export, only when there is something to lose', () => {
  const day = 24 * 60 * 60 * 1000;
  const doc = createDoc(0);
  assert.equal(backupDue(doc, 30 * day).due, false);
  const room = addRoom(doc, { name: 'Stue' });
  addItems(doc, room.id, [{ name: 'Sofa' }]);
  assert.deepEqual(backupDue(doc, 13 * day), { due: false, daysSince: 13, never: true });
  assert.equal(backupDue(doc, 14 * day).due, true);
  doc.meta.lastExportAt = 14 * day;
  assert.deepEqual(backupDue(doc, 20 * day), { due: false, daysSince: 6, never: false });
});
