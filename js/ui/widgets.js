// Small pieces shared by several views. They only turn numbers from model/stats.js into elements and classes.

import { h, plural, fmt } from './dom.js';
import { labelOf } from '../model/decisions.js';
import { segments } from '../model/stats.js';

export const STATE_LABEL = { empty: 'Ikke gennemgået', open: 'Mangler beslutninger', done: 'Alt afgjort' };

// "12 ting · 3 uafgjorte" – or the room's state when there is nothing to count.
export function statsLine(stats) {
  if (stats.state === 'empty') return STATE_LABEL.empty;
  const base = plural(stats.things, 'ting', 'ting');
  return stats.state === 'done' ? `${base} · alt afgjort` : `${base} · ${fmt(stats.undecided)} uafgjort`;
}

// Stacked bar of the decision distribution. Segment widths are flex weights; colours come from the CSS classes.
export function decisionBar(stats, { big = false } = {}) {
  const segs = segments(stats);
  return h('div', {
    class: ['bar', big && 'bar-big'],
    role: 'img',
    'aria-label': segs.length ? segs.map((x) => `${labelOf(x.decision)}: ${x.things}`).join(', ') : 'Ingen ting endnu',
  }, segs.map((x) => h('span', { class: ['seg', `dec-${x.decision}`], style: { flexGrow: String(x.things) } })));
}

export const decisionBadge = (decision) => h('span', { class: ['badge', `dec-${decision}`], text: labelOf(decision) });

export function legend(stats) {
  return h('ul', { class: 'legend' }, segments(stats).map((x) =>
    h('li', {}, h('span', { class: ['swatch', `dec-${x.decision}`] }), `${labelOf(x.decision)} ${fmt(x.things)}`)));
}

export function emptyState(title, text, ...actions) {
  return h('div', { class: 'empty' }, h('h2', { text: title }), text ? h('p', { text }) : null, actions.length ? h('div', { class: 'actions' }, actions) : null);
}
