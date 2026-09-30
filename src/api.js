import { supabase, appUrl } from './supabase.js';

function unwrap({ data, error }) {
  if (error) throw error;
  return data;
}

// ---- Auth -------------------------------------------------------------
export async function getSession() {
  return unwrap(await supabase.auth.getSession()).session;
}
const PROVIDER_OPTIONS = {
  github: {},
  google: {},
  // Azure only returns the email address when it is requested explicitly.
  azure: { scopes: 'email' },
};
export async function signInWithProvider(provider) {
  if (!PROVIDER_OPTIONS[provider]) throw new Error(`Unbekannter Anbieter: ${provider}`);
  unwrap(
    await supabase.auth.signInWithOAuth({
      provider,
      options: { redirectTo: appUrl(), ...PROVIDER_OPTIONS[provider] },
    }),
  );
}
export async function signInWithEmail(email) {
  unwrap(await supabase.auth.signInWithOtp({ email, options: { emailRedirectTo: appUrl() } }));
}
export async function signOut() {
  unwrap(await supabase.auth.signOut());
}
export async function acceptInvites() {
  return unwrap(await supabase.rpc('accept_invites'));
}

// ---- Logbooks ---------------------------------------------------------
export async function listLogbooks() {
  return unwrap(
    await supabase
      .from('logbooks')
      .select('id, name, owner_id, created_at, logbook_members(user_id, role, email), fields(count)')
      .order('created_at'),
  );
}
export async function createLogbook(name) {
  return unwrap(await supabase.from('logbooks').insert({ name }).select('id').single());
}
export async function renameLogbook(id, name) {
  unwrap(await supabase.from('logbooks').update({ name }).eq('id', id));
}
export async function deleteLogbook(id) {
  unwrap(await supabase.from('logbooks').delete().eq('id', id));
}

// ---- Fields -----------------------------------------------------------
export async function listFields(logbookId) {
  return unwrap(await supabase.from('fields').select('*').eq('logbook_id', logbookId).order('position'));
}
export async function addField(logbookId, position) {
  return unwrap(
    await supabase
      .from('fields')
      .insert({ logbook_id: logbookId, name: 'Neues Feld', type: 'text', unit: null, position })
      .select('*')
      .single(),
  );
}
export async function updateField(id, patch) {
  unwrap(await supabase.from('fields').update(patch).eq('id', id));
}
export async function deleteField(id) {
  unwrap(await supabase.from('fields').delete().eq('id', id));
}
export async function saveFieldOrder(fields) {
  const results = await Promise.all(
    fields.map((f, i) => supabase.from('fields').update({ position: i }).eq('id', f.id)),
  );
  results.forEach(unwrap);
}

// ---- Entries ----------------------------------------------------------
export async function listEntries(logbookId) {
  const pageSize = 1000;
  let from = 0;
  const all = [];
  for (;;) {
    const rows = unwrap(
      await supabase
        .from('entries')
        .select('id, created_by, recorded_at, values')
        .eq('logbook_id', logbookId)
        .order('recorded_at', { ascending: false })
        .range(from, from + pageSize - 1),
    );
    all.push(...rows);
    if (rows.length < pageSize) return all;
    from += pageSize;
  }
}
export async function addEntry(logbookId, recordedAt, values) {
  return unwrap(
    await supabase
      .from('entries')
      .insert({ logbook_id: logbookId, recorded_at: recordedAt.toISOString(), values })
      .select('id, created_by, recorded_at, values')
      .single(),
  );
}
export async function deleteEntry(id) {
  unwrap(await supabase.from('entries').delete().eq('id', id));
}

// ---- Members & invites ------------------------------------------------
export async function listInvites(logbookId) {
  return unwrap(
    await supabase.from('logbook_invites').select('id, email, role, created_at').eq('logbook_id', logbookId).order('created_at'),
  );
}
export async function createInvite(logbookId, email, role) {
  return unwrap(
    await supabase.from('logbook_invites').insert({ logbook_id: logbookId, email, role }).select('id, email, role, created_at').single(),
  );
}
export async function deleteInvite(id) {
  unwrap(await supabase.from('logbook_invites').delete().eq('id', id));
}
export async function setMemberRole(logbookId, userId, role) {
  unwrap(await supabase.from('logbook_members').update({ role }).eq('logbook_id', logbookId).eq('user_id', userId));
}
export async function removeMember(logbookId, userId) {
  unwrap(await supabase.from('logbook_members').delete().eq('logbook_id', logbookId).eq('user_id', userId));
}
