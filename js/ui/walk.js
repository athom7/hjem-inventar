// Walk through the house: one screen where the microphone stays on. Say which room you are in ("nu er jeg i
// køkkenet") and then what you see; every phrase is saved at once in the current room. Mistakes are fixed
// afterwards (tap an item) or with "Fortryd sidste". The parsing lives in parse/; this view only connects the pieces.

import { h, fmt, plural } from './dom.js';
import { speechSupported, listen } from './speech.js';
import { editItem } from './itemdialog.js';
import { emptyState, decisionBadge } from './widgets.js';
import { addItems, removeItem, findRoom, findItem, itemsIn } from '../model/inventory.js';
import { orderedRooms } from '../model/stats.js';
import { parseDa } from '../parse/parse-da.js';
import { matchRoomCommand } from '../parse/rooms-da.js';

const MAX_SHOWN = 8;

// What was added during this walk, oldest first. Kept while the app is open, so the list survives a redraw.
const added = []; // { roomId, ids: [itemId] }

export function renderWalk(view, ctx) {
  ctx.setTitle('Gå-tur', '#/');
  if (!ctx.doc.rooms.length) {
    view.append(emptyState(
      'Ingen rum endnu',
      'Opret husets rum først, så ved appen, hvor du er, når du siger dine ting.',
      h('a', { class: 'btn btn-primary', href: '#/quickstart', text: 'Hurtigstart: opret rummene' }),
    ));
    return;
  }

  let roomId = ctx.doc.rooms.some((r) => r.id === ctx.prefs.walkRoomId) ? ctx.prefs.walkRoomId : orderedRooms(ctx.doc)[0].id;
  let stop = null;
  let wake = null;

  const banner = h('section', { class: 'walk-banner', 'aria-live': 'polite' });
  const chips = h('div', { class: 'chips', role: 'group', 'aria-label': 'Rum' });
  const interim = h('p', { class: 'interim', 'aria-live': 'polite' });
  const feed = h('section', { class: 'feed' });

  // ---------- drawing ----------

  const paint = () => {
    const room = findRoom(ctx.doc, roomId);
    const things = itemsIn(ctx.doc, roomId).reduce((sum, i) => sum + i.qty, 0);
    banner.replaceChildren(
      h('small', { text: 'Du er i' }),
      h('strong', { text: room.name }),
      h('span', { class: 'muted', text: things ? `${plural(things, 'ting', 'ting')} i rummet` : 'Ingen ting endnu' }),
    );
    chips.replaceChildren(...orderedRooms(ctx.doc).map((r) => {
      const posts = itemsIn(ctx.doc, r.id).length;
      return h('button', {
        type: 'button', class: ['chip', r.id === roomId && 'selected'], 'aria-pressed': String(r.id === roomId), onclick: () => setRoom(r.id),
      }, r.name, posts ? h('span', { class: 'chip-count', text: String(posts) }) : null);
    }));
    chips.querySelector('.selected')?.scrollIntoView?.({ inline: 'center', block: 'nearest' });

    const shown = added
      .map((e) => ({ ...e, items: e.ids.map((id) => findItem(ctx.doc, id)).filter(Boolean) }))
      .filter((e) => e.items.length)
      .slice(-MAX_SHOWN)
      .reverse();
    feed.replaceChildren(...[
      h('h2', { class: 'section-title', text: shown.length ? 'Lige tilføjet' : 'Intet tilføjet endnu' }),
      shown.length ? h('div', { class: 'actions secondary' }, h('button', { type: 'button', class: 'btn btn-small', text: 'Fortryd sidste', onclick: undoLast })) : null,
      ...shown.map((e) => h('div', { class: 'feed-entry' },
        h('h3', { class: 'muted', text: findRoom(ctx.doc, e.roomId)?.name ?? '' }),
        h('ul', { class: 'item-list' }, e.items.map((item) => h('li', {},
          h('button', {
            type: 'button', class: ['item-row', `dec-${item.decision}`],
            // Editing redraws the screen, which ends the listening, so stop it on purpose first.
            onclick: () => { stop?.(); editItem(ctx, item.id); },
          },
          h('span', { class: 'item-name' }, item.qty > 1 ? h('span', { class: 'qty', text: `${fmt(item.qty)} ×` }) : null, item.name),
          decisionBadge(item.decision))))))),
    ].filter(Boolean));
  };

  const setRoom = (id) => {
    roomId = id;
    ctx.setPref('walkRoomId', id);
    paint();
  };

  // ---------- one spoken (or typed) phrase ----------

  const handlePhrase = (phrase) => {
    const command = matchRoomCommand(phrase, ctx.doc.rooms);
    let text = phrase;
    if (command?.ambiguous) {
      ctx.toast(`Hvilket rum: ${command.ambiguous.map((r) => r.name).join(' eller ')}? Sig det mere præcist, eller tryk på rummet.`);
      return;
    }
    if (command?.unknown) {
      ctx.toast(`Fandt ikke rummet »${command.unknown}«. Sig et andet navn, eller tryk på rummet.`);
      return;
    }
    if (command?.room) {
      setRoom(command.room.id);
      text = command.rest;
    }
    const rows = parseDa(text);
    if (!rows.length) return;
    const created = ctx.commit((doc) => addItems(doc, roomId, rows), { render: false });
    added.push({ roomId, ids: created.map((i) => i.id) });
    paint();
  };

  const undoLast = () => {
    while (added.length) {
      const ids = added.pop().ids.filter((id) => findItem(ctx.doc, id));
      if (!ids.length) continue; // that phrase was already deleted by hand
      ctx.commit((doc) => ids.forEach((id) => removeItem(doc, id)), { render: false });
      break;
    }
    paint();
  };

  // ---------- microphone and screen ----------

  const holdScreen = async () => {
    try {
      wake = (await navigator.wakeLock?.request('screen')) ?? null;
    } catch {
      wake = null; // not supported or refused: the phone may lock the screen, nothing is lost
    }
  };
  const releaseScreen = () => {
    wake?.release?.()?.catch?.(() => {});
    wake = null;
  };
  const onVisible = () => {
    if (document.visibilityState === 'visible' && stop && !wake) holdScreen(); // the screen lock is dropped when the page is hidden
  };

  const mic = speechSupported()
    ? h('button', { type: 'button', class: 'btn btn-primary btn-big mic', onclick: () => toggle() },
      h('span', { class: 'mic-icon', 'aria-hidden': 'true' }), h('span', { class: 'mic-label', text: 'Start' }))
    : null;

  const paintMic = () => {
    if (!mic) return;
    mic.classList.toggle('listening', stop !== null);
    mic.querySelector('.mic-label').textContent = stop ? 'Stop' : 'Start';
    interim.textContent = stop ? 'Lytter …' : '';
  };

  const toggle = () => {
    if (stop) {
      stop();
      return;
    }
    let live = true;
    const handle = listen({
      keepAlive: true,
      onPhrase: (phrase) => { if (phrase) handlePhrase(phrase); },
      onInterim: (t) => { interim.textContent = t || 'Lytter …'; },
      onError: (msg) => ctx.toast(msg),
      onEnd: () => {
        live = false;
        stop = null;
        releaseScreen();
        paintMic();
      },
    });
    if (live) stop = handle; // listen() may already have ended (e.g. no microphone)
    paintMic();
    if (live) holdScreen();
  };
  document.addEventListener('visibilitychange', onVisible);

  // ---------- typing instead (also where speech recognition is missing) ----------

  const field = h('textarea', {
    class: 'walk-field', rows: 2, 'aria-label': 'Skriv eller diktér',
    placeholder: 'Fx: i køkkenet en kaffemaskine, to stole',
  });
  const addTyped = () => {
    const lines = field.value.split('\n').map((l) => l.trim()).filter(Boolean);
    field.value = '';
    lines.forEach(handlePhrase);
  };

  view.append(
    banner,
    chips,
    h('div', { class: 'actions' }, mic),
    interim,
    h('p', { class: 'help' },
      'Sig rummets navn for at skifte: »nu er jeg i stuen«. Sig tingene med små pauser eller komma. ',
      'Sig »skal med«, »skal smides ud«, »doneres« eller »sælges« efter en ting for at beslutte med det samme.'),
    feed,
    h('details', { class: 'walk-type', open: !mic },
      h('summary', { text: 'Skriv eller diktér med tastaturet' }),
      field,
      h('button', { type: 'button', class: 'btn btn-small', text: 'Tilføj', onclick: addTyped })),
  );
  paint();

  return () => {
    stop?.();
    releaseScreen();
    document.removeEventListener('visibilitychange', onVisible);
  };
}
