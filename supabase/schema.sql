-- Logbuch – database schema (already applied in the Supabase project).
-- Kept here for reference and for setting up a new project.

create table public.logbooks (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users on delete cascade,
  name text not null,
  created_at timestamptz not null default now()
);

create table public.logbook_members (
  logbook_id uuid not null references public.logbooks on delete cascade,
  user_id uuid not null references auth.users on delete cascade,
  email text,
  role text not null check (role in ('owner','editor','viewer')),
  added_at timestamptz not null default now(),
  primary key (logbook_id, user_id)
);

create table public.logbook_invites (
  id uuid primary key default gen_random_uuid(),
  logbook_id uuid not null references public.logbooks on delete cascade,
  email text not null check (email = lower(email)),
  role text not null check (role in ('editor','viewer')),
  invited_by uuid not null default auth.uid() references auth.users,
  created_at timestamptz not null default now(),
  unique (logbook_id, email)
);

create table public.fields (
  id uuid primary key default gen_random_uuid(),
  logbook_id uuid not null references public.logbooks on delete cascade,
  name text not null,
  type text not null check (type in ('text','number','duration','choice','boolean')),
  unit text,
  position int not null default 0
);

create table public.entries (
  id uuid primary key default gen_random_uuid(),
  logbook_id uuid not null references public.logbooks on delete cascade,
  created_by uuid default auth.uid() references auth.users on delete set null,
  recorded_at timestamptz not null default now(),
  values jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index on public.logbook_members (user_id);
create index on public.fields (logbook_id, position);
create index on public.entries (logbook_id, recorded_at desc);

create function public.logbook_role(lb uuid) returns text
language sql stable security definer set search_path = '' as $$
  select role from public.logbook_members
  where logbook_id = lb and user_id = (select auth.uid())
$$;

create function public.add_owner_membership() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  insert into public.logbook_members (logbook_id, user_id, email, role)
  values (new.id, new.owner_id, auth.jwt() ->> 'email', 'owner');
  return new;
end $$;

create trigger logbooks_owner_membership
  after insert on public.logbooks
  for each row execute function public.add_owner_membership();

create function public.accept_invites() returns int
language plpgsql security definer set search_path = '' as $$
declare
  my_email text := lower(auth.jwt() ->> 'email');
  n int;
begin
  if my_email is null then return 0; end if;
  insert into public.logbook_members (logbook_id, user_id, email, role)
  select i.logbook_id, auth.uid(), my_email, i.role
  from public.logbook_invites i where i.email = my_email
  on conflict do nothing;
  get diagnostics n = row_count;
  delete from public.logbook_invites where email = my_email;
  return n;
end $$;

revoke execute on function public.accept_invites() from public, anon;
grant execute on function public.accept_invites() to authenticated;

alter table public.logbooks        enable row level security;
alter table public.logbook_members enable row level security;
alter table public.logbook_invites enable row level security;
alter table public.fields          enable row level security;
alter table public.entries         enable row level security;

create policy "members read" on public.logbooks for select to authenticated
  using (owner_id = (select auth.uid()) or public.logbook_role(id) is not null);
create policy "create own" on public.logbooks for insert to authenticated
  with check (owner_id = (select auth.uid()));
create policy "owner update" on public.logbooks for update to authenticated
  using (owner_id = (select auth.uid()));
create policy "owner delete" on public.logbooks for delete to authenticated
  using (owner_id = (select auth.uid()));

create policy "members read" on public.logbook_members for select to authenticated
  using (public.logbook_role(logbook_id) is not null);
create policy "owner changes roles" on public.logbook_members for update to authenticated
  using (public.logbook_role(logbook_id) = 'owner' and role <> 'owner')
  with check (role in ('editor','viewer'));
create policy "owner removes or member leaves" on public.logbook_members for delete to authenticated
  using (role <> 'owner' and (public.logbook_role(logbook_id) = 'owner' or user_id = (select auth.uid())));

create policy "owner manages invites" on public.logbook_invites for all to authenticated
  using (public.logbook_role(logbook_id) = 'owner')
  with check (public.logbook_role(logbook_id) = 'owner');

create policy "members read" on public.fields for select to authenticated
  using (public.logbook_role(logbook_id) is not null);
create policy "owner writes" on public.fields for all to authenticated
  using (public.logbook_role(logbook_id) = 'owner')
  with check (public.logbook_role(logbook_id) = 'owner');

create policy "members read" on public.entries for select to authenticated
  using (public.logbook_role(logbook_id) is not null);
create policy "writers add" on public.entries for insert to authenticated
  with check (created_by = (select auth.uid())
              and public.logbook_role(logbook_id) in ('owner','editor'));
create policy "change own or owner" on public.entries for update to authenticated
  using (public.logbook_role(logbook_id) = 'owner'
         or (created_by = (select auth.uid()) and public.logbook_role(logbook_id) = 'editor'));
create policy "delete own or owner" on public.entries for delete to authenticated
  using (public.logbook_role(logbook_id) = 'owner'
         or (created_by = (select auth.uid()) and public.logbook_role(logbook_id) = 'editor'));

grant select, insert, update, delete on public.logbooks, public.fields, public.entries, public.logbook_invites to authenticated;
grant select, update, delete on public.logbook_members to authenticated;
