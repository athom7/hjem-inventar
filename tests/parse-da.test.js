// The Danish dictation parser. Each rule in CLAUDE.md has an example here.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseDa } from '../js/parse/parse-da.js';

const names = (text) => parseDa(text).map((i) => `${i.name}×${i.qty}${i.decision ? `:${i.decision}` : ''}`);

test('splits on comma and "og", reads number words, keeps "med" inside an item', () => {
  assert.deepEqual(names('en sofa, to lamper og en kasse med gamle kabler'), ['Sofa×1', 'Lamper×2', 'Kasse med gamle kabler×1']);
});

test('removes spoken lead-ins and splits on full stops', () => {
  assert.deepEqual(names('Jeg ser et spisebord og seks stole. Der står en reol.'), ['Spisebord×1', 'Stole×6', 'Reol×1']);
  assert.deepEqual(names('og så ligger der to tæpper\nher hænger et maleri'), ['Tæpper×2', 'Maleri×1']);
  assert.deepEqual(names('står der også en lampe'), ['Lampe×1']);
});

test('digits and "stk"/"x" as quantity, but not digits inside a name', () => {
  assert.deepEqual(names('3 bøger, 10 stk. bøjler, 2x puder'), ['Bøger×3', 'Bøjler×10', 'Puder×2']);
  assert.deepEqual(names('3d-printer'), ['3d-printer×1']);
});

test('vague amounts stay part of the description', () => {
  assert.deepEqual(names('en masse bøger, et par sko'), ['En masse bøger×1', 'Par sko×1']);
});

test('a decision said at the end of an item', () => {
  assert.deepEqual(names('gammel printer skal smides ud'), ['Gammel printer×1:trash']);
  assert.deepEqual(names('sofaen skal med, lampen sælges, to stole doneres, kommoden beholdes'), [
    'Sofaen×1:keep', 'Lampen×1:sell', 'Stole×2:donate', 'Kommoden×1:keep',
  ]);
  assert.deepEqual(names('kasse med kabler – smid ud'), ['Kasse med kabler×1:trash']);
});

test('"med" and "ud" alone are not decisions', () => {
  assert.deepEqual(names('en kasse med'), ['Kasse med×1']);
  assert.deepEqual(names('gardiner ud'), ['Gardiner ud×1']);
});

test('empty input and leftover fragments give nothing', () => {
  assert.deepEqual(parseDa(''), []);
  assert.deepEqual(parseDa('  ,, og . '), []);
  assert.deepEqual(parseDa('jeg ser'), []);
  assert.deepEqual(parseDa('skal smides ud'), []);
});

test('Danish letters and capitalisation are kept', () => {
  assert.deepEqual(names('ældre fjernsyn, øreklapstol'), ['Ældre fjernsyn×1', 'Øreklapstol×1']);
  assert.deepEqual(names('IKEA-reol'), ['IKEA-reol×1']);
});
