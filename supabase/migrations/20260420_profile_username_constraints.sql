update public.profiles
set username = nullif(regexp_replace(trim(coalesce(username, '')), '^@+', ''), '')
where username is not null;

drop index if exists profiles_username_unique_idx;

create unique index if not exists profiles_username_unique_idx
on public.profiles (lower(username))
where username is not null;

alter table public.profiles
drop constraint if exists profiles_username_format_check;

alter table public.profiles
add constraint profiles_username_format_check
check (
  username is null
  or username ~ '^[A-Za-z0-9.]+$'
);
