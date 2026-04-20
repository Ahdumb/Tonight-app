"use client"

import Link from "next/link"
import { useEffect, useMemo, useState } from "react"
import { useRouter } from "next/navigation"
import { supabase } from "@/lib/supabase"
import SkeletonImage from "@/components/SkeletonImage"
import { isEventArchived } from "@/lib/eventStatus"

type MediaItem = {
  event_id: number
  file_url: string
  file_type: string
}

type ProfileItem = {
  id: string
  username: string | null
  display_name: string | null
  organization_name: string | null
  avatar_url: string | null
  is_verified: boolean | null
  account_type: string | null
}

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
  profile?: ProfileItem | null
}

type FollowItem = {
  follower_id: string
  following_id: string
}

const categories = [
  "All",
  "Frat",
  "Sorority",
  "Bar",
  "Party",
  "Live Music",
  "Formal",
  "Religious",
]

const taglines = [
  "Find what’s happening after dark.",
  "What’s going on tonight.",
  "The night starts here.",
  "Let’s get the night started.",
  "Nothing wrong with a little fun.",
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

function getDisplayDate(eventDate?: string | null) {
  if (!eventDate) return null

  const today = new Date()
  const tomorrow = new Date()
  tomorrow.setDate(today.getDate() + 1)

  const event = new Date(`${eventDate}T12:00:00`)

  const isSameDay =
    event.getFullYear() === today.getFullYear() &&
    event.getMonth() === today.getMonth() &&
    event.getDate() === today.getDate()

  const isTomorrow =
    event.getFullYear() === tomorrow.getFullYear() &&
    event.getMonth() === tomorrow.getMonth() &&
    event.getDate() === tomorrow.getDate()

  const formattedDate = event.toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
  })

  if (isSameDay) return `Today • ${formattedDate}`
  if (isTomorrow) return `Tomorrow • ${formattedDate}`
  return formattedDate
}

function getProfileDisplayName(profile?: ProfileItem | null, fallback?: string) {
  if (!profile) return fallback || "Unknown"
  return (
    profile.organization_name ||
    profile.display_name ||
    profile.username ||
    fallback ||
    "Unknown"
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

function sortEventsWithLiveFirst<T extends {
  event_date?: string | null
  start_time?: string | null
  end_time?: string | null
}>(events: T[]) {
  return [...events].sort((a, b) => {
    const aLive = isEventLive(a)
    const bLive = isEventLive(b)

    if (aLive && !bLive) return -1
    if (!aLive && bLive) return 1

    return 0
  })
}

export default function Home() {
  const router = useRouter()

  const [events, setEvents] = useState<EventItem[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedCategory, setSelectedCategory] = useState("All")
  const [feedTab, setFeedTab] = useState<"all" | "following">("all")
  const [followingIds, setFollowingIds] = useState<string[]>([])
  const [currentUserId, setCurrentUserId] = useState<string | null>(null)
  const [filtersOpen, setFiltersOpen] = useState(false)

  const [tagline, setTagline] = useState("Find what’s happening after dark.")
  const [taglineVisible, setTaglineVisible] = useState(false)

  useEffect(() => {
    const randomIndex = Math.floor(Math.random() * taglines.length)
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setTagline(taglines[randomIndex])

    const timer = setTimeout(() => {
      setTaglineVisible(true)
    }, 50)

    return () => clearTimeout(timer)
  }, [])

  useEffect(() => {
    const fetchEvents = async () => {
      const { data: userData } = await supabase.auth.getUser()
      const user = userData.user
      setCurrentUserId(user?.id || null)

      if (user?.id) {
        const { data: followsData, error: followsError } = await supabase
          .from("follows")
          .select("*")
          .eq("follower_id", user.id)

        if (followsError) {
          console.error("Follows fetch error:", followsError)
        }

        setFollowingIds((followsData as FollowItem[] | null)?.map((f) => f.following_id) || [])
      } else {
        setFollowingIds([])
      }

      // Single query with joins — fetches events with their media and poster
      // profile in one round trip instead of three. Scales regardless of how
      // many users or events exist in the database.
      const { data: eventsData, error: eventsError } = await supabase
        .from("events")
        .select(`
          *,
          profile:profiles(*),
          media:event_media(*)
        `)
        .order("id", { ascending: false })

      if (eventsError) {
        console.error("Events fetch error:", eventsError)
        setLoading(false)
        return
      }

      const formattedEvents = (eventsData || []) as EventItem[]

      setEvents(formattedEvents)
      setLoading(false)
    }

    fetchEvents()
  }, [])

  const baseEvents = useMemo(() => {
    const activeEvents = events.filter((event) => !isEventArchived(event))

    if (feedTab === "following") {
      return activeEvents.filter(
        (event) => !!event.profile_id && followingIds.includes(event.profile_id)
      )
    }

    return activeEvents
  }, [events, feedTab, followingIds])

  const filteredEvents = sortEventsWithLiveFirst(
    selectedCategory === "All"
      ? baseEvents
      : baseEvents.filter((event) => event.category === selectedCategory)
  )

  return (
    <main style={styles.page}>
      <div style={styles.container}>
        <div style={styles.header}>
          <div>
            <h1 style={styles.logo}>TONIGHT.</h1>
            <p
              style={{
                ...styles.tagline,
                opacity: taglineVisible ? 1 : 0,
                transform: taglineVisible ? "translateY(0px)" : "translateY(8px)",
                transition: "opacity 500ms ease, transform 500ms ease",
              }}
            >
              {tagline}
            </p>
          </div>

          <Link href="/post" style={styles.postButton}>
            Post Event
          </Link>
        </div>

        <div style={styles.feedTabsRow}>
          <button
            onClick={() => setFeedTab("all")}
            style={{
              ...styles.feedTabButton,
              ...(feedTab === "all" ? styles.feedTabButtonActive : {}),
            }}
          >
            All
          </button>

          <button
            onClick={() => setFeedTab("following")}
            style={{
              ...styles.feedTabButton,
              ...(feedTab === "following" ? styles.feedTabButtonActive : {}),
            }}
          >
            Following
          </button>

          <button
            onClick={() => setFiltersOpen((prev) => !prev)}
            style={{
              ...styles.feedTabButton,
              ...(filtersOpen ? styles.feedTabButtonActive : {}),
            }}
          >
            Filters
          </button>
        </div>

        {feedTab === "following" && !currentUserId && (
          <p style={styles.helperText}>
            Sign in to see events from organizations you follow.
          </p>
        )}

        {filtersOpen && (
          <div style={styles.filtersPanel}>
            <div style={styles.filtersPanelHeader}>
              <p style={styles.filtersTitle}>Choose a filter</p>
              {selectedCategory !== "All" && (
                <button
                  onClick={() => setSelectedCategory("All")}
                  style={styles.clearFiltersButton}
                >
                  Clear
                </button>
              )}
            </div>

            <div style={styles.filtersGrid}>
              {categories.map((chip) => {
                const active = selectedCategory === chip

                return (
                  <button
                    key={chip}
                    onClick={() => {
                      setSelectedCategory(chip)
                      setFiltersOpen(false)
                    }}
                    style={{
                      ...styles.filterChip,
                      ...(active ? styles.filterChipActive : {}),
                    }}
                  >
                    {chip}
                  </button>
                )
              })}
            </div>
          </div>
        )}

        {loading ? (
          <p style={styles.loadingText}>Loading events...</p>
        ) : filteredEvents.length === 0 ? (
          <p style={styles.loadingText}>
            {feedTab === "following"
              ? "No followed organizations have events right now."
              : "No events in this category yet."}
          </p>
        ) : (
          <div style={styles.feed}>
            {filteredEvents.map((event) => {
              const imageMedia =
                event.media?.filter((item) => item.file_type === "image") || []
              const extraPhotos = Math.max(imageMedia.length - 1, 0)
              const displayDate = getDisplayDate(event.event_date)
              const profileName = getProfileDisplayName(event.profile, event.posted_by)
              const liveNow = isEventLive(event)

              return (
                <Link
                  key={event.id}
                  href={`/events/${event.id}`}
                  style={styles.cardLink}
                >
                  <article style={styles.card}>
                    {imageMedia.length > 0 && (
                      <div style={styles.mobileMediaWrap} className="mobile-media">
                        <SkeletonImage
                          src={imageMedia[0].file_url}
                          alt={event.title}
                          wrapperStyle={styles.mobileHeroImageWrap}
                          style={styles.mobileHeroImage}
                        />
                        <div style={styles.mobileOverlay} />
                        <div style={styles.mobileTopRow}>
                          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                            <span style={{ ...styles.categoryChip, ...getCategoryStyles(event.category) }}>
                              {event.category}
                            </span>
                            {liveNow && <span style={styles.liveBadge}>Live Now</span>}
                          </div>

                          {extraPhotos > 0 && (
                            <span style={styles.photoCountChip}>+{extraPhotos} photos</span>
                          )}
                        </div>
                      </div>
                    )}

                    {imageMedia.length > 0 && (
                      <div style={styles.desktopMediaWrap} className="desktop-media">
                        <div style={styles.desktopGrid}>
                          {[0, 1, 2].map((index) =>
                            imageMedia[index] ? (
                              <SkeletonImage
                                key={index}
                                src={imageMedia[index].file_url}
                                alt={event.title}
                                wrapperStyle={styles.desktopGridImageWrap}
                                style={styles.desktopGridImage}
                              />
                            ) : (
                              <div key={index} style={styles.desktopGridPlaceholder} />
                            )
                          )}
                        </div>

                        <div style={styles.desktopTopRow}>
                          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                            <span style={{ ...styles.categoryChip, ...getCategoryStyles(event.category) }}>
                              {event.category}
                            </span>
                            {liveNow && <span style={styles.liveBadge}>Live Now</span>}
                          </div>

                          {imageMedia.length > 3 && (
                            <span style={styles.photoCountChip}>
                              +{imageMedia.length - 3} more
                            </span>
                          )}
                        </div>
                      </div>
                    )}

                    <div style={styles.cardBody}>
                      <div style={styles.posterRow}>
                        {event.profile?.id ? (
                          <div
                            style={styles.posterLink}
                            onClick={(e) => {
                              e.preventDefault()
                              e.stopPropagation()
                              router.push(`/org/${event.profile!.id}`)
                            }}
                          >
                            {event.profile?.avatar_url ? (
                              <SkeletonImage
                                src={event.profile.avatar_url}
                                alt={profileName}
                                wrapperStyle={styles.posterAvatarWrap}
                                style={styles.posterAvatar}
                              />
                            ) : (
                              <div style={styles.posterAvatarPlaceholder} />
                            )}

                            <div style={{ minWidth: 0 }}>
                              <div style={styles.posterNameRow}>
                                <p style={styles.posterName}>{profileName}</p>
                                {event.profile?.is_verified && (
                                  <span style={styles.verifiedBadge}>Verified</span>
                                )}
                              </div>
                            </div>
                          </div>
                        ) : (
                          <>
                            {event.profile?.avatar_url ? (
                              <SkeletonImage
                                src={event.profile.avatar_url}
                                alt={profileName}
                                wrapperStyle={styles.posterAvatarWrap}
                                style={styles.posterAvatar}
                              />
                            ) : (
                              <div style={styles.posterAvatarPlaceholder} />
                            )}

                            <div style={{ minWidth: 0 }}>
                              <div style={styles.posterNameRow}>
                                <p style={styles.posterName}>{profileName}</p>
                                {event.profile?.is_verified && (
                                  <span style={styles.verifiedBadge}>Verified</span>
                                )}
                              </div>
                            </div>
                          </>
                        )}
                      </div>

                      <h2 style={styles.eventTitle}>{event.title}</h2>

                      {displayDate && <p style={styles.dateText}>{displayDate}</p>}

                      <div style={styles.metaRow}>
                        <span style={styles.metaText}>{event.time}</span>
                        <span style={styles.metaDot}>•</span>
                        <span style={styles.metaText}>{event.location}</span>
                      </div>

                      <p style={styles.description}>{event.description}</p>
                    </div>
                  </article>
                </Link>
              )
            })}
          </div>
        )}

        <style jsx>{`
          .desktop-media {
            display: none;
          }

          .mobile-media {
            display: block;
          }

          @media (min-width: 768px) {
            .desktop-media {
              display: block;
            }

            .mobile-media {
              display: none;
            }
          }

          @media (hover: hover) and (pointer: fine) {
            a:hover article {
              transform: translateY(-4px);
              box-shadow: 0 18px 50px rgba(0, 0, 0, 0.45);
              border-color: rgba(255, 255, 255, 0.12);
            }
          }
        `}</style>
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
    maxWidth: 980,
    margin: "0 auto",
    position: "relative",
    zIndex: 1,
  },
  header: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "flex-end",
    gap: 16,
    marginBottom: 22,
    flexWrap: "wrap",
  },
  logo: {
    fontSize: "clamp(56px, 11vw, 110px)",
    lineHeight: 0.92,
    margin: "0 0 10px 0",
    letterSpacing: "-4px",
    fontWeight: 800,
  },
  tagline: {
    margin: 0,
    color: "rgba(255,255,255,0.68)",
    fontSize: "clamp(18px, 2.2vw, 24px)",
    letterSpacing: "-0.4px",
  },
  postButton: {
    background: "rgba(255,255,255,0.96)",
    color: "#050505",
    padding: "14px 22px",
    borderRadius: 999,
    textDecoration: "none",
    fontWeight: 700,
    boxShadow: "0 10px 30px rgba(255,255,255,0.08)",
    border: "1px solid rgba(255,255,255,0.2)",
  },
  feedTabsRow: {
    display: "flex",
    gap: 10,
    flexWrap: "wrap",
    marginBottom: 14,
  },
  feedTabButton: {
    padding: "10px 14px",
    borderRadius: 999,
    background: "rgba(255,255,255,0.04)",
    border: "1px solid rgba(255,255,255,0.08)",
    color: "rgba(255,255,255,0.75)",
    fontSize: 14,
    fontWeight: 700,
    cursor: "pointer",
    backdropFilter: "blur(12px)",
    boxShadow: "0 8px 22px rgba(0,0,0,0.22)",
  },
  feedTabButtonActive: {
    background: "rgba(255,255,255,0.96)",
    color: "#050505",
    border: "1px solid rgba(255,255,255,0.2)",
  },
  helperText: {
    margin: "0 0 14px 0",
    color: "rgba(255,255,255,0.58)",
    fontSize: 14,
  },
  filtersPanel: {
    marginBottom: 22,
    borderRadius: 22,
    border: "1px solid rgba(255,255,255,0.08)",
    background: "linear-gradient(180deg, rgba(20,20,24,0.96), rgba(10,10,12,0.96))",
    boxShadow: "0 16px 40px rgba(0,0,0,0.32)",
    padding: 16,
    backdropFilter: "blur(18px)",
  },
  filtersPanelHeader: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 12,
    marginBottom: 14,
    flexWrap: "wrap",
  },
  filtersTitle: {
    margin: 0,
    fontSize: 15,
    fontWeight: 700,
    color: "rgba(255,255,255,0.84)",
  },
  clearFiltersButton: {
    padding: "8px 12px",
    borderRadius: 999,
    border: "1px solid rgba(255,255,255,0.10)",
    background: "rgba(255,255,255,0.04)",
    color: "white",
    fontWeight: 700,
    fontSize: 13,
    cursor: "pointer",
  },
  filtersGrid: {
    display: "flex",
    gap: 10,
    flexWrap: "wrap",
    maxHeight: 180,
    overflowY: "auto",
    paddingRight: 4,
  },
  filterChip: {
    padding: "10px 14px",
    borderRadius: 999,
    background: "rgba(255,255,255,0.04)",
    border: "1px solid rgba(255,255,255,0.08)",
    color: "rgba(255,255,255,0.78)",
    fontSize: 13,
    fontWeight: 700,
    cursor: "pointer",
    backdropFilter: "blur(10px)",
  },
  filterChipActive: {
    background: "white",
    color: "#050505",
    border: "1px solid rgba(255,255,255,0.2)",
  },
  loadingText: {
    color: "rgba(255,255,255,0.5)",
    fontSize: 16,
  },
  feed: {
    display: "grid",
    gap: 20,
  },
  cardLink: {
    textDecoration: "none",
    color: "inherit",
    display: "block",
  },
  card: {
    background: "linear-gradient(180deg, rgba(18,18,20,0.98), rgba(10,10,12,0.98))",
    border: "1px solid rgba(255,255,255,0.08)",
    borderRadius: 24,
    overflow: "hidden",
    boxShadow: "0 10px 30px rgba(0,0,0,0.35)",
    transition: "all 180ms ease",
    position: "relative",
  },
  mobileMediaWrap: {
    position: "relative",
  },
  mobileHeroImageWrap: {
    width: "100%",
    height: 240,
  },
  mobileHeroImage: {
    width: "100%",
    height: 240,
    objectFit: "cover",
    display: "block",
  },
  mobileOverlay: {
    position: "absolute",
    inset: 0,
    background: "linear-gradient(to top, rgba(0,0,0,0.55), rgba(0,0,0,0.08))",
    pointerEvents: "none",
  },
  mobileTopRow: {
    position: "absolute",
    left: 14,
    right: 14,
    top: 14,
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 10,
    flexWrap: "wrap",
  },
  desktopMediaWrap: {
    position: "relative",
    padding: 14,
    paddingBottom: 0,
  },
  desktopGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(3, 1fr)",
    gap: 10,
  },
  desktopGridImageWrap: {
    width: "100%",
    height: 180,
    borderRadius: 18,
  },
  desktopGridImage: {
    width: "100%",
    height: 180,
    objectFit: "cover",
    borderRadius: 18,
    display: "block",
  },
  desktopGridPlaceholder: {
    height: 180,
    borderRadius: 18,
    background: "rgba(255,255,255,0.03)",
  },
  desktopTopRow: {
    position: "absolute",
    left: 28,
    right: 28,
    top: 28,
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 10,
    pointerEvents: "none",
  },
  categoryChip: {
    padding: "8px 12px",
    borderRadius: 999,
    fontSize: 12,
    fontWeight: 700,
    backdropFilter: "blur(10px)",
  },
  liveBadge: {
    padding: "8px 12px",
    borderRadius: 999,
    background: "rgba(255, 70, 110, 0.18)",
    border: "1px solid rgba(255, 70, 110, 0.35)",
    color: "#ffd6e2",
    fontSize: 12,
    fontWeight: 700,
    backdropFilter: "blur(10px)",
  },
  photoCountChip: {
    padding: "8px 12px",
    borderRadius: 999,
    background: "rgba(255,255,255,0.12)",
    color: "white",
    fontSize: 12,
    fontWeight: 700,
    border: "1px solid rgba(255,255,255,0.12)",
    backdropFilter: "blur(10px)",
  },
  cardBody: {
    padding: "18px 18px 20px",
  },
  posterRow: {
    display: "flex",
    alignItems: "center",
    gap: 10,
    marginBottom: 14,
  },
  posterLink: {
    display: "flex",
    alignItems: "center",
    gap: 10,
    textDecoration: "none",
    color: "inherit",
    cursor: "pointer",
  },
  posterAvatarWrap: {
    width: 40,
    height: 40,
    borderRadius: "50%",
    flexShrink: 0,
  },
  posterAvatar: {
    width: 40,
    height: 40,
    borderRadius: "50%",
    objectFit: "cover",
    border: "1px solid rgba(255,255,255,0.10)",
    flexShrink: 0,
  },
  posterAvatarPlaceholder: {
    width: 40,
    height: 40,
    borderRadius: "50%",
    background: "rgba(255,255,255,0.08)",
    border: "1px solid rgba(255,255,255,0.08)",
    flexShrink: 0,
  },
  posterNameRow: {
    display: "flex",
    alignItems: "center",
    gap: 8,
    flexWrap: "wrap",
  },
  posterName: {
    margin: 0,
    color: "rgba(255,255,255,0.9)",
    fontSize: 14,
    fontWeight: 700,
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
  eventTitle: {
    margin: "0 0 10px 0",
    fontSize: "clamp(28px, 4vw, 36px)",
    lineHeight: 1.02,
    letterSpacing: "-1.2px",
    fontWeight: 800,
    wordBreak: "break-word",
    overflowWrap: "anywhere",
  },
  dateText: {
    margin: "0 0 10px 0",
    color: "rgba(255,255,255,0.72)",
    fontSize: 14,
    fontWeight: 700,
    letterSpacing: "0.2px",
  },
  metaRow: {
    display: "flex",
    alignItems: "center",
    gap: 8,
    flexWrap: "wrap",
    marginBottom: 10,
  },
  metaText: {
    color: "rgba(255,255,255,0.82)",
    fontSize: 16,
  },
  metaDot: {
    color: "rgba(255,255,255,0.28)",
  },
  description: {
    margin: 0,
    color: "rgba(255,255,255,0.88)",
    lineHeight: 1.55,
    fontSize: 15,
    wordBreak: "break-word",
    overflowWrap: "anywhere",
    display: "-webkit-box",
    WebkitLineClamp: 2,
    WebkitBoxOrient: "vertical",
    overflow: "hidden",
  },
}
