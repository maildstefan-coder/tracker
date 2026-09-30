# Logbuch

Configure what you want to track, track it, share logbooks with others.
Static frontend (Vite, vanilla JS) on GitHub Pages, Supabase for login and data.

## Features

- Login with GitHub or an email magic link
- Multiple logbooks, each with its own fields (text, number, duration, choice, yes/no, unit)
- Reorder fields with drag and drop (or the arrow keys on the grip)
- Invite people by email as "Kann erfassen" (editor) or "Nur lesen" (viewer)
- Entry panel with automatic date/time or a manual override (24 h)
- History table per logbook, CSV export (semicolon, UTF-8 BOM, opens in Excel)

## Supabase

The schema lives in [`supabase/schema.sql`](supabase/schema.sql). Access control is done with
Row Level Security, so the publishable key can be public.

Auth settings (Authentication → URL Configuration):

- Site URL: `https://maildstefan-coder.github.io/tracker/`
- Redirect URLs: `https://maildstefan-coder.github.io/tracker/**` and `http://localhost:5173/**`

GitHub login: Authentication → Sign In / Providers → GitHub, with a GitHub OAuth App whose
callback URL is `https://<project-ref>.supabase.co/auth/v1/callback`.

## Local development

```bash
cp .env.example .env.local   # fill in URL and publishable key
npm install
npm run dev                  # http://localhost:5173/tracker/
```

## Deployment

1. Repository → Settings → Pages → Source: **GitHub Actions**
2. Repository → Settings → Secrets and variables → Actions → **Variables**:
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_PUBLISHABLE_KEY`
3. Push to `main`. The workflow in `.github/workflows/deploy.yml` builds and publishes.

## Invitations

The owner adds an email address in "Mitglieder". When that person signs in with the same
(verified) address, the app calls `accept_invites()` and the logbook appears. Supabase does not
send an invitation email; share the app link yourself.
