// Modal dialogs on the single <dialog id="dialog"> element. Each helper returns a Promise with the answer,
// or null when the dialog is cancelled (Escape, backdrop tap or the cancel button).

import { h } from './dom.js';

// Generic dialog.
// - `body(close)` returns the nodes to show; it may call close(value) itself (e.g. a list of choices).
// - `buttons` are { label, value, kind } with kind 'primary' | 'danger' | undefined. value null = cancel.
// - `collect(value)` turns the clicked button's value into the result, or returns undefined to keep the
//   dialog open (e.g. a required field is empty).
export function openDialog({ title, body = () => [], buttons = [], collect = (v) => v, initialFocus = null }) {
  const dlg = document.getElementById('dialog');
  return new Promise((resolve) => {
    let done = false;
    const close = (result) => {
      if (done) return;
      done = true;
      dlg.removeEventListener('cancel', onCancel);
      dlg.onclick = null;
      if (dlg.open) dlg.close();
      dlg.replaceChildren();
      resolve(result);
    };
    const onCancel = (e) => {
      e.preventDefault();
      close(null);
    };
    const press = (value) => {
      if (value === null) return close(null);
      const result = collect(value);
      if (result !== undefined) close(result);
    };
    const primary = buttons.find((b) => b.kind === 'primary');
    const form = h('form', {
      class: 'dialog-form',
      onsubmit: (e) => {
        e.preventDefault();
        if (primary) press(primary.value);
      },
    },
    h('h2', { class: 'dialog-title', text: title }),
    body(close),
    buttons.length ? h('div', { class: 'dialog-buttons' }, buttons.map((b) =>
      h('button', { type: 'button', class: ['btn', b.kind && `btn-${b.kind}`], text: b.label, onclick: () => press(b.value) }))) : null);
    dlg.replaceChildren(form);
    dlg.addEventListener('cancel', onCancel);
    dlg.onclick = (e) => {
      if (e.target === dlg) close(null); // tap on the backdrop
    };
    dlg.showModal();
    const focus = typeof initialFocus === 'function' ? initialFocus(form) : form.querySelector('input[type=text], textarea');
    focus?.focus();
  });
}

export function ask({ title, label, value = '', ok = 'OK', placeholder = '' }) {
  let input;
  return openDialog({
    title,
    body: () => {
      input = h('input', { type: 'text', value, placeholder, autocomplete: 'off', enterkeyhint: 'done' });
      return h('label', { class: 'field' }, h('span', { text: label }), input);
    },
    buttons: [{ label: 'Annullér', value: null }, { label: ok, value: 'ok', kind: 'primary' }],
    collect: () => {
      const v = input.value.trim();
      if (v) return v;
      input.focus();
      return undefined;
    },
  });
}

export function confirmDialog({ title, message, ok = 'Ja', danger = false }) {
  return openDialog({
    title,
    body: () => (message ? h('p', { text: message }) : []),
    buttons: [{ label: 'Annullér', value: null }, { label: ok, value: true, kind: danger ? 'danger' : 'primary' }],
  }).then((v) => v === true);
}

// Pick one of several options, shown as big buttons: [{ value, label, hint, kind }].
export function choose({ title, message, options }) {
  return openDialog({
    title,
    body: (close) => [
      message ? h('p', { text: message }) : null,
      h('div', { class: 'choice-list' }, options.map((o) =>
        h('button', { type: 'button', class: ['btn', 'choice', o.kind && `btn-${o.kind}`], onclick: () => close(o.value) },
          h('strong', { text: o.label }), o.hint ? h('small', { text: o.hint }) : null))),
    ],
    buttons: [{ label: 'Annullér', value: null }],
    initialFocus: () => null,
  });
}
