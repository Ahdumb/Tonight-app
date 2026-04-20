import { NextRequest, NextResponse } from "next/server"
import { getSupabaseAdmin } from "@/lib/supabase-admin"

type EventRow = {
  id: number
  title: string
  event_date: string | null
  start_time: string | null
  location: string | null
}

type LikeRow = {
  event_id: number
  profile_id: string
}

function getEventStartDate(event: Pick<EventRow, "event_date" | "start_time">) {
  if (!event.event_date || !event.start_time) return null

  const [hours, minutes] = event.start_time.split(":").map(Number)

  if (!Number.isFinite(hours) || !Number.isFinite(minutes)) return null

  const start = new Date(`${event.event_date}T00:00:00`)
  start.setHours(hours, minutes, 0, 0)
  return start
}

export async function GET(request: NextRequest) {
  const cronSecret = process.env.CRON_SECRET
  const authorization = request.headers.get("authorization")

  if (!cronSecret || authorization !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  try {
    const supabaseAdmin = getSupabaseAdmin()
    const now = new Date()
    const inOneHour = new Date(now.getTime() + 60 * 60 * 1000)

    const datesToCheck = Array.from(
      new Set([
        now.toISOString().slice(0, 10),
        inOneHour.toISOString().slice(0, 10),
      ])
    )

    const { data: eventsData, error: eventsError } = await supabaseAdmin
      .from("events")
      .select("id, title, event_date, start_time, location")
      .in("event_date", datesToCheck)

    if (eventsError) {
      console.error("Cron events fetch error:", eventsError.message || eventsError)
      return NextResponse.json(
        { error: "Failed to fetch events" },
        { status: 500 }
      )
    }

    const dueEvents = ((eventsData || []) as EventRow[]).filter((event) => {
      const start = getEventStartDate(event)
      return !!start && start > now && start <= inOneHour
    })

    if (dueEvents.length === 0) {
      return NextResponse.json({ inserted: 0, dueEvents: 0 })
    }

    const eventIds = dueEvents.map((event) => event.id)

    const { data: likesData, error: likesError } = await supabaseAdmin
      .from("likes")
      .select("event_id, profile_id")
      .in("event_id", eventIds)

    if (likesError) {
      console.error("Cron likes fetch error:", likesError.message || likesError)
      return NextResponse.json(
        { error: "Failed to fetch likes" },
        { status: 500 }
      )
    }

    const notifications = ((likesData || []) as LikeRow[]).flatMap((like) => {
      const event = dueEvents.find((item) => item.id === like.event_id)
      if (!event) return []

      return [
        {
          recipient_profile_id: like.profile_id,
          type: "event_starting_soon",
          title: "Event starts in an hour",
          body: `${event.title} starts soon${event.location ? ` at ${event.location}` : ""}.`,
          dedupe_key: `event_starting_soon:${like.profile_id}:${event.id}`,
          event_id: event.id,
        },
      ]
    })

    if (notifications.length === 0) {
      return NextResponse.json({ inserted: 0, dueEvents: dueEvents.length })
    }

    const { error: notificationsError } = await supabaseAdmin
      .from("notifications")
      .upsert(notifications, {
        onConflict: "dedupe_key",
        ignoreDuplicates: true,
      })

    if (notificationsError) {
      console.error(
        "Cron notification insert error:",
        notificationsError.message || notificationsError
      )
      return NextResponse.json(
        { error: "Failed to insert notifications" },
        { status: 500 }
      )
    }

    return NextResponse.json({
      inserted: notifications.length,
      dueEvents: dueEvents.length,
    })
  } catch (error) {
    console.error("Cron route error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
