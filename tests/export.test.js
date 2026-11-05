// CSV for Danish Excel, full JSON backup round-trip, and the plain-text list.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createDoc, addFloor, addRoom, addItems } from '../js/model/inventory.js';
import { listByDecision } from '../js/model/stats.js';
import { toCSV, csvField, toBackup, fromBackup, listAsText, fileStamp } from '../js/data/export.js';

function house() {
  const doc = createDoc(0);
  const floor = addFloor(doc, { name: 'Stueetage', imageId: 'plan-1', aspect: 0.7 });
  const room = addRoom(doc, { name: 'Køkken', floorId: floor.id });
  addItems(doc, room.id, [
    { name: 'Stole', qty: 6, decision: 'sell', note: 'Hvide; lidt slidte' },
    { name: 'Brødrister "gammel"', decision: 'trash' },
  ]);
  return doc;
}

test('CSV has a BOM, semicolons, Danish labels and escapes awkward values', () => {
  const csv = toCSV(house());
  assert.ok(csv.startsWith('﻿Etage;Rum;Ting;Antal;Beslutning;Note\r\n'));
  assert.ok(csv.includes('Stueetage;Køkken;Stole;6;Sælg;"Hvide; lidt slidte"'));
  assert.ok(csv.includes('Stueetage;Køkken;"Brødrister ""gammel""";1;Smid ud;'));
  assert.equal(csvField('=SUM(A1)'), "'=SUM(A1)");
});

test('a backup restores the document and its floor plans', () => {
  const doc = house();
  const png = 'data:image/png;base64,iVBORw0KGgo=';
  const text = toBackup(doc, { 'plan-1': png, stray: png }, Date.UTC(2026, 10, 5));
  const back = fromBackup(text);
  assert.deepEqual(back.doc.items.map((i) => i.name), doc.items.map((i) => i.name));
  assert.deepEqual(back.images, { 'plan-1': png });
  assert.equal(JSON.parse(text).exportedAt, '2026-11-05T00:00:00.000Z');
});

test('a backup refuses files that are not ours, and unsafe image data', () => {
  assert.throws(() => fromBackup('not json'), /kan ikke læses/);
  assert.throws(() => fromBackup('{"app":"other"}'), /ikke en backup/);
  assert.throws(() => fromBackup(JSON.stringify({ app: 'hjem-inventar', version: 99, doc: {} })), /nyere version/);
  const text = toBackup(house(), { 'plan-1': 'javascript:alert(1)' });
  assert.deepEqual(fromBackup(text).images, {});
});

test('a list as plain text, ready to paste', () => {
  const text = listAsText(listByDecision(house(), 'sell'), 'sell');
  assert.equal(text, 'Sælg – 6 ting\n\nKøkken\n- 6 × Stole (Hvide; lidt slidte)');
  assert.equal(fileStamp(Date.UTC(2026, 10, 5, 12)), '2026-11-05');
});
