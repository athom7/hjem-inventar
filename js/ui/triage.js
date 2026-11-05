// Decide fast: one undecided item at a time, four big buttons, skip and undo. For one room or the whole home.

import { h, fmt } from './dom.js';
import { emptyState } from './widgets.js';
import { DECIDED_IDS, DECISION_BY_ID } from '../model/decisions.js';
import { findItem, findRoom, setDecision } from '../model/inventory.js';
import { triageQueue } from '../model/stats.js';

// The queue is fixed when triage starts, so skipped items do not come straight back.
let session = null; // { key, ids, index, history: [{ id, previous, index }], decided, skipped }

export function renderTriage(view, ctx, { roomId = null }) {
  const room = roomId ? findRoom(ctx.doc, roomId) : null;
  if (roomId && !room) return ctx.go('#/');
  const back = room ? `#/room/${room.id}` : '#/';
  ctx.setTitle(room ? `Beslut · ${room.name}` : 'Beslut', room ? back : null);

  const key = roomId ?? '__all';
  if (!session || session.key !== key) start(ctx, key, roomId);

  // Move past items that were deleted or decided elsewhere since the queue was made.
  while (session.index < session.ids.length) {
    const it = findItem(ctx.doc, session.ids[session.index]);
    if (it && it.decision === 'undecided') break;
    session.index++;
  }

  if (session.index >= session.ids.length) {
    view.append(emptyState(
      session.ids.length ? 'Færdig!' : 'Intet at beslutte',
      session.ids.length
        ? `Du har besluttet ${fmt(session.decided)} ${session.decided === 1 ? 'ting' : 'ting'}${session.skipped ? `, og ${fmt(session.skipped)} er sprunget over og står stadig som uafgjort` : ''}.`
        : 'Alle ting har en beslutning. Indtal flere rum, eller se listerne.',
      session.history.length ? h('button', { type: 'button', class: 'btn', text: 'Fortryd sidste', onclick: () => undo(ctx) }) : null,
      session.skipped ? h('button', { type: 'button', class: 'btn', text: 'Tag de oversprungne', onclick: () => { start(ctx, key, roomId); ctx.render(); } }) : null,
      h('a', { class: 'btn btn-primary', href: back, text: room ? `Tilbage til ${room.name}` : 'Til oversigten' }),
    ));
    return;
  }

  const item = findItem(ctx.doc, session.ids[session.index]);
  const itemRoom = findRoom(ctx.doc, item.roomId);
  const decide = (decision) => {
    session.history.push({ id: item.id, previous: item.decision, index: session.index });
    session.index++;
    if (decision) session.decided++;
    else session.skipped++;
    if (decision) ctx.commit((doc) => setDecision(doc, item.id, decision));
    else ctx.render();
  };

  view.append(
    h('p', { class: 'progress-text', text: `${fmt(session.index + 1)} af ${fmt(session.ids.length)}` }),
    h('div', { class: 'progress', role: 'progressbar', 'aria-valuemin': '0', 'aria-valuemax': String(session.ids.length), 'aria-valuenow': String(session.index) },
      h('span', { style: { width: `${(session.index / session.ids.length) * 100}%` } })),
    h('article', { class: 'triage-card' },
      h('p', { class: 'muted', text: itemRoom.name }),
      h('h2', { class: 'triage-name' }, item.qty > 1 ? h('span', { class: 'qty', text: `${fmt(item.qty)} ×` }) : null, item.name),
      item.note ? h('p', { class: 'item-note', text: item.note }) : null),
    h('div', { class: 'triage-buttons' }, DECIDED_IDS.map((id) =>
      h('button', { type: 'button', class: ['btn', 'decision-btn', 'btn-big', `dec-${id}`], onclick: () => decide(id) },
        h('strong', { text: DECISION_BY_ID[id].labelDa }), h('small', { text: DECISION_BY_ID[id].hintDa })))),
    h('div', { class: 'actions secondary' },
      h('button', { type: 'button', class: 'btn', text: 'Fortryd', disabled: !session.history.length, onclick: () => undo(ctx) }),
      h('button', { type: 'button', class: 'btn', text: 'Spring over', onclick: () => decide(null) })),
  );
}

function start(ctx, key, roomId) {
  session = { key, ids: triageQueue(ctx.doc, roomId).map((i) => i.id), index: 0, history: [], decided: 0, skipped: 0 };
}

function undo(ctx) {
  const last = session.history.pop();
  if (!last) return;
  session.index = last.index;
  const item = findItem(ctx.doc, last.id);
  if (item && item.decision !== last.previous) {
    session.decided--;
    ctx.commit((doc) => setDecision(doc, last.id, last.previous));
  } else {
    session.skipped--;
    ctx.render();
  }
}

// Called when the user leaves triage, so the next visit starts with a fresh queue.
export function resetTriage() {
  session = null;
}
