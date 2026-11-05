// Edit one item: name, quantity, decision, note and room. Used from the room view and the lists.

import { h } from './dom.js';
import { openDialog, confirmDialog } from './dialog.js';
import { DECISIONS } from '../model/decisions.js';
import { findItem, updateItem, removeItem } from '../model/inventory.js';
import { orderedRooms } from '../model/stats.js';

export async function editItem(ctx, itemId) {
  const item = findItem(ctx.doc, itemId);
  if (!item) return;
  let name, qty, note, room, decision = item.decision;

  const result = await openDialog({
    title: 'Ret ting',
    body: () => {
      name = h('input', { type: 'text', value: item.name, autocomplete: 'off' });
      qty = h('input', { type: 'number', value: String(item.qty), min: '1', max: '9999', inputmode: 'numeric' });
      note = h('textarea', { rows: 2, placeholder: 'Fx mærke, stand, hvem der skal have den' });
      note.value = item.note;
      room = h('select', {}, orderedRooms(ctx.doc).map((r) => h('option', { value: r.id, text: r.name, selected: r.id === item.roomId })));
      const choices = h('div', { class: 'decision-picker', role: 'radiogroup', 'aria-label': 'Beslutning' });
      const paint = () => choices.querySelectorAll('button').forEach((b) => {
        b.classList.toggle('selected', b.dataset.value === decision);
        b.setAttribute('aria-checked', String(b.dataset.value === decision));
      });
      for (const d of DECISIONS) {
        choices.append(h('button', {
          type: 'button', role: 'radio', class: ['btn', 'decision-btn', `dec-${d.id}`], dataset: { value: d.id }, text: d.labelDa,
          onclick: () => { decision = d.id; paint(); },
        }));
      }
      paint();
      return [
        h('div', { class: 'field-row' },
          h('label', { class: 'field grow' }, h('span', { text: 'Ting' }), name),
          h('label', { class: 'field qty' }, h('span', { text: 'Antal' }), qty)),
        h('div', { class: 'field' }, h('span', { text: 'Beslutning' }), choices),
        h('label', { class: 'field' }, h('span', { text: 'Note' }), note),
        h('label', { class: 'field' }, h('span', { text: 'Rum' }), room),
      ];
    },
    buttons: [
      { label: 'Slet', value: 'delete', kind: 'danger' },
      { label: 'Annullér', value: null },
      { label: 'Gem', value: 'save', kind: 'primary' },
    ],
    collect: (value) => {
      if (value === 'delete') return 'delete';
      if (!name.value.trim()) {
        name.focus();
        return undefined;
      }
      return { name: name.value, qty: qty.value, note: note.value, decision, roomId: room.value };
    },
    initialFocus: () => null,
  });

  if (result === 'delete') {
    if (await confirmDialog({ title: `Slet »${item.name}«?`, ok: 'Slet', danger: true })) ctx.commit((doc) => removeItem(doc, item.id));
  } else if (result) {
    ctx.commit((doc) => updateItem(doc, item.id, result));
  }
}
