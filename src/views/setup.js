import { esc, icons } from '../ui.js';
import { TYPES, typeLabel, ROLES } from '../format.js';

export function renderSetup(root, ctx) {
  const { state, current } = ctx;
  const b = current();

  root.innerHTML = `
    <div class="page-head">
      <h1>Deine Logbücher</h1>
      <p>Jedes Logbuch hat eigene Felder und eigene Mitglieder.</p>
    </div>
    <div class="setup">
      <aside class="card books" aria-label="Logbücher">
        <ul class="book-list">
          ${state.logbooks.map((x) => bookItem(x, x.id === state.selectedId)).join('')}
        </ul>
        <button class="btn btn-dashed" data-action="new-book">${icons.plus}<span>Neues Logbuch</span></button>
      </aside>
      <section class="card editor">
        ${b ? editor(ctx, b) : `<div class="empty"><p>Leg dein erstes Logbuch an und bestimme, was du darin erfassen willst.</p><button class="btn btn-primary" data-action="new-book">Logbuch anlegen</button></div>`}
      </section>
    </div>`;

  bind(root, ctx);
}

function bookItem(b, on) {
  const label = b.name || 'Unbenannt';
  const fields = b.fieldCount === 1 ? '1 Feld' : `${b.fieldCount} Felder`;
  const shared = b.members.length > 1 ? `, ${b.members.length} Personen` : '';
  const role = b.myRole !== 'owner' ? `<span class="role-tag">${esc(ROLES[b.myRole] || '')}</span>` : '';
  return `<li><button class="book ${on ? 'is-on' : ''}" data-book="${esc(b.id)}" ${on ? 'aria-current="true"' : ''}>
      <span class="book-initial" aria-hidden="true">${esc(label.charAt(0).toUpperCase())}</span>
      <span class="book-text"><span class="book-name">${esc(label)}</span><span class="book-meta">${fields}${shared}</span></span>
      ${role}
    </button></li>`;
}

function editor(ctx, b) {
  const { state, myRole } = ctx;
  const owner = myRole() === 'owner';
  const tab = state.setupTab;
  const memberCount = b.members.length + (owner ? state.invites.length : 0);
  return `
    <div class="editor-head">
      <div class="grow stack-sm">
        <label for="book-name" class="label">Name des Logbuchs</label>
        <input id="book-name" class="input input-title" value="${esc(b.name)}" ${owner ? '' : 'readonly'} maxlength="80" />
      </div>
      <a class="btn btn-primary" href="#/erfassen">Erfassen ${icons.arrow}</a>
    </div>
    <div class="tabs" role="tablist">
      <button role="tab" id="tab-fields" aria-controls="panel" aria-selected="${tab === 'fields'}" data-tab="fields">Felder (${state.fields.length})</button>
      <button role="tab" id="tab-members" aria-controls="panel" aria-selected="${tab === 'members'}" data-tab="members">Mitglieder (${memberCount})</button>
    </div>
    <div id="panel" class="panel" role="tabpanel" aria-labelledby="tab-${tab}">
      ${tab === 'fields' ? fieldsPanel(state, owner) : membersPanel(ctx, b, owner)}
    </div>
    <div class="editor-foot">
      ${tab === 'fields' && owner ? `<button class="btn btn-dashed" data-action="add-field">${icons.plus}<span>Feld hinzufügen</span></button>` : '<span></span>'}
      ${owner
        ? `<button class="btn btn-danger-text" data-action="delete-book">Logbuch löschen</button>`
        : `<button class="btn btn-danger-text" data-action="leave-book">Logbuch verlassen</button>`}
    </div>`;
}

function fieldsPanel(state, owner) {
  if (state.loading && !state.fields.length) return `<p class="muted pad">Lädt …</p>`;
  if (!state.fields.length) {
    return `<p class="muted pad">${owner ? 'Noch keine Felder. Füge das erste Feld hinzu, z. B. „Kohlenhydrate“ in g.' : 'Dieses Logbuch hat noch keine Felder.'}</p>`;
  }
  if (!owner) {
    return `<ul class="field-list readonly">${state.fields
      .map((f) => `<li><span class="field-ro-name">${esc(f.name)}</span><span class="muted">${esc(typeLabel(f.type))}${f.unit ? `, ${esc(f.unit)}` : ''}</span></li>`)
      .join('')}</ul>
      <p class="muted pad-sm">Felder kann nur der Besitzer ändern.</p>`;
  }
  return `
    <div class="field-grid field-head" aria-hidden="true"><span></span><span>Name</span><span>Typ</span><span>Einheit</span><span></span></div>
    <ul class="field-list">
      ${state.fields
        .map(
          (f, i) => `
        <li class="field-grid field-row" draggable="true" data-row="${esc(f.id)}" data-index="${i}">
          <button class="icon-btn grip" data-handle="${esc(f.id)}" aria-label="${esc(f.name)} verschieben (Pfeiltasten hoch/runter)" title="Ziehen oder Pfeiltasten">${icons.grip}</button>
          <input class="input" aria-label="Feldname" data-field-name="${esc(f.id)}" value="${esc(f.name)}" maxlength="60" />
          <select class="input" aria-label="Typ von ${esc(f.name)}" data-field-type="${esc(f.id)}">
            ${TYPES.map((t) => `<option value="${t.value}" ${t.value === f.type ? 'selected' : ''}>${t.label}</option>`).join('')}
          </select>
          <input class="input" aria-label="Einheit von ${esc(f.name)}" data-field-unit="${esc(f.id)}" value="${esc(f.unit || '')}" placeholder="–" maxlength="12" ${f.type === 'boolean' ? 'disabled' : ''} />
          <button class="icon-btn" data-field-delete="${esc(f.id)}" aria-label="${esc(f.name)} entfernen">${icons.trash}</button>
        </li>`,
        )
        .join('')}
    </ul>`;
}

function membersPanel(ctx, b, owner) {
  const { state } = ctx;
  const uid = state.user.id;
  const rows = [...b.members]
    .sort((x, y) => (x.role === 'owner' ? -1 : y.role === 'owner' ? 1 : 0))
    .map((m) => {
      const me = m.user_id === uid;
      const name = me ? 'Du' : m.email || 'Unbekannt';
      const control =
        m.role === 'owner'
          ? `<span class="muted">Besitzer</span>`
          : owner
            ? `${roleSelect(`data-member-role="${esc(m.user_id)}"`, m.role, `Berechtigung für ${name}`)}
               <button class="icon-btn" data-member-remove="${esc(m.user_id)}" aria-label="${esc(name)} entfernen">${icons.close}</button>`
            : `<span class="muted">${esc(ROLES[m.role])}</span>`;
      return `<li class="member">
          <span class="avatar ${me ? 'avatar-me' : ''}" aria-hidden="true">${esc(name.charAt(0).toUpperCase())}</span>
          <span class="member-text"><span class="member-name">${esc(name)}</span>${me && m.email ? `<span class="muted small">${esc(m.email)}</span>` : ''}</span>
          <span class="member-ctl">${control}</span>
        </li>`;
    });
  const invites = owner
    ? state.invites.map(
        (i) => `<li class="member">
          <span class="avatar avatar-pending" aria-hidden="true">${esc(i.email.charAt(0).toUpperCase())}</span>
          <span class="member-text"><span class="member-name">${esc(i.email)}</span><span class="small warn">Einladung ausstehend, ${esc(ROLES[i.role])}</span></span>
          <span class="member-ctl"><button class="icon-btn" data-invite-delete="${esc(i.id)}" aria-label="Einladung an ${esc(i.email)} zurückziehen">${icons.close}</button></span>
        </li>`,
      )
    : [];

  return `
    ${
      owner
        ? `<form class="invite" data-form="invite" novalidate>
            <h2 class="h2">Person einladen</h2>
            <div class="invite-row">
              <div class="grow stack-sm">
                <label for="invite-email" class="label">E-Mail-Adresse</label>
                <input id="invite-email" class="input" type="email" autocomplete="off" placeholder="name@beispiel.ch" />
              </div>
              <div class="stack-sm invite-role">
                <label for="invite-role" class="label">Berechtigung</label>
                ${roleSelect('id="invite-role"', 'editor')}
              </div>
              <button class="btn btn-primary" type="submit">Einladen</button>
            </div>
            <p class="muted small">Die Person sieht das Logbuch, sobald sie sich mit dieser Adresse anmeldet. „Kann erfassen“ erlaubt Einträge; Felder und Mitglieder verwaltet nur der Besitzer.</p>
          </form>`
        : ''
    }
    <h2 class="h2">Mitglieder</h2>
    <ul class="member-list">${rows.join('')}${invites.join('')}</ul>`;
}

function roleSelect(attrs, value, label) {
  return `<select class="input" ${attrs} ${label ? `aria-label="${esc(label)}"` : ''}>
      <option value="editor" ${value === 'editor' ? 'selected' : ''}>Kann erfassen</option>
      <option value="viewer" ${value === 'viewer' ? 'selected' : ''}>Nur lesen</option>
    </select>`;
}

// ---- Events -----------------------------------------------------------
function bind(root, ctx) {
  const { actions, run } = ctx;
  const on = (sel, ev, fn) => root.querySelectorAll(sel).forEach((el) => el.addEventListener(ev, fn));

  on('[data-action="new-book"]', 'click', () => run(actions.createLogbook));
  on('[data-book]', 'click', (e) => run(actions.selectLogbook, e.currentTarget.dataset.book));
  on('[data-tab]', 'click', (e) => actions.setRouteSetupTab(e.currentTarget.dataset.tab));
  on('[data-tab]', 'keydown', (e) => {
    if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') {
      const next = e.currentTarget.dataset.tab === 'fields' ? 'members' : 'fields';
      ctx.state.focus = `[data-tab="${next}"]`;
      actions.setRouteSetupTab(next);
    }
  });

  const name = root.querySelector('#book-name:not([readonly])');
  if (name) {
    name.addEventListener('change', () => run(actions.renameLogbook, name.value));
    name.addEventListener('keydown', (e) => e.key === 'Enter' && name.blur());
  }

  on('[data-action="add-field"]', 'click', () => run(actions.addField));
  on('[data-action="delete-book"]', 'click', () => run(actions.deleteLogbook));
  on('[data-action="leave-book"]', 'click', () => run(actions.leaveLogbook));

  on('[data-field-name]', 'change', (e) => {
    const v = e.target.value.trim();
    if (!v) {
      e.target.value = ctx.state.fields.find((f) => f.id === e.target.dataset.fieldName)?.name || '';
      return;
    }
    run(actions.updateField, e.target.dataset.fieldName, { name: v });
  });
  on('[data-field-name], [data-field-unit]', 'keydown', (e) => e.key === 'Enter' && e.target.blur());
  on('[data-field-type]', 'change', (e) => {
    const id = e.target.dataset.fieldType;
    const f = ctx.state.fields.find((x) => x.id === id);
    const patch = { type: e.target.value };
    if (patch.type === 'duration' && !f.unit) patch.unit = 'min';
    if (patch.type === 'boolean') patch.unit = null;
    run(actions.updateField, id, patch);
  });
  on('[data-field-unit]', 'change', (e) => run(actions.updateField, e.target.dataset.fieldUnit, { unit: e.target.value.trim() || null }));
  on('[data-field-delete]', 'click', (e) => run(actions.deleteField, e.currentTarget.dataset.fieldDelete));

  // Keyboard reordering
  on('[data-handle]', 'keydown', (e) => {
    const d = e.key === 'ArrowUp' ? -1 : e.key === 'ArrowDown' ? 1 : 0;
    if (!d) return;
    e.preventDefault();
    const id = e.currentTarget.dataset.handle;
    const idx = ctx.state.fields.findIndex((f) => f.id === id);
    run(actions.moveField, id, idx + d, true);
  });

  // Drag and drop reordering
  let dragId = null;
  const rows = root.querySelectorAll('.field-row');
  const clearMarks = () => rows.forEach((r) => r.classList.remove('drop-before', 'drop-after', 'dragging'));
  rows.forEach((row) => {
    row.addEventListener('dragstart', (e) => {
      if (e.target.closest('input, select')) {
        e.preventDefault();
        return;
      }
      dragId = row.dataset.row;
      row.classList.add('dragging');
      e.dataTransfer.effectAllowed = 'move';
      e.dataTransfer.setData('text/plain', dragId);
    });
    row.addEventListener('dragover', (e) => {
      if (!dragId) return;
      e.preventDefault();
      const fromIdx = ctx.state.fields.findIndex((f) => f.id === dragId);
      const toIdx = Number(row.dataset.index);
      rows.forEach((r) => r.classList.remove('drop-before', 'drop-after'));
      if (row.dataset.row !== dragId) row.classList.add(fromIdx > toIdx ? 'drop-before' : 'drop-after');
    });
    row.addEventListener('drop', (e) => {
      e.preventDefault();
      const id = dragId;
      dragId = null;
      clearMarks();
      if (id && id !== row.dataset.row) run(actions.moveField, id, Number(row.dataset.index));
    });
    row.addEventListener('dragend', () => {
      dragId = null;
      clearMarks();
    });
  });

  // Members
  root.querySelector('[data-form="invite"]')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = root.querySelector('#invite-email').value;
    const role = root.querySelector('#invite-role').value;
    const ok = await run(actions.invite, email, role);
    if (ok === false) {
      const input = document.querySelector('#invite-email');
      if (input) {
        input.value = email;
        input.focus();
      }
    }
  });
  on('[data-invite-delete]', 'click', (e) => run(actions.deleteInvite, e.currentTarget.dataset.inviteDelete));
  on('[data-member-role]', 'change', (e) => run(actions.setMemberRole, e.target.dataset.memberRole, e.target.value));
  on('[data-member-remove]', 'click', (e) => run(actions.removeMember, e.currentTarget.dataset.memberRemove));
}
