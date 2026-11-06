// Quick start: create the home's rooms from the numbers in BBR, so the walk-through can start without a floor plan.
// The suggestion itself comes from model/quickstart.js; this view only collects the numbers and shows the result.

import { h, plural } from './dom.js';
import { EXTRA_ROOMS, DEFAULT_EXTRAS, MAX_COUNT, suggestRooms, newRoomNames } from '../model/quickstart.js';
import { addRooms, findFloor } from '../model/inventory.js';

// Kept between re-renders while the user adjusts the numbers.
const state = { livingRooms: 4, bathrooms: 1, extras: new Set(DEFAULT_EXTRAS), floorId: undefined };

export function renderQuickstart(view, ctx) {
  const { doc } = ctx;
  ctx.setTitle('Hurtigstart', '#/');
  if (state.floorId === undefined || (state.floorId && !findFloor(doc, state.floorId))) {
    state.floorId = findFloor(doc, ctx.prefs.floorId)?.id ?? doc.floors[0]?.id ?? null;
  }

  const names = suggestRooms({ livingRooms: state.livingRooms, bathrooms: state.bathrooms, extras: [...state.extras] });
  const fresh = newRoomNames(doc, names);
  const freshSet = new Set(fresh);

  const stepper = (key, label, hint, noun) => h('div', { class: 'stepper' },
    h('div', { class: 'stepper-text' }, h('strong', { text: label }), hint ? h('small', { class: 'muted', text: hint }) : null),
    h('div', { class: 'stepper-controls' },
      h('button', {
        type: 'button', class: 'btn', text: '−', 'aria-label': `Færre ${noun}`, disabled: state[key] <= 0,
        onclick: () => { state[key]--; ctx.render(); },
      }),
      h('output', { class: 'stepper-value', 'aria-live': 'polite', text: String(state[key]) }),
      h('button', {
        type: 'button', class: 'btn', text: '+', 'aria-label': `Flere ${noun}`, disabled: state[key] >= MAX_COUNT,
        onclick: () => { state[key]++; ctx.render(); },
      })));

  view.append(...[
    h('p', { class: 'help', text: 'Har I ikke plantegningen endnu? Opret rummene ud fra BBR-meddelelsen eller salgsopstillingen, og gå i gang. Når tegningen kommer, markerer du rummene på den.' }),
    h('section', { class: 'panel' },
      stepper('livingRooms', 'Værelser', 'Stuer og soveværelser – som »Antal værelser« i BBR.', 'værelser'),
      stepper('bathrooms', 'Badeværelser', null, 'badeværelser')),
    h('h2', { class: 'section-title', text: 'Andre rum' }),
    h('div', { class: 'chips wrap', role: 'group', 'aria-label': 'Andre rum' }, EXTRA_ROOMS.map((r) => {
      const on = state.extras.has(r.name);
      return h('button', {
        type: 'button', class: ['chip', on && 'selected'], 'aria-pressed': String(on), text: r.name,
        onclick: () => { if (on) state.extras.delete(r.name); else state.extras.add(r.name); ctx.render(); },
      });
    })),
    doc.floors.length
      ? h('label', { class: 'field quick-floor' }, h('span', { text: 'Etage' }),
        h('select', { onchange: (e) => { state.floorId = e.target.value || null; ctx.render(); } },
          doc.floors.map((f) => h('option', { value: f.id, text: f.name, selected: f.id === state.floorId })),
          h('option', { value: '', text: 'Ingen etage endnu', selected: state.floorId === null })))
      : null,
    h('h2', { class: 'section-title', text: fresh.length ? `Disse ${plural(fresh.length, 'rum', 'rum')} oprettes` : 'Ingen nye rum' }),
    h('ul', { class: 'room-preview' }, names.map((n) => h('li', { class: freshSet.has(n) ? null : 'exists' },
      n, freshSet.has(n) ? null : h('small', { text: ' findes allerede' })))),
    h('div', { class: 'actions' }, h('button', {
      type: 'button', class: 'btn btn-primary btn-big btn-block', disabled: !fresh.length,
      text: fresh.length ? `Opret ${plural(fresh.length, 'rum', 'rum')}` : 'Alle rum findes allerede',
      onclick: () => {
        const created = ctx.commit((d) => addRooms(d, names, state.floorId));
        if (state.floorId) ctx.setPref('floorId', state.floorId);
        ctx.toast(`${plural(created.length, 'rum', 'rum')} oprettet. Tryk på et rum for at indtale, hvad der står der.`);
        ctx.go('#/');
      },
    })),
  ].filter(Boolean));
}
