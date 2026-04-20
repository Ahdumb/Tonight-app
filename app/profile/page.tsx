"use client"

import Link from "next/link"
import { useEffect, useMemo, useState } from "react"
import { useRouter } from "next/navigation"
import { supabase } from "@/lib/supabase"
import ImageCropModal from "@/components/ImageCropModal"
import SkeletonImage from "@/components/SkeletonImage"
import { isEventArchived } from "@/lib/eventStatus"
import { useToast } from "@/components/Toast"
import {
  getUsernameErrorMessage,
  isValidUsername,
  normalizeUsername,
} from "@/lib/username"

type Profile = {
  id: string
  email: string
  username: string | null
  display_name: string | null
  organization_name: string | null
  avatar_url: string | null
  banner_url: string | null
  bio: string | null
  account_type: string | null
  is_verified: boolean | null
}

type MediaItem = {
  event_id: number
  file_url: string
  file_type: string
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

function getDisplayTitle(profile: Profile | null, values: {
  username: string
  displayName: string
  organizationName: string
}) {
  const isOrganization = profile?.account_type === "organization"

  return (
    (isOrganization ? values.organizationName : values.displayName) ||
    values.username ||
    "Profile"
  )
}

export default function ProfilePage() {
  const router = useRouter()
  const toast = useToast()

  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [editOpen, setEditOpen] = useState(false)
  const [userId, setUserId] = useState("")
  const [profile, setProfile] = useState<Profile | null>(null)
  const [events, setEvents] = useState<EventItem[]>([])
  const [followersCount, setFollowersCount] = useState(0)

  const [email, setEmail] = useState("")
  const [username, setUsername] = useState("")
  const [displayName, setDisplayName] = useState("")
  const [organizationName, setOrganizationName] = useState("")
  const [bio, setBio] = useState("")
  const [avatarUrl, setAvatarUrl] = useState("")
  const [bannerUrl, setBannerUrl] = useState("")

  const [avatarCropOpen, setAvatarCropOpen] = useState(false)
  const [avatarTempSrc, setAvatarTempSrc] = useState("")
  const [bannerCropOpen, setBannerCropOpen] = useState(false)
  const [bannerTempSrc, setBannerTempSrc] = useState("")
  const [avatarFileLabel, setAvatarFileLabel] = useState("No file selected")
  const [bannerFileLabel, setBannerFileLabel] = useState("No file selected")

  useEffect(() => {
    const fetchProfile = async () => {
      const { data: userData } = await supabase.auth.getUser()
      const user = userData.user

      if (!user) {
        router.push("/auth")
        return
      }

      setUserId(user.id)
      setEmail(user.email || "")

      const [{ data: profileData, error: profileError }, { data: eventsData, error: eventsError }, { count: followerCount, error: followersError }] =
        await Promise.all([
          supabase.from("profiles").select("*").eq("id", user.id).maybeSingle(),
          supabase
            .from("events")
            .select(`
              *,
              media:event_media(*)
            `)
            .eq("profile_id", user.id)
            .order("id", { ascending: false }),
          supabase
            .from("follows")
            .select("*", { count: "exact", head: true })
            .eq("following_id", user.id),
        ])

      if (profileError) {
        console.error(profileError)
      }

      if (eventsError) {
        console.error("Profile events fetch error:", eventsError.message || eventsError)
      }

      if (followersError) {
        console.error("Followers fetch error:", followersError.message || followersError)
      }

      if (profileData) {
        setProfile(profileData)
        setUsername(profileData.username || "")
        setDisplayName(profileData.display_name || "")
        setOrganizationName(profileData.organization_name || "")
        setBio(profileData.bio || "")
        setAvatarUrl(profileData.avatar_url || "")
        setBannerUrl(profileData.banner_url || "")
      }

      setEvents((eventsData || []) as EventItem[])
      setFollowersCount(followerCount || 0)
      setLoading(false)
    }

    fetchProfile()
  }, [router])

  const saveProfileMedia = async (
    field: "avatar_url" | "banner_url",
    url: string,
    errorMessage: string
  ) => {
    if (!userId) return false

    const { error } = await supabase
      .from("profiles")
      .update({ [field]: url })
      .eq("id", userId)

    if (error) {
      console.error(error)
      toast.error(errorMessage)
      return false
    }

    setProfile((prev) =>
      prev
        ? {
            ...prev,
            [field]: url,
          }
        : prev
    )

    return true
  }

  const handleAvatarUploadSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    setAvatarFileLabel(file.name)
    setAvatarTempSrc(URL.createObjectURL(file))
    setAvatarCropOpen(true)
  }

  const handleAvatarCropped = async (croppedFile: File) => {
    if (!userId) return

    const filePath = `${userId}/avatar-${Date.now()}-${croppedFile.name}`
    const { error: uploadError } = await supabase.storage
      .from("avatars")
      .upload(filePath, croppedFile)

    if (uploadError) {
      console.error(uploadError)
      toast.error("There was an error uploading the image.")
      return
    }

    const { data } = supabase.storage.from("avatars").getPublicUrl(filePath)
    const saved = await saveProfileMedia(
      "avatar_url",
      data.publicUrl,
      "There was an error saving your profile picture."
    )

    if (!saved) return

    setAvatarUrl(data.publicUrl)
    setAvatarCropOpen(false)
    setAvatarTempSrc("")
    toast.success("Profile picture updated.")
  }

  const handleBannerUploadSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    setBannerFileLabel(file.name)
    setBannerTempSrc(URL.createObjectURL(file))
    setBannerCropOpen(true)
  }

  const handleBannerCropped = async (croppedFile: File) => {
    if (!userId) return

    const filePath = `${userId}/banner-${Date.now()}-${croppedFile.name}`
    const { error: uploadError } = await supabase.storage
      .from("banners")
      .upload(filePath, croppedFile)

    if (uploadError) {
      console.error(uploadError)
      toast.error("There was an error uploading the banner.")
      return
    }

    const { data } = supabase.storage.from("banners").getPublicUrl(filePath)
    const saved = await saveProfileMedia(
      "banner_url",
      data.publicUrl,
      "There was an error saving your featured banner."
    )

    if (!saved) return

    setBannerUrl(data.publicUrl)
    setBannerCropOpen(false)
    setBannerTempSrc("")
    toast.success("Featured banner updated.")
  }

  const handleSave = async () => {
    if (!userId) return

    const normalizedUsername = normalizeUsername(username)

    if (!normalizedUsername) {
      toast.error("Please choose a username.")
      return
    }

    if (!isValidUsername(normalizedUsername)) {
      toast.error("Usernames can only contain letters, numbers, and periods.")
      return
    }

    setSaving(true)

    const updates = {
      username: normalizedUsername || null,
      display_name: displayName || null,
      organization_name: organizationName || null,
      bio: bio || null,
      avatar_url: avatarUrl || null,
      banner_url: bannerUrl || null,
    }

    const { error } = await supabase
      .from("profiles")
      .update(updates)
      .eq("id", userId)

    setSaving(false)

    if (error) {
      console.error(error)
      toast.error(
        getUsernameErrorMessage(error) || "There was an error saving your profile."
      )
      return
    }

    toast.success("Profile updated.")
    setProfile((prev) => (prev ? { ...prev, ...updates } : prev))
    setEditOpen(false)
  }

  const handleSignOut = async () => {
    await supabase.auth.signOut()
    router.push("/auth")
  }

  const currentEvents = useMemo(
    () => events.filter((event) => !isEventArchived(event)),
    [events]
  )
  const pastEvents = useMemo(
    () => events.filter((event) => isEventArchived(event)),
    [events]
  )

  if (loading) {
    return (
      <main style={styles.page}>
        <div style={styles.container}>
          <p style={styles.meta}>Loading profile...</p>
        </div>
      </main>
    )
  }

  const isOrganization = profile?.account_type === "organization"
  const displayTitle = getDisplayTitle(profile, {
    username,
    displayName,
    organizationName,
  })

  return (
    <main style={styles.page}>
      <div style={styles.container}>
        <div style={styles.headerBlock}>
          <div style={styles.headerTopRow}>
            <div style={styles.headerIntro}>
              <div style={styles.sectionPill}>Profile</div>
              <h1 style={styles.title}>Profile</h1>
              <p style={styles.subtitle}>
                {isOrganization
                  ? "See your organization page the way everyone else does."
                  : "See your account at a glance and edit it only when you need to."}
              </p>
            </div>

            <button
              type="button"
              onClick={handleSignOut}
              style={styles.headerSignOutButton}
              className="profile-header-signout"
            >
              Sign Out
            </button>
          </div>
        </div>

        <section style={styles.heroCard}>
          {isOrganization ? (
            <>
              <div style={styles.heroBannerSection}>
                {bannerUrl ? (
                  <SkeletonImage
                    src={bannerUrl}
                    alt={`${displayTitle} banner`}
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
                  <h2 style={styles.name}>{displayTitle}</h2>
                  {profile?.is_verified && (
                    <span style={styles.verifiedBadge}>Verified</span>
                  )}
                </div>

                {username && <p style={styles.meta}>@{username}</p>}
              </div>

              <div style={styles.heroInfoRow} className="profile-hero-info">
                {avatarUrl ? (
                  <SkeletonImage
                    src={avatarUrl}
                    alt={displayTitle}
                    wrapperStyle={styles.avatarImageWrapLarge}
                    style={styles.avatarImageLarge}
                  />
                ) : (
                  <div style={styles.avatarPlaceholderLarge} />
                )}

                <div style={styles.heroContent}>
                  <div style={styles.statRow}>
                    <span style={styles.statPill}>
                      {followersCount} follower{followersCount === 1 ? "" : "s"}
                    </span>
                    <span style={styles.statPill}>
                      {events.length} event{events.length === 1 ? "" : "s"}
                    </span>
                    <span style={styles.statPill}>Organization</span>
                  </div>

                  {bio && <p style={styles.bioPreview}>{bio}</p>}
                </div>
              </div>
            </>
          ) : (
            <div style={styles.userHeroBody} className="profile-user-hero">
              {avatarUrl ? (
                <SkeletonImage
                  src={avatarUrl}
                  alt={displayTitle}
                  wrapperStyle={styles.avatarImageWrap}
                  style={styles.avatarImage}
                />
              ) : (
                <div style={styles.avatarPlaceholder} />
              )}

              <div style={styles.heroContent}>
                <div style={styles.nameRow}>
                  <h2 style={styles.name}>{displayTitle}</h2>
                  {profile?.is_verified && (
                    <span style={styles.verifiedBadge}>Verified</span>
                  )}
                </div>

                {username && <p style={styles.meta}>@{username}</p>}
                <p style={styles.meta}>{email}</p>

                <div style={styles.statRow}>
                  <span style={styles.statPill}>
                    {followersCount} follower{followersCount === 1 ? "" : "s"}
                  </span>
                  <span style={styles.statPill}>User account</span>
                </div>
              </div>
            </div>
          )}
        </section>

        <section style={styles.card}>
          <div style={styles.actionsRow} className="profile-actions">
            <button
              type="button"
              onClick={() => setEditOpen((prev) => !prev)}
              style={styles.primaryButton}
            >
              {editOpen ? "Close Editor" : "Edit Profile"}
            </button>

            {isOrganization && userId && (
              <Link href={`/org/${userId}`} style={styles.secondaryLinkButton}>
                Open Public Page
              </Link>
            )}
          </div>
        </section>

        <section style={styles.card}>
          <div style={styles.sectionHeader}>
            <h2 style={styles.sectionTitle}>Current Events</h2>
            <span style={styles.countPill}>{currentEvents.length}</span>
          </div>

          {currentEvents.length === 0 ? (
            <p style={styles.meta}>
              {isOrganization ? "No active events right now." : "No events posted yet."}
            </p>
          ) : (
            <div style={styles.feed}>
              {currentEvents.map((event) => {
                const firstImage = event.media?.find((item) => item.file_type === "image")

                return (
                  <Link key={event.id} href={`/events/${event.id}`} style={styles.eventCardLink}>
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

        {pastEvents.length > 0 && (
          <section style={styles.card}>
            <div style={styles.sectionHeader}>
              <h2 style={styles.sectionTitle}>Past Events</h2>
              <span style={styles.countPill}>{pastEvents.length}</span>
            </div>

            <div style={styles.feed}>
              {pastEvents.map((event) => {
                const firstImage = event.media?.find((item) => item.file_type === "image")

                return (
                  <Link key={event.id} href={`/events/${event.id}`} style={styles.eventCardLink}>
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
          </section>
        )}

        {editOpen && (
          <section style={styles.card}>
            <h2 style={styles.sectionTitle}>Edit Profile</h2>

            <div style={styles.formGrid}>
              <div style={styles.fieldGroup}>
                <label style={styles.label}>Profile picture</label>
                <label style={styles.filePickerButton}>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleAvatarUploadSelect}
                    style={styles.hiddenFileInput}
                  />
                  <span>Choose Profile Picture</span>
                </label>
                <p style={styles.fileMetaText}>{avatarFileLabel}</p>
              </div>

              <div style={styles.fieldGroup}>
                <label style={styles.label}>Username</label>
                <input
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(normalizeUsername(e.target.value))}
                  placeholder="@username"
                  style={styles.input}
                />
                <p style={styles.fileMetaText}>
                  Use only letters, numbers, and periods.
                </p>
              </div>

              {!isOrganization && (
                <div style={styles.fieldGroup}>
                  <label style={styles.label}>Display name</label>
                  <input
                    type="text"
                    value={displayName}
                    onChange={(e) => setDisplayName(e.target.value)}
                    placeholder="Your name"
                    style={styles.input}
                  />
                </div>
              )}

              {isOrganization && (
                <>
                  <div style={styles.fieldGroupFull}>
                    <label style={styles.label}>Featured banner</label>
                    <label style={styles.filePickerButton}>
                      <input
                        type="file"
                        accept="image/*"
                        onChange={handleBannerUploadSelect}
                        style={styles.hiddenFileInput}
                      />
                      <span>Choose Featured Banner</span>
                    </label>
                    <p style={styles.fileMetaText}>{bannerFileLabel}</p>
                    <p style={styles.helperText}>
                      Upload a wide cover photo for your organization profile.
                    </p>
                  </div>

                  <div style={styles.fieldGroup}>
                    <label style={styles.label}>Organization name</label>
                    <input
                      type="text"
                      value={organizationName}
                      onChange={(e) => setOrganizationName(e.target.value)}
                      placeholder="Organization name"
                      style={styles.input}
                    />
                  </div>

                  <div style={styles.fieldGroupFull}>
                    <label style={styles.label}>Description</label>
                    <textarea
                      value={bio}
                      onChange={(e) => setBio(e.target.value)}
                      placeholder="Tell people who you are."
                      rows={5}
                      style={styles.textarea}
                    />
                  </div>
                </>
              )}
            </div>

            <div style={styles.buttonRow}>
              <button
                onClick={handleSave}
                disabled={saving}
                style={{
                  ...styles.primaryButton,
                  opacity: saving ? 0.7 : 1,
                }}
              >
                {saving ? "Saving..." : "Save Profile"}
              </button>

              <button
                type="button"
                onClick={() => setEditOpen(false)}
                style={styles.secondaryButton}
              >
                Cancel
              </button>
            </div>
          </section>
        )}
      </div>

      <ImageCropModal
        open={avatarCropOpen}
        imageSrc={avatarTempSrc}
        aspect={1 / 1}
        title="Crop profile picture"
        onClose={() => {
          setAvatarCropOpen(false)
          setAvatarTempSrc("")
        }}
        onDone={(croppedFile) => handleAvatarCropped(croppedFile)}
      />

      <ImageCropModal
        open={bannerCropOpen}
        imageSrc={bannerTempSrc}
        aspect={16 / 5}
        title="Crop featured banner"
        onClose={() => {
          setBannerCropOpen(false)
          setBannerTempSrc("")
        }}
        onDone={(croppedFile) => handleBannerCropped(croppedFile)}
      />

      <style jsx>{`
        @media (max-width: 640px) {
          .profile-header-signout {
            width: auto;
          }

          .profile-hero-info {
            gap: 14px;
            padding: 0 18px 18px;
          }

          .profile-user-hero {
            gap: 14px;
            padding: 18px;
          }

          .profile-actions {
            display: grid;
            grid-template-columns: 1fr;
          }
        }
      `}</style>
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
    maxWidth: 920,
    margin: "0 auto",
  },
  headerBlock: {
    marginBottom: 24,
  },
  headerTopRow: {
    display: "flex",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 14,
  },
  headerIntro: {
    flex: 1,
    minWidth: 0,
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
  headerSignOutButton: {
    padding: "12px 16px",
    borderRadius: 999,
    border: "1px solid rgba(255,255,255,0.08)",
    background: "rgba(255,255,255,0.03)",
    color: "white",
    fontWeight: 700,
    fontSize: 14,
    cursor: "pointer",
    flexShrink: 0,
  },
  heroCard: {
    borderRadius: 28,
    border: "1px solid rgba(255,255,255,0.08)",
    background: "linear-gradient(180deg, rgba(18,18,20,0.98), rgba(10,10,12,0.98))",
    boxShadow: "0 10px 30px rgba(0,0,0,0.35)",
    marginBottom: 18,
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
  userHeroBody: {
    display: "flex",
    alignItems: "center",
    gap: 18,
    padding: 22,
    flexWrap: "wrap",
  },
  heroContent: {
    flex: 1,
    minWidth: 0,
  },
  avatarImageWrapLarge: {
    width: 96,
    height: 96,
    borderRadius: "50%",
    flexShrink: 0,
    border: "3px solid rgba(10,10,12,0.96)",
    boxShadow: "0 12px 30px rgba(0,0,0,0.35)",
    marginTop: -12,
  },
  avatarPlaceholderLarge: {
    width: 96,
    height: 96,
    borderRadius: "50%",
    background: "rgba(255,255,255,0.08)",
    border: "1px solid rgba(255,255,255,0.08)",
    flexShrink: 0,
    boxShadow: "0 12px 30px rgba(0,0,0,0.35)",
  },
  avatarImageLarge: {
    width: 96,
    height: 96,
    borderRadius: "50%",
    objectFit: "cover",
    display: "block",
  },
  avatarImageWrap: {
    width: 90,
    height: 90,
    borderRadius: "50%",
    flexShrink: 0,
  },
  avatarPlaceholder: {
    width: 90,
    height: 90,
    borderRadius: "50%",
    background: "rgba(255,255,255,0.08)",
    border: "1px solid rgba(255,255,255,0.08)",
    flexShrink: 0,
    marginTop: -12,
  },
  avatarImage: {
    width: 90,
    height: 90,
    borderRadius: "50%",
    objectFit: "cover",
    display: "block",
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
    fontSize: "clamp(30px, 6vw, 52px)",
    fontWeight: 800,
    letterSpacing: "-1.4px",
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
  statRow: {
    display: "flex",
    gap: 10,
    flexWrap: "wrap",
    marginTop: 10,
  },
  statPill: {
    padding: "8px 12px",
    borderRadius: 999,
    background: "rgba(255,255,255,0.06)",
    border: "1px solid rgba(255,255,255,0.08)",
    color: "rgba(255,255,255,0.76)",
    fontSize: 13,
    fontWeight: 700,
  },
  meta: {
    margin: "0 0 4px 0",
    color: "rgba(255,255,255,0.66)",
    fontSize: 15,
  },
  bioPreview: {
    margin: "14px 0 0 0",
    color: "rgba(255,255,255,0.82)",
    lineHeight: 1.6,
    fontSize: 15,
  },
  card: {
    borderRadius: 28,
    border: "1px solid rgba(255,255,255,0.08)",
    background: "linear-gradient(180deg, rgba(18,18,20,0.98), rgba(10,10,12,0.98))",
    boxShadow: "0 10px 30px rgba(0,0,0,0.35)",
    padding: 22,
    marginBottom: 18,
  },
  actionsRow: {
    display: "flex",
    gap: 12,
    flexWrap: "wrap",
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
  formGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
    gap: 16,
    marginTop: 16,
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
    minHeight: 120,
  },
  hiddenFileInput: {
    position: "absolute",
    inset: 0,
    opacity: 0,
    cursor: "pointer",
  },
  filePickerButton: {
    position: "relative",
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    width: "fit-content",
    minHeight: 48,
    padding: "13px 18px",
    borderRadius: 999,
    border: "1px solid rgba(255,255,255,0.10)",
    background: "rgba(255,255,255,0.04)",
    color: "white",
    fontWeight: 700,
    fontSize: 14,
    cursor: "pointer",
    boxShadow: "0 10px 24px rgba(0,0,0,0.22)",
    overflow: "hidden",
  },
  fileMetaText: {
    margin: 0,
    color: "rgba(255,255,255,0.58)",
    fontSize: 13,
  },
  helperText: {
    margin: 0,
    color: "rgba(255,255,255,0.58)",
    fontSize: 14,
    lineHeight: 1.6,
  },
  buttonRow: {
    display: "flex",
    gap: 12,
    flexWrap: "wrap",
  },
  primaryButton: {
    padding: "14px 18px",
    borderRadius: 999,
    border: "1px solid rgba(255,255,255,0.18)",
    background: "rgba(255,255,255,0.96)",
    color: "#050505",
    fontWeight: 800,
    fontSize: 15,
    cursor: "pointer",
    textDecoration: "none",
  },
  secondaryButton: {
    padding: "14px 18px",
    borderRadius: 999,
    border: "1px solid rgba(255,255,255,0.08)",
    background: "rgba(255,255,255,0.03)",
    color: "white",
    fontWeight: 700,
    fontSize: 15,
    cursor: "pointer",
  },
  secondaryLinkButton: {
    padding: "14px 18px",
    borderRadius: 999,
    border: "1px solid rgba(255,255,255,0.08)",
    background: "rgba(255,255,255,0.03)",
    color: "white",
    fontWeight: 700,
    fontSize: 15,
    textDecoration: "none",
  },
}
