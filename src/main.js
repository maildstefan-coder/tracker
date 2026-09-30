import './styles.css';
import { supabase, configured } from './supabase.js';
import * as api from './api.js';
import { esc, icons, errorText } from './ui.js';
import { buildCsv, downloadText, slug } from './csv.js';
import { localDateIso } from './format.js';
import { renderLogin } from './views/login.js';
import { renderSetup } from './views/setup.js';
import { renderTrack } from './views/track.js';

const app = document.getElementById('app');
const LAST_BOOK_KEY = 'logbuch:lastLogbook';

const state = {
  ready: false,
  user: null,
  loading: false,
  error: '',
  notice: '',
  logbooks: [],
  selectedId: null,
  fields: [],
  entries: [],
  invites: [],
  setupTab: 'fields',
  drafts: {},
  manual: false,
  manualDate: '',
  manualHour: '00',
  manualMinute: '00',
  loginSentTo: '',
  focus: null, // selector to focus after the next render
};

// ---- Derived ----------------------------------------------------------
const current = () => state.logbooks.find((b) => b.id === state.selectedId) || null;
const myRole = () => current()?.myRole || null;
const route = () => (location.hash.startsWith('#/einrichten') ? 'setup' : 'track');

function authorLabel(userId) {
  if (!userId) return 'Unbekannt';
  if (userId === state.user?.id) return 'Du';
  const m = current()?.members.find((x) => x.user_id === userId);
  return m?.email || 'Ehemaliges Mitglied';
}

// ---- Rendering --------------------------------------------------------
/** Selector that finds the currently focused control again after a re-render. */
function focusKey() {
  const el = document.activeElement;
  if (!el || el === document.body || !app.contains(el)) return null;
  if (el.id) return `#${CSS.escape(el.id)}`;
  const attr = [...el.attributes].find((x) => x.name.startsWith('data-') && x.value);
  return attr ? `[${attr.name}="${CSS.escape(attr.value)}"]` : null;
}

function render() {
  const keep = focusKey();
  if (!configured) {
    app.innerHTML = `<div class="center-msg"><h1>Konfiguration fehlt</h1><p>Setze <code>VITE_SUPABASE_URL</code> und <code>VITE_SUPABASE_PUBLISHABLE_KEY</code> (lokal in <code>.env.local</code>, auf GitHub als Repository-Variablen).</p></div>`;
    return;
  }
  if (!state.ready) {
    app.innerHTML = `<div class="center-msg" aria-busy="true"><p>Lädt …</p></div>`;
    return;
  }
  if (!state.user) {
    renderLogin(app, ctx);
    return;
  }
  const r = route();
  app.innerHTML = `
    <header class="topbar">
      <a class="brand" href="#/erfassen">${icons.book}<span>Logbuch</span></a>
      <nav class="mainnav" aria-label="Bereiche">
        <a href="#/erfassen" ${r === 'track' ? 'aria-current="page"' : ''}>Erfassen</a>
        <a href="#/einrichten" ${r === 'setup' ? 'aria-current="page"' : ''}>Einrichten</a>
      </nav>
      <div class="account">
        <span class="account-email" title="${esc(state.user.email)}">${esc(state.user.email)}</span>
        <button class="btn btn-ghost btn-sm" data-action="sign-out">Abmelden</button>
      </div>
    </header>
    <div class="status" role="status" aria-live="polite">
      ${state.error ? `<div class="banner banner-error"><span>${esc(state.error)}</span><button class="icon-btn" data-action="dismiss" aria-label="Meldung schliessen">${icons.close}</button></div>` : ''}
      ${state.notice ? `<div class="banner banner-ok"><span>${esc(state.notice)}</span><button class="icon-btn" data-action="dismiss" aria-label="Meldung schliessen">${icons.close}</button></div>` : ''}
    </div>
    <main id="view" class="view" ${state.loading ? 'aria-busy="true"' : ''}></main>`;
  app.querySelector('[data-action="sign-out"]').addEventListener('click', () => run(actions.signOut));
  app.querySelectorAll('[data-action="dismiss"]').forEach((b) =>
    b.addEventListener('click', () => {
      state.error = '';
      state.notice = '';
      render();
    }),
  );
  const view = app.querySelector('#view');
  if (r === 'setup') renderSetup(view, ctx);
  else renderTrack(view, ctx);

  const target = state.focus || keep;
  state.focus = null;
  if (target) app.querySelector(target)?.focus();
}

// ---- Error handling ---------------------------------------------------
async function run(fn, ...args) {
  try {
    state.error = '';
    return await fn(...args);
  } catch (err) {
    console.error(err);
    state.error = errorText(err);
    render();
    return undefined;
  }
}

// ---- Loading ----------------------------------------------------------
async function reloadLogbooks() {
  const rows = await api.listLogbooks();
  const uid = state.user.id;
  state.logbooks = rows.map((b) => {
    const members = b.logbook_members || [];
    return {
      id: b.id,
      name: b.name,
      ownerId: b.owner_id,
      members,
      fieldCount: b.fields?.[0]?.count ?? 0,
      myRole: members.find((m) => m.user_id === uid)?.role || (b.owner_id === uid ? 'owner' : null),
    };
  });
  if (!state.logbooks.some((b) => b.id === state.selectedId)) {
    const last = localStorage.getItem(LAST_BOOK_KEY);
    state.selectedId = (state.logbooks.find((b) => b.id === last) || state.logbooks[0])?.id || null;
  }
}

async function loadSelected() {
  const id = state.selectedId;
  if (!id) {
    state.fields = [];
    state.entries = [];
    state.invites = [];
    return;
  }
  const [fields, entries, invites] = await Promise.all([
    api.listFields(id),
    api.listEntries(id),
    myRole() === 'owner' ? api.listInvites(id) : Promise.resolve([]),
  ]);
  if (id !== state.selectedId) return; // switched meanwhile
  state.fields = fields;
  state.entries = entries;
  state.invites = invites;
}

async function onSignedIn(session) {
  if (state.user?.id === session.user.id) return;
  state.user = session.user;
  state.ready = true;
  state.loading = true;
  render();
  try {
    await api.acceptInvites();
  } catch (err) {
    console.warn('accept_invites failed', err);
  }
  await run(async () => {
    await reloadLogbooks();
    await loadSelected();
    if (!state.logbooks.length && route() !== 'setup') location.hash = '#/einrichten';
  });
  state.loading = false;
  render();
}

function resetUserState() {
  Object.assign(state, {
    user: null, logbooks: [], selectedId: null, fields: [], entries: [], invites: [],
    drafts: {}, error: '', notice: '', manual: false, loginSentTo: '',
  });
}

// ---- Actions ----------------------------------------------------------
const actions = {
  async signInWithGithub() {
    await api.signInWithGithub();
  },
  async signInWithEmail(email) {
    await api.signInWithEmail(email);
    state.loginSentTo = email;
    render();
  },
  async signOut() {
    await api.signOut();
    resetUserState();
    render();
  },

  async selectLogbook(id) {
    if (id === state.selectedId) return;
    state.selectedId = id;
    localStorage.setItem(LAST_BOOK_KEY, id);
    state.drafts = {};
    state.fields = [];
    state.entries = [];
    state.invites = [];
    state.loading = true;
    render();
    await loadSelected();
    state.loading = false;
    render();
  },

  async createLogbook() {
    const { id } = await api.createLogbook('Neues Logbuch');
    await reloadLogbooks();
    state.setupTab = 'fields';
    await actions.selectLogbook(id);
    state.focus = '#book-name';
    if (route() !== 'setup') location.hash = '#/einrichten';
    else render();
  },
  async renameLogbook(name) {
    const b = current();
    const trimmed = name.trim();
    if (!b || !trimmed || trimmed === b.name) return;
    await api.renameLogbook(b.id, trimmed);
    b.name = trimmed;
    render();
  },
  async deleteLogbook() {
    const b = current();
    if (!b) return;
    if (!confirm(`Logbuch „${b.name}“ mit allen Einträgen endgültig löschen?`)) return;
    await api.deleteLogbook(b.id);
    state.selectedId = null;
    await reloadLogbooks();
    await loadSelected();
    render();
  },
  async leaveLogbook() {
    const b = current();
    if (!b) return;
    if (!confirm(`Logbuch „${b.name}“ verlassen? Du siehst es danach nicht mehr.`)) return;
    await api.removeMember(b.id, state.user.id);
    state.selectedId = null;
    await reloadLogbooks();
    await loadSelected();
    render();
  },

  async addField() {
    const f = await api.addField(state.selectedId, state.fields.length);
    state.fields.push(f);
    bumpFieldCount(1);
    state.focus = `[data-field-name="${f.id}"]`;
    render();
  },
  async updateField(id, patch) {
    const f = state.fields.find((x) => x.id === id);
    if (!f) return;
    await api.updateField(id, patch);
    Object.assign(f, patch);
    render();
  },
  async deleteField(id) {
    const f = state.fields.find((x) => x.id === id);
    if (!f) return;
    if (!confirm(`Feld „${f.name}“ entfernen? Bereits erfasste Werte werden im Verlauf nicht mehr angezeigt.`)) return;
    await api.deleteField(id);
    state.fields = state.fields.filter((x) => x.id !== id);
    bumpFieldCount(-1);
    render();
  },
  async moveField(fromId, toIndex, focusHandle = false) {
    const arr = [...state.fields];
    const from = arr.findIndex((x) => x.id === fromId);
    if (from < 0 || toIndex < 0 || toIndex >= arr.length || from === toIndex) return;
    const [item] = arr.splice(from, 1);
    arr.splice(toIndex, 0, item);
    const before = state.fields;
    state.fields = arr;
    if (focusHandle) state.focus = `[data-handle="${fromId}"]`;
    render();
    try {
      await api.saveFieldOrder(arr);
      arr.forEach((f, i) => (f.position = i));
    } catch (err) {
      state.fields = before;
      throw err;
    }
  },

  async invite(email, role) {
    const b = current();
    const clean = email.trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(clean)) {
      state.error = 'Bitte eine gültige E-Mail-Adresse eingeben.';
      render();
      return false;
    }
    if (b.members.some((m) => (m.email || '').toLowerCase() === clean) || state.invites.some((i) => i.email === clean)) {
      state.error = 'Diese Person ist bereits Mitglied oder eingeladen.';
      render();
      return false;
    }
    const inv = await api.createInvite(b.id, clean, role);
    state.invites.push(inv);
    state.notice = `${clean} ist eingeladen. Schick der Person den Link zur App – sie sieht das Logbuch nach der Anmeldung mit dieser Adresse.`;
    render();
    return true;
  },
  async deleteInvite(id) {
    await api.deleteInvite(id);
    state.invites = state.invites.filter((i) => i.id !== id);
    render();
  },
  async setMemberRole(userId, role) {
    const b = current();
    await api.setMemberRole(b.id, userId, role);
    const m = b.members.find((x) => x.user_id === userId);
    if (m) m.role = role;
    render();
  },
  async removeMember(userId) {
    const b = current();
    const m = b.members.find((x) => x.user_id === userId);
    if (!confirm(`${m?.email || 'Diese Person'} aus dem Logbuch entfernen?`)) return;
    await api.removeMember(b.id, userId);
    b.members = b.members.filter((x) => x.user_id !== userId);
    render();
  },

  async saveEntry(values, recordedAt) {
    const e = await api.addEntry(state.selectedId, recordedAt, values);
    state.entries = [e, ...state.entries].sort((a, b) => new Date(b.recorded_at) - new Date(a.recorded_at));
    state.drafts = {};
    state.focus = '.entry-grid input, .entry-grid select';
    render();
  },
  async deleteEntry(id) {
    if (!confirm('Diesen Eintrag löschen?')) return;
    await api.deleteEntry(id);
    state.entries = state.entries.filter((e) => e.id !== id);
    render();
  },

  exportCsv() {
    const b = current();
    if (!b || !state.entries.length) return;
    const shared = b.members.length > 1;
    const csv = buildCsv({ fields: state.fields, entries: state.entries, authorOf: shared ? authorLabel : null });
    downloadText(`logbuch-${slug(b.name)}-${localDateIso()}.csv`, csv);
  },

  setRouteSetupTab(tab) {
    state.setupTab = tab;
    render();
  },
};

function bumpFieldCount(d) {
  const b = current();
  if (b) b.fieldCount = Math.max(0, (b.fieldCount || 0) + d);
}

const ctx = { state, actions, run, render, current, myRole, authorLabel };

// ---- Boot -------------------------------------------------------------
window.addEventListener('hashchange', render);

async function init() {
  if (!configured) {
    render();
    return;
  }
  supabase.auth.onAuthStateChange((event, session) => {
    // Never await Supabase calls inside this callback; defer instead.
    if (session && (event === 'SIGNED_IN' || event === 'INITIAL_SESSION')) {
      setTimeout(() => onSignedIn(session), 0);
    } else if (event === 'SIGNED_OUT') {
      resetUserState();
      state.ready = true;
      render();
    }
  });
  const session = await run(api.getSession);
  if (location.search.includes('code=')) history.replaceState(null, '', location.pathname + location.hash);
  if (session) await onSignedIn(session);
  else {
    state.ready = true;
    render();
  }
}

render();
init();
