// The overview (front page): the floor plan with every room showing how far it is, filter chips for each
// decision, and the rooms as cards below. Only draws; every number comes from model/stats.js.

import { h, fmt, plural } from './dom.js';
import { ask } from './dialog.js';
import { planBoard, zoomControls } from './board.js';
import { statsLine, decisionBar, emptyState, STATE_LABEL } from './widgets.js';
import { fileButton, addPlanFromFile, loadDemo } from './actions.js';
import { DECIDED_IDS, labelOf } from '../model/decisions.js';
import { addRoom, roomsOn, findFloor } from '../model/inventory.js';
import { roomStats, houseStats, filterCounts, levelOf, progressOf } from '../model/stats.js';

const FILTERS = ['progress', ...DECIDED_IDS];
const FILTER_LABEL = { progress: 'Fremdrift', ...Object.fromEntries(DECIDED_IDS.map((id) => [id, labelOf(id)])) };

let zoom = 1;

export function renderHome(view, ctx) {
  const { doc } = ctx;
  ctx.setTitle('Hjem-inventar');

  if (!doc.floors.length && !doc.rooms.length) {
    view.append(emptyState(
      'Velkommen',
      'Start med boligens plantegning. Har du den som PDF, så tag et skærmbillede af den og vælg billedet her. Har du ikke tegningen endnu, så opret rummene ud fra BBR-meddelelsen og markér dem senere.',
      fileButton({ label: 'Læg plantegning ind', accept: 'image/*', kind: 'primary', onFile: (f) => addPlanFromFile(ctx, f) }),
      h('a', { class: 'btn', href: '#/quickstart', text: 'Hurtigstart: opret rummene' }),
      h('button', { type: 'button', class: 'btn btn-quiet', text: 'Prøv med en eksempel-bolig', onclick: () => loadDemo(ctx) }),
    ));
    return;
  }

  const filter = FILTERS.includes(ctx.prefs.filter) ? ctx.prefs.filter : 'progress';
  const floor = findFloor(doc, ctx.prefs.floorId) ?? doc.floors[0] ?? null;

  view.append(houseSummary(doc));

  if (doc.floors.length > 1) {
    view.append(h('div', { class: 'tabs', role: 'tablist', 'aria-label': 'Etager' }, doc.floors.map((f) =>
      h('button', {
        type: 'button', role: 'tab', class: ['tab', f.id === floor?.id && 'selected'], 'aria-selected': String(f.id === floor?.id), text: f.name,
        onclick: () => ctx.setPref('floorId', f.id, true),
      }))));
  }

  view.append(h('div', { class: 'chips', role: 'group', 'aria-label': 'Vis på tegningen' }, FILTERS.map((id) =>
    h('button', {
      type: 'button', class: ['chip', id !== 'progress' && `filter-${id}`, id === filter && 'selected'], 'aria-pressed': String(id === filter), text: FILTER_LABEL[id],
      onclick: () => ctx.setPref('filter', id, true),
    }))));

  const counts = filter === 'progress' ? null : filterCounts(doc, filter);
  const classesFor = (room) => {
    if (!counts) return [`room-${roomStats(doc, room.id).state}`];
    return [`filter-${filter}`, `level-${levelOf(counts.counts.get(room.id), counts.max)}`];
  };
  const labelFor = (room) => {
    const st = roomStats(doc, room.id);
    if (counts) {
      const n = counts.counts.get(room.id) ?? 0;
      return [h('strong', { text: room.name }), h('span', { text: n ? `${fmt(n)} ${labelOf(filter).toLowerCase()}` : '–' })];
    }
    // Short on purpose: small rooms are narrow on a phone. The state itself is shown by the area's style.
    const meta = { empty: '0 ting', open: `${fmt(st.undecided)} uafgjort`, done: `${fmt(st.things)} ting ✓` }[st.state];
    return [h('strong', { text: room.name, title: room.name }), h('span', { text: meta }), st.things ? decisionBar(st) : null];
  };

  if (floor) {
    const rooms = roomsOn(doc, floor.id);
    const board = planBoard({
      floor, imageUrl: ctx.images.get(floor.imageId), zoom, rooms,
      areaClass: classesFor, label: labelFor,
      onRoom: (room) => ctx.go(`#/room/${room.id}`),
    });
    view.append(h('section', { class: 'plan-section' },
      board.wrap,
      h('div', { class: 'plan-tools' },
        zoomControls(zoom, (z) => { zoom = z; ctx.render(); }),
        h('a', { class: 'btn btn-small', href: `#/plan/${floor.id}`, text: 'Markér rum' }),
        h('button', { type: 'button', class: 'btn btn-small', text: '+ Rum', onclick: () => newRoom(ctx, floor.id) })),
      legendFor(filter)));
    if (!rooms.length) {
      view.append(h('p', { class: 'note' }, 'Ingen rum på denne etage endnu. ', h('a', { href: `#/plan/${floor.id}`, text: 'Markér rum på tegningen' }), ' eller brug ', h('a', { href: '#/quickstart', text: 'hurtigstart' }), '.'));
    } else if (!rooms.some((r) => r.areas.length)) {
      view.append(h('p', { class: 'note' }, 'Ingen rum er markeret på tegningen endnu. ', h('a', { href: `#/plan/${floor.id}`, text: 'Markér rum' }), '.'));
    }
    view.append(roomCards(ctx, rooms, counts, filter, floor.name));
  } else {
    view.append(h('div', { class: 'plan-tools' },
      fileButton({ label: 'Læg plantegning ind', accept: 'image/*', onFile: (f) => addPlanFromFile(ctx, f) }),
      h('a', { class: 'btn btn-small', href: '#/quickstart', text: 'Hurtigstart' }),
      h('button', { type: 'button', class: 'btn btn-small', text: '+ Rum', onclick: () => newRoom(ctx, null) })));
  }

  const loose = doc.rooms.filter((r) => r.floorId === null);
  if (loose.length) view.append(roomCards(ctx, loose, counts, filter, doc.floors.length ? 'Uden etage' : 'Rum'));
}

function houseSummary(doc) {
  const st = houseStats(doc);
  const pct = Math.round(progressOf(st) * 100);
  return h('section', { class: 'summary' },
    h('div', { class: 'summary-numbers' },
      h('div', {}, h('strong', { text: fmt(st.things) }), h('span', { text: 'ting' })),
      h('div', {}, h('strong', { text: fmt(st.rooms) }), h('span', { text: 'rum' })),
      h('div', {}, h('strong', { text: `${pct} %` }), h('span', { text: 'afgjort' })),
      h('div', { class: st.undecided ? 'attention' : null }, h('strong', { text: fmt(st.undecided) }), h('span', { text: 'uafgjort' }))),
    decisionBar(st, { big: true }),
    // The walk-through is the main thing to do until there are items; after that, deciding is.
    st.rooms ? h('a', { class: ['btn', 'btn-block', !st.things && 'btn-primary'], href: '#/walk', text: 'Gå-tur: indtal hele huset' }) : null,
    st.undecided ? h('a', { class: 'btn btn-primary btn-block', href: '#/triage', text: `Beslut ${plural(st.undecidedPosts, 'post', 'poster')}` }) : null);
}

function legendFor(filter) {
  if (filter === 'progress') {
    return h('ul', { class: 'legend' }, ['empty', 'open', 'done'].map((state) =>
      h('li', {}, h('span', { class: ['swatch', `room-${state}`] }), STATE_LABEL[state])));
  }
  return h('p', { class: 'legend-note' }, `Jo kraftigere farve, jo flere ting at ${filter === 'keep' ? 'tage med' : labelOf(filter).toLowerCase()} i rummet.`);
}

function roomCards(ctx, rooms, counts, filter, heading) {
  return h('section', { class: 'cards' },
    h('h2', { class: 'section-title', text: heading }),
    rooms.length
      ? h('ul', { class: 'card-list' }, rooms.map((room) => {
        const st = roomStats(ctx.doc, room.id);
        const n = counts?.counts.get(room.id) ?? 0;
        return h('li', {}, h('a', {
          class: ['room-card', counts ? [`filter-${filter}`, `level-${levelOf(n, counts.max)}`] : `room-${st.state}`],
          href: `#/room/${room.id}`,
        },
        h('span', { class: 'room-card-name', text: room.name }),
        h('span', { class: 'room-card-meta', text: counts ? `${fmt(n)} ${labelOf(filter).toLowerCase()}` : statsLine(st) }),
        st.things ? decisionBar(st) : null,
        room.floorId && !room.areas.length ? h('span', { class: 'room-card-flag', text: 'Ikke markeret på tegningen' }) : null));
      }))
      : h('p', { class: 'note', text: 'Ingen rum endnu.' }));
}

export async function newRoom(ctx, floorId) {
  const name = await ask({ title: 'Nyt rum', label: 'Navn', placeholder: 'Fx Køkken', ok: 'Opret' });
  if (!name) return;
  const room = ctx.commit((doc) => addRoom(doc, { name, floorId }));
  ctx.go(`#/room/${room.id}`);
}
