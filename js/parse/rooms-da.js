// Walk-through: tell which room the user says they are in. "Nu er jeg i køkkenet. En kaffemaskine og seks stole."
// → switch to Køkken, and "En kaffemaskine og seks stole." is what is left to parse as items.
//
// A phrase is a room switch when it is
//   1. just a room name ("køkkenet"), or
//   2. a trigger followed by a room name ("nu er jeg i stuen", "ind i entréen", "i værelse to"),
//      optionally followed by items ("i køkkenet en kaffemaskine, to stole").
// A phrase that only STARTS with a room name ("stue lampe") is an item, not a switch: a trigger is required.
// Pure functions, no DOM.

import { NUMBER_WORDS } from './parse-da.js';

const WORD = /[^\s,.;:!?]+/g;

function tokenize(text) {
  return [...String(text ?? '').matchAll(WORD)].map((m) => ({
    w: m[0].toLocaleLowerCase('da-DK'),
    end: m.index + m[0].length,
  }));
}

// ---------- what a room can be called ----------

const WORDS_FOR = new Map(); // 1 → en, et, én, ét; 2 → to; …
for (const [word, value] of Object.entries(NUMBER_WORDS)) WORDS_FOR.set(value, [...(WORDS_FOR.get(value) ?? []), word]);

// The last word of a room name in the forms people say: køkken, køkkenet, stue, stuen, bad, badet, alrummet …
// A number ("Værelse 1") can be said as digits or as a word, with or without "nummer".
function lastWordForms(w) {
  const value = /^\d+$/.test(w) ? Number(w) : NUMBER_WORDS[w];
  if (value !== undefined) {
    const forms = [String(value), ...(WORDS_FOR.get(value) ?? [])];
    return [...forms, ...forms.map((f) => `nummer ${f}`)];
  }
  const forms = [w, `${w}n`, `${w}en`, `${w}t`, `${w}et`];
  if (w.endsWith('m')) forms.push(`${w}met`); // alrum → alrummet
  return forms;
}

// "Bad (stort)" is also "bad stort" and "stort bad", so two bathrooms can be told apart by voice.
function aliasesOf(name) {
  const qualifier = String(name).match(/\(([^)]*)\)/)?.[1];
  const base = tokenize(String(name).replace(/\([^)]*\)/g, ' ')).map((t) => t.w);
  if (!base.length) return [];
  const head = base.slice(0, -1);
  const out = lastWordForms(base.at(-1)).map((form) => [...head, ...form.split(' ')]);
  const q = qualifier ? tokenize(qualifier).map((t) => t.w) : [];
  if (q.length) {
    out.push([...base, ...q]);
    out.push(...lastWordForms(base.at(-1)).map((form) => [...q, ...head, ...form.split(' ')]));
  }
  return out;
}

function buildIndex(rooms) {
  return rooms.flatMap((room) => aliasesOf(room.name).map((tokens) => ({ tokens, room })));
}

// ---------- triggers ----------

const FILLERS = new Set(['og', 'så', 'nu']);

// Clear "I am moving": a room that does not exist is reported, not taken for an item.
const STRONG = [
  ['går', 'vi', 'ind', 'i'], ['går', 'jeg', 'ind', 'i'], ['jeg', 'går', 'ind', 'i'], ['vi', 'går', 'ind', 'i'],
  ['er', 'jeg', 'nu', 'i'], ['er', 'vi', 'nu', 'i'], ['er', 'jeg', 'i'], ['er', 'vi', 'i'], ['jeg', 'er', 'i'], ['vi', 'er', 'i'],
  ['ind', 'i'], ['over', 'i'], ['videre', 'til'],
].sort((a, b) => b.length - a.length);

// Only a switch if a room name follows; otherwise it is an item ("i skabet står en gryde").
const WEAK = [['i'], ['rum']];

const startsWith = (tokens, at, pattern) => pattern.every((p, i) => tokens[at + i]?.w === p);

// The rooms whose name is said at tokens[at…], longest name first. >1 room = ambiguous.
function roomsAt(index, tokens, at, wholePhrase) {
  let best = 0;
  let hits = [];
  for (const entry of index) {
    const n = entry.tokens.length;
    if (!startsWith(tokens, at, entry.tokens)) continue;
    if (wholePhrase && at + n !== tokens.length) continue;
    if (n > best) { best = n; hits = []; }
    if (n === best) hits.push(entry.room);
  }
  const rooms = [...new Map(hits.map((r) => [r.id, r])).values()];
  return { rooms, length: best };
}

function resolve(found, tokens, at, phrase) {
  if (found.rooms.length > 1) return { ambiguous: found.rooms };
  const last = tokens[at + found.length - 1];
  return { room: found.rooms[0], rest: phrase.slice(last.end).replace(/^[\s,.;:!?–-]+/, '') };
}

// → { room, rest } | { ambiguous: [rooms] } | { unknown: "garagen" } | null (not a room switch: it is items)
export function matchRoomCommand(phrase, rooms) {
  const tokens = tokenize(phrase);
  if (!tokens.length || !rooms.length) return null;
  const index = buildIndex(rooms);

  const bare = roomsAt(index, tokens, 0, true);
  if (bare.rooms.length) return resolve(bare, tokens, 0, phrase);

  let at = 0;
  while (FILLERS.has(tokens[at]?.w)) at++;

  for (const [triggers, strong] of [[STRONG, true], [WEAK, false]]) {
    const trigger = triggers.find((t) => startsWith(tokens, at, t));
    if (!trigger) continue;
    const start = at + trigger.length;
    const found = roomsAt(index, tokens, start, false);
    if (found.rooms.length) return resolve(found, tokens, start, phrase);
    if (strong && start < tokens.length) return { unknown: tokens.slice(start, start + 3).map((t) => t.w).join(' ') };
  }
  return null;
}
