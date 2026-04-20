create unique index if not exists likes_profile_event_unique_idx
on public.likes (profile_id, event_id);

create unique index if not exists follows_follower_following_unique_idx
on public.follows (follower_id, following_id);

alter table public.profiles
drop constraint if exists profiles_account_type_check;

alter table public.profiles
add constraint profiles_account_type_check
check (
  account_type is null
  or account_type in ('organization', 'user')
);

alter table public.events
drop constraint if exists events_required_fields_check;

alter table public.events
add constraint events_required_fields_check
check (
  nullif(trim(title), '') is not null
  and nullif(trim(location), '') is not null
  and nullif(trim(posted_by), '') is not null
  and nullif(trim(description), '') is not null
  and nullif(trim(category), '') is not null
  and event_date is not null
  and start_time is not null
  and end_time is not null
);

alter table public.events
drop constraint if exists events_time_range_check;

alter table public.events
add constraint events_time_range_check
check (
  start_time is null
  or end_time is null
  or end_time >= start_time
);

alter table public.comments
drop constraint if exists comments_content_check;

alter table public.comments
add constraint comments_content_check
check (nullif(trim(content), '') is not null);

alter table public.follows
drop constraint if exists follows_no_self_follow_check;

alter table public.follows
add constraint follows_no_self_follow_check
check (follower_id <> following_id);

alter table public.event_media
drop constraint if exists event_media_file_type_check;

alter table public.event_media
add constraint event_media_file_type_check
check (file_type in ('image', 'video'));

alter table public.notifications
drop constraint if exists notifications_type_check;

alter table public.notifications
add constraint notifications_type_check
check (type in ('event_posted', 'event_starting_soon', 'comment_reply'));

alter table public.profiles enable row level security;
alter table public.events enable row level security;
alter table public.comments enable row level security;
alter table public.likes enable row level security;
alter table public.follows enable row level security;
alter table public.event_media enable row level security;

drop policy if exists "Profiles are viewable by everyone" on public.profiles;
create policy "Profiles are viewable by everyone"
on public.profiles
for select
using (true);

drop policy if exists "Users can insert their own profile" on public.profiles;
create policy "Users can insert their own profile"
on public.profiles
for insert
to authenticated
with check (auth.uid() = id);

drop policy if exists "Users can update their own profile" on public.profiles;
create policy "Users can update their own profile"
on public.profiles
for update
to authenticated
using (auth.uid() = id)
with check (auth.uid() = id);

drop policy if exists "Events are viewable by everyone" on public.events;
create policy "Events are viewable by everyone"
on public.events
for select
using (true);

drop policy if exists "Users can insert their own events" on public.events;
create policy "Users can insert their own events"
on public.events
for insert
to authenticated
with check (auth.uid() = profile_id);

drop policy if exists "Users can update their own events" on public.events;
create policy "Users can update their own events"
on public.events
for update
to authenticated
using (auth.uid() = profile_id)
with check (auth.uid() = profile_id);

drop policy if exists "Users can delete their own events" on public.events;
create policy "Users can delete their own events"
on public.events
for delete
to authenticated
using (auth.uid() = profile_id);

drop policy if exists "Comments are viewable by everyone" on public.comments;
create policy "Comments are viewable by everyone"
on public.comments
for select
using (true);

drop policy if exists "Users can insert their own comments" on public.comments;
create policy "Users can insert their own comments"
on public.comments
for insert
to authenticated
with check (auth.uid() = profile_id);

drop policy if exists "Users can update their own comments" on public.comments;
create policy "Users can update their own comments"
on public.comments
for update
to authenticated
using (auth.uid() = profile_id)
with check (auth.uid() = profile_id);

drop policy if exists "Users can delete their own comments" on public.comments;
create policy "Users can delete their own comments"
on public.comments
for delete
to authenticated
using (auth.uid() = profile_id);

drop policy if exists "Likes are viewable by everyone" on public.likes;
create policy "Likes are viewable by everyone"
on public.likes
for select
using (true);

drop policy if exists "Users can insert their own likes" on public.likes;
create policy "Users can insert their own likes"
on public.likes
for insert
to authenticated
with check (auth.uid() = profile_id);

drop policy if exists "Users can delete their own likes" on public.likes;
create policy "Users can delete their own likes"
on public.likes
for delete
to authenticated
using (auth.uid() = profile_id);

drop policy if exists "Follows are viewable by everyone" on public.follows;
create policy "Follows are viewable by everyone"
on public.follows
for select
using (true);

drop policy if exists "Users can insert their own follows" on public.follows;
create policy "Users can insert their own follows"
on public.follows
for insert
to authenticated
with check (auth.uid() = follower_id and follower_id <> following_id);

drop policy if exists "Users can delete their own follows" on public.follows;
create policy "Users can delete their own follows"
on public.follows
for delete
to authenticated
using (auth.uid() = follower_id);

drop policy if exists "Event media is viewable by everyone" on public.event_media;
create policy "Event media is viewable by everyone"
on public.event_media
for select
using (true);

drop policy if exists "Event owners can insert media" on public.event_media;
create policy "Event owners can insert media"
on public.event_media
for insert
to authenticated
with check (
  exists (
    select 1
    from public.events
    where events.id = event_media.event_id
      and events.profile_id = auth.uid()
  )
);

drop policy if exists "Event owners can delete media" on public.event_media;
create policy "Event owners can delete media"
on public.event_media
for delete
to authenticated
using (
  exists (
    select 1
    from public.events
    where events.id = event_media.event_id
      and events.profile_id = auth.uid()
  )
);

drop policy if exists "Authenticated actors can insert notifications" on public.notifications;
create policy "Authenticated actors can insert notifications"
on public.notifications
for insert
to authenticated
with check (
  auth.uid() is not null
  and (
    actor_profile_id is null
    or actor_profile_id = auth.uid()
  )
);
