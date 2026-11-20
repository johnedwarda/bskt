-- Account pictures: each person's photo from their sign-in provider (Google gives avatar_url / picture),
-- copied onto their profile so everyone who shares a list with them can see it.
-- Kept up to date: the provider's picture is refreshed in auth.users on every sign-in.

alter table public.profiles add column if not exists avatar_url text;

create or replace function public.sync_profile_photo()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  update public.profiles
  set avatar_url = nullif(trim(coalesce(new.raw_user_meta_data ->> 'avatar_url', new.raw_user_meta_data ->> 'picture', '')), '')
  where id = new.id;
  return new;
end $$;

-- runs after on_auth_user_created (triggers fire in name order), so the profile row exists
drop trigger if exists on_auth_user_photo on auth.users;
create trigger on_auth_user_photo
  after insert or update of raw_user_meta_data on auth.users
  for each row execute function public.sync_profile_photo();

-- everyone who has already signed in
update public.profiles p
set avatar_url = nullif(trim(coalesce(u.raw_user_meta_data ->> 'avatar_url', u.raw_user_meta_data ->> 'picture', '')), '')
from auth.users u
where u.id = p.id;
