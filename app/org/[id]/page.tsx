"use client"

import Link from "next/link"
import { useEffect, useMemo, useState } from "react"
import { useParams, useRouter } from "next/navigation"
import { supabase } from "@/lib/supabase"
import SkeletonImage from "@/components/SkeletonImage"
import { isEventArchived } from "@/lib/eventStatus"
import { createReport } from "@/lib/reporting"
import { useToast } from "@/components/Toast"

type ProfileItem = {
  id: string
  username: string | null
  display_name: string | null
  organization_name: string | null
  avatar_url: string | null
  banner_url: string | null
  bio: string | null
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
  if (!profile) return "Organization"
  return (
    profile.organization_name ||
    profile.display_name ||
    profile.username ||
    "Organization"
  )
}

export default function OrgPage() {
  const params = useParams()
  const router = useRouter()
  const toast = useToast()

  const rawId = useMemo(() => {
    const value = params?.id
    return Array.isArray(value) ? value[0] : value
  }, [params])

  const [loading, setLoading] = useState(true)
  const [profile, setProfile] = useState<ProfileItem | null>(null)
  const [events, setEvents] = useState<EventItem[]>([])


  const [currentUserId, setCurrentUserId] = useState<string | null>(null)
  const [isFollowing, setIsFollowing] = useState(false)
  const [followersCount, setFollowersCount] = useState(0)

  useEffect(() => {
    const fetchOrg = async () => {
      if (!rawId) {
        console.error("Invalid org id")
        setLoading(false)
        return
      }

      setLoading(true)

      const { data: userData } = await supabase.auth.getUser()
      const user = userData.user
      setCurrentUserId(user?.id || null)

      const { data: profileData, error: profileError } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", rawId)
        .maybeSingle()

      if (profileError) {
        console.error("Profile fetch error:", profileError.message || profileError)
        setLoading(false)
        return
      }

      if (!profileData) {
        console.error("Profile fetch error: No organization found")
        setLoading(false)
        return
      }

      // Single query: fetch this org's events WITH their media attached.
      // Previously we loaded ALL media in the database and filtered client-side.
      const { data: eventsData, error: eventsError } = await supabase
        .from("events")
        .select(`
          *,
          media:event_media(*)
        `)
        .eq("profile_id", rawId)
        .order("id", { ascending: false })

      if (eventsError) {
        console.error("Events fetch error:", eventsError.message || eventsError)
      }

      // Count-only query — no rows transferred.
      const { count: followerCount, error: followersError } = await supabase
        .from("follows")
        .select("*", { count: "exact", head: true })
        .eq("following_id", rawId)

      if (followersError) {
        console.error("Followers fetch error:", followersError.message || followersError)
      }

      setFollowersCount(followerCount || 0)

      if (user?.id) {
        const { data: followRow, error: followError } = await supabase
          .from("follows")
          .select("follower_id")
          .eq("follower_id", user.id)
          .eq("following_id", rawId)
          .maybeSingle()

        if (followError) {
          console.error("Follow state error:", followError.message || followError)
        }

        setIsFollowing(!!followRow)
      }

      setProfile(profileData)
      setEvents((eventsData || []) as EventItem[])
      setLoading(false)
    }

    fetchOrg()
  }, [rawId])

  const handleFollowToggle = async () => {
    if (!rawId) return

    if (!currentUserId) {
      router.push("/auth")
      return
    }

    if (currentUserId === rawId) {
      toast.error("You can't follow your own profile.")
      return
    }

    // Optimistic update: flip UI immediately, roll back on server error.
    const wasFollowing = isFollowing
    setIsFollowing(!wasFollowing)
    setFollowersCount((prev) =>
      wasFollowing ? Math.max(prev - 1, 0) : prev + 1
    )

    if (wasFollowing) {
      const { error } = await supabase
        .from("follows")
        .delete()
        .eq("follower_id", currentUserId)
        .eq("following_id", rawId)

      if (error) {
        console.error(error)
        // Roll back
        setIsFollowing(true)
        setFollowersCount((prev) => prev + 1)
        toast.error("There was an error unfollowing.")
      }
      return
    }

    const { error } = await supabase.from("follows").insert([
      {
        follower_id: currentUserId,
        following_id: rawId,
      },
    ])

    if (error) {
      console.error(error)
      // Roll back
      setIsFollowing(false)
      setFollowersCount((prev) => Math.max(prev - 1, 0))
      toast.error("There was an error following this organization.")
    }
  }

  const handleReportProfile = async () => {
    if (!rawId) return

    if (!currentUserId) {
      router.push("/auth")
      return
    }

    const reason = window.prompt(
      "What are you reporting this profile for?",
      "Spam or impersonation"
    )

    if (!reason?.trim()) return

    try {
      await createReport({
        reporterProfileId: currentUserId,
        targetType: "profile",
        targetProfileId: rawId,
        reason: reason.trim(),
      })
      toast.success("Report submitted.")
    } catch (error) {
      console.error(error)
      toast.error("There was an error submitting your report.")
    }
  }

  if (loading) {
    return (
      <main style={styles.page}>
        <div style={styles.container}>
          <p style={styles.helperText}>Loading organization...</p>
        </div>
      </main>
    )
  }

  if (!profile) {
    return (
      <main style={styles.page}>
        <div style={styles.container}>
          <Link href="/" style={styles.backLink}>
            ← Back
          </Link>
          <h1 style={styles.title}>Organization not found.</h1>
        </div>
      </main>
    )
  }

  const profileName = getProfileDisplayName(profile)
  const isOwnProfile = currentUserId === profile.id
  const currentEvents = events.filter((event) => !isEventArchived(event))
  const pastEvents = events.filter((event) => isEventArchived(event))

  return (
    <main style={styles.page}>
      <div style={styles.container}>
        <Link href="/" style={styles.backLink}>
          ← Back
        </Link>

        <section style={styles.heroCard}>
          <div style={styles.heroBannerSection}>
            {profile.banner_url ? (
              <SkeletonImage
                src={profile.banner_url}
                alt={`${profileName} banner`}
                wrapperStyle={styles.heroBannerImageWrap}
                style={styles.heroBannerImage}
              />
            ) : (
              <div style={styles.heroBannerPlaceholder} />
            )}
            <div style={styles.heroBannerOverlay} />
          </div>
          <div style={styles.heroBlendBand} />

          <div style={styles.heroTitleBlock}>
            <div style={styles.nameRow}>
              <h1 style={styles.name}>{profileName}</h1>
              {profile.is_verified && (
                <span style={styles.verifiedBadge}>Verified</span>
              )}
            </div>

            {profile.username && <p style={styles.meta}>@{profile.username}</p>}
          </div>

          <div style={styles.heroInfoRow}>
            {profile.avatar_url ? (
              <SkeletonImage
                src={profile.avatar_url}
                alt={profileName}
                wrapperStyle={styles.avatarImageWrap}
                style={styles.avatarImage}
              />
            ) : (
              <div style={styles.avatarPlaceholder} />
            )}

            <div style={styles.heroContent}>
              <div style={styles.statRow}>
                <span style={styles.statPill}>
                  {followersCount} follower{followersCount === 1 ? "" : "s"}
                </span>
                <span style={styles.statPill}>
                  {events.length} event{events.length === 1 ? "" : "s"}
                </span>
                <span style={styles.statPill}>
                  {profile.account_type === "organization" ? "Organization" : "User"}
                </span>
              </div>

              {profile.bio && <p style={styles.bio}>{profile.bio}</p>}

              {!isOwnProfile && (
                <div style={{ marginTop: "16px" }}>
                  <button
                    onClick={handleFollowToggle}
                    style={{
                      ...styles.followButton,
                      ...(isFollowing ? styles.followingButton : {}),
                    }}
                  >
                    {isFollowing ? "Following" : "Follow"}
                  </button>
                  <button onClick={handleReportProfile} style={styles.reportButton}>
                    Report Profile
                  </button>
                </div>
              )}
            </div>
          </div>
        </section>

        <section style={styles.card}>
          <div style={styles.sectionHeader}>
            <h2 style={styles.sectionTitle}>Current Events</h2>
            <span style={styles.countPill}>{currentEvents.length}</span>
          </div>

          {currentEvents.length === 0 ? (
            <p style={styles.meta}>No active events right now.</p>
          ) : (
            <div style={styles.feed}>
              {currentEvents.map((event) => {
                const firstImage = event.media?.find(
                  (item) => item.file_type === "image"
                )

                return (
                  <Link
                    key={event.id}
                    href={`/events/${event.id}`}
                  style={styles.eventCardLink}
                >
                  <div style={styles.eventCard}>
                    {firstImage && (
                      <SkeletonImage
                        src={firstImage.file_url}
                        alt={event.title}
                        wrapperStyle={styles.eventImageWrap}
                        style={styles.eventImage}
                      />
                    )}

                      <div style={styles.eventBody}>
                        <span
                          style={{
                            ...styles.categoryChip,
                            ...getCategoryStyles(event.category),
                          }}
                        >
                          {event.category}
                        </span>

                        <h3 style={styles.eventTitle}>{event.title}</h3>
                        <p style={styles.eventMeta}>{event.time}</p>
                        <p style={styles.eventMeta}>{event.location}</p>
                      </div>
                    </div>
                  </Link>
                )
              })}
            </div>
          )}
        </section>

        <section style={styles.card}>
          <div style={styles.sectionHeader}>
            <h2 style={styles.sectionTitle}>Past Events</h2>
            <span style={styles.countPill}>{pastEvents.length}</span>
          </div>

          {pastEvents.length === 0 ? (
            <p style={styles.meta}>No past events yet.</p>
          ) : (
            <div style={styles.feed}>
              {pastEvents.map((event) => {
                const firstImage = event.media?.find(
                  (item) => item.file_type === "image"
                )

                return (
                  <Link
                    key={event.id}
                    href={`/events/${event.id}`}
                    style={styles.eventCardLink}
                  >
                    <div style={styles.eventCard}>
                      {firstImage && (
                        <SkeletonImage
                          src={firstImage.file_url}
                          alt={event.title}
                          wrapperStyle={styles.eventImageWrap}
                          style={styles.eventImage}
                        />
                      )}

                      <div style={styles.eventBody}>
                        <span
                          style={{
                            ...styles.categoryChip,
                            ...getCategoryStyles(event.category),
                          }}
                        >
                          {event.category}
                        </span>

                        <h3 style={styles.eventTitle}>{event.title}</h3>
                        <p style={styles.eventMeta}>{event.time}</p>
                        <p style={styles.eventMeta}>{event.location}</p>
                      </div>
                    </div>
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
    maxWidth: 980,
    margin: "0 auto",
  },
  backLink: {
    color: "rgba(255,255,255,0.62)",
    textDecoration: "none",
    display: "inline-block",
    marginBottom: 18,
    fontSize: 15,
  },
  helperText: {
    color: "rgba(255,255,255,0.62)",
    fontSize: 16,
  },
  title: {
    fontSize: "clamp(44px, 8vw, 82px)",
    lineHeight: 0.95,
    margin: 0,
    letterSpacing: "-3px",
    fontWeight: 800,
  },
  heroCard: {
    borderRadius: 28,
    border: "1px solid rgba(255,255,255,0.08)",
    background: "linear-gradient(180deg, rgba(18,18,20,0.98), rgba(10,10,12,0.98))",
    boxShadow: "0 10px 30px rgba(0,0,0,0.35)",
    marginBottom: 18,
    position: "relative",
    overflow: "hidden",
  },
  heroBannerSection: {
    position: "relative",
    height: 180,
  },
  heroBannerImageWrap: {
    width: "100%",
    height: "100%",
  },
  heroBannerImage: {
    width: "100%",
    height: "100%",
    objectFit: "cover",
    display: "block",
  },
  heroBannerPlaceholder: {
    width: "100%",
    height: "100%",
    background:
      "linear-gradient(135deg, rgba(92,120,255,0.18), rgba(255,255,255,0.03))",
  },
  heroBannerOverlay: {
    position: "absolute",
    inset: 0,
    background:
      "linear-gradient(180deg, rgba(10,10,12,0.12), rgba(10,10,12,0.46) 68%, rgba(10,10,12,0.72))",
  },
  heroBlendBand: {
    height: 1,
    margin: "0 18px",
    position: "relative",
    zIndex: 1,
    background: "linear-gradient(90deg, rgba(255,255,255,0), rgba(255,255,255,0.14), rgba(255,255,255,0))",
    boxShadow: "0 0 18px rgba(255,255,255,0.05)",
    opacity: 0.9,
  },
  heroTitleBlock: {
    padding: "18px 22px 12px",
  },
  heroInfoRow: {
    display: "flex",
    alignItems: "flex-start",
    gap: 18,
    padding: "0 22px 22px",
    position: "relative",
    zIndex: 1,
    flexWrap: "wrap",
  },
  heroContent: {
    flex: 1,
    minWidth: 0,
  },
  avatarImageWrap: {
    width: 96,
    height: 96,
    borderRadius: "50%",
    flexShrink: 0,
    border: "3px solid rgba(10,10,12,0.96)",
    boxShadow: "0 12px 30px rgba(0,0,0,0.35)",
    marginTop: -12,
  },
  avatarPlaceholder: {
    width: 96,
    height: 96,
    borderRadius: "50%",
    background: "rgba(255,255,255,0.08)",
    border: "1px solid rgba(255,255,255,0.08)",
    flexShrink: 0,
    boxShadow: "0 12px 30px rgba(0,0,0,0.35)",
    marginTop: -12,
  },
  avatarImage: {
    width: 96,
    height: 96,
    borderRadius: "50%",
    objectFit: "cover",
    border: "1px solid rgba(255,255,255,0.10)",
    flexShrink: 0,
  },
  nameRow: {
    display: "flex",
    alignItems: "center",
    gap: 10,
    flexWrap: "wrap",
    marginBottom: 6,
  },
  name: {
    margin: 0,
    fontSize: "clamp(36px, 6vw, 58px)",
    fontWeight: 800,
    letterSpacing: "-2px",
  },
  verifiedBadge: {
    padding: "7px 11px",
    borderRadius: 999,
    background: "rgba(92,120,255,0.18)",
    border: "1px solid rgba(92,120,255,0.35)",
    color: "#dbe4ff",
    fontSize: 12,
    fontWeight: 700,
  },
  meta: {
    margin: "0 0 4px 0",
    color: "rgba(255,255,255,0.66)",
    fontSize: 15,
  },
  statRow: {
    display: "flex",
    gap: 10,
    flexWrap: "wrap",
  },
  statPill: {
    padding: "9px 14px",
    borderRadius: 999,
    background: "rgba(255,255,255,0.07)",
    border: "1px solid rgba(255,255,255,0.08)",
    color: "rgba(255,255,255,0.8)",
    fontSize: 14,
    fontWeight: 700,
  },
  bio: {
    margin: "12px 0 0 0",
    color: "rgba(255,255,255,0.82)",
    lineHeight: 1.6,
    fontSize: 15,
  },
  followButton: {
    padding: "14px 20px",
    borderRadius: 999,
    border: "1px solid rgba(255,255,255,0.18)",
    background: "rgba(255,255,255,0.96)",
    color: "#050505",
    fontWeight: 800,
    fontSize: 15,
    cursor: "pointer",
  },
  followingButton: {
    background: "rgba(255,255,255,0.08)",
    color: "white",
    border: "1px solid rgba(255,255,255,0.10)",
  },
  reportButton: {
    marginLeft: 10,
    padding: "14px 20px",
    borderRadius: 999,
    border: "1px solid rgba(255,255,255,0.10)",
    background: "rgba(255,255,255,0.04)",
    color: "rgba(255,255,255,0.82)",
    fontWeight: 700,
    fontSize: 15,
    cursor: "pointer",
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
    fontSize: 26,
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
  feed: {
    display: "grid",
    gap: 16,
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
    marginBottom: 12,
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
}
