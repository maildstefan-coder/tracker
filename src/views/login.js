import { esc, icons } from '../ui.js';

export function renderLogin(root, { state, actions, run }) {
  const sent = state.loginSentTo;
  root.innerHTML = `
    <div class="login">
      <section class="login-brand">
        <div class="brand brand-light">${icons.book}<span>Logbuch</span></div>
        <div class="login-hero">
          <h1>Alles, was zählt – an einem Ort erfasst.</h1>
          <p>Lege selbst fest, was du festhalten willst, und erfasse es in Sekunden. Allein oder gemeinsam.</p>
        </div>
      </section>
      <section class="login-form-wrap">
        <div class="login-form">
          <h2>Anmelden</h2>
          ${state.error ? `<p class="form-error" role="alert">${esc(state.error)}</p>` : ''}
          <button class="btn btn-github" data-action="github">${icons.github}<span>Mit GitHub anmelden</span></button>
          <div class="divider"><span>oder per E-Mail</span></div>
          ${
            sent
              ? `<p class="login-sent" role="status">Wir haben einen Anmeldelink an <strong>${esc(sent)}</strong> geschickt. Öffne ihn auf diesem Gerät.</p>
                 <button class="btn btn-ghost" data-action="again">Andere Adresse verwenden</button>`
              : `<form class="stack" data-form="email" novalidate>
                   <label for="login-email">E-Mail-Adresse</label>
                   <input id="login-email" type="email" autocomplete="email" required placeholder="name@beispiel.ch" />
                   <button class="btn btn-primary" type="submit">Anmeldelink senden</button>
                 </form>`
          }
        </div>
      </section>
    </div>`;

  root.querySelector('[data-action="github"]').addEventListener('click', () => run(actions.signInWithGithub));
  root.querySelector('[data-action="again"]')?.addEventListener('click', () => {
    state.loginSentTo = '';
    renderLogin(root, { state, actions, run });
  });
  root.querySelector('[data-form="email"]')?.addEventListener('submit', async (ev) => {
    ev.preventDefault();
    const input = root.querySelector('#login-email');
    const email = input.value.trim();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      state.error = 'Bitte eine gültige E-Mail-Adresse eingeben.';
      renderLogin(root, { state, actions, run });
      root.querySelector('#login-email').value = email;
      return;
    }
    const btn = ev.submitter;
    if (btn) btn.disabled = true;
    await run(actions.signInWithEmail, email);
    if (btn) btn.disabled = false;
  });
}
