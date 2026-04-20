import { supabase } from "@/lib/supabase"

type NotificationInsert = {
  recipient_profile_id: string
  actor_profile_id?: string | null
  type: string
  title: string
  body: string
  dedupe_key: string
  event_id?: number | null
  comment_id?: number | null
}

type LikedEvent = {
  id: number
  title: string
  event_date?: string | null
  start_time?: string | null
  location: string
}

function getEventStartDate(event: Pick<LikedEvent, "event_date" | "start_time">) {
  if (!event.event_date || !event.start_time) return null

  const [hours, minutes] = event.start_time.split(":").map(Number)

  if (!Number.isFinite(hours) || !Number.isFinite(minutes)) return null

  const start = new Date(`${event.event_date}T00:00:00`)
  start.setHours(hours, minutes, 0, 0)
  return start
}

export async function createNotification(notification: NotificationInsert) {
  const { error } = await supabase.from("notifications").insert(notification)

  if (error) {
    if (error.code === "23505") {
      return
    }

    console.error("Notification insert error:", error.message || error)
  }
}

export async function syncLikedEventNotifications(userId: string) {
  const { data: likesData, error: likesError } = await supabase
    .from("likes")
    .select("event_id")
    .eq("profile_id", userId)

  if (likesError) {
    console.error("Liked events fetch error:", likesError.message || likesError)
    return
  }

  const eventIds = (likesData || [])
    .map((like) => like.event_id)
    .filter((value): value is number => Number.isFinite(value))

  if (eventIds.length === 0) return

  const { data: eventsData, error: eventsError } = await supabase
    .from("events")
    .select("id, title, event_date, start_time, location")
    .in("id", eventIds)

  if (eventsError) {
    console.error("Upcoming liked events fetch error:", eventsError.message || eventsError)
    return
  }

  const now = new Date()
  const inOneHour = new Date(now.getTime() + 60 * 60 * 1000)

  const dueNotifications = ((eventsData || []) as LikedEvent[]).filter((event) => {
    const start = getEventStartDate(event)
    if (!start) return false
    return start > now && start <= inOneHour
  })

  if (dueNotifications.length === 0) return

  await Promise.all(
    dueNotifications.map((event) =>
      createNotification({
        recipient_profile_id: userId,
        type: "event_starting_soon",
        title: "Event starts in an hour",
        body: `${event.title} starts soon${event.location ? ` at ${event.location}` : ""}.`,
        dedupe_key: `event_starting_soon:${userId}:${event.id}`,
        event_id: event.id,
      })
    )
  )
}
