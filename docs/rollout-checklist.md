# Rollout Checklist

## 1. Run Supabase SQL

Run these migrations in Supabase SQL Editor if they are not already applied:

- `supabase/migrations/20260418_comment_replies_and_notifications.sql`
- `supabase/migrations/20260419_profile_banner.sql`
- `supabase/migrations/20260420_profile_username_constraints.sql`
- `supabase/migrations/20260420_security_and_integrity.sql`
- `supabase/migrations/20260420_reports.sql`

## 2. Create or verify Storage buckets

Make sure these buckets exist and their policies match your app's upload behavior:

- `avatars`
- `banners`
- `images`
- `videos`

Recommended:

- public read for image/video URLs used in the client
- authenticated upload only
- size and mime-type restrictions where possible

## 3. Add production environment variables

Client:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`

Server:

- `SUPABASE_SERVICE_ROLE_KEY`
- `CRON_SECRET`

## 4. Schedule liked-event reminder notifications

The app now exposes:

- `GET /api/cron/liked-event-reminders`

Call it every 15 minutes or every hour with:

- header: `Authorization: Bearer <CRON_SECRET>`

This route uses the service role key and creates deduped `event_starting_soon` notifications.

## 5. Add health monitoring

The app now exposes:

- `GET /api/health`

Use it with your uptime provider to confirm the app is reachable after deploys.

## 6. Add error monitoring

Recommended before public rollout:

- Sentry or another error tracker for client and server errors
- deploy alerts
- uptime alerts on `/api/health`

Minimum things to watch:

- sign up / sign in failures
- event post failures
- storage upload failures
- cron notification failures
- report submission failures

## 7. Manual QA

Test these flows on a real phone and desktop:

- sign up as `user`
- sign up as `organization`
- profile picture upload
- banner upload and crop
- create event
- edit event
- delete event
- like / unlike event
- comment / reply / delete comment
- follow / unfollow profile
- report event
- report profile
- notification inbox

## 8. Content and trust basics

Before public rollout, add:

- Privacy Policy
- Terms of Service
- support contact email
- community guidelines

## 9. Nice-to-have next

These are not blockers, but they would help:

- admin review UI for `reports`
- stronger storage policies by bucket path
- background cleanup for orphaned uploads
- richer moderation reasons and evidence capture
