begin;

insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values('koda-sandbox','koda-sandbox',false,20971520,array['text/csv','application/csv','application/vnd.ms-excel','text/plain'])
on conflict(id) do update set public=false,file_size_limit=excluded.file_size_limit,allowed_mime_types=excluded.allowed_mime_types;

create table if not exists public.sandbox_files(
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  logical_path text not null,
  storage_key text not null unique,
  size_bytes bigint not null check(size_bytes>0 and size_bytes<=20971520),
  mime_type text not null default 'text/csv',
  content_hash text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(user_id,name),
  unique(user_id,logical_path),
  check(logical_path='/datasets/'||name)
);
alter table public.sandbox_files enable row level security;
drop policy if exists sandbox_files_own_select on public.sandbox_files;
drop policy if exists sandbox_files_own_insert on public.sandbox_files;
drop policy if exists sandbox_files_own_update on public.sandbox_files;
drop policy if exists sandbox_files_own_delete on public.sandbox_files;
create policy sandbox_files_own_select on public.sandbox_files for select to authenticated using((select auth.uid())=user_id);
create policy sandbox_files_own_insert on public.sandbox_files for insert to authenticated with check((select auth.uid())=user_id);
create policy sandbox_files_own_update on public.sandbox_files for update to authenticated using((select auth.uid())=user_id) with check((select auth.uid())=user_id);
create policy sandbox_files_own_delete on public.sandbox_files for delete to authenticated using((select auth.uid())=user_id);
drop trigger if exists sandbox_files_set_updated_at on public.sandbox_files;
create trigger sandbox_files_set_updated_at before update on public.sandbox_files for each row execute function public.set_updated_at();

drop policy if exists sandbox_storage_own_select on storage.objects;
drop policy if exists sandbox_storage_own_insert on storage.objects;
drop policy if exists sandbox_storage_own_delete on storage.objects;
create policy sandbox_storage_own_select on storage.objects for select to authenticated using(bucket_id='koda-sandbox' and (storage.foldername(name))[1]=(select auth.uid())::text);
create policy sandbox_storage_own_insert on storage.objects for insert to authenticated with check(bucket_id='koda-sandbox' and (storage.foldername(name))[1]=(select auth.uid())::text);
create policy sandbox_storage_own_delete on storage.objects for delete to authenticated using(bucket_id='koda-sandbox' and (storage.foldername(name))[1]=(select auth.uid())::text);

grant select,insert,update,delete on public.sandbox_files to authenticated;
commit;
