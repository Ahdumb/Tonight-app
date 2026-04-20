export type EventTiming = {
  event_date?: string | null
  end_time?: string | null
}

function getTodayString() {
  const now = new Date()
  const year = now.getFullYear()
  const month = String(now.getMonth() + 1).padStart(2, "0")
  const day = String(now.getDate()).padStart(2, "0")
  return `${year}-${month}-${day}`
}

export function isEventArchived(event: EventTiming) {
  if (!event.event_date) return false

  const todayString = getTodayString()

  if (event.event_date < todayString) return true
  if (event.event_date > todayString) return false
  if (!event.end_time) return false

  const [endHour, endMinute] = event.end_time.split(":").map(Number)

  if (!Number.isFinite(endHour) || !Number.isFinite(endMinute)) {
    return false
  }

  const now = new Date()
  const end = new Date(now)
  end.setHours(endHour, endMinute, 0, 0)

  return now > end
}
