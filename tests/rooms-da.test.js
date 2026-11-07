// Walk-through: which room does the user say they are in?
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { matchRoomCommand } from '../js/parse/rooms-da.js';
import { parseDa } from '../js/parse/parse-da.js';

const names = ['Entré', 'Køkken', 'Alrum', 'Stue', 'Bryggers', 'Værelse 1', 'Værelse 2', 'Bad (stort)', 'Bad (lille)', 'Carport'];
const rooms = names.map((name, i) => ({ id: `r${i}`, name }));
const named = (r) => r?.room?.name;

test('a room name alone is a switch, in the form people say it', () => {
  assert.equal(named(matchRoomCommand('køkkenet', rooms)), 'Køkken');
  assert.equal(named(matchRoomCommand('Stuen.', rooms)), 'Stue');
  assert.equal(named(matchRoomCommand('entréen', rooms)), 'Entré');
  assert.equal(named(matchRoomCommand('alrummet', rooms)), 'Alrum');
  assert.equal(named(matchRoomCommand('bryggerset', rooms)), 'Bryggers');
  assert.equal(matchRoomCommand('køkkenet', rooms).rest, '');
});

test('triggers: "nu er jeg i", "ind i", "videre til", "i"', () => {
  for (const phrase of ['nu er jeg i køkkenet', 'Så går vi ind i køkkenet', 'ind i køkkenet', 'videre til køkkenet', 'og så er vi i køkkenet', 'i køkkenet', 'nu i køkkenet']) {
    assert.equal(named(matchRoomCommand(phrase, rooms)), 'Køkken', phrase);
  }
});

test('items said after the room name are returned as the rest, with commas and case kept', () => {
  const r = matchRoomCommand('i køkkenet en IKEA-reol, to stole og en gryde', rooms);
  assert.equal(named(r), 'Køkken');
  assert.equal(r.rest, 'en IKEA-reol, to stole og en gryde');
  assert.deepEqual(parseDa(r.rest).map((i) => `${i.name}×${i.qty}`), ['IKEA-reol×1', 'Stole×2', 'Gryde×1']);
});

test('numbered rooms by digit, number word and "nummer"', () => {
  for (const phrase of ['værelse 2', 'værelse to', 'ind i værelse nummer to', 'i værelse 2']) {
    assert.equal(named(matchRoomCommand(phrase, rooms)), 'Værelse 2', phrase);
  }
  const r = matchRoomCommand('i værelse 1 to puder', rooms);
  assert.equal(named(r), 'Værelse 1');
  assert.equal(r.rest, 'to puder');
});

test('a thing that merely starts with a room name is an item, not a switch', () => {
  assert.equal(matchRoomCommand('stue lampe', rooms), null);
  assert.equal(matchRoomCommand('køkkenkniv og skærebræt', rooms), null);
  assert.equal(matchRoomCommand('en sofa, to lamper', rooms), null);
  assert.equal(matchRoomCommand('i skabet står en gryde', rooms), null);
});

test('two rooms with the same name are told apart by their qualifier, or reported as ambiguous', () => {
  assert.equal(named(matchRoomCommand('nu er jeg i stort bad', rooms)), 'Bad (stort)');
  assert.equal(named(matchRoomCommand('lille bad', rooms)), 'Bad (lille)');
  assert.equal(named(matchRoomCommand('bad lille', rooms)), 'Bad (lille)');
  const ambiguous = matchRoomCommand('nu er jeg i badet', rooms);
  assert.deepEqual(ambiguous.ambiguous.map((r) => r.name).sort(), ['Bad (lille)', 'Bad (stort)']);
  assert.ok(matchRoomCommand('badet', rooms).ambiguous);
});

test('a clear "I am moving" to a room that does not exist is reported, not taken for an item', () => {
  assert.deepEqual(matchRoomCommand('nu er jeg i garagen', rooms), { unknown: 'garagen' });
  assert.deepEqual(matchRoomCommand('ind i det store soveværelse', rooms), { unknown: 'det store soveværelse' });
  assert.equal(matchRoomCommand('i garagen', rooms), null); // weak trigger: could be an item
});

test('nothing to match', () => {
  assert.equal(matchRoomCommand('', rooms), null);
  assert.equal(matchRoomCommand('  ,, ', rooms), null);
  assert.equal(matchRoomCommand('køkkenet', []), null);
});
