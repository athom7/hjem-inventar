// The floor plan with rooms drawn on top: the image, an SVG layer with one rectangle per marked area,
// and HTML labels. Shared by the overview (planview.js) and the room marker (planedit.js).

import { h, s } from './dom.js';
import { labelAnchor } from '../model/plan.js';

export const VIEW_W = 1000;
export const ZOOMS = [1, 1.5, 2, 3];

// rooms: the rooms on this floor. areaClass(room) → class list for its rectangles.
// label(room) → node shown at the room's centre, or null. onRoom(room) → called on tap (omit for no taps).
export function planBoard({ floor, imageUrl, zoom = 1, rooms, areaClass = () => [], label = () => null, onRoom = null }) {
  const viewH = Math.round(VIEW_W * floor.aspect);
  const svg = s('svg', { class: 'plan-svg', viewBox: `0 0 ${VIEW_W} ${viewH}`, preserveAspectRatio: 'none', 'aria-hidden': 'true' });
  const labels = h('div', { class: 'plan-labels' });

  for (const room of rooms) {
    for (const a of room.areas) {
      svg.append(s('rect', {
        class: ['area', ...areaClass(room)],
        x: a.x * VIEW_W, y: a.y * viewH, width: a.w * VIEW_W, height: a.h * viewH,
        'data-room': room.id,
        onclick: onRoom ? () => onRoom(room) : null,
      }));
    }
    const anchor = labelAnchor(room.areas);
    const content = anchor && label(room);
    if (content) {
      labels.append(h(onRoom ? 'button' : 'div', {
        type: onRoom ? 'button' : null,
        class: ['room-label', ...areaClass(room)],
        style: { left: `${anchor.x * 100}%`, top: `${anchor.y * 100}%`, maxWidth: `${anchor.maxW * 100}%` },
        'data-room': room.id,
        onclick: onRoom ? () => onRoom(room) : null,
      }, content));
    }
  }

  const plan = h('div', {
    class: 'plan',
    style: { width: `${zoom * 100}%`, aspectRatio: String(1 / floor.aspect) },
  },
  imageUrl
    ? h('img', { class: 'plan-img', src: imageUrl, alt: `Plantegning: ${floor.name}`, draggable: 'false' })
    : h('div', { class: 'plan-missing', text: 'Billedet af plantegningen mangler. Læg det ind igen under Indstillinger.' }),
  svg, labels);

  const wrap = h('div', { class: 'plan-wrap' }, plan);
  return { wrap, plan, svg, viewH };
}

export function zoomControls(zoom, setZoom) {
  const i = Math.max(0, ZOOMS.indexOf(zoom));
  return h('div', { class: 'zoom', role: 'group', 'aria-label': 'Zoom' },
    h('button', { type: 'button', class: 'btn btn-small', text: '−', 'aria-label': 'Zoom ud', disabled: i === 0, onclick: () => setZoom(ZOOMS[i - 1]) }),
    h('span', { class: 'zoom-value', text: `${String(zoom).replace('.', ',')}×` }),
    h('button', { type: 'button', class: 'btn btn-small', text: '+', 'aria-label': 'Zoom ind', disabled: i === ZOOMS.length - 1, onclick: () => setZoom(ZOOMS[i + 1]) }));
}
