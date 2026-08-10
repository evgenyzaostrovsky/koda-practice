begin;

create extension if not exists pgcrypto;

create table if not exists public.profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  last_active_at timestamptz not null default now()
);

create table if not exists public.task_progress (
  user_id uuid not null references auth.users(id) on delete cascade,
  task_id text not null,
  code text not null default '',
  status text not null default 'not_started' check (status in ('not_started','in_progress','completed')),
  attempts_count integer not null default 0 check (attempts_count >= 0),
  hints_opened integer not null default 0 check (hints_opened between 0 and 3),
  last_run_status text,
  last_run_result jsonb,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (user_id, task_id)
);

create table if not exists public.solution_attempts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  task_id text not null,
  code text not null,
  passed boolean not null,
  result_type text not null,
  feedback jsonb,
  execution_ms integer not null default 0,
  created_at timestamptz not null default now()
);

create table if not exists public.user_state (
  user_id uuid primary key references auth.users(id) on delete cascade,
  last_task_id text,
  last_topic_id text,
  bank_version integer not null default 2,
  updated_at timestamptz not null default now()
);

create index if not exists task_progress_user_status_idx on public.task_progress(user_id,status);
create index if not exists task_progress_updated_idx on public.task_progress(user_id,updated_at desc);
create index if not exists solution_attempts_user_created_idx on public.solution_attempts(user_id,created_at desc);
create index if not exists solution_attempts_user_task_idx on public.solution_attempts(user_id,task_id,created_at desc);

create or replace function public.set_updated_at() returns trigger language plpgsql as $$
begin new.updated_at=now(); return new; end $$;
drop trigger if exists profiles_set_updated_at on public.profiles;
create trigger profiles_set_updated_at before update on public.profiles for each row execute function public.set_updated_at();
drop trigger if exists task_progress_set_updated_at on public.task_progress;
create trigger task_progress_set_updated_at before update on public.task_progress for each row execute function public.set_updated_at();
drop trigger if exists user_state_set_updated_at on public.user_state;
create trigger user_state_set_updated_at before update on public.user_state for each row execute function public.set_updated_at();

create or replace function public.create_profile_for_new_user() returns trigger language plpgsql security definer set search_path=public as $$
begin
  insert into public.profiles(user_id,display_name) values(new.id,coalesce(new.raw_user_meta_data->>'display_name',split_part(new.email,'@',1))) on conflict do nothing;
  return new;
end $$;
drop trigger if exists auth_user_created_profile on auth.users;
create trigger auth_user_created_profile after insert on auth.users for each row execute function public.create_profile_for_new_user();

alter table public.profiles enable row level security;
alter table public.task_progress enable row level security;
alter table public.solution_attempts enable row level security;
alter table public.user_state enable row level security;

do $$ declare t text; op text; begin
  foreach t in array array['profiles','task_progress','solution_attempts','user_state'] loop
    foreach op in array array['select','insert','update','delete'] loop
      execute format('drop policy if exists %I on public.%I',t||'_own_'||op,t);
      if op='insert' then
        execute format('create policy %I on public.%I for insert to authenticated with check ((select auth.uid())=user_id)',t||'_own_'||op,t);
      elsif op='update' then
        execute format('create policy %I on public.%I for update to authenticated using ((select auth.uid())=user_id) with check ((select auth.uid())=user_id)',t||'_own_'||op,t);
      else
        execute format('create policy %I on public.%I for %s to authenticated using ((select auth.uid())=user_id)',t||'_own_'||op,t,op);
      end if;
    end loop;
  end loop;
end $$;

grant select,insert,update,delete on public.profiles,public.task_progress,public.solution_attempts,public.user_state to authenticated;
commit;
