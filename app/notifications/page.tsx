"use client"

import Link from "next/link"
import { useEffect, useMemo, useState } from "react"
import { useRouter } from "next/navigation"
import { supabase } from "@/lib/supabase"
import { syncLikedEventNotifications } from "@/lib/notifications"

type NotificationItem = {
  id: number
  type: string
  title: string
  body: string
  event_id?: number | null
  comment_id?: number | null
  created_at: string
  read_at?: string | null
}

function formatNotificationDate(dateString: string) {
  return new Date(dateString).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  })
}

export default function NotificationsPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [notifications, setNotifications] = useState<NotificationItem[]>([])

  useEffect(() => {
    const loadNotifications = async () => {
      const { data: userData } = await supabase.auth.getUser()
      const user = userData.user

      if (!user) {
        router.push("/auth")
        return
      }

      await syncLikedEventNotifications(user.id)

      const { data, error } = await supabase
        .from("notifications")
        .select("*")
        .eq("recipient_profile_id", user.id)
        .order("created_at", { ascending: false })

      if (error) {
        console.error("Notifications fetch error:", error.message || error)
        setLoading(false)
        return
      }

      setNotifications((data || []) as NotificationItem[])
      setLoading(false)

      const unreadIds = (data || [])
        .filter((notification) => !notification.read_at)
        .map((notification) => notification.id)

      if (unreadIds.length > 0) {
        await supabase
          .from("notifications")
          .update({ read_at: new Date().toISOString() })
          .in("id", unreadIds)

        setNotifications((prev) =>
          prev.map((notification) =>
            unreadIds.includes(notification.id)
              ? { ...notification, read_at: new Date().toISOString() }
              : notification
          )
        )
      }
    }

    loadNotifications()
  }, [router])

  const unreadCount = useMemo(
    () => notifications.filter((notification) => !notification.read_at).length,
    [notifications]
  )

  return (
    <main style={styles.page}>
      <div style={styles.container}>
        <div style={styles.headerBlock}>
          <div style={styles.sectionPill}>Notifications</div>
          <h1 style={styles.title}>Alerts</h1>
          <p style={styles.subtitle}>
            Replies, new posts from followed organizations, and event reminders.
          </p>
        </div>

        <section style={styles.card}>
          <div style={styles.cardHeader}>
            <h2 style={styles.sectionTitle}>Inbox</h2>
            <span style={styles.countPill}>{unreadCount} unread</span>
          </div>

          {loading ? (
            <p style={styles.helperText}>Loading notifications...</p>
          ) : notifications.length === 0 ? (
            <p style={styles.helperText}>You’re all caught up.</p>
          ) : (
            <div style={styles.list}>
              {notifications.map((notification) => {
                const href = notification.event_id
                  ? `/events/${notification.event_id}`
                  : "/"

                return (
                  <Link
                    key={notification.id}
                    href={href}
                    style={{
                      ...styles.notificationCard,
                      ...(!notification.read_at ? styles.notificationCardUnread : {}),
                    }}
                  >
                    <div style={styles.notificationTopRow}>
                      <h3 style={styles.notificationTitle}>{notification.title}</h3>
                      {!notification.read_at && <span style={styles.unreadDot} />}
                    </div>
                    <p style={styles.notificationBody}>{notification.body}</p>
                    <p style={styles.notificationDate}>
                      {formatNotificationDate(notification.created_at)}
                    </p>
                  </Link>
                )
              })}
            </div>
          )}
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
    fontFamily: "Arial, sans-serif",
    background: "transparent",
  },
  container: {
    maxWidth: 920,
    margin: "0 auto",
  },
  headerBlock: {
    marginBottom: 24,
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
  card: {
    borderRadius: 28,
    border: "1px solid rgba(255,255,255,0.08)",
    background: "linear-gradient(180deg, rgba(18,18,20,0.98), rgba(10,10,12,0.98))",
    boxShadow: "0 10px 30px rgba(0,0,0,0.35)",
    padding: 22,
  },
  cardHeader: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 12,
    flexWrap: "wrap",
    marginBottom: 16,
  },
  sectionTitle: {
    margin: 0,
    fontSize: 26,
    fontWeight: 800,
    letterSpacing: "-1px",
  },
  countPill: {
    padding: "7px 11px",
    borderRadius: 999,
    background: "rgba(255,255,255,0.06)",
    border: "1px solid rgba(255,255,255,0.08)",
    color: "rgba(255,255,255,0.7)",
    fontSize: 13,
  },
  helperText: {
    margin: 0,
    color: "rgba(255,255,255,0.56)",
    fontSize: 15,
  },
  list: {
    display: "grid",
    gap: 14,
  },
  notificationCard: {
    display: "block",
    textDecoration: "none",
    color: "inherit",
    borderRadius: 20,
    border: "1px solid rgba(255,255,255,0.08)",
    background: "rgba(255,255,255,0.03)",
    padding: 18,
  },
  notificationCardUnread: {
    background: "rgba(92,120,255,0.08)",
    border: "1px solid rgba(92,120,255,0.22)",
  },
  notificationTopRow: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
    marginBottom: 8,
  },
  notificationTitle: {
    margin: 0,
    fontSize: 18,
    fontWeight: 800,
  },
  unreadDot: {
    width: 10,
    height: 10,
    borderRadius: "50%",
    background: "#ff5f85",
    flexShrink: 0,
  },
  notificationBody: {
    margin: "0 0 8px 0",
    color: "rgba(255,255,255,0.82)",
    lineHeight: 1.6,
    fontSize: 15,
  },
  notificationDate: {
    margin: 0,
    color: "rgba(255,255,255,0.52)",
    fontSize: 13,
  },
}
