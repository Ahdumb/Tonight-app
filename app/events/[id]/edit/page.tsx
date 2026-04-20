"use client"

import Link from "next/link"
import { useEffect, useMemo, useState } from "react"
import { useParams, useRouter } from "next/navigation"
import { supabase } from "@/lib/supabase"
import { useToast } from "@/components/Toast"

const categoryOptions = [
  "Frat",
  "Sorority",
  "Bar",
  "Party",
  "Live Music",
  "Formal",
  "Religious",
]

const getCategoryStyles = (category: string): React.CSSProperties => {
  switch (category) {
    case "Frat":
      return {
        background: "rgba(92, 120, 255, 0.18)",
        border: "1px solid rgba(92, 120, 255, 0.35)",
        color: "#dbe4ff",
      }
    case "Sorority":
      return {
        background: "rgba(255, 120, 190, 0.16)",
        border: "1px solid rgba(255, 120, 190, 0.32)",
        color: "#ffe0ef",
      }
    case "Bar":
      return {
        background: "rgba(255, 170, 70, 0.16)",
        border: "1px solid rgba(255, 170, 70, 0.30)",
        color: "#ffe8c7",
      }
    case "Party":
      return {
        background: "rgba(180, 110, 255, 0.16)",
        border: "1px solid rgba(180, 110, 255, 0.30)",
        color: "#f0e0ff",
      }
    case "Live Music":
      return {
        background: "rgba(80, 210, 170, 0.16)",
        border: "1px solid rgba(80, 210, 170, 0.30)",
        color: "#d9fff2",
      }
    case "Formal":
      return {
        background: "rgba(235, 235, 245, 0.10)",
        border: "1px solid rgba(235, 235, 245, 0.22)",
        color: "#f3f3f8",
      }
    case "Religious":
      return {
        background: "rgba(120, 200, 120, 0.16)",
        border: "1px solid rgba(120, 200, 120, 0.30)",
        color: "#e3ffe3",
      }
    default:
      return {
        background: "rgba(255,255,255,0.12)",
        border: "1px solid rgba(255,255,255,0.12)",
        color: "white",
      }
  }
}

function formatDate(dateString: string) {
  if (!dateString) return ""
  const date = new Date(`${dateString}T12:00:00`)
  return date.toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  })
}

function formatTime(timeString: string) {
  if (!timeString) return ""
  const [hour, minute] = timeString.split(":")
  const date = new Date()
  date.setHours(Number(hour), Number(minute))
  return date.toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
  })
}

export default function EditEventPage() {
  const params = useParams()
  const router = useRouter()
  const toast = useToast()

  const rawId = useMemo(() => {
    const value = params?.id
    return Array.isArray(value) ? value[0] : value
  }, [params])

  const eventId = useMemo(() => {
    if (!rawId) return null
    const parsed = parseInt(String(rawId), 10)
    return Number.isFinite(parsed) ? parsed : null
  }, [rawId])

  const [authChecking, setAuthChecking] = useState(true)
  const [notFound, setNotFound] = useState(false)
  const [notOwner, setNotOwner] = useState(false)

  const [title, setTitle] = useState("")
  const [date, setDate] = useState("")
  const [startTime, setStartTime] = useState("")
  const [endTime, setEndTime] = useState("")
  const [location, setLocation] = useState("")
  const [postedBy, setPostedBy] = useState("")
  const [description, setDescription] = useState("")
  const [category, setCategory] = useState("Frat")

  const [saving, setSaving] = useState(false)

  useEffect(() => {
    const loadEvent = async () => {
      if (eventId === null) {
        setNotFound(true)
        setAuthChecking(false)
        return
      }

      const { data: userData } = await supabase.auth.getUser()
      const user = userData.user

      if (!user) {
        router.push("/auth")
        return
      }

      const { data: eventData, error } = await supabase
        .from("events")
        .select("*")
        .eq("id", eventId)
        .maybeSingle()

      if (error) {
        console.error("Event fetch error:", error)
      }

      if (!eventData) {
        setNotFound(true)
        setAuthChecking(false)
        return
      }

      if (eventData.profile_id !== user.id) {
        setNotOwner(true)
        setAuthChecking(false)
        return
      }

      setTitle(eventData.title || "")
      setDate(eventData.event_date || "")
      setStartTime(eventData.start_time || "")
      setEndTime(eventData.end_time || "")
      setLocation(eventData.location || "")
      setPostedBy(eventData.posted_by || "")
      setDescription(eventData.description || "")
      setCategory(eventData.category || "Frat")
      setAuthChecking(false)
    }

    loadEvent()
  }, [eventId, router])

  const handleSave = async () => {
    if (!eventId) return

    if (
      !title ||
      !date ||
      !startTime ||
      !endTime ||
      !location ||
      !postedBy ||
      !description ||
      !category
    ) {
      toast.error("Please fill out all fields.")
      return
    }

    const formattedTime = `${formatDate(date)} • ${formatTime(startTime)} - ${formatTime(endTime)}`

    setSaving(true)

    const { error } = await supabase
      .from("events")
      .update({
        title,
        time: formattedTime,
        event_date: date,
        start_time: startTime,
        end_time: endTime,
        location,
        posted_by: postedBy,
        description,
        category,
      })
      .eq("id", eventId)

    setSaving(false)

    if (error) {
      console.error("Event update error:", error)
      toast.error("There was an error saving your changes.")
      return
    }

    toast.success("Event updated.")
    router.push(`/events/${eventId}`)
  }

  if (authChecking) {
    return (
      <main style={styles.page}>
        <div style={styles.container}>
          <p style={styles.helperText}>Loading event...</p>
        </div>
      </main>
    )
  }

  if (notFound) {
    return (
      <main style={styles.page}>
        <div style={styles.container}>
          <Link href="/" style={styles.backLink}>
            ← Back to events
          </Link>
          <h1 style={styles.title}>Event not found.</h1>
        </div>
      </main>
    )
  }

  if (notOwner) {
    return (
      <main style={styles.page}>
        <div style={styles.container}>
          <Link href="/" style={styles.backLink}>
            ← Back to events
          </Link>

          <section style={styles.gateCard}>
            <div style={styles.sectionPill}>Access denied</div>
            <h1 style={styles.title}>You can&apos;t edit this event</h1>
            <p style={styles.subtitle}>
              Only the organization that posted this event can edit it.
            </p>

            <div style={{ marginTop: 18 }}>
              <Link href={`/events/${eventId}`} style={styles.primaryLinkButton}>
                Back to Event
              </Link>
            </div>
          </section>
        </div>
      </main>
    )
  }

  return (
    <main style={styles.page}>
      <div style={styles.container}>
        <Link href={`/events/${eventId}`} style={styles.backLink}>
          ← Back to event
        </Link>

        <div style={styles.headerBlock}>
          <div
            style={{
              ...styles.categoryPill,
              ...getCategoryStyles(category),
            }}
          >
            {category}
          </div>
          <h1 style={styles.title}>Edit Event</h1>
          <p style={styles.subtitle}>Update the details of your event.</p>
        </div>

        <section style={styles.formCard}>
          <div style={styles.formGrid}>
            <div style={styles.fieldGroup}>
              <label style={styles.label}>Event title</label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                style={styles.input}
              />
            </div>

            <div style={styles.fieldGroup}>
              <label style={styles.label}>Category</label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                style={styles.input}
              >
                {categoryOptions.map((option) => (
                  <option key={option} value={option} style={{ color: "black" }}>
                    {option}
                  </option>
                ))}
              </select>
            </div>

            <div style={styles.fieldGroup}>
              <label style={styles.label}>Date</label>
              <input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                style={styles.input}
              />
            </div>

            <div style={styles.fieldGroup}>
              <label style={styles.label}>Start time</label>
              <input
                type="time"
                value={startTime}
                onChange={(e) => setStartTime(e.target.value)}
                style={styles.input}
              />
            </div>

            <div style={styles.fieldGroup}>
              <label style={styles.label}>End time</label>
              <input
                type="time"
                value={endTime}
                onChange={(e) => setEndTime(e.target.value)}
                style={styles.input}
              />
            </div>

            <div style={styles.fieldGroup}>
              <label style={styles.label}>Location</label>
              <input
                type="text"
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                style={styles.input}
              />
            </div>

            <div style={styles.fieldGroup}>
              <label style={styles.label}>Posted by</label>
              <input
                type="text"
                value={postedBy}
                onChange={(e) => setPostedBy(e.target.value)}
                style={styles.input}
              />
            </div>

            <div style={styles.fieldGroupFull}>
              <label style={styles.label}>Description</label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={6}
                style={styles.textarea}
              />
            </div>
          </div>

          <p style={styles.noteText}>
            Note: To change photos or videos, delete this event and create a new
            one. This edit form only updates event details.
          </p>

          <div style={styles.buttonRow}>
            <button
              onClick={handleSave}
              disabled={saving}
              style={{
                ...styles.submitButton,
                opacity: saving ? 0.7 : 1,
              }}
            >
              {saving ? "Saving..." : "Save Changes"}
            </button>

            <Link href={`/events/${eventId}`} style={styles.cancelLink}>
              Cancel
            </Link>
          </div>
        </section>
      </div>
    </main>
  )
}

const styles: Record<string, React.CSSProperties> = {
  page: {
    minHeight: "100vh",
    color: "white",
    padding: "32px 18px 120px",
    fontFamily: "inherit",
    overflowX: "hidden",
    position: "relative",
    background: "transparent",
  },
  container: {
    maxWidth: 920,
    margin: "0 auto",
    position: "relative",
    zIndex: 1,
  },
  backLink: {
    color: "rgba(255,255,255,0.62)",
    textDecoration: "none",
    display: "inline-block",
    marginBottom: 22,
    fontSize: 15,
  },
  helperText: {
    color: "rgba(255,255,255,0.62)",
    fontSize: 16,
  },
  headerBlock: {
    marginBottom: 24,
  },
  categoryPill: {
    display: "inline-block",
    padding: "8px 12px",
    borderRadius: 999,
    fontSize: 13,
    marginBottom: 16,
    fontWeight: 700,
  },
  sectionPill: {
    display: "inline-block",
    padding: "8px 12px",
    borderRadius: 999,
    background: "rgba(255,255,255,0.05)",
    border: "1px solid rgba(255,255,255,0.08)",
    color: "rgba(255,255,255,0.72)",
    fontSize: 13,
    marginBottom: 16,
  },
  title: {
    fontSize: "clamp(44px, 8vw, 82px)",
    lineHeight: 0.95,
    margin: "0 0 10px 0",
    letterSpacing: "-3px",
    fontWeight: 800,
  },
  subtitle: {
    margin: 0,
    color: "rgba(255,255,255,0.66)",
    fontSize: "clamp(18px, 2vw, 23px)",
  },
  gateCard: {
    borderRadius: 28,
    border: "1px solid rgba(255,255,255,0.08)",
    background:
      "linear-gradient(180deg, rgba(18,18,20,0.98), rgba(10,10,12,0.98))",
    boxShadow: "0 10px 30px rgba(0,0,0,0.35)",
    padding: 24,
  },
  primaryLinkButton: {
    display: "inline-block",
    padding: "14px 18px",
    borderRadius: 999,
    border: "1px solid rgba(255,255,255,0.18)",
    background: "rgba(255,255,255,0.96)",
    color: "#050505",
    fontWeight: 800,
    fontSize: 15,
    textDecoration: "none",
  },
  formCard: {
    borderRadius: 28,
    border: "1px solid rgba(255,255,255,0.08)",
    background:
      "linear-gradient(180deg, rgba(18,18,20,0.98), rgba(10,10,12,0.98))",
    boxShadow: "0 10px 30px rgba(0,0,0,0.35)",
    padding: 22,
  },
  formGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
    gap: 16,
    marginBottom: 18,
  },
  fieldGroup: {
    display: "flex",
    flexDirection: "column",
    gap: 8,
  },
  fieldGroupFull: {
    display: "flex",
    flexDirection: "column",
    gap: 8,
    gridColumn: "1 / -1",
  },
  label: {
    fontSize: 14,
    color: "rgba(255,255,255,0.72)",
    fontWeight: 600,
  },
  input: {
    padding: "15px 16px",
    borderRadius: 16,
    border: "1px solid rgba(255,255,255,0.08)",
    background: "rgba(255,255,255,0.03)",
    color: "white",
    outline: "none",
    fontSize: 15,
  },
  textarea: {
    padding: "16px",
    borderRadius: 18,
    border: "1px solid rgba(255,255,255,0.08)",
    background: "rgba(255,255,255,0.03)",
    color: "white",
    outline: "none",
    fontSize: 15,
    resize: "vertical",
    minHeight: 140,
  },
  noteText: {
    margin: "0 0 18px 0",
    color: "rgba(255,255,255,0.55)",
    fontSize: 13,
    fontStyle: "italic",
  },
  buttonRow: {
    display: "flex",
    gap: 12,
    alignItems: "center",
    flexWrap: "wrap",
  },
  submitButton: {
    flex: 1,
    minWidth: 200,
    padding: "17px 20px",
    borderRadius: 999,
    border: "1px solid rgba(255,255,255,0.18)",
    background: "rgba(255,255,255,0.96)",
    color: "#050505",
    fontWeight: 800,
    fontSize: 16,
    cursor: "pointer",
    boxShadow: "0 10px 30px rgba(255,255,255,0.08)",
  },
  cancelLink: {
    padding: "14px 18px",
    borderRadius: 999,
    border: "1px solid rgba(255,255,255,0.10)",
    background: "rgba(255,255,255,0.04)",
    color: "white",
    fontWeight: 700,
    fontSize: 15,
    textDecoration: "none",
  },
}
