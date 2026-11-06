// Mark rooms on a floor plan: drag a rectangle over a room, then name it (or pick an existing room).
// A room can have several rectangles (L-shaped rooms). Tapping a rectangle offers to remove it.

import { h, s } from './dom.js';
import { ask, choose, confirmDialog } from './dialog.js';
import { planBoard, zoomControls, VIEW_W } from './board.js';
import { toPlanPoint, rectFromPoints, isUsableRect, areaAt } from '../model/plan.js';
import { addRoom, addArea, removeArea, findFloor, roomsOn, setRoomFloor } from '../model/inventory.js';

let zoom = 1;
let mode = 'draw'; // 'draw' | 'pan' – pan lets one finger scroll a zoomed plan

export function renderPlanEdit(view, ctx, { floorId }) {
  const floor = findFloor(ctx.doc, floorId);
  if (!floor) return ctx.go('#/');
  ctx.setTitle(`Markér rum · ${floor.name}`, '#/');
  const rooms = roomsOn(ctx.doc, floor.id);

  const board = planBoard({
    floor, imageUrl: ctx.images.get(floor.imageId), zoom, rooms,
    areaClass: () => ['area-edit'],
    label: (room) => h('strong', { text: room.name }),
  });
  board.plan.classList.add(mode === 'draw' ? 'drawing' : 'panning');

  // The drawing layer covers the plan and catches the finger in draw mode.
  const ghost = s('rect', { class: 'area-ghost', x: 0, y: 0, width: 0, height: 0, visibility: 'hidden' });
  board.svg.append(ghost);
  const layer = h('div', { class: 'draw-layer' });
  board.plan.append(layer);

  let start = null;
  const point = (e) => toPlanPoint(e.clientX, e.clientY, board.plan.getBoundingClientRect());
  const showGhost = (r) => {
    ghost.setAttribute('x', r.x * VIEW_W);
    ghost.setAttribute('y', r.y * board.viewH);
    ghost.setAttribute('width', r.w * VIEW_W);
    ghost.setAttribute('height', r.h * board.viewH);
    ghost.setAttribute('visibility', 'visible');
  };
  layer.addEventListener('pointerdown', (e) => {
    if (mode !== 'draw' || e.button > 0) return;
    e.preventDefault();
    layer.setPointerCapture(e.pointerId);
    start = point(e);
  });
  layer.addEventListener('pointermove', (e) => {
    if (start) showGhost(rectFromPoints(start, point(e)));
  });
  layer.addEventListener('pointercancel', () => {
    start = null;
    ghost.setAttribute('visibility', 'hidden');
  });
  layer.addEventListener('pointerup', async (e) => {
    if (!start) return;
    const end = point(e);
    const rect = rectFromPoints(start, end);
    start = null;
    if (isUsableRect(rect)) {
      await assignRect(ctx, floor, rooms, rect);
    } else {
      await offerRemove(ctx, rooms, end);
    }
    ghost.setAttribute('visibility', 'hidden');
  });

  view.append(
    h('p', { class: 'help' }, mode === 'draw'
      ? 'Træk en firkant over et rum med fingeren. Tryk på en firkant for at fjerne den. Et L-formet rum kan få to firkanter.'
      : 'Flyt-tilstand: rul rundt i tegningen. Skift til Tegn for at markere rum.'),
    h('div', { class: 'plan-tools' },
      h('div', { class: 'segmented', role: 'group', 'aria-label': 'Tilstand' },
        ['draw', 'pan'].map((m) => h('button', {
          type: 'button', class: ['btn', 'btn-small', m === mode && 'selected'], 'aria-pressed': String(m === mode),
          text: m === 'draw' ? 'Tegn' : 'Flyt', onclick: () => { mode = m; ctx.render(); },
        }))),
      zoomControls(zoom, (z) => { zoom = z; ctx.render(); })),
    board.wrap,
    h('section', { class: 'cards' },
      h('h2', { class: 'section-title', text: `Rum på ${floor.name}` }),
      rooms.length
        ? h('ul', { class: 'plain-list' }, rooms.map((r) => h('li', {},
          h('a', { href: `#/room/${r.id}`, text: r.name }),
          h('span', { class: r.areas.length ? 'muted' : 'flag', text: r.areas.length ? `${r.areas.length} ${r.areas.length === 1 ? 'firkant' : 'firkanter'}` : 'ikke markeret' }))))
        : h('p', { class: 'note', text: 'Ingen rum endnu. Træk den første firkant på tegningen.' })),
    h('div', { class: 'actions' }, h('a', { class: 'btn btn-primary btn-block', href: '#/', text: 'Færdig' })),
  );
}

async function assignRect(ctx, floor, rooms, rect) {
  const unmarked = rooms.filter((r) => !r.areas.length);
  const marked = rooms.filter((r) => r.areas.length);
  const loose = ctx.doc.rooms.filter((r) => r.floorId === null); // e.g. from quick start on a second floor
  const choice = rooms.length || loose.length
    ? await choose({
      title: 'Hvilket rum er det?',
      options: [
        { value: '__new', label: 'Nyt rum …', kind: 'primary' },
        ...unmarked.map((r) => ({ value: r.id, label: r.name, hint: 'Ikke markeret endnu' })),
        ...loose.map((r) => ({ value: r.id, label: r.name, hint: `Uden etage – flyttes til ${floor.name}` })),
        ...marked.map((r) => ({ value: r.id, label: r.name, hint: 'Tilføj en firkant mere (L-formet rum)' })),
      ],
    })
    : '__new';
  if (!choice) return;
  let roomId = choice;
  if (choice === '__new') {
    const name = await ask({ title: 'Nyt rum', label: 'Navn på rummet', placeholder: 'Fx Køkken', ok: 'Opret' });
    if (!name) return;
    roomId = ctx.commit((doc) => addRoom(doc, { name, floorId: floor.id })).id;
  }
  ctx.commit((doc) => {
    if (loose.some((r) => r.id === roomId)) setRoomFloor(doc, roomId, floor.id);
    addArea(doc, roomId, rect);
  });
}

async function offerRemove(ctx, rooms, p) {
  for (const room of [...rooms].reverse()) {
    const i = areaAt(room.areas, p);
    if (i < 0) continue;
    const ok = await confirmDialog({
      title: `Fjern firkant fra ${room.name}?`,
      message: room.areas.length === 1 ? 'Rummet og dets ting bliver liggende – det er bare ikke markeret på tegningen længere.' : null,
      ok: 'Fjern',
      danger: true,
    });
    if (ok) ctx.commit((doc) => removeArea(doc, room.id, i));
    return;
  }
}
