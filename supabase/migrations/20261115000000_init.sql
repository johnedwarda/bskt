-- bskt: shared shopping lists
-- Tables: profiles, lists, list_members, list_invites, items, purchases.
-- Every row is scoped to a list; row-level security lets only that list's members see or change it.

-- ---------------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------------

create table public.profiles (
  id          uuid primary key references auth.users (id) on delete cascade,
  name        text not null default '',
  color       text not null default '#F2B33D',
  created_at  timestamptz not null default now()
);

create table public.lists (
  id            uuid primary key default gen_random_uuid(),
  name          text not null default 'Groceries',
  owner_id      uuid not null references public.profiles (id) on delete cascade,
  invite_token  text not null unique default replace(gen_random_uuid()::text, '-', ''),
  created_at    timestamptz not null default now()
);

create table public.list_members (
  list_id      uuid not null references public.lists (id) on delete cascade,
  user_id      uuid not null references public.profiles (id) on delete cascade,
  role         text not null default 'editor' check (role in ('owner', 'editor')),
  notify_shop  boolean not null default true,
  notify_add   boolean not null default false,
  joined_at    timestamptz not null default now(),
  primary key (list_id, user_id)
);
create index list_members_user_idx on public.list_members (user_id);

create table public.list_invites (
  id           uuid primary key default gen_random_uuid(),
  list_id      uuid not null references public.lists (id) on delete cascade,
  email        text not null,
  invited_by   uuid references public.profiles (id) on delete set null,
  created_at   timestamptz not null default now(),
  accepted_at  timestamptz
);
create unique index list_invites_list_email_idx on public.list_invites (list_id, lower(email));

-- One row per thing this list has ever had on it. Rows stay when ticked off,
-- so the list keeps each item's history, quantity, type and note for next time.
create table public.items (
  id           uuid primary key default gen_random_uuid(),
  list_id      uuid not null references public.lists (id) on delete cascade,
  catalog_key  text,                       -- e.g. 'milk'; null for custom items
  name         text not null,
  kind         text not null default 'generic',  -- which illustration to draw
  variant      text not null default '',   -- the "type": Oat, Greek, Rye...
  note         text not null default '',
  qty          numeric not null default 1,
  unit         text not null default 'pcs',
  units        text[] not null default array['pcs'],
  step         numeric not null default 1,
  grp          text not null default 'Other',
  sort_order   numeric not null default 50, -- shopping order, learned from trips
  must_buy     boolean not null default false,
  on_list      boolean not null default true,
  in_cart      boolean not null default false,
  added_by     uuid references public.profiles (id) on delete set null,
  cart_by      uuid references public.profiles (id) on delete set null,
  is_custom    boolean not null default false,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);
create index items_list_idx on public.items (list_id);

-- Each time an item goes into the cart. Used to learn how often things are bought.
create table public.purchases (
  id         uuid primary key default gen_random_uuid(),
  item_id    uuid not null references public.items (id) on delete cascade,
  list_id    uuid not null references public.lists (id) on delete cascade,
  bought_by  uuid references public.profiles (id) on delete set null,
  bought_at  timestamptz not null default now()
);
create index purchases_list_idx on public.purchases (list_id, bought_at desc);
create index purchases_item_idx on public.purchases (item_id, bought_at desc);

-- ---------------------------------------------------------------------------
-- Helpers
-- ---------------------------------------------------------------------------

create function public.is_member(l uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.list_members m where m.list_id = l and m.user_id = auth.uid()
  );
$$;

create function public.shares_list_with(other uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1
    from public.list_members a
    join public.list_members b on a.list_id = b.list_id
    where a.user_id = auth.uid() and b.user_id = other
  );
$$;

create function public.touch_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end $$;

create trigger items_touch before update on public.items
  for each row execute function public.touch_updated_at();

-- New account: create its profile and join any lists it was invited to by email.
create function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  palette text[] := array['#F2B33D', '#9CC5E8', '#E9A08C', '#B9D98C', '#C9B3E6', '#F2A0B5'];
begin
  insert into public.profiles (id, name, color)
  values (
    new.id,
    coalesce(
      nullif(trim(new.raw_user_meta_data ->> 'name'), ''),
      nullif(trim(new.raw_user_meta_data ->> 'full_name'), ''),
      split_part(coalesce(new.email, ''), '@', 1),
      'Someone'
    ),
    palette[1 + floor(random() * array_length(palette, 1))::int]
  );

  if new.email is not null then
    insert into public.list_members (list_id, user_id, role)
    select i.list_id, new.id, 'editor'
    from public.list_invites i
    where lower(i.email) = lower(new.email) and i.accepted_at is null
    on conflict do nothing;

    update public.list_invites
    set accepted_at = now()
    where lower(email) = lower(new.email) and accepted_at is null;
  end if;

  return new;
end $$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------------------------------------------------------------------------
-- RPCs
-- ---------------------------------------------------------------------------

create function public.create_list(p_name text)
returns public.lists language plpgsql security definer set search_path = '' as $$
declare
  l public.lists;
begin
  if auth.uid() is null then
    raise exception 'not signed in';
  end if;
  insert into public.lists (name, owner_id)
  values (coalesce(nullif(trim(p_name), ''), 'Groceries'), auth.uid())
  returning * into l;
  insert into public.list_members (list_id, user_id, role) values (l.id, auth.uid(), 'owner');
  return l;
end $$;

-- Join through a shared link.
create function public.join_list(p_token text)
returns uuid language plpgsql security definer set search_path = '' as $$
declare
  l uuid;
begin
  if auth.uid() is null then
    raise exception 'not signed in';
  end if;
  select id into l from public.lists where invite_token = p_token;
  if l is null then
    raise exception 'invite link not found';
  end if;
  insert into public.list_members (list_id, user_id, role)
  values (l, auth.uid(), 'editor')
  on conflict do nothing;
  return l;
end $$;

-- Invite by email: someone who already has an account joins straight away,
-- anyone else joins when they sign up with that email.
create function public.invite_to_list(p_list uuid, p_email text)
returns text language plpgsql security definer set search_path = '' as $$
declare
  u uuid;
  e text := lower(trim(p_email));
begin
  if not public.is_member(p_list) then
    raise exception 'not a member of this list';
  end if;
  if e !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' then
    raise exception 'invalid email';
  end if;

  select id into u from auth.users where lower(email) = e;
  if u is not null then
    insert into public.list_members (list_id, user_id, role)
    values (p_list, u, 'editor')
    on conflict do nothing;
    return 'added';
  end if;

  insert into public.list_invites (list_id, email, invited_by)
  values (p_list, e, auth.uid())
  on conflict (list_id, lower(email)) do nothing;
  return 'invited';
end $$;

-- Rotate a list's share link (the old link stops working).
create function public.rotate_invite_token(p_list uuid)
returns text language plpgsql security definer set search_path = '' as $$
declare
  t text := replace(gen_random_uuid()::text, '-', '');
begin
  if not public.is_member(p_list) then
    raise exception 'not a member of this list';
  end if;
  update public.lists set invite_token = t where id = p_list;
  return t;
end $$;

revoke execute on function public.create_list(text) from anon;
revoke execute on function public.join_list(text) from anon;
revoke execute on function public.invite_to_list(uuid, text) from anon;
revoke execute on function public.rotate_invite_token(uuid) from anon;

-- ---------------------------------------------------------------------------
-- Row-level security
-- ---------------------------------------------------------------------------

alter table public.profiles     enable row level security;
alter table public.lists        enable row level security;
alter table public.list_members enable row level security;
alter table public.list_invites enable row level security;
alter table public.items        enable row level security;
alter table public.purchases    enable row level security;

create policy "see self and people you share a list with" on public.profiles
  for select using (id = auth.uid() or public.shares_list_with(id));
create policy "edit own profile" on public.profiles
  for update using (id = auth.uid()) with check (id = auth.uid());

create policy "members see the list" on public.lists
  for select using (public.is_member(id));
create policy "members rename the list" on public.lists
  for update using (public.is_member(id)) with check (public.is_member(id));
create policy "owner deletes the list" on public.lists
  for delete using (owner_id = auth.uid());

create policy "members see each other" on public.list_members
  for select using (public.is_member(list_id));
create policy "edit own notification settings" on public.list_members
  for update using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "leave a list, or owner removes someone" on public.list_members
  for delete using (
    user_id = auth.uid()
    or exists (select 1 from public.lists l where l.id = list_id and l.owner_id = auth.uid())
  );

create policy "members see invites" on public.list_invites
  for select using (public.is_member(list_id));
create policy "members cancel invites" on public.list_invites
  for delete using (public.is_member(list_id));

create policy "members read items" on public.items
  for select using (public.is_member(list_id));
create policy "members add items" on public.items
  for insert with check (public.is_member(list_id));
create policy "members change items" on public.items
  for update using (public.is_member(list_id)) with check (public.is_member(list_id));
create policy "members remove items" on public.items
  for delete using (public.is_member(list_id));

create policy "members read purchases" on public.purchases
  for select using (public.is_member(list_id));
create policy "members record own purchases" on public.purchases
  for insert with check (public.is_member(list_id) and bought_by = auth.uid());
create policy "members undo purchases" on public.purchases
  for delete using (public.is_member(list_id));

-- ---------------------------------------------------------------------------
-- Realtime: everyone on a list sees changes live
-- ---------------------------------------------------------------------------

alter table public.items        replica identity full;
alter table public.purchases    replica identity full;
alter table public.list_members replica identity full;
alter table public.lists        replica identity full;

alter publication supabase_realtime
  add table public.items, public.purchases, public.list_members, public.lists;
