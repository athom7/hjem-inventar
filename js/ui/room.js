// One room: its numbers, the items with their decisions, and the way into dictation and triage.

import { h, fmt, plural } from './dom.js';
import { ask, choose, confirmDialog } from './dialog.js';
import { statsLine, decisionBar, decisionBadge, legend, emptyState } from './widgets.js';
import { editItem } from './itemdialog.js';
import { findRoom, findFloor, itemsIn, renameRoom, removeRoom, setRoomFloor } from '../model/inventory.js';
import { roomStats } from '../model/stats.js';

export function renderRoom(view, ctx, { roomId }) {
  const room = findRoom(ctx.doc, roomId);
  if (!room) return ctx.go('#/');
  const floor = room.floorId ? findFloor(ctx.doc, room.floorId) : null;
  const st = roomStats(ctx.doc, room.id);
  const items = itemsIn(ctx.doc, room.id);
  ctx.setTitle(room.name, '#/');

  view.append(
    h('section', { class: ['room-head', `room-${st.state}`] },
      h('p', { class: 'muted', text: [floor?.name, statsLine(st)].filter(Boolean).join(' · ') }),
      st.things ? [decisionBar(st, { big: true }), legend(st)] : null,
      h('div', { class: 'actions' },
        h('a', { class: 'btn btn-primary btn-big', href: `#/room/${room.id}/capture` }, h('span', { class: 'mic-icon', 'aria-hidden': 'true' }), 'Indtal ting'),
        h('a', { class: 'btn btn-big', href: '#/walk', text: 'Gå-tur herfra', onclick: () => ctx.setPref('walkRoomId', room.id) }),
        st.undecidedPosts ? h('a', { class: 'btn btn-big', href: `#/triage/${room.id}`, text: `Beslut ${plural(st.undecidedPosts, 'post', 'poster')}` }) : null)),
  );

  if (!items.length) {
    view.append(emptyState('Ingen ting endnu', 'Tryk på »Indtal ting«, og sig hvad du ser i rummet – fx »en sofa, to lamper og en kasse med gamle kabler«.'));
  } else {
    view.append(h('ul', { class: 'item-list' }, items.map((item) => h('li', {},
      h('button', { type: 'button', class: ['item-row', `dec-${item.decision}`], onclick: () => editItem(ctx, item.id) },
        h('span', { class: 'item-name' },
          item.qty > 1 ? h('span', { class: 'qty', text: `${fmt(item.qty)} ×` }) : null,
          item.name,
          item.note ? h('small', { class: 'item-note', text: item.note }) : null),
        decisionBadge(item.decision))))));
  }

  view.append(h('div', { class: 'actions secondary' },
    h('button', { type: 'button', class: 'btn btn-small', text: 'Omdøb', onclick: () => rename(ctx, room) }),
    ctx.doc.floors.length ? h('button', { type: 'button', class: 'btn btn-small', text: 'Flyt til etage', onclick: () => move(ctx, room) }) : null,
    room.floorId ? h('a', { class: 'btn btn-small', href: `#/plan/${room.floorId}`, text: 'Markér på tegningen' }) : null,
    h('button', { type: 'button', class: 'btn btn-small btn-danger', text: 'Slet rum', onclick: () => remove(ctx, room, items.length) })));
}

async function rename(ctx, room) {
  const name = await ask({ title: 'Omdøb rum', label: 'Navn', value: room.name, ok: 'Gem' });
  if (name) ctx.commit((doc) => renameRoom(doc, room.id, name));
}

async function move(ctx, room) {
  const floorId = await choose({
    title: `Flyt ${room.name} til`,
    message: 'Rummets markering på tegningen fjernes, så du kan markere det på den nye etage.',
    options: [
      ...ctx.doc.floors.filter((f) => f.id !== room.floorId).map((f) => ({ value: f.id, label: f.name })),
      room.floorId ? { value: '__none', label: 'Uden etage' } : null,
    ].filter(Boolean),
  });
  if (floorId) ctx.commit((doc) => setRoomFloor(doc, room.id, floorId === '__none' ? null : floorId));
}

async function remove(ctx, room, count) {
  const ok = await confirmDialog({
    title: `Slet ${room.name}?`,
    message: count ? `Rummets ${plural(count, 'post', 'poster')} slettes også.` : null,
    ok: 'Slet rum',
    danger: true,
  });
  if (!ok) return;
  ctx.commit((doc) => removeRoom(doc, room.id));
  ctx.go('#/');
}
