// Quick start: rooms suggested from the numbers in BBR, before there is a floor plan.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { suggestRooms, newRoomNames, DEFAULT_EXTRAS, MAX_COUNT } from '../js/model/quickstart.js';
import { createDoc, addRoom } from '../js/model/inventory.js';

test('BBR "værelser" become living room, bedroom and numbered rooms, in walking order', () => {
  assert.deepEqual(suggestRooms({ livingRooms: 5, bathrooms: 2, extras: ['Køkken', 'Entré', 'Carport'] }), [
    'Entré', 'Stue', 'Køkken', 'Soveværelse', 'Værelse 1', 'Værelse 2', 'Værelse 3', 'Badeværelse 1', 'Badeværelse 2', 'Carport',
  ]);
});

test('one bathroom is just "Badeværelse"; kitchen and hall are on by default', () => {
  assert.deepEqual(DEFAULT_EXTRAS, ['Køkken', 'Entré']);
  assert.deepEqual(suggestRooms({ livingRooms: 2, bathrooms: 1 }), ['Entré', 'Stue', 'Køkken', 'Soveværelse', 'Badeværelse']);
});

test('small and silly numbers', () => {
  assert.deepEqual(suggestRooms({ livingRooms: 0, bathrooms: 0, extras: [] }), []);
  assert.deepEqual(suggestRooms({ livingRooms: 1, bathrooms: 0, extras: [] }), ['Stue']);
  assert.deepEqual(suggestRooms({ livingRooms: -3, bathrooms: 'x', extras: [] }), []);
  assert.equal(suggestRooms({ livingRooms: 999, bathrooms: 0, extras: [] }).length, MAX_COUNT);
});

test('extra rooms keep their offered order whatever order they were picked in', () => {
  assert.deepEqual(suggestRooms({ livingRooms: 0, bathrooms: 0, extras: ['Loft', 'Bryggers', 'Gang'] }), ['Gang', 'Bryggers', 'Loft']);
});

test('names that already exist are left out, whatever their case', () => {
  const doc = createDoc(0);
  addRoom(doc, { name: 'køkken' });
  assert.deepEqual(newRoomNames(doc, ['Entré', 'Køkken', 'Stue', 'stue']), ['Entré', 'Stue']);
});
