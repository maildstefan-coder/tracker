import { esc, icons } from '../ui.js';
import { fmtShort, fmtLongDate, localDateIso, pad2, parseInput, cellValue, isNumeric } from '../format.js';

export function renderTrack(root, ctx) {
  const { state, current, myRole } = ctx;
  const b = current();

  if (!state.logbooks.length) {
    root.innerHTML = `<div class="card empty"><p>Du hast noch kein Logbuch.</p><a class="btn btn-primary" href="#/einrichten">Logbuch anlegen</a></div>`;
    return;
  }

  const role = myRole();
  const canWrite = role === 'owner' || role === 'editor';
  const shared = b && b.members.length > 1;

  root.innerHTML = `
    <nav class="pills" aria-label="Logbuch wählen">
      ${state.logbooks
        .map((x) => `<button class="pill" data-book="${esc(x.id)}" aria-pressed="${x.id === state.selectedId}">${esc(x.name || 'Unbenannt')}</button>`)
        .join('')}
      <a class="pill-add" href="#/einrichten" aria-label="Logbücher einrichten" title="Logbücher einrichten">${icons.plus}</a>
    </nav>
    <section class="card track">
      ${entryPanel(ctx, b, canWrite)}
      ${historyPanel(ctx, b, shared, role)}
    </section>`;

  bind(root, ctx);
}

// ---- Entry panel ------------------------------------------------------
function entryPanel(ctx, b, canWrite) {
  const { state } = ctx;
  if (state.loading && !state.fields.length) return `<div class="entry"><p class="muted">Lädt …</p></div>`;
  if (!state.fields.length) {
    return `<div class="entry"><p class="muted">Dieses Logbuch hat noch keine Felder.${ctx.myRole() === 'owner' ? ' <a href="#/einrichten">Felder festlegen</a>' : ''}</p></div>`;
  }
  if (!canWrite) {
    return `<div class="entry"><p class="muted">Du kannst dieses Logbuch nur lesen.</p></div>`;
  }

  const now = new Date();
  const dateLabel = state.manual
    ? `${fmtLongDate(new Date(`${state.manualDate}T12:00:00`))}, ${state.manualHour}:${state.manualMinute} Uhr`
    : fmtLongDate(now);

  const hours = Array.from({ length: 24 }, (_, i) => pad2(i));
  const minutes = Array.from({ length: 60 }, (_, i) => pad2(i));
  const opts = (list, v) => list.map((x) => `<option value="${x}" ${x === v ? 'selected' : ''}>${x}</option>`).join('');

  return `
    <form class="entry" data-form="entry" novalidate>
      <div class="entry-head">
        <h2 class="h2">Neuer Eintrag</h2>
        <div class="when">
          ${state.manual ? `<span class="badge badge-warn">Manuell</span>` : `<span class="badge">Automatisch, jetzt</span>`}
          <span class="when-label">${esc(dateLabel)}</span>
          ${
            state.manual
              ? `<label class="sr-only" for="when-date">Datum</label>
                 <input id="when-date" class="input input-sm" type="date" value="${esc(state.manualDate)}" max="${localDateIso()}" />
                 <span class="time-pick">
                   <select class="input input-sm" id="when-hour" aria-label="Stunde (0–23)">${opts(hours, state.manualHour)}</select>
                   <span aria-hidden="true">:</span>
                   <select class="input input-sm" id="when-minute" aria-label="Minute">${opts(minutes, state.manualMinute)}</select>
                 </span>`
              : ''
          }
          <button type="button" class="btn btn-ghost btn-sm" data-action="toggle-when">${state.manual ? 'Auf jetzt zurücksetzen' : 'Datum / Zeit ändern'}</button>
        </div>
      </div>
      <div class="entry-grid">
        ${state.fields.map((f) => fieldInput(f, state)).join('')}
      </div>
      <div class="entry-actions">
        <button type="button" class="btn btn-ghost" data-action="discard">Verwerfen</button>
        <button type="submit" class="btn btn-primary">Eintrag speichern</button>
      </div>
    </form>`;
}

function fieldInput(f, state) {
  const id = `in-${f.id}`;
  const v = state.drafts[f.id] ?? '';
  let control;
  if (f.type === 'boolean') {
    control = `<select class="input input-value" id="${id}" data-draft="${esc(f.id)}">
        <option value="" ${v === '' ? 'selected' : ''}>–</option>
        <option value="ja" ${v === 'ja' ? 'selected' : ''}>Ja</option>
        <option value="nein" ${v === 'nein' ? 'selected' : ''}>Nein</option>
      </select>`;
  } else if (isNumeric(f)) {
    control = `<input class="input input-value input-num" id="${id}" data-draft="${esc(f.id)}" type="text" inputmode="decimal" autocomplete="off" placeholder="0" value="${esc(v)}" />`;
  } else {
    const list = f.type === 'choice' ? previousValues(f, state.entries) : [];
    control = `<input class="input input-value" id="${id}" data-draft="${esc(f.id)}" type="text" autocomplete="off" value="${esc(v)}" ${list.length ? `list="dl-${esc(f.id)}"` : ''} />
      ${list.length ? `<datalist id="dl-${esc(f.id)}">${list.map((x) => `<option value="${esc(x)}"></option>`).join('')}</datalist>` : ''}`;
  }
  const unit = f.unit && f.type !== 'boolean' ? `<span class="unit">${esc(f.unit)}</span>` : '';
  return `<div class="entry-field">
      <label for="${id}">${esc(f.name)}</label>
      <div class="value-wrap ${unit ? 'has-unit' : ''}">${control}${unit}</div>
    </div>`;
}

function previousValues(f, entries) {
  const seen = new Set();
  for (const e of entries) {
    const v = e.values?.[f.id];
    if (typeof v === 'string' && v) seen.add(v);
    if (seen.size >= 30) break;
  }
  return [...seen];
}

// ---- History ----------------------------------------------------------
function historyPanel(ctx, b, shared, role) {
  const { state, authorLabel } = ctx;
  const uid = state.user.id;
  const n = state.entries.length;
  const canDelete = (e) => role === 'owner' || (role === 'editor' && e.created_by === uid);
  const cols = state.fields.length + 2 + (shared ? 1 : 0);

  const body = n
    ? state.entries
        .map(
          (e) => `<tr>
            <td class="nowrap num">${esc(fmtShort(e.recorded_at))}</td>
            ${shared ? `<td class="nowrap">${esc(authorLabel(e.created_by))}</td>` : ''}
            ${state.fields.map((f) => `<td class="c">${esc(cellValue(f, e.values?.[f.id]))}</td>`).join('')}
            <td class="act">${canDelete(e) ? `<button class="icon-btn" data-entry-delete="${esc(e.id)}" aria-label="Eintrag vom ${esc(fmtShort(e.recorded_at))} löschen">${icons.close}</button>` : ''}</td>
          </tr>`,
        )
        .join('')
    : `<tr><td colspan="${cols}" class="empty-row">${state.loading ? 'Lädt …' : 'Noch keine Einträge.'}</td></tr>`;

  return `
    <div class="history">
      <div class="history-head">
        <h2 class="h2">Verlauf</h2>
        <span class="muted">${n === 1 ? '1 Eintrag' : `${n} Einträge`}</span>
      </div>
      <div class="table-wrap" tabindex="0" aria-label="Verlauf, horizontal scrollbar">
        <table>
          <thead><tr>
            <th scope="col">Datum / Zeit</th>
            ${shared ? '<th scope="col">Von</th>' : ''}
            ${state.fields.map((f) => `<th scope="col" class="c">${esc(f.name)}</th>`).join('')}
            <th scope="col" class="act"><span class="sr-only">Aktionen</span></th>
          </tr></thead>
          <tbody>${body}</tbody>
        </table>
      </div>
      <div class="history-foot">
        <button class="btn btn-ghost" data-action="export" ${n ? '' : 'disabled'}>${icons.download}<span>Als CSV exportieren</span></button>
      </div>
    </div>`;
}

// ---- Events -----------------------------------------------------------
function bind(root, ctx) {
  const { state, actions, run, render } = ctx;
  const on = (sel, ev, fn) => root.querySelectorAll(sel).forEach((el) => el.addEventListener(ev, fn));

  on('[data-book]', 'click', (e) => run(actions.selectLogbook, e.currentTarget.dataset.book));

  // Drafts are kept in state without re-rendering, so typing never loses focus.
  on('[data-draft]', 'input', (e) => {
    state.drafts[e.target.dataset.draft] = e.target.value;
  });
  on('[data-draft]', 'change', (e) => {
    state.drafts[e.target.dataset.draft] = e.target.value;
  });

  on('[data-action="discard"]', 'click', () => {
    state.drafts = {};
    render();
  });

  on('[data-action="toggle-when"]', 'click', () => {
    state.manual = !state.manual;
    if (state.manual) {
      const d = new Date();
      state.manualDate = localDateIso(d);
      state.manualHour = pad2(d.getHours());
      state.manualMinute = pad2(d.getMinutes());
    }
    render();
  });
  root.querySelector('#when-date')?.addEventListener('change', (e) => {
    if (e.target.value) state.manualDate = e.target.value;
    render();
  });
  root.querySelector('#when-hour')?.addEventListener('change', (e) => {
    state.manualHour = e.target.value;
    render();
  });
  root.querySelector('#when-minute')?.addEventListener('change', (e) => {
    state.manualMinute = e.target.value;
    render();
  });

  root.querySelector('[data-form="entry"]')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const values = {};
    try {
      for (const f of state.fields) {
        const v = parseInput(f, state.drafts[f.id]);
        if (v !== undefined) values[f.id] = v;
      }
    } catch (err) {
      state.error = err.message;
      render();
      return;
    }
    if (!Object.keys(values).length) {
      state.error = 'Bitte mindestens ein Feld ausfüllen.';
      render();
      return;
    }
    const when = state.manual
      ? new Date(`${state.manualDate}T${state.manualHour}:${state.manualMinute}:00`)
      : new Date();
    const btn = e.submitter;
    if (btn) btn.disabled = true;
    await run(actions.saveEntry, values, when);
    if (btn) btn.disabled = false;
  });

  on('[data-entry-delete]', 'click', (e) => run(actions.deleteEntry, e.currentTarget.dataset.entryDelete));
  on('[data-action="export"]', 'click', () => run(actions.exportCsv));
}
