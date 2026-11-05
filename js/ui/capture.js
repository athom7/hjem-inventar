// Dictate a room: speak or type what you see, check the parsed list, save. Nothing is saved before the
// user confirms the preview, because the parser can split a phrase wrongly.

import { h, plural } from './dom.js';
import { speechSupported, listen } from './speech.js';
import { DECISIONS } from '../model/decisions.js';
import { findRoom, addItems, cleanQty } from '../model/inventory.js';
import { parseDa } from '../parse/parse-da.js';

// Kept between re-renders, per room, until saved.
const drafts = new Map(); // roomId → { text, rows: [{ name, qty, decision }] | null }

export function renderCapture(view, ctx, { roomId }) {
  const room = findRoom(ctx.doc, roomId);
  if (!room) return ctx.go('#/');
  ctx.setTitle(`Indtal · ${room.name}`, `#/room/${room.id}`);
  const draft = drafts.get(room.id) ?? { text: '', rows: null };
  drafts.set(room.id, draft);

  const text = h('textarea', {
    class: 'dictation', rows: 6, placeholder: 'Fx: en sofa, to lamper og en kasse med gamle kabler. Printeren skal smides ud.',
    'aria-label': 'Hvad ser du i rummet?',
    oninput: () => { draft.text = text.value; },
  });
  text.value = draft.text;
  const interim = h('p', { class: 'interim', 'aria-live': 'polite' });
  const preview = h('section', { class: 'preview' });

  const showPreview = () => {
    draft.text = text.value;
    draft.rows = parseDa(draft.text).map((i) => ({ name: i.name, qty: i.qty, decision: i.decision ?? 'undecided' }));
    drawPreview(preview, ctx, room, draft);
  };

  let stop = null;
  const mic = speechSupported()
    ? h('button', {
      type: 'button', class: 'btn btn-primary btn-big mic',
      onclick: () => {
        if (stop) return stop();
        mic.classList.add('listening');
        mic.lastChild.textContent = 'Stop';
        stop = listen({
          onPhrase: (phrase) => {
            if (!phrase) return;
            text.value = text.value.trim() ? `${text.value.trimEnd()}\n${phrase}` : phrase;
            draft.text = text.value;
          },
          onInterim: (t) => { interim.textContent = t; },
          onError: (msg) => ctx.toast(msg),
          onEnd: () => {
            stop = null;
            interim.textContent = '';
            mic.classList.remove('listening');
            mic.lastChild.textContent = 'Tal';
            if (text.value.trim()) showPreview();
          },
        });
      },
    }, h('span', { class: 'mic-icon', 'aria-hidden': 'true' }), 'Tal')
    : null;

  view.append(...[
    h('p', { class: 'help' },
      'Sig eller skriv, hvad du ser – hold en lille pause eller sig komma mellem tingene. ',
      'Sig »skal smides ud«, »doneres«, »sælges« eller »skal med« efter en ting for at beslutte med det samme.'),
    text,
    interim,
    h('div', { class: 'actions' },
      mic,
      h('button', { type: 'button', class: ['btn', 'btn-big', !mic && 'btn-primary'], text: 'Vis listen', onclick: showPreview })),
    mic ? null : h('p', { class: 'note', text: 'Tip: brug mikrofonen på telefonens tastatur til at indtale.' }),
    preview,
  ].filter(Boolean));

  if (draft.rows) drawPreview(preview, ctx, room, draft);
  else text.focus({ preventScroll: true });

  return () => stop?.();
}

function drawPreview(preview, ctx, room, draft) {
  const rows = draft.rows;
  const redraw = () => drawPreview(preview, ctx, room, draft);
  preview.replaceChildren(
    h('h2', { class: 'section-title', text: rows.length ? `${plural(rows.length, 'ting', 'ting')} fundet – ret hvis noget er forkert` : 'Ingen ting fundet endnu' }),
    h('ul', { class: 'preview-list' }, rows.map((row, i) => h('li', { class: 'preview-row' },
      h('input', { type: 'text', class: 'grow', value: row.name, 'aria-label': 'Ting', oninput: (e) => { row.name = e.target.value; } }),
      h('input', { type: 'number', class: 'qty', value: String(row.qty), min: '1', inputmode: 'numeric', 'aria-label': 'Antal', oninput: (e) => { row.qty = cleanQty(e.target.value); } }),
      h('select', { 'aria-label': 'Beslutning', class: `dec-${row.decision}`, onchange: (e) => { row.decision = e.target.value; e.target.className = `dec-${row.decision}`; } },
        DECISIONS.map((d) => h('option', { value: d.id, text: d.labelDa, selected: d.id === row.decision }))),
      h('button', { type: 'button', class: 'btn btn-small btn-quiet', 'aria-label': `Fjern ${row.name}`, text: '✕', onclick: () => { rows.splice(i, 1); redraw(); } })))),
    h('div', { class: 'actions' },
      h('button', { type: 'button', class: 'btn btn-small', text: '+ Tilføj linje', onclick: () => { rows.push({ name: '', qty: 1, decision: 'undecided' }); redraw(); preview.querySelector('.preview-row:last-child input')?.focus(); } }),
      rows.length ? h('button', {
        type: 'button', class: 'btn btn-primary btn-big btn-block', text: `Gem i ${room.name}`,
        onclick: () => {
          if (!rows.some((r) => r.name.trim())) return ctx.toast('Skriv mindst én ting.');
          const created = ctx.commit((doc) => addItems(doc, room.id, rows));
          drafts.delete(room.id);
          ctx.toast(`${plural(created.length, 'post', 'poster')} gemt i ${room.name}.`);
          ctx.go(`#/room/${room.id}`);
        },
      }) : null),
  );
}
