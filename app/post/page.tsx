"use client"

import Link from "next/link"
import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { supabase } from "@/lib/supabase"
import ImageCropModal from "@/components/ImageCropModal"
import { createNotification } from "@/lib/notifications"
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

type Profile = {
  id: string
  email: string
  username: string | null
  organization_name: string | null
  account_type: string | null
  is_verified: boolean | null
}

type PendingImageItem = {
  originalFile: File
  previewUrl: string
  croppedFile?: File
  croppedUrl?: string
}

export default function PostPage() {
  const router = useRouter()
  const toast = useToast()

  const [authLoading, setAuthLoading] = useState(true)
  const [profile, setProfile] = useState<Profile | null>(null)

  const [title, setTitle] = useState("")
  const [date, setDate] = useState("")
  const [startTime, setStartTime] = useState("")
  const [endTime, setEndTime] = useState("")
  const [location, setLocation] = useState("")
  const [postedBy, setPostedBy] = useState("")
  const [description, setDescription] = useState("")
  const [category, setCategory] = useState("Frat")

  const [videos, setVideos] = useState<FileList | null>(null)
  const [photosFileLabel, setPhotosFileLabel] = useState("No files selected")
  const [videosFileLabel, setVideosFileLabel] = useState("No files selected")

  const [loading, setLoading] = useState(false)
  const [pendingImages, setPendingImages] = useState<PendingImageItem[]>([])
  const [cropOpen, setCropOpen] = useState(false)
  const [cropIndex, setCropIndex] = useState<number | null>(null)
  const [cropImageSrc, setCropImageSrc] = useState("")

  useEffect(() => {
    const checkAccess = async () => {
      const { data: userData } = await supabase.auth.getUser()
      const user = userData.user

      if (!user) {
        router.push("/auth")
        return
      }

      const { data: profileData, error } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", user.id)
        .maybeSingle()

      if (error) {
        console.error("Profile fetch error:", error)
      }

      if (profileData) {
        setProfile(profileData)
        if (profileData.organization_name) {
          setPostedBy(profileData.organization_name)
        } else if (profileData.username) {
          setPostedBy(profileData.username)
        }
      }

      setAuthLoading(false)
    }

    checkAccess()
  }, [router])

  const handleImagesSelected = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || [])
    if (!files.length) return

    setPhotosFileLabel(
      files.length === 1 ? files[0].name : `${files.length} photos selected`
    )

    const onlyImages = files.filter((file) => file.type.startsWith("image/"))

    if (pendingImages.length + onlyImages.length > 10) {
      toast.error("You can upload a maximum of 10 images.")
      return
    }

    const newItems: PendingImageItem[] = onlyImages.map((file) => ({
      originalFile: file,
      previewUrl: URL.createObjectURL(file),
    }))

    setPendingImages((prev) => [...prev, ...newItems])
  }

  const openCropForImage = (index: number) => {
    const item = pendingImages[index]
    if (!item) return

    setCropIndex(index)
    setCropImageSrc(item.croppedUrl || item.previewUrl)
    setCropOpen(true)
  }

  const handleImageCropped = (croppedFile: File, croppedUrl: string) => {
    if (cropIndex === null) return

    setPendingImages((prev) =>
      prev.map((item, index) =>
        index === cropIndex
          ? {
              ...item,
              croppedFile,
              croppedUrl,
            }
          : item
      )
    )

    setCropOpen(false)
    setCropIndex(null)
    setCropImageSrc("")
  }

  const removePendingImage = (index: number) => {
    setPendingImages((prev) => prev.filter((_, i) => i !== index))
  }

  const handleSubmit = async () => {
    if (!profile) return

    if (profile.account_type !== "organization") {
      toast.error("Only verified organization accounts can post events.")
      return
    }

    if (!profile.is_verified) {
      toast.error("Your organization account is not verified yet.")
      return
    }

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

    if (pendingImages.length > 10) {
      toast.error("You can upload a maximum of 10 images.")
      return
    }

    if (videos && videos.length > 2) {
      toast.error("You can upload a maximum of 2 videos.")
      return
    }

    const formattedTime = `${formatDate(date)} • ${formatTime(startTime)} - ${formatTime(endTime)}`

    setLoading(true)

    const { data: eventData, error: eventError } = await supabase
      .from("events")
      .insert([
        {
          title,
          time: formattedTime,
          event_date: date,
          start_time: startTime,
          end_time: endTime,
          location,
          posted_by: postedBy,
          profile_id: profile.id,
          description,
          category,
        },
      ])
      .select()
      .single()

    if (eventError || !eventData) {
      console.error("Event insert error:", eventError)
      toast.error("There was an error creating the event.")
      setLoading(false)
      return
    }

    const eventId = eventData.id

    const { data: followersData, error: followersError } = await supabase
      .from("follows")
      .select("follower_id")
      .eq("following_id", profile.id)

    if (followersError) {
      console.error("Follower notification fetch error:", followersError.message || followersError)
    } else {
      await Promise.all(
        (followersData || []).map((follow) =>
          createNotification({
            recipient_profile_id: follow.follower_id,
            actor_profile_id: profile.id,
            type: "event_posted",
            title: `${postedBy} posted a new event`,
            body: title,
            dedupe_key: `event_posted:${follow.follower_id}:${eventId}`,
            event_id: eventId,
          })
        )
      )
    }

    for (const image of pendingImages) {
      const fileToUpload = image.croppedFile || image.originalFile
      const filePath = `${eventId}/image-${Date.now()}-${fileToUpload.name}`

      const { error: uploadError } = await supabase.storage
        .from("images")
        .upload(filePath, fileToUpload)

      if (uploadError) {
        console.error("Image upload error:", uploadError)
        continue
      }

      const { data: publicUrlData } = supabase.storage
        .from("images")
        .getPublicUrl(filePath)

      await supabase.from("event_media").insert([
        {
          event_id: eventId,
          file_url: publicUrlData.publicUrl,
          file_type: "image",
        },
      ])
    }

    if (videos) {
      for (let i = 0; i < videos.length; i++) {
        const file = videos[i]
        const filePath = `${eventId}/video-${Date.now()}-${i}-${file.name}`

        const { error: uploadError } = await supabase.storage
          .from("videos")
          .upload(filePath, file)

        if (uploadError) {
          console.error("Video upload error:", uploadError)
          continue
        }

        const { data: publicUrlData } = supabase.storage
          .from("videos")
          .getPublicUrl(filePath)

        await supabase.from("event_media").insert([
          {
            event_id: eventId,
            file_url: publicUrlData.publicUrl,
            file_type: "video",
          },
        ])
      }
    }

    setLoading(false)
    toast.success("Event posted successfully.")
    router.push("/")
  }

  if (authLoading) {
    return (
      <main style={styles.page}>
        <div style={styles.container}>
          <p style={styles.helperText}>Checking account access...</p>
        </div>
      </main>
    )
  }

  if (!profile) {
    return null
  }

  if (profile.account_type !== "organization") {
    return (
      <main style={styles.page}>
        <div style={styles.container}>
          <Link href="/" style={styles.backLink}>
            ← Back to events
          </Link>

          <section style={styles.gateCard}>
            <div style={styles.sectionPill}>Posting locked</div>
            <h1 style={styles.title}>Organization accounts only</h1>
            <p style={styles.subtitle}>
              Regular users can browse, like, comment, and share events later,
              but only verified organization accounts can post.
            </p>

            <div style={styles.buttonRow}>
              <Link href="/profile" style={styles.secondaryButton}>
                Go to Profile
              </Link>
              <Link href="/" style={styles.primaryLinkButton}>
                Back Home
              </Link>
            </div>
          </section>
        </div>
      </main>
    )
  }

  if (!profile.is_verified) {
    return (
      <main style={styles.page}>
        <div style={styles.container}>
          <Link href="/" style={styles.backLink}>
            ← Back to events
          </Link>

          <section style={styles.gateCard}>
            <div
              style={{
                ...styles.categoryPill,
                ...getCategoryStyles("Formal"),
              }}
            >
              Pending Verification
            </div>
            <h1 style={styles.title}>Your org is waiting for approval</h1>
            <p style={styles.subtitle}>
              Your organization account exists, but it has not been manually
              verified yet. Once approved, this page will unlock for posting.
            </p>

            <div style={styles.buttonRow}>
              <Link href="/profile" style={styles.secondaryButton}>
                View Profile
              </Link>
              <Link href="/" style={styles.primaryLinkButton}>
                Back Home
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
        <Link href="/" style={styles.backLink}>
          ← Back to events
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
          <h1 style={styles.title}>Post Event</h1>
          <p style={styles.subtitle}>Create something worth showing up for.</p>
        </div>

        <section style={styles.formCard}>
          <div style={styles.formGrid}>
            <div style={styles.fieldGroup}>
              <label style={styles.label}>Event title</label>
              <input
                type="text"
                placeholder="Bayou Bash"
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
                placeholder="Chapter House"
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                style={styles.input}
              />
            </div>

            <div style={styles.fieldGroup}>
              <label style={styles.label}>Posted by</label>
              <input
                type="text"
                placeholder="Phi Delta Theta"
                value={postedBy}
                onChange={(e) => setPostedBy(e.target.value)}
                style={styles.input}
              />
            </div>

            <div style={styles.fieldGroupFull}>
              <label style={styles.label}>Description</label>
              <textarea
                placeholder="Tell people what the event feels like, what to expect, and why they should come."
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={6}
                style={styles.textarea}
              />
            </div>

            <div style={styles.uploadCard}>
              <label style={styles.uploadTitle}>Photos</label>
              <p style={styles.uploadSubtext}>Upload up to 10 images.</p>
              <label style={styles.filePickerButton}>
                <input
                  type="file"
                  accept="image/*"
                  multiple
                  onChange={handleImagesSelected}
                  style={styles.hiddenFileInput}
                />
                <span>Choose Photos</span>
              </label>
              <p style={styles.fileMetaText}>{photosFileLabel}</p>
            </div>

            <div style={styles.uploadCard}>
              <label style={styles.uploadTitle}>Videos</label>
              <p style={styles.uploadSubtext}>Upload up to 2 videos under 60 seconds.</p>
              <label style={styles.filePickerButton}>
                <input
                  type="file"
                  accept="video/*"
                  multiple
                  onChange={(e) => {
                    setVideos(e.target.files)
                    const files = Array.from(e.target.files || [])
                    setVideosFileLabel(
                      files.length === 0
                        ? "No files selected"
                        : files.length === 1
                          ? files[0].name
                          : `${files.length} videos selected`
                    )
                  }}
                  style={styles.hiddenFileInput}
                />
                <span>Choose Videos</span>
              </label>
              <p style={styles.fileMetaText}>{videosFileLabel}</p>
            </div>
          </div>

          <section style={styles.previewCard}>
            <div style={styles.sectionHeaderRow}>
              <h2 style={styles.previewSectionTitle}>Uploaded photos</h2>
              <span style={styles.countPill}>{pendingImages.length}</span>
            </div>

            {pendingImages.length === 0 ? (
              <p style={styles.helperText}>No photos uploaded yet.</p>
            ) : (
              <>
                <div style={styles.uploadedGrid}>
                  {pendingImages.map((item, index) => {
                    const displayUrl = item.croppedUrl || item.previewUrl

                    return (
                      <div key={index} style={styles.uploadedCard}>
                        <img
                          src={displayUrl}
                          alt={`Upload ${index + 1}`}
                          style={styles.uploadedImage}
                        />

                        <div style={styles.uploadedButtonRow}>
                          <button
                            type="button"
                            onClick={() => openCropForImage(index)}
                            style={styles.smallActionButton}
                          >
                            Crop
                          </button>

                          <button
                            type="button"
                            onClick={() => removePendingImage(index)}
                            style={styles.smallGhostButton}
                          >
                            Remove
                          </button>
                        </div>
                      </div>
                    )
                  })}
                </div>

                <div style={styles.homePreviewWrap}>
                  <p style={styles.previewLabel}>Mobile home page preview</p>

                  <div style={styles.mobilePreviewShell}>
                    <div style={styles.mobilePreviewMediaWrap}>
                      {pendingImages[0] ? (
                        <img
                          src={pendingImages[0].croppedUrl || pendingImages[0].previewUrl}
                          alt="Main preview"
                          style={styles.mobilePreviewHeroImage}
                        />
                      ) : (
                        <div style={styles.mobilePreviewHeroPlaceholder} />
                      )}

                      <div style={styles.mobilePreviewOverlay} />

                      <div style={styles.mobilePreviewTopRow}>
                        <div style={styles.mobilePreviewChipRow}>
                          <span
                            style={{
                              ...styles.mobilePreviewCategoryChip,
                              ...getCategoryStyles(category),
                            }}
                          >
                            {category}
                          </span>
                        </div>

                        {pendingImages.length > 1 && (
                          <span style={styles.mobilePreviewPhotoCountChip}>
                            +{pendingImages.length - 1} photos
                          </span>
                        )}
                      </div>
                    </div>

                    <div style={styles.mobilePreviewBody}>
                      <div style={styles.mobilePreviewPosterRow}>
                        <div style={styles.mobilePreviewPosterBadge}>TN.</div>

                        <div style={{ minWidth: 0 }}>
                          <div style={styles.mobilePreviewPosterNameRow}>
                            <p style={styles.mobilePreviewPosterName}>
                              {postedBy || "TONIGHT."}
                            </p>
                            <span style={styles.mobilePreviewVerifiedBadge}>Verified</span>
                          </div>
                        </div>
                      </div>

                      <h3 style={styles.mobilePreviewEventTitle}>
                        {title || "Your event title"}
                      </h3>

                      <p style={styles.mobilePreviewDateText}>
                        {date ? `Today • ${formatDate(date)}` : "Today • Event date"}
                      </p>

                      <div style={styles.mobilePreviewMetaRow}>
                        <span style={styles.mobilePreviewMetaText}>
                          {date && startTime && endTime
                            ? `${formatDate(date)} • ${formatTime(startTime)} - ${formatTime(endTime)}`
                            : "April 17, 2026 • 12:15 PM - 10:00 PM"}
                        </span>
                        <span style={styles.mobilePreviewMetaDot}>•</span>
                        <span style={styles.mobilePreviewMetaText}>
                          {location || "Location"}
                        </span>
                      </div>

                      <p style={styles.mobilePreviewDescription}>
                        {description || "Your event description will show here."}
                      </p>
                    </div>
                  </div>

                  <p style={{ ...styles.previewLabel, marginTop: 18 }}>
                    Desktop home page preview
                  </p>

                  <div style={styles.desktopPreviewShell}>
                    <div style={styles.desktopPreviewMediaWrap}>
                      <div style={styles.desktopPreviewGrid}>
                        {[0, 1, 2].map((index) => {
                          const item = pendingImages[index]
                          const displayUrl = item ? item.croppedUrl || item.previewUrl : ""

                          return item ? (
                            <img
                              key={index}
                              src={displayUrl}
                              alt={`Desktop preview ${index + 1}`}
                              style={styles.desktopPreviewGridImage}
                            />
                          ) : (
                            <div
                              key={index}
                              style={styles.desktopPreviewGridPlaceholder}
                            />
                          )
                        })}
                      </div>

                      <div style={styles.desktopPreviewTopRow}>
                        <div style={styles.desktopPreviewChipRow}>
                          <span
                            style={{
                              ...styles.desktopPreviewCategoryChip,
                              ...getCategoryStyles(category),
                            }}
                          >
                            {category}
                          </span>
                        </div>

                        {pendingImages.length > 3 && (
                          <span style={styles.desktopPreviewPhotoCountChip}>
                            +{pendingImages.length - 3} more
                          </span>
                        )}
                      </div>
                    </div>

                    <div style={styles.desktopPreviewBody}>
                      <div style={styles.desktopPreviewPosterRow}>
                        <div style={styles.desktopPreviewPosterBadge}>TN.</div>

                        <div style={{ minWidth: 0 }}>
                          <div style={styles.desktopPreviewPosterNameRow}>
                            <p style={styles.desktopPreviewPosterName}>
                              {postedBy || "TONIGHT."}
                            </p>
                            <span style={styles.desktopPreviewVerifiedBadge}>
                              Verified
                            </span>
                          </div>
                        </div>
                      </div>

                      <h3 style={styles.desktopPreviewEventTitle}>
                        {title || "Your event title"}
                      </h3>

                      <p style={styles.desktopPreviewDateText}>
                        {date ? `Today • ${formatDate(date)}` : "Today • Event date"}
                      </p>

                      <div style={styles.desktopPreviewMetaRow}>
                        <span style={styles.desktopPreviewMetaText}>
                          {date && startTime && endTime
                            ? `${formatDate(date)} • ${formatTime(startTime)} - ${formatTime(endTime)}`
                            : "April 17, 2026 • 12:15 PM - 10:00 PM"}
                        </span>
                        <span style={styles.desktopPreviewMetaDot}>•</span>
                        <span style={styles.desktopPreviewMetaText}>
                          {location || "Location"}
                        </span>
                      </div>

                      <p style={styles.desktopPreviewDescription}>
                        {description || "Your event description will show here."}
                      </p>
                    </div>
                  </div>
                </div>
              </>
            )}
          </section>

          <button
            onClick={handleSubmit}
            disabled={loading}
            style={{
              ...styles.submitButton,
              opacity: loading ? 0.7 : 1,
            }}
          >
            {loading ? "Posting..." : "Post Event"}
          </button>
        </section>
      </div>

      <ImageCropModal
        open={cropOpen}
        imageSrc={cropImageSrc}
        aspect={16 / 9}
        title="Crop event image"
        onClose={() => {
          setCropOpen(false)
          setCropIndex(null)
          setCropImageSrc("")
        }}
        onDone={(croppedFile, croppedUrl) => handleImageCropped(croppedFile, croppedUrl)}
      />
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
    background: "linear-gradient(180deg, rgba(18,18,20,0.98), rgba(10,10,12,0.98))",
    boxShadow: "0 10px 30px rgba(0,0,0,0.35)",
    padding: 24,
  },
  buttonRow: {
    display: "flex",
    gap: 12,
    flexWrap: "wrap",
    marginTop: 18,
  },
  primaryLinkButton: {
    padding: "14px 18px",
    borderRadius: 999,
    border: "1px solid rgba(255,255,255,0.18)",
    background: "rgba(255,255,255,0.96)",
    color: "#050505",
    fontWeight: 800,
    fontSize: 15,
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
    textDecoration: "none",
  },
  formCard: {
    borderRadius: 28,
    border: "1px solid rgba(255,255,255,0.08)",
    background: "linear-gradient(180deg, rgba(18,18,20,0.98), rgba(10,10,12,0.98))",
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
  uploadCard: {
    borderRadius: 20,
    border: "1px solid rgba(255,255,255,0.08)",
    background: "rgba(255,255,255,0.03)",
    padding: 18,
  },
  uploadTitle: {
    display: "block",
    fontWeight: 700,
    marginBottom: 6,
    fontSize: 16,
  },
  uploadSubtext: {
    margin: "0 0 12px 0",
    color: "rgba(255,255,255,0.6)",
    fontSize: 14,
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
    margin: "10px 0 0 0",
    color: "rgba(255,255,255,0.58)",
    fontSize: 13,
  },
  previewCard: {
    borderRadius: 24,
    border: "1px solid rgba(255,255,255,0.08)",
    background: "linear-gradient(180deg, rgba(18,18,20,0.98), rgba(10,10,12,0.98))",
    boxShadow: "0 10px 30px rgba(0,0,0,0.35)",
    padding: 22,
    marginTop: 20,
    marginBottom: 20,
  },
  sectionHeaderRow: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
    marginBottom: 16,
    flexWrap: "wrap",
  },
  previewSectionTitle: {
    margin: 0,
    fontSize: 24,
    fontWeight: 800,
    letterSpacing: "-1px",
    color: "white",
  },
  countPill: {
    padding: "7px 11px",
    borderRadius: 999,
    background: "rgba(255,255,255,0.06)",
    border: "1px solid rgba(255,255,255,0.08)",
    color: "rgba(255,255,255,0.7)",
    fontSize: 13,
  },
  uploadedGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
    gap: 14,
    marginBottom: 22,
  },
  uploadedCard: {
    borderRadius: 18,
    overflow: "hidden",
    border: "1px solid rgba(255,255,255,0.08)",
    background: "rgba(255,255,255,0.03)",
  },
  uploadedImage: {
    width: "100%",
    height: 180,
    objectFit: "cover",
    display: "block",
  },
  uploadedButtonRow: {
    display: "flex",
    gap: 10,
    padding: 12,
    flexWrap: "wrap",
  },
  smallActionButton: {
    padding: "10px 14px",
    borderRadius: 999,
    border: "1px solid rgba(255,255,255,0.18)",
    background: "rgba(255,255,255,0.96)",
    color: "#050505",
    fontWeight: 700,
    cursor: "pointer",
  },
  smallGhostButton: {
    padding: "10px 14px",
    borderRadius: 999,
    border: "1px solid rgba(255,255,255,0.10)",
    background: "rgba(255,255,255,0.04)",
    color: "white",
    fontWeight: 700,
    cursor: "pointer",
  },
  homePreviewWrap: {
    display: "grid",
    gap: 10,
  },
  previewLabel: {
    margin: 0,
    color: "rgba(255,255,255,0.72)",
    fontSize: 14,
    fontWeight: 700,
  },

  mobilePreviewShell: {
    borderRadius: 24,
    overflow: "hidden",
    border: "1px solid rgba(255,255,255,0.08)",
    background: "linear-gradient(180deg, rgba(18,18,20,0.98), rgba(10,10,12,0.98))",
    boxShadow: "0 10px 30px rgba(0,0,0,0.35)",
    maxWidth: 370,
  },
  mobilePreviewMediaWrap: {
    position: "relative",
  },
  mobilePreviewHeroImage: {
    width: "100%",
    height: 250,
    objectFit: "cover",
    display: "block",
  },
  mobilePreviewHeroPlaceholder: {
    width: "100%",
    height: 250,
    background: "rgba(255,255,255,0.04)",
  },
  mobilePreviewOverlay: {
    position: "absolute",
    inset: 0,
    background: "linear-gradient(to top, rgba(0,0,0,0.55), rgba(0,0,0,0.08))",
    pointerEvents: "none",
  },
  mobilePreviewTopRow: {
    position: "absolute",
    left: 14,
    right: 14,
    top: 14,
    display: "flex",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: 10,
    flexWrap: "wrap",
  },
  mobilePreviewChipRow: {
    display: "flex",
    gap: 8,
    flexWrap: "wrap",
  },
  mobilePreviewCategoryChip: {
    padding: "8px 12px",
    borderRadius: 999,
    fontSize: 12,
    fontWeight: 700,
    backdropFilter: "blur(10px)",
  },
  mobilePreviewPhotoCountChip: {
    padding: "8px 12px",
    borderRadius: 999,
    background: "rgba(255,255,255,0.12)",
    color: "white",
    fontSize: 12,
    fontWeight: 700,
    border: "1px solid rgba(255,255,255,0.12)",
    backdropFilter: "blur(10px)",
  },
  mobilePreviewBody: {
    padding: "18px 18px 20px",
  },
  mobilePreviewPosterRow: {
    display: "flex",
    alignItems: "center",
    gap: 10,
    marginBottom: 14,
  },
  mobilePreviewPosterBadge: {
    width: 40,
    height: 40,
    borderRadius: "50%",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    background: "rgba(0,0,0,0.55)",
    border: "1px solid rgba(255,255,255,0.10)",
    color: "white",
    fontWeight: 800,
    fontSize: 16,
    flexShrink: 0,
  },
  mobilePreviewPosterNameRow: {
    display: "flex",
    alignItems: "center",
    gap: 8,
    flexWrap: "wrap",
  },
  mobilePreviewPosterName: {
    margin: 0,
    color: "rgba(255,255,255,0.9)",
    fontSize: 14,
    fontWeight: 700,
  },
  mobilePreviewVerifiedBadge: {
    padding: "6px 10px",
    borderRadius: 999,
    background: "rgba(92,120,255,0.18)",
    border: "1px solid rgba(92,120,255,0.35)",
    color: "#dbe4ff",
    fontSize: 11,
    fontWeight: 700,
  },
  mobilePreviewEventTitle: {
    margin: "0 0 10px 0",
    fontSize: 26,
    lineHeight: 1.02,
    letterSpacing: "-1px",
    fontWeight: 800,
    color: "white",
    wordBreak: "break-word",
  },
  mobilePreviewDateText: {
    margin: "0 0 10px 0",
    color: "rgba(255,255,255,0.72)",
    fontSize: 14,
    fontWeight: 700,
  },
  mobilePreviewMetaRow: {
    display: "flex",
    alignItems: "center",
    gap: 8,
    flexWrap: "wrap",
    marginBottom: 10,
  },
  mobilePreviewMetaText: {
    color: "rgba(255,255,255,0.82)",
    fontSize: 15,
  },
  mobilePreviewMetaDot: {
    color: "rgba(255,255,255,0.28)",
  },
  mobilePreviewDescription: {
    margin: 0,
    color: "rgba(255,255,255,0.88)",
    lineHeight: 1.5,
    fontSize: 15,
    display: "-webkit-box",
    WebkitLineClamp: 2,
    WebkitBoxOrient: "vertical",
    overflow: "hidden",
  },

  desktopPreviewShell: {
    borderRadius: 24,
    overflow: "hidden",
    border: "1px solid rgba(255,255,255,0.08)",
    background: "linear-gradient(180deg, rgba(18,18,20,0.98), rgba(10,10,12,0.98))",
    boxShadow: "0 10px 30px rgba(0,0,0,0.35)",
  },
  desktopPreviewMediaWrap: {
    position: "relative",
    padding: 14,
    paddingBottom: 0,
  },
  desktopPreviewGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(3, 1fr)",
    gap: 10,
  },
  desktopPreviewGridImage: {
    width: "100%",
    height: 180,
    objectFit: "cover",
    borderRadius: 18,
    display: "block",
  },
  desktopPreviewGridPlaceholder: {
    height: 180,
    borderRadius: 18,
    background: "rgba(255,255,255,0.03)",
  },
  desktopPreviewTopRow: {
    position: "absolute",
    left: 28,
    right: 28,
    top: 28,
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 10,
  },
  desktopPreviewChipRow: {
    display: "flex",
    gap: 8,
    flexWrap: "wrap",
  },
  desktopPreviewCategoryChip: {
    padding: "8px 12px",
    borderRadius: 999,
    fontSize: 12,
    fontWeight: 700,
    backdropFilter: "blur(10px)",
  },
  desktopPreviewPhotoCountChip: {
    padding: "8px 12px",
    borderRadius: 999,
    background: "rgba(255,255,255,0.12)",
    color: "white",
    fontSize: 12,
    fontWeight: 700,
    border: "1px solid rgba(255,255,255,0.12)",
    backdropFilter: "blur(10px)",
  },
  desktopPreviewBody: {
    padding: "18px 18px 20px",
  },
  desktopPreviewPosterRow: {
    display: "flex",
    alignItems: "center",
    gap: 10,
    marginBottom: 14,
  },
  desktopPreviewPosterBadge: {
    width: 40,
    height: 40,
    borderRadius: "50%",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    background: "rgba(0,0,0,0.55)",
    border: "1px solid rgba(255,255,255,0.10)",
    color: "white",
    fontWeight: 800,
    fontSize: 16,
    flexShrink: 0,
  },
  desktopPreviewPosterNameRow: {
    display: "flex",
    alignItems: "center",
    gap: 8,
    flexWrap: "wrap",
  },
  desktopPreviewPosterName: {
    margin: 0,
    color: "rgba(255,255,255,0.9)",
    fontSize: 14,
    fontWeight: 700,
  },
  desktopPreviewVerifiedBadge: {
    padding: "6px 10px",
    borderRadius: 999,
    background: "rgba(92,120,255,0.18)",
    border: "1px solid rgba(92,120,255,0.35)",
    color: "#dbe4ff",
    fontSize: 11,
    fontWeight: 700,
  },
  desktopPreviewEventTitle: {
    margin: "0 0 10px 0",
    fontSize: 32,
    lineHeight: 1.02,
    letterSpacing: "-1.2px",
    fontWeight: 800,
    color: "white",
    wordBreak: "break-word",
  },
  desktopPreviewDateText: {
    margin: "0 0 10px 0",
    color: "rgba(255,255,255,0.72)",
    fontSize: 14,
    fontWeight: 700,
  },
  desktopPreviewMetaRow: {
    display: "flex",
    alignItems: "center",
    gap: 8,
    flexWrap: "wrap",
    marginBottom: 10,
  },
  desktopPreviewMetaText: {
    color: "rgba(255,255,255,0.82)",
    fontSize: 16,
  },
  desktopPreviewMetaDot: {
    color: "rgba(255,255,255,0.28)",
  },
  desktopPreviewDescription: {
    margin: 0,
    color: "rgba(255,255,255,0.88)",
    lineHeight: 1.55,
    fontSize: 15,
    display: "-webkit-box",
    WebkitLineClamp: 2,
    WebkitBoxOrient: "vertical",
    overflow: "hidden",
  },

  submitButton: {
    width: "100%",
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
}
