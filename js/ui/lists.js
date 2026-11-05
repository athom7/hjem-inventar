// One list per decision, grouped by room – what to bring to the recycling centre, what to put up for sale.

import { h, fmt } from './dom.js';
import { emptyState } from './widgets.js';
import { editItem } from './itemdialog.js';
import { DECISIONS, DECISION_BY_ID, isDecision } from '../model/decisions.js';
import { listByDecision } from '../model/stats.js';
import { listAsText } from '../data/export.js';

export function renderLists(view, ctx, { decision }) {
  if (!isDecision(decision)) return ctx.go('#/lists/trash');
  ctx.setTitle('Lister');
  const groups = listByDecision(ctx.doc, decision);
  const total = groups.reduce((s, g) => s + g.things, 0);

  view.append(h('div', { class: 'chips', role: 'group', 'aria-label': 'Liste' }, DECISIONS.map((d) =>
    h('a', { class: ['chip', `filter-${d.id}`, d.id === decision && 'selected'], href: `#/lists/${d.id}`, 'aria-current': d.id === decision ? 'page' : null, text: d.labelDa }))));

  view.append(h('header', { class: 'list-head' },
    h('h2', { text: `${DECISION_BY_ID[decision].labelDa} – ${fmt(total)} ting` }),
    h('p', { class: 'muted', text: DECISION_BY_ID[decision].hintDa })));

  if (!groups.length) {
    view.append(emptyState('Listen er tom', 'Når du beslutter ting, kommer de her – samlet pr. rum.'));
    return;
  }

  view.append(h('div', { class: 'actions secondary no-print' },
    h('button', {
      type: 'button', class: 'btn btn-small', text: 'Kopiér liste',
      onclick: async () => {
        try {
          await navigator.clipboard.writeText(listAsText(groups, decision));
          ctx.toast('Listen er kopieret. Sæt den ind i en besked eller en note.');
        } catch {
          ctx.toast('Kunne ikke kopiere. Prøv »Print« i stedet.');
        }
      },
    }),
    h('button', { type: 'button', class: 'btn btn-small', text: 'Print', onclick: () => window.print() })));

  for (const g of groups) {
    view.append(h('section', { class: 'list-group' },
      h('h3', {}, h('a', { href: `#/room/${g.room.id}`, text: g.room.name }), h('span', { class: 'muted', text: ` · ${fmt(g.things)} ting` })),
      h('ul', { class: 'item-list' }, g.items.map((item) => h('li', {},
        h('button', { type: 'button', class: ['item-row', `dec-${item.decision}`], onclick: () => editItem(ctx, item.id) },
          h('span', { class: 'item-name' },
            item.qty > 1 ? h('span', { class: 'qty', text: `${fmt(item.qty)} ×` }) : null,
            item.name,
            item.note ? h('small', { class: 'item-note', text: item.note }) : null)))))));
  }
}
