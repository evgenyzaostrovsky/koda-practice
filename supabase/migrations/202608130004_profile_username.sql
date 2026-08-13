begin;
alter table public.profiles add column if not exists username text;
update public.profiles set username = left(lower(regexp_replace(split_part(coalesce((select email from auth.users where id = profiles.user_id), user_id::text), '@', 1), '[^a-z0-9_]+', '_', 'g')), 19) || '_' || left(user_id::text, 4) where username is null;
alter table public.profiles alter column username set not null;
alter table public.profiles drop constraint if exists profiles_username_format;
alter table public.profiles add constraint profiles_username_format check (username ~ '^[a-z0-9_]{3,24}$');
create unique index if not exists profiles_username_unique on public.profiles (lower(username));
create or replace function public.create_profile_for_new_user() returns trigger language plpgsql security definer set search_path=public as $$
declare candidate text;
begin
  candidate := left(lower(regexp_replace(split_part(coalesce(new.email, new.id::text), '@', 1), '[^a-z0-9_]+', '_', 'g')), 19) || '_' || left(new.id::text, 4);
  insert into public.profiles(user_id,display_name,username) values(new.id,coalesce(new.raw_user_meta_data->>'display_name',split_part(new.email,'@',1)),candidate) on conflict (user_id) do nothing;
  return new;
end $$;
commit;
