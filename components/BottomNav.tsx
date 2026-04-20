"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { useEffect, useState } from "react"
import { supabase } from "@/lib/supabase"
import { syncLikedEventNotifications } from "@/lib/notifications"

const navItems = [
  { label: "Home", href: "/" },
  { label: "Search", href: "/search" },
  { label: "Alerts", href: "/notifications" },
  { label: "Profile", href: "/profile" },
]

export default function BottomNav() {
  const pathname = usePathname()
  const [unreadCount, setUnreadCount] = useState(0)

  useEffect(() => {
    let cancelled = false

    const loadNotifications = async () => {
      const { data: userData } = await supabase.auth.getUser()
      const user = userData.user

      if (!user) {
        if (!cancelled) setUnreadCount(0)
        return
      }

      await syncLikedEventNotifications(user.id)

      const { count, error } = await supabase
        .from("notifications")
        .select("*", { count: "exact", head: true })
        .eq("recipient_profile_id", user.id)
        .is("read_at", null)

      if (error) {
        console.error("Unread notifications fetch error:", error.message || error)
        return
      }

      if (!cancelled) {
        setUnreadCount(count || 0)
      }
    }

    loadNotifications()

    return () => {
      cancelled = true
    }
  }, [pathname])

  return (
    <nav style={styles.wrapper}>
      <div style={styles.inner}>
        {navItems.map((item) => {
          const isActive = pathname === item.href
          const isNotifications = item.href === "/notifications"

          return (
            <Link
              key={item.href}
              href={item.href}
              style={{
                ...styles.link,
                ...(isActive ? styles.activeLink : {}),
              }}
            >
              <span
                style={{
                  ...styles.label,
                  ...(isActive ? styles.activeLabel : {}),
                }}
              >
                {item.label}
              </span>

              {isNotifications && unreadCount > 0 && (
                <span style={styles.badge}>
                  {unreadCount > 99 ? "99+" : unreadCount}
                </span>
              )}
            </Link>
          )
        })}
      </div>
    </nav>
  )
}

const styles: Record<string, React.CSSProperties> = {
  wrapper: {
    position: "fixed",
    left: 0,
    right: 0,
    bottom: 0,
    display: "flex",
    justifyContent: "center",
    padding: "0 14px 14px",
    zIndex: 50,
    pointerEvents: "none",
  },
  inner: {
    width: "100%",
    maxWidth: 680,
    display: "grid",
    gridTemplateColumns: "repeat(4, 1fr)",
    gap: 8,
    padding: 10,
    borderRadius: 24,
    background: "rgba(10,10,12,0.82)",
    border: "1px solid rgba(255,255,255,0.08)",
    boxShadow: "0 10px 30px rgba(0,0,0,0.35)",
    backdropFilter: "blur(18px)",
    WebkitBackdropFilter: "blur(18px)",
    pointerEvents: "auto",
  },
  link: {
    position: "relative",
    textDecoration: "none",
    borderRadius: 18,
    padding: "14px 12px",
    textAlign: "center",
    background: "transparent",
    transition: "all 180ms ease",
  },
  activeLink: {
    background: "rgba(255,255,255,0.08)",
    boxShadow: "inset 0 0 0 1px rgba(255,255,255,0.06)",
  },
  label: {
    color: "rgba(255,255,255,0.56)",
    fontSize: 15,
    fontWeight: 600,
    letterSpacing: "-0.2px",
  },
  activeLabel: {
    color: "white",
  },
  badge: {
    position: "absolute",
    top: 8,
    right: 12,
    minWidth: 20,
    height: 20,
    borderRadius: 999,
    padding: "0 6px",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    background: "rgba(255, 70, 110, 0.94)",
    color: "white",
    fontSize: 11,
    fontWeight: 800,
    boxShadow: "0 6px 18px rgba(255, 70, 110, 0.3)",
  },
}
