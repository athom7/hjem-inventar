// The inventory document: floors, rooms with marked areas, items, and import (validate + merge).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  createDoc, addFloor, addRoom, addRooms, adoptLooseRooms, addArea, removeArea, addItems, updateItem, removeRoom, removeFloor,
  setRoomFloor, validateDoc, mergeDocs, itemsIn,
} from '../js/model/inventory.js';

function sample() {
  const doc = createDoc(0);
  const floor = addFloor(doc, { name: 'Stueetage', imageId: 'img1', aspect: 0.7 });
  const room = addRoom(doc, { name: '  Køkken ', floorId: floor.id });
  return { doc, floor, room };
}

test('rooms and items get clean names, quantities and decisions', () => {
  const { doc, room } = sample();
  assert.equal(room.name, 'Køkken');
  const items = addItems(doc, room.id, [
    { name: 'Kaffemaskine', qty: 1, decision: 'keep' },
    { name: 'Stole', qty: '6' },
    { name: '   ' },
    { name: 'Brødrister', qty: -3, decision: 'nonsense' },
  ]);
  assert.deepEqual(items.map((i) => [i.name, i.qty, i.decision]), [
    ['Kaffemaskine', 1, 'keep'], ['Stole', 6, 'undecided'], ['Brødrister', 1, 'undecided'],
  ]);
  assert.throws(() => addRoom(doc, { name: ' ' }), /navn/);
  assert.throws(() => addItems(doc, 'missing', [{ name: 'x' }]), /findes ikke/);
});

test('an L-shaped room is two areas; tiny areas are refused', () => {
  const { doc, room } = sample();
  addArea(doc, room.id, { x: 0.1, y: 0.1, w: 0.4, h: 0.2 });
  addArea(doc, room.id, { x: 0.1, y: 0.3, w: 0.15, h: 0.3 });
  assert.equal(room.areas.length, 2);
  assert.throws(() => addArea(doc, room.id, { x: 0.5, y: 0.5, w: 0.001, h: 0.3 }), /for lille/);
  removeArea(doc, room.id, 0);
  assert.deepEqual(room.areas, [{ x: 0.1, y: 0.3, w: 0.15, h: 0.3 }]);
});

test('removing a room removes its items; removing a floor keeps rooms but clears their areas', () => {
  const { doc, floor, room } = sample();
  const other = addRoom(doc, { name: 'Stue', floorId: floor.id });
  addArea(doc, other.id, { x: 0, y: 0, w: 0.5, h: 0.5 });
  addItems(doc, room.id, [{ name: 'Gryde' }]);
  addItems(doc, other.id, [{ name: 'Sofa' }]);
  removeRoom(doc, room.id);
  assert.deepEqual(doc.items.map((i) => i.name), ['Sofa']);
  assert.equal(removeFloor(doc, floor.id), 'img1');
  assert.equal(other.floorId, null);
  assert.deepEqual(other.areas, []);
  assert.equal(itemsIn(doc, other.id).length, 1);
});

test('moving a room to another floor clears its areas', () => {
  const { doc, room } = sample();
  const upstairs = addFloor(doc, { name: '1. sal' });
  addArea(doc, room.id, { x: 0, y: 0, w: 0.5, h: 0.5 });
  setRoomFloor(doc, room.id, upstairs.id);
  assert.equal(room.floorId, upstairs.id);
  assert.deepEqual(room.areas, []);
});

test('updateItem changes only what is given and stamps updatedAt', () => {
  const { doc, room } = sample();
  const [item] = addItems(doc, room.id, [{ name: 'Lampe', qty: 2 }]);
  item.updatedAt = 0;
  updateItem(doc, item.id, { decision: 'sell', note: ' virker ' });
  assert.deepEqual([item.name, item.qty, item.decision, item.note], ['Lampe', 2, 'sell', 'virker']);
  assert.ok(item.updatedAt > 0);
});

test('validateDoc refuses foreign files and repairs broken parts', () => {
  assert.throws(() => validateDoc({ hello: 1 }), /ikke et inventar/);
  assert.throws(() => validateDoc(null), /ikke et inventar/);
  const doc = validateDoc({
    floors: [{ id: 'f1', name: 'Stue', aspect: 'x' }, { name: 'no id' }],
    rooms: [
      { id: 'r1', name: 'Køkken', floorId: 'f1', areas: [{ x: 0.9, y: 0.9, w: 0.5, h: 0.5 }, { x: 0, y: 0, w: 0, h: 0 }] },
      { id: 'r2', name: 'Bad', floorId: 'gone', areas: [{ x: 0, y: 0, w: 0.5, h: 0.5 }] },
    ],
    items: [
      { id: 'i1', roomId: 'r1', name: 'Gryde', qty: 0, decision: 'maybe' },
      { id: 'i2', roomId: 'nowhere', name: 'Lost' },
      { id: 'i1', roomId: 'r1', name: 'Duplicate' },
    ],
  });
  assert.equal(doc.floors.length, 1);
  assert.equal(doc.floors[0].aspect, 0.75);
  assert.deepEqual(doc.rooms[0].areas, [{ x: 0.9, y: 0.9, w: 0.1, h: 0.1 }]);
  assert.equal(doc.rooms[1].floorId, null);
  assert.deepEqual(doc.rooms[1].areas, []);
  assert.deepEqual(doc.items.map((i) => [i.id, i.qty, i.decision]), [['i1', 1, 'undecided']]);
});

test('mergeDocs keeps everything and lets the newest version of the same thing win', () => {
  const base = validateDoc({
    meta: { createdAt: 100, lastExportAt: null },
    rooms: [{ id: 'r1', name: 'Køkken', updatedAt: 1 }],
    items: [
      { id: 'a', roomId: 'r1', name: 'Gryde', decision: 'undecided', updatedAt: 5 },
      { id: 'b', roomId: 'r1', name: 'Pande', decision: 'keep', updatedAt: 9 },
    ],
  });
  const backup = validateDoc({
    meta: { createdAt: 50, lastExportAt: 70 },
    rooms: [{ id: 'r1', name: 'Køkken', updatedAt: 1 }, { id: 'r2', name: 'Bad', updatedAt: 1 }],
    items: [
      { id: 'a', roomId: 'r1', name: 'Gryde', decision: 'trash', updatedAt: 6 },
      { id: 'b', roomId: 'r1', name: 'Pande', decision: 'sell', updatedAt: 2 },
      { id: 'c', roomId: 'r2', name: 'Vægt', updatedAt: 3 },
    ],
  });
  const merged = mergeDocs(base, backup);
  assert.deepEqual(merged.rooms.map((r) => r.id), ['r1', 'r2']);
  assert.deepEqual(merged.items.map((i) => `${i.id}:${i.decision}`), ['a:trash', 'b:keep', 'c:undecided']);
  assert.deepEqual(merged.meta, { createdAt: 50, lastExportAt: 70 });
});

test('addRooms creates several rooms on a floor and skips names that exist or repeat', () => {
  const { doc, floor } = sample(); // already has "Køkken"
  const created = addRooms(doc, ['Entré', 'køkken', 'Stue', 'Entré', '  '], floor.id);
  assert.deepEqual(created.map((r) => r.name), ['Entré', 'Stue']);
  assert.ok(created.every((r) => r.floorId === floor.id && r.areas.length === 0));
  assert.equal(doc.rooms.length, 3);
  assert.deepEqual(addRooms(doc, ['Bad']).map((r) => r.floorId), [null]);
});

test('rooms made before a floor plan move onto the first floor', () => {
  const doc = createDoc(0);
  addRooms(doc, ['Entré', 'Stue']);
  const floor = addFloor(doc, { name: 'Stueetage' });
  const kept = addRoom(doc, { name: 'Bad', floorId: floor.id });
  assert.deepEqual(adoptLooseRooms(doc, floor.id).map((r) => r.name), ['Entré', 'Stue']);
  assert.ok(doc.rooms.every((r) => r.floorId === floor.id));
  assert.equal(kept.floorId, floor.id);
  assert.throws(() => adoptLooseRooms(doc, 'nope'), /findes ikke/);
});
