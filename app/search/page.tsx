"use client"

import Link from "next/link"
import { useEffect, useMemo, useState } from "react"
import { supabase } from "@/lib/supabase"
import SkeletonImage from "@/components/SkeletonImage"
import { isEventArchived } from "@/lib/eventStatus"

type EventItem = {
  id: number
  title: string
  time: string
  event_date?: string | null
  start_time?: string | null
  end_time?: string | null
  location: string
  posted_by: string
  profile_id?: string | null
  description: string
  category: string
  media?: MediaItem[]
}

type ProfileItem = {
  id: string
  username: string | null
  display_name: string | null
  organization_name: string | null
  avatar_url: string | null
  bio: string | null
  is_verified: boolean | null
  account_type: string | null
}

type MediaItem = {
  event_id: number
  file_url: string
  file_type: string
}

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

function getProfileDisplayName(profile?: ProfileItem | null) {
  if (!profile) return "Profile"
  return (
    profile.organization_name ||
    profile.display_name ||
    profile.username ||
    "Profile"
  )
}

function isEventLive(event: {
  event_date?: string | null
  start_time?: string | null
  end_time?: string | null
}) {
  if (!event.event_date || !event.start_time || !event.end_time) return false

  const now = new Date()
  const year = now.getFullYear()
  const month = String(now.getMonth() + 1).padStart(2, "0")
  const day = String(now.getDate()).padStart(2, "0")
  const todayString = `${year}-${month}-${day}`

  if (event.event_date !== todayString) return false

  const [startHour, startMinute] = event.start_time.split(":").map(Number)
  const [endHour, endMinute] = event.end_time.split(":").map(Number)

  const start = new Date(now)
  start.setHours(startHour, startMinute, 0, 0)

  const end = new Date(now)
  end.setHours(endHour, endMinute, 0, 0)

  return now >= start && now <= end
}

export default function SearchPage() {
  const [query, setQuery] = useState("")
  const [loading, setLoading] = useState(true)
  const [showAllProfiles, setShowAllProfiles] = useState(false)

  const [events, setEvents] = useState<EventItem[]>([])
  const [profiles, setProfiles] = useState<ProfileItem[]>([])

  useEffect(() => {
    const fetchSearchData = async () => {
      setLoading(true)

      // Single query: events + their media attached. We still fetch profiles
      // separately because they're displayed as their own search section, not
      // joined to events in the rendering.
      const { data: eventsData, error: eventsError } = await supabase
        .from("events")
        .select(`
          *,
          media:event_media(*)
        `)
        .order("id", { ascending: false })

      if (eventsError) {
        console.error("Events fetch error:", eventsError.message || eventsError)
      }

      const { data: profilesData, error: profilesError } = await supabase
        .from("profiles")
        .select("*")
        .order("created_at", { ascending: false })

      if (profilesError) {
        console.error("Profiles fetch error:", profilesError.message || profilesError)
      }

      setEvents((eventsData || []) as EventItem[])
      setProfiles(profilesData || [])
      setLoading(false)
    }

    fetchSearchData()
  }, [])

  const filteredProfiles = useMemo(() => {
    const q = query.trim().toLowerCase()

    if (!q) return profiles

    return profiles.filter((profile) => {
      const searchable = [
        profile.organization_name,
        profile.display_name,
        profile.username,
        profile.bio,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()

      return searchable.includes(q)
    })
  }, [profiles, query])

  const visibleProfiles = useMemo(() => {
    const q = query.trim()
    if (q) return filteredProfiles
    if (showAllProfiles) return filteredProfiles
    return filteredProfiles.slice(0, 2)
  }, [filteredProfiles, query, showAllProfiles])

  const filteredEvents = useMemo(() => {
    const activeEvents = events.filter((event) => !isEventArchived(event))
    const q = query.trim().toLowerCase()
    if (!q) return activeEvents

    return activeEvents.filter((event) => {
      const searchable = [
        event.title,
        event.description,
        event.location,
        event.posted_by,
        event.category,
        event.time,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()

      return searchable.includes(q)
    })
  }, [events, query])

  const liveEvents = useMemo(() => {
    return filteredEvents.filter((event) => isEventLive(event))
  }, [filteredEvents])

  const shouldShowProfileToggle =
    query.trim() === "" && filteredProfiles.length > 2

  return (
    <main style={styles.page}>
      <div style={styles.container}>
        <div style={styles.headerBlock}>
          <div style={styles.sectionPill}>Search</div>
          <h1 style={styles.title}>Search</h1>
          <p style={styles.subtitle}>Find events, people, and organizations on TONIGHT.</p>
        </div>

        <section style={styles.searchCard}>
          <input
            type="text"
            placeholder="Search events, people, organizations..."
            value={query}
            onChange={(e) => {
              setQuery(e.target.value)
              setShowAllProfiles(false)
            }}
            style={styles.searchInput}
          />
        </section>

        {loading ? (
          <p style={styles.helperText}>Loading search...</p>
        ) : (
          <>
            <section style={styles.card}>
              <div style={styles.sectionHeader}>
                <h2 style={styles.sectionTitle}>Live Now</h2>
                <span style={styles.countPill}>{liveEvents.length}</span>
              </div>

              {liveEvents.length === 0 ? (
                <p style={styles.helperText}>No live events right now.</p>
              ) : (
                <div style={styles.resultsGrid}>
                  {liveEvents.map((event) => {
                    const firstImage = event.media?.find(
                      (item) => item.file_type === "image"
                    )

                    return (
                      <Link
                        key={event.id}
                        href={`/events/${event.id}`}
                        style={styles.eventCardLink}
                      >
                        <article style={styles.eventCard}>
                          {firstImage && (
                            <SkeletonImage
                              src={firstImage.file_url}
                              alt={event.title}
                              wrapperStyle={styles.eventImageWrap}
                              style={styles.eventImage}
                            />
                          )}

                          <div style={styles.eventBody}>
                            <div style={styles.badgeRow}>
                              <span
                                style={{
                                  ...styles.categoryChip,
                                  ...getCategoryStyles(event.category),
                                }}
                              >
                                {event.category}
                              </span>
                              <span style={styles.liveBadge}>Live Now</span>
                            </div>

                            <h3 style={styles.eventTitle}>{event.title}</h3>
                            <p style={styles.eventMeta}>{event.time}</p>
                            <p style={styles.eventMeta}>{event.location}</p>
                            <p style={styles.eventPostedBy}>Posted by {event.posted_by}</p>
                          </div>
                        </article>
                      </Link>
                    )
                  })}
                </div>
              )}
            </section>

            <section style={styles.card}>
              <div style={styles.sectionHeader}>
                <h2 style={styles.sectionTitle}>Profiles</h2>
                <span style={styles.countPill}>{filteredProfiles.length}</span>
              </div>

              {visibleProfiles.length === 0 ? (
                <p style={styles.helperText}>No profiles found.</p>
              ) : (
                <div style={styles.resultsGrid}>
                  {visibleProfiles.map((profile) => (
                    <Link
                      key={profile.id}
                      href={`/org/${profile.id}`}
                      style={styles.profileCardLink}
                    >
                      <article style={styles.profileCard}>
                        {profile.avatar_url ? (
                          <SkeletonImage
                            src={profile.avatar_url}
                            alt={getProfileDisplayName(profile)}
                            wrapperStyle={styles.profileAvatarWrap}
                            style={styles.profileAvatar}
                          />
                        ) : (
                          <div style={styles.profileAvatarPlaceholder} />
                        )}

                        <div style={{ minWidth: 0 }}>
                          <div style={styles.nameRow}>
                            <h3 style={styles.profileName}>
                              {getProfileDisplayName(profile)}
                            </h3>

                            {profile.is_verified && (
                              <span style={styles.verifiedBadge}>Verified</span>
                            )}

                            <span style={styles.accountTypePill}>
                              {profile.account_type === "organization" ? "Organization" : "User"}
                            </span>
                          </div>

                          {profile.username && (
                            <p style={styles.profileMeta}>@{profile.username}</p>
                          )}

                          {profile.bio && (
                            <p style={styles.profileBio}>{profile.bio}</p>
                          )}
                        </div>
                      </article>
                    </Link>
                  ))}
                </div>
              )}

              {shouldShowProfileToggle && (
                <button
                  onClick={() => setShowAllProfiles((prev) => !prev)}
                  style={styles.showMoreButton}
                >
                  {showAllProfiles ? "Show Less" : "Show More"}
                </button>
              )}
            </section>

            <section style={styles.card}>
              <div style={styles.sectionHeader}>
                <h2 style={styles.sectionTitle}>Events</h2>
                <span style={styles.countPill}>{filteredEvents.length}</span>
              </div>

              {filteredEvents.length === 0 ? (
                <p style={styles.helperText}>No events found.</p>
              ) : (
                <div style={styles.resultsGrid}>
                  {filteredEvents.map((event) => {
                    const firstImage = event.media?.find(
                      (item) => item.file_type === "image"
                    )

                    return (
                      <Link
                        key={event.id}
                        href={`/events/${event.id}`}
                        style={styles.eventCardLink}
                      >
                        <article style={styles.eventCard}>
                          {firstImage && (
                            <SkeletonImage
                              src={firstImage.file_url}
                              alt={event.title}
                              wrapperStyle={styles.eventImageWrap}
                              style={styles.eventImage}
                            />
                          )}

                          <div style={styles.eventBody}>
                            <div style={styles.badgeRow}>
                              <span
                                style={{
                                  ...styles.categoryChip,
                                  ...getCategoryStyles(event.category),
                                }}
                              >
                                {event.category}
                              </span>
                              {isEventLive(event) && (
                                <span style={styles.liveBadge}>Live Now</span>
                              )}
                            </div>

                            <h3 style={styles.eventTitle}>{event.title}</h3>
                            <p style={styles.eventMeta}>{event.time}</p>
                            <p style={styles.eventMeta}>{event.location}</p>
                            <p style={styles.eventPostedBy}>
                              Posted by {event.posted_by}
                            </p>
                          </div>
                        </article>
                      </Link>
                    )
                  })}
                </div>
              )}
            </section>
          </>
        )}
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
    background: "transparent",
  },
  container: {
    maxWidth: 980,
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
  searchCard: {
    borderRadius: 28,
    border: "1px solid rgba(255,255,255,0.08)",
    background: "linear-gradient(180deg, rgba(18,18,20,0.98), rgba(10,10,12,0.98))",
    boxShadow: "0 10px 30px rgba(0,0,0,0.35)",
    padding: 18,
    marginBottom: 18,
  },
  searchInput: {
    width: "100%",
    padding: "16px 18px",
    borderRadius: 18,
    border: "1px solid rgba(255,255,255,0.08)",
    background: "rgba(255,255,255,0.03)",
    color: "white",
    outline: "none",
    fontSize: 16,
    boxSizing: "border-box",
  },
  card: {
    borderRadius: 28,
    border: "1px solid rgba(255,255,255,0.08)",
    background: "linear-gradient(180deg, rgba(18,18,20,0.98), rgba(10,10,12,0.98))",
    boxShadow: "0 10px 30px rgba(0,0,0,0.35)",
    padding: 22,
    marginBottom: 18,
  },
  sectionHeader: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
    marginBottom: 16,
    flexWrap: "wrap",
  },
  sectionTitle: {
    margin: 0,
    fontSize: 28,
    fontWeight: 800,
    letterSpacing: "-1px",
  },
  countPill: {
    padding: "8px 12px",
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
  resultsGrid: {
    display: "grid",
    gap: 16,
  },
  badgeRow: {
    display: "flex",
    gap: 8,
    flexWrap: "wrap",
    marginBottom: 12,
  },
  profileCardLink: {
    textDecoration: "none",
    color: "inherit",
  },
  profileCard: {
    display: "flex",
    alignItems: "flex-start",
    gap: 14,
    padding: 16,
    borderRadius: 22,
    border: "1px solid rgba(255,255,255,0.08)",
    background: "rgba(255,255,255,0.03)",
  },
  profileAvatarWrap: {
    width: 58,
    height: 58,
    borderRadius: "50%",
    flexShrink: 0,
  },
  profileAvatar: {
    width: 58,
    height: 58,
    borderRadius: "50%",
    objectFit: "cover",
    border: "1px solid rgba(255,255,255,0.10)",
    flexShrink: 0,
  },
  profileAvatarPlaceholder: {
    width: 58,
    height: 58,
    borderRadius: "50%",
    background: "rgba(255,255,255,0.08)",
    border: "1px solid rgba(255,255,255,0.08)",
    flexShrink: 0,
  },
  nameRow: {
    display: "flex",
    alignItems: "center",
    gap: 8,
    flexWrap: "wrap",
    marginBottom: 4,
  },
  profileName: {
    margin: 0,
    fontSize: 22,
    fontWeight: 800,
    letterSpacing: "-0.8px",
  },
  verifiedBadge: {
    padding: "6px 10px",
    borderRadius: 999,
    background: "rgba(92,120,255,0.18)",
    border: "1px solid rgba(92,120,255,0.35)",
    color: "#dbe4ff",
    fontSize: 11,
    fontWeight: 700,
  },
  accountTypePill: {
    padding: "6px 10px",
    borderRadius: 999,
    background: "rgba(255,255,255,0.06)",
    border: "1px solid rgba(255,255,255,0.08)",
    color: "rgba(255,255,255,0.75)",
    fontSize: 11,
    fontWeight: 700,
  },
  profileMeta: {
    margin: "0 0 6px 0",
    color: "rgba(255,255,255,0.62)",
    fontSize: 14,
  },
  profileBio: {
    margin: 0,
    color: "rgba(255,255,255,0.82)",
    fontSize: 14,
    lineHeight: 1.6,
  },
  showMoreButton: {
    marginTop: 16,
    padding: "12px 16px",
    borderRadius: 999,
    border: "1px solid rgba(255,255,255,0.10)",
    background: "rgba(255,255,255,0.04)",
    color: "white",
    fontWeight: 700,
    fontSize: 14,
    cursor: "pointer",
  },
  eventCardLink: {
    textDecoration: "none",
    color: "inherit",
  },
  eventCard: {
    borderRadius: 22,
    overflow: "hidden",
    border: "1px solid rgba(255,255,255,0.08)",
    background: "rgba(255,255,255,0.03)",
  },
  eventImageWrap: {
    width: "100%",
    height: 220,
  },
  eventImage: {
    width: "100%",
    height: 220,
    objectFit: "cover",
    display: "block",
  },
  eventBody: {
    padding: 16,
  },
  categoryChip: {
    display: "inline-block",
    padding: "8px 12px",
    borderRadius: 999,
    fontSize: 12,
    fontWeight: 700,
  },
  liveBadge: {
    display: "inline-block",
    padding: "8px 12px",
    borderRadius: 999,
    background: "rgba(255, 70, 110, 0.18)",
    border: "1px solid rgba(255, 70, 110, 0.35)",
    color: "#ffd6e2",
    fontSize: 12,
    fontWeight: 700,
  },
  eventTitle: {
    margin: "0 0 8px 0",
    fontSize: 24,
    fontWeight: 800,
    letterSpacing: "-1px",
  },
  eventMeta: {
    margin: "0 0 4px 0",
    color: "rgba(255,255,255,0.72)",
    fontSize: 15,
  },
  eventPostedBy: {
    margin: "10px 0 0 0",
    color: "rgba(255,255,255,0.58)",
    fontSize: 14,
  },
}
