"use client"

import Link from "next/link"
import { useEffect, useMemo, useState } from "react"
import { useParams, useRouter } from "next/navigation"
import { supabase } from "@/lib/supabase"
import SkeletonImage from "@/components/SkeletonImage"
import { createNotification } from "@/lib/notifications"
import { createReport } from "@/lib/reporting"
import { useToast } from "@/components/Toast"

type MediaItem = {
  id?: number
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
  bio: string | null
  is_verified: boolean | null
  account_type: string | null
}

type EventItem = {
  id: number
  title: string
  time: string
  event_date?: string | null
  location: string
  posted_by: string
  profile_id?: string | null
  description: string
  category: string
}

type CommentItem = {
  id: number
  event_id: number
  profile_id: string
  content: string
  created_at: string
  parent_comment_id?: number | null
  profile?: ProfileItem | null
  replies?: CommentItem[]
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

function formatCommentDate(dateString: string) {
  const date = new Date(dateString)
  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  })
}

function buildCommentTree(comments: CommentItem[]) {
  const commentMap = new Map<number, CommentItem>()
  const rootComments: CommentItem[] = []

  comments.forEach((comment) => {
    commentMap.set(comment.id, {
      ...comment,
      replies: [],
    })
  })

  comments.forEach((comment) => {
    const mappedComment = commentMap.get(comment.id)
    if (!mappedComment) return

    if (comment.parent_comment_id) {
      const parent = commentMap.get(comment.parent_comment_id)
      if (parent) {
        parent.replies = [...(parent.replies || []), mappedComment]
        return
      }
    }

    rootComments.push(mappedComment)
  })

  rootComments.forEach((comment) => {
    if (comment.replies) {
      comment.replies.sort(
        (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
      )
    }
  })

  return rootComments
}

export default function EventPage() {
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

  const [event, setEvent] = useState<EventItem | null>(null)
  const [media, setMedia] = useState<MediaItem[]>([])
  const [profile, setProfile] = useState<ProfileItem | null>(null)
  const [comments, setComments] = useState<CommentItem[]>([])
  const [loading, setLoading] = useState(true)
  const [commentsOpen, setCommentsOpen] = useState(false)

  const [currentUserId, setCurrentUserId] = useState<string | null>(null)
  const [liked, setLiked] = useState(false)
  const [likesCount, setLikesCount] = useState(0)

  const [commentText, setCommentText] = useState("")
  const [commentLoading, setCommentLoading] = useState(false)
  const [replyText, setReplyText] = useState("")
  const [activeReplyId, setActiveReplyId] = useState<number | null>(null)
  const [replyLoadingId, setReplyLoadingId] = useState<number | null>(null)

  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false)
  const [deleteLoading, setDeleteLoading] = useState(false)

  useEffect(() => {
    const fetchEvent = async () => {
      if (eventId === null) {
        console.error("Invalid event id:", rawId)
        setLoading(false)
        return
      }

      setLoading(true)

      const { data: userData } = await supabase.auth.getUser()
      const user = userData.user
      setCurrentUserId(user?.id || null)

      // Single query: fetches event + its media + its poster profile at once.
      const { data: eventData, error: eventError } = await supabase
        .from("events")
        .select(`
          *,
          profile:profiles(*),
          media:event_media(*)
        `)
        .eq("id", eventId)
        .maybeSingle()

      if (eventError || !eventData) {
        console.error(
          "Event fetch error:",
          eventError?.message || eventError || `No event found for id ${eventId}`
        )
        setLoading(false)
        return
      }

      // Count-only query — no row data transferred, just a COUNT(*) from Postgres.
      const { count: likesCountValue, error: likesError } = await supabase
        .from("likes")
        .select("*", { count: "exact", head: true })
        .eq("event_id", eventId)

      if (likesError) {
        console.error("Likes fetch error:", likesError.message || likesError)
      }

      setLikesCount(likesCountValue || 0)

      if (user?.id) {
        const { data: likeRow, error: likeStateError } = await supabase
          .from("likes")
          .select("event_id")
          .eq("event_id", eventId)
          .eq("profile_id", user.id)
          .maybeSingle()

        if (likeStateError) {
          console.error("Like state error:", likeStateError.message || likeStateError)
        }

        setLiked(!!likeRow)
      }

      // Single query: comments with their commenter profiles joined in.
      const { data: commentsData, error: commentsError } = await supabase
        .from("comments")
        .select(`
          *,
          profile:profiles(*)
        `)
        .eq("event_id", eventId)
        .order("created_at", { ascending: false })

      if (commentsError) {
        console.error("Comments fetch error:", commentsError.message || commentsError)
      }

      setEvent(eventData)
      setMedia(eventData.media || [])
      setProfile(eventData.profile || null)
      setComments((commentsData || []) as CommentItem[])
      setLoading(false)
    }

    fetchEvent()
  }, [eventId, rawId])

  const commentThreads = useMemo(() => buildCommentTree(comments), [comments])

  const handleLikeToggle = async () => {
    if (!eventId) return

    if (!currentUserId) {
      router.push("/auth")
      return
    }

    // Optimistic update: flip UI immediately, roll back if the server rejects.
    // This makes the button feel instant instead of waiting on a round trip.
    const wasLiked = liked
    setLiked(!wasLiked)
    setLikesCount((prev) => (wasLiked ? Math.max(prev - 1, 0) : prev + 1))

    if (wasLiked) {
      const { error } = await supabase
        .from("likes")
        .delete()
        .eq("event_id", eventId)
        .eq("profile_id", currentUserId)

      if (error) {
        console.error(error)
        // Roll back
        setLiked(true)
        setLikesCount((prev) => prev + 1)
        toast.error("There was an error removing your like.")
      }
      return
    }

    const { error } = await supabase.from("likes").insert([
      {
        event_id: eventId,
        profile_id: currentUserId,
      },
    ])

    if (error) {
      console.error(error)
      // Roll back
      setLiked(false)
      setLikesCount((prev) => Math.max(prev - 1, 0))
      toast.error("There was an error liking this event.")
    }
  }

  const handleAddComment = async (parentComment?: CommentItem) => {
    if (!eventId) return

    if (!currentUserId) {
      router.push("/auth")
      return
    }

    const content = parentComment ? replyText.trim() : commentText.trim()

    if (!content) {
      toast.error(parentComment ? "Write a reply first." : "Write a comment first.")
      return
    }

    if (parentComment) {
      setReplyLoadingId(parentComment.id)
    } else {
      setCommentLoading(true)
    }

    const { data: insertedComment, error } = await supabase
      .from("comments")
      .insert([
        {
          event_id: eventId,
          profile_id: currentUserId,
          content,
          parent_comment_id: parentComment?.id || null,
        },
      ])
      .select("id, parent_comment_id")
      .single()

    if (error) {
      console.error(error)
      toast.error(parentComment ? "There was an error posting your reply." : "There was an error posting your comment.")
      setCommentLoading(false)
      setReplyLoadingId(null)
      return
    }

    // Fetch just the current user's profile instead of all profiles.
    const { data: currentProfile } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", currentUserId)
      .maybeSingle()

    const newComment: CommentItem = {
      id: insertedComment.id,
      event_id: eventId,
      profile_id: currentUserId,
      content,
      created_at: new Date().toISOString(),
      parent_comment_id: insertedComment.parent_comment_id,
      profile: currentProfile,
    }

    setComments((prev) => [newComment, ...prev])

    if (parentComment) {
      setReplyText("")
      setActiveReplyId(null)
      setReplyLoadingId(null)

      if (parentComment.profile_id !== currentUserId) {
        await createNotification({
          recipient_profile_id: parentComment.profile_id,
          actor_profile_id: currentUserId,
          type: "comment_reply",
          title: "Someone replied to your comment",
          body: `${getProfileDisplayName(currentProfile, "Someone")} replied on ${event?.title || "an event"}.`,
          dedupe_key: `comment_reply:${parentComment.id}:${insertedComment.id}`,
          event_id: eventId,
          comment_id: insertedComment.id,
        })
      }
    } else {
      setCommentText("")
      setCommentLoading(false)
    }
  }

  const handleShare = async () => {
    const shareUrl = window.location.href

    try {
      if (navigator.share) {
        await navigator.share({
          title: event?.title || "TONIGHT. event",
          text: "Check out this event on TONIGHT.",
          url: shareUrl,
        })
        return
      }

      await navigator.clipboard.writeText(shareUrl)
      toast.success("Event link copied.")
    } catch (error) {
      console.error(error)
      toast.error("Could not share the event.")
    }
  }

  const handleDelete = async () => {
    if (!eventId) return

    setDeleteLoading(true)

    // Delete event. Due to ON DELETE CASCADE on the foreign keys we set up,
    // related media, likes, and comments are cleaned up automatically.
    const { error } = await supabase.from("events").delete().eq("id", eventId)

    setDeleteLoading(false)

    if (error) {
      console.error(error)
      toast.error("There was an error deleting this event.")
      return
    }

    toast.success("Event deleted.")
    setDeleteConfirmOpen(false)
    router.push("/")
  }

  const handleReportEvent = async () => {
    if (!eventId) return

    if (!currentUserId) {
      router.push("/auth")
      return
    }

    const reason = window.prompt(
      "What are you reporting this event for?",
      "Spam or misleading event"
    )

    if (!reason?.trim()) return

    try {
      await createReport({
        reporterProfileId: currentUserId,
        targetType: "event",
        targetEventId: eventId,
        reason: reason.trim(),
      })
      toast.success("Report submitted.")
    } catch (error) {
      console.error(error)
      toast.error("There was an error submitting your report.")
    }
  }

  const handleDeleteComment = async (commentId: number) => {
    const confirmed = window.confirm("Delete this comment?")
    if (!confirmed) return

    const { error } = await supabase.from("comments").delete().eq("id", commentId)

    if (error) {
      console.error(error)
      toast.error("There was an error deleting your comment.")
      return
    }

    setComments((prev) =>
      prev.filter(
        (comment) =>
          comment.id !== commentId && comment.parent_comment_id !== commentId
      )
    )
    toast.success("Comment deleted.")
  }

  const isOwner =
    !!currentUserId && !!event?.profile_id && event.profile_id === currentUserId

  if (loading) {
    return (
      <main style={styles.page}>
        <div style={styles.container}>
          <p style={styles.loadingText}>Loading event...</p>
        </div>
      </main>
    )
  }

  if (!event) {
    return (
      <main style={styles.page}>
        <div style={styles.container}>
          <Link href="/" style={styles.backLink}>
            ← Back
          </Link>
          <h1 style={styles.notFoundTitle}>Event not found.</h1>
        </div>
      </main>
    )
  }

  const images = media.filter((item) => item.file_type === "image")
  const videos = media.filter((item) => item.file_type === "video")
  const profileName = getProfileDisplayName(profile, event.posted_by)

  return (
    <main style={styles.page}>
      <div style={styles.container}>
        <div style={styles.headerRow}>
          <Link href="/" style={styles.backLink}>
          ← Back
          </Link>

          {!isOwner && (
            <button onClick={handleReportEvent} style={styles.headerReportButton}>
              Report
            </button>
          )}
        </div>

        <section style={styles.heroCard}>
          {images[0] && (
            <div style={styles.heroImageWrap}>
              <SkeletonImage
                src={images[0].file_url}
                alt={event.title}
                wrapperStyle={styles.heroImageShell}
                style={styles.heroImage}
              />
              <div style={styles.heroOverlay} />

              <div style={styles.heroContent}>
                <div style={styles.heroTopRow}>
                  <span
                    style={{
                      ...styles.categoryChip,
                      ...getCategoryStyles(event.category),
                    }}
                  >
                    {event.category}
                  </span>

                  {images.length > 1 && (
                    <span style={styles.mediaCountChip}>
                      +{images.length - 1} more photos
                    </span>
                  )}
                </div>

                <div>
                  <h1 style={styles.heroTitle}>{event.title}</h1>

                  <div style={styles.heroMetaRow}>
                    <span style={styles.heroMetaText}>{event.time}</span>
                    <span style={styles.heroMetaDot}>•</span>
                    <span style={styles.heroMetaText}>{event.location}</span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {!images[0] && (
            <div style={styles.noImageHeader}>
              <div style={styles.heroTopRow}>
                <span
                  style={{
                    ...styles.categoryChip,
                    ...getCategoryStyles(event.category),
                  }}
                >
                  {event.category}
                </span>
              </div>

              <h1 style={styles.heroTitle}>{event.title}</h1>

              <div style={styles.heroMetaRow}>
                <span style={styles.heroMetaText}>{event.time}</span>
                <span style={styles.heroMetaDot}>•</span>
                <span style={styles.heroMetaText}>{event.location}</span>
              </div>
            </div>
          )}
        </section>

        <section style={styles.infoCard}>
          <div style={styles.topRow}>
            {profile?.id ? (
              <Link href={`/org/${profile.id}`} style={styles.posterLink}>
                {profile.avatar_url ? (
                  <SkeletonImage
                    src={profile.avatar_url}
                    alt={profileName}
                    wrapperStyle={styles.posterAvatarWrap}
                    style={styles.posterAvatar}
                  />
                ) : (
                  <div style={styles.posterAvatarPlaceholder} />
                )}

                <div>
                  <div style={styles.posterNameRow}>
                    <h2 style={styles.posterName}>{profileName}</h2>
                    {profile.is_verified && (
                      <span style={styles.verifiedBadge}>Verified</span>
                    )}
                  </div>

                  {profile.bio && <p style={styles.posterBio}>{profile.bio}</p>}
                </div>
              </Link>
            ) : (
              <div style={styles.posterRow}>
                {profile?.avatar_url ? (
                  <SkeletonImage
                    src={profile.avatar_url}
                    alt={profileName}
                    wrapperStyle={styles.posterAvatarWrap}
                    style={styles.posterAvatar}
                  />
                ) : (
                  <div style={styles.posterAvatarPlaceholder} />
                )}

                <div>
                  <div style={styles.posterNameRow}>
                    <h2 style={styles.posterName}>{profileName}</h2>
                    {profile?.is_verified && (
                      <span style={styles.verifiedBadge}>Verified</span>
                    )}
                  </div>

                  {profile?.bio && <p style={styles.posterBio}>{profile.bio}</p>}
                </div>
              </div>
            )}

            <div style={styles.topActions}>
              <button
                onClick={handleLikeToggle}
                style={{
                  ...styles.actionButton,
                  ...(liked ? styles.actionButtonActive : {}),
                }}
              >
                <span style={styles.actionIcon}>{liked ? "♥" : "♡"}</span>
                <span>{likesCount}</span>
              </button>

              <button onClick={handleShare} style={styles.actionButton}>
                <span style={styles.actionIcon}>↗</span>
              </button>

              <button
                onClick={() => setCommentsOpen(true)}
                style={styles.actionButton}
              >
                <span style={styles.actionIcon}>💬</span>
                <span>{comments.length}</span>
              </button>

              {isOwner && (
                <>
                  <button
                    onClick={() => router.push(`/events/${eventId}/edit`)}
                    style={styles.actionButton}
                  >
                    <span style={styles.actionIcon}>✎</span>
                    <span>Edit</span>
                  </button>

                  <button
                    onClick={() => setDeleteConfirmOpen(true)}
                    style={{
                      ...styles.actionButton,
                      ...styles.actionButtonDanger,
                    }}
                  >
                    <span style={styles.actionIcon}>🗑</span>
                    <span>Delete</span>
                  </button>
                </>
              )}
            </div>
          </div>

          <div style={styles.aboutBlock}>
            <h2 style={styles.sectionTitle}>About this event</h2>
            <p style={styles.description}>{event.description}</p>
          </div>
        </section>

        {deleteConfirmOpen && (
          <div
            style={styles.modalOverlay}
            onClick={() => !deleteLoading && setDeleteConfirmOpen(false)}
          >
            <div
              style={styles.deleteModalCard}
              onClick={(e) => e.stopPropagation()}
            >
              <h2 style={styles.deleteTitle}>Delete this event?</h2>
              <p style={styles.deleteBody}>
                This can&apos;t be undone. All photos, comments, and likes on this
                event will be removed.
              </p>

              <div style={styles.deleteButtonRow}>
                <button
                  onClick={() => setDeleteConfirmOpen(false)}
                  disabled={deleteLoading}
                  style={styles.deleteCancelButton}
                >
                  Cancel
                </button>
                <button
                  onClick={handleDelete}
                  disabled={deleteLoading}
                  style={{
                    ...styles.deleteConfirmButton,
                    opacity: deleteLoading ? 0.7 : 1,
                  }}
                >
                  {deleteLoading ? "Deleting..." : "Delete Event"}
                </button>
              </div>
            </div>
          </div>
        )}

        {commentsOpen && (
          <div style={styles.modalOverlay} onClick={() => setCommentsOpen(false)}>
            <div style={styles.modalCard} onClick={(e) => e.stopPropagation()}>
              <div style={styles.modalHeader}>
                <h2 style={styles.modalTitle}>Comments</h2>
                <button
                  onClick={() => setCommentsOpen(false)}
                  style={styles.closeButton}
                >
                  ✕
                </button>
              </div>

              <div style={styles.commentComposer}>
                <textarea
                  value={commentText}
                  onChange={(e) => setCommentText(e.target.value)}
                  placeholder="Say something..."
                  rows={4}
                  style={styles.commentInput}
                />
                <button
                  type="button"
                  onClick={() => handleAddComment()}
                  disabled={commentLoading}
                  style={{
                    ...styles.commentButton,
                    opacity: commentLoading ? 0.7 : 1,
                  }}
                >
                  {commentLoading ? "Posting..." : "Post Comment"}
                </button>
              </div>

              <div style={styles.modalCommentsList}>
                {comments.length === 0 ? (
                  <p style={styles.emptyText}>No comments yet.</p>
                ) : (
                  commentThreads.map((comment) => {
                    const commenterName = getProfileDisplayName(comment.profile, "User")

                    return (
                      <div key={comment.id} style={styles.commentCard}>
                        <div style={styles.commentHeader}>
                          <div style={styles.commentUserRow}>
                            {comment.profile?.avatar_url ? (
                              <SkeletonImage
                                src={comment.profile.avatar_url}
                                alt={commenterName}
                                wrapperStyle={styles.commentAvatarWrap}
                                style={styles.commentAvatar}
                              />
                            ) : (
                              <div style={styles.commentAvatarPlaceholder} />
                            )}

                            <div>
                              <div style={styles.commentNameRow}>
                                <p style={styles.commentName}>{commenterName}</p>
                                {comment.profile?.is_verified && (
                                  <span style={styles.commentVerifiedBadge}>Verified</span>
                                )}
                              </div>
                              <p style={styles.commentDate}>
                                {formatCommentDate(comment.created_at)}
                              </p>
                            </div>
                          </div>
                        </div>

                        <p style={styles.commentText}>{comment.content}</p>

                        <div style={styles.commentActionsRow}>
                          <button
                            type="button"
                            onClick={() =>
                              setActiveReplyId((prev) => (prev === comment.id ? null : comment.id))
                            }
                            style={styles.replyToggleButton}
                          >
                            Reply
                          </button>
                          {comment.profile_id === currentUserId && (
                            <button
                              type="button"
                              onClick={() => handleDeleteComment(comment.id)}
                              style={styles.deleteCommentButton}
                            >
                              Delete
                            </button>
                          )}
                        </div>

                        {activeReplyId === comment.id && (
                          <div style={styles.replyComposer}>
                            <textarea
                              value={replyText}
                              onChange={(e) => setReplyText(e.target.value)}
                              placeholder={`Reply to ${commenterName}...`}
                              rows={3}
                              style={styles.replyInput}
                            />
                            <div style={styles.replyButtonRow}>
                              <button
                                type="button"
                                onClick={() => {
                                  setActiveReplyId(null)
                                  setReplyText("")
                                }}
                                style={styles.replyCancelButton}
                              >
                                Cancel
                              </button>
                              <button
                                type="button"
                                onClick={() => handleAddComment(comment)}
                                disabled={replyLoadingId === comment.id}
                                style={{
                                  ...styles.replySubmitButton,
                                  opacity: replyLoadingId === comment.id ? 0.7 : 1,
                                }}
                              >
                                {replyLoadingId === comment.id ? "Replying..." : "Post Reply"}
                              </button>
                            </div>
                          </div>
                        )}

                        {(comment.replies || []).length > 0 && (
                          <div style={styles.replyList}>
                            {(comment.replies || []).map((reply) => {
                              const replyName = getProfileDisplayName(reply.profile, "User")

                              return (
                                <div key={reply.id} style={styles.replyCard}>
                                  <div style={styles.commentHeader}>
                                    <div style={styles.commentUserRow}>
                                      {reply.profile?.avatar_url ? (
                                        <SkeletonImage
                                          src={reply.profile.avatar_url}
                                          alt={replyName}
                                          wrapperStyle={styles.commentAvatarWrap}
                                          style={styles.commentAvatar}
                                        />
                                      ) : (
                                        <div style={styles.commentAvatarPlaceholder} />
                                      )}

                                      <div>
                                        <div style={styles.commentNameRow}>
                                          <p style={styles.commentName}>{replyName}</p>
                                          {reply.profile?.is_verified && (
                                            <span style={styles.commentVerifiedBadge}>Verified</span>
                                          )}
                                        </div>
                                        <p style={styles.commentDate}>
                                          {formatCommentDate(reply.created_at)}
                                        </p>
                                      </div>
                                    </div>
                                  </div>

                                  <p style={styles.commentText}>{reply.content}</p>
                                  {reply.profile_id === currentUserId && (
                                    <div style={styles.commentActionsRow}>
                                      <button
                                        type="button"
                                        onClick={() => handleDeleteComment(reply.id)}
                                        style={styles.deleteCommentButton}
                                      >
                                        Delete
                                      </button>
                                    </div>
                                  )}
                                </div>
                              )
                            })}
                          </div>
                        )}
                      </div>
                    )
                  })
                )}
              </div>
            </div>
          </div>
        )}

        {images.length > 0 && (
          <section style={styles.sectionCard}>
            <div style={styles.sectionHeaderRow}>
              <h2 style={styles.sectionTitle}>Photos</h2>
              <span style={styles.sectionCount}>{images.length}</span>
            </div>

            <div style={styles.photoGrid}>
              {images.map((image, index) => (
                <SkeletonImage
                  key={image.id ?? index}
                  src={image.file_url}
                  alt={event.title}
                  wrapperStyle={styles.photoWrap}
                  style={styles.photo}
                />
              ))}
            </div>
          </section>
        )}

        {videos.length > 0 && (
          <section style={styles.sectionCard}>
            <div style={styles.sectionHeaderRow}>
              <h2 style={styles.sectionTitle}>Videos</h2>
              <span style={styles.sectionCount}>{videos.length}</span>
            </div>

            <div style={styles.videoGrid}>
              {videos.map((video, index) => (
                <video key={video.id ?? index} controls style={styles.video}>
                  <source src={video.file_url} />
                </video>
              ))}
            </div>
          </section>
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
  topRow: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 18,
    flexWrap: "wrap",
  },
  headerRow: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 12,
    marginBottom: 18,
  },
  topActions: {
    display: "flex",
    gap: 12,
    flexWrap: "wrap",
    alignItems: "center",
  },
  aboutBlock: {
    marginTop: 22,
    paddingTop: 20,
    borderTop: "1px solid rgba(255,255,255,0.08)",
  },
  posterLink: {
    display: "flex",
    alignItems: "flex-start",
    gap: 14,
    flexWrap: "wrap",
    textDecoration: "none",
    color: "inherit",
  },
  modalOverlay: {
    position: "fixed",
    inset: 0,
    background: "rgba(0,0,0,0.68)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    padding: 18,
    zIndex: 100,
  },
  modalCard: {
    width: "100%",
    maxWidth: 760,
    maxHeight: "85vh",
    overflow: "hidden",
    borderRadius: 24,
    border: "1px solid rgba(255,255,255,0.08)",
    background: "linear-gradient(180deg, rgba(18,18,20,0.98), rgba(10,10,12,0.98))",
    boxShadow: "0 10px 40px rgba(0,0,0,0.45)",
    padding: 20,
    display: "flex",
    flexDirection: "column",
  },
  modalHeader: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
    marginBottom: 14,
  },
  modalTitle: {
    margin: 0,
    fontSize: 32,
    fontWeight: 800,
    letterSpacing: "-1px",
  },
  closeButton: {
    width: 42,
    height: 42,
    borderRadius: "50%",
    border: "1px solid rgba(255,255,255,0.10)",
    background: "rgba(255,255,255,0.04)",
    color: "white",
    fontSize: 18,
    cursor: "pointer",
  },
  modalCommentsList: {
    display: "grid",
    gap: 14,
    overflowY: "auto",
    paddingRight: 4,
  },
  backLink: {
    color: "rgba(255,255,255,0.7)",
    textDecoration: "none",
    display: "inline-block",
    fontSize: 15,
    fontWeight: 700,
  },
  headerReportButton: {
    padding: "10px 16px",
    borderRadius: 999,
    border: "1.5px solid rgba(255,255,255,0.22)",
    background: "rgba(255,255,255,0.05)",
    color: "white",
    fontWeight: 700,
    fontSize: 14,
    cursor: "pointer",
  },
  loadingText: {
    color: "rgba(255,255,255,0.5)",
    fontSize: 16,
  },
  notFoundTitle: {
    fontSize: "clamp(34px, 6vw, 58px)",
    margin: 0,
    letterSpacing: "-2px",
  },
  heroCard: {
    borderRadius: 28,
    overflow: "hidden",
    border: "1px solid rgba(255,255,255,0.08)",
    background: "linear-gradient(180deg, rgba(18,18,20,0.98), rgba(10,10,12,0.98))",
    boxShadow: "0 10px 30px rgba(0,0,0,0.35)",
    marginBottom: 20,
  },
  heroImageWrap: {
    position: "relative",
    minHeight: 420,
  },
  heroImageShell: {
    width: "100%",
    height: 420,
  },
  heroImage: {
    width: "100%",
    height: 420,
    objectFit: "cover",
    display: "block",
  },
  heroOverlay: {
    position: "absolute",
    inset: 0,
    background:
      "linear-gradient(to top, rgba(0,0,0,0.82), rgba(0,0,0,0.18) 45%, rgba(0,0,0,0.1))",
  },
  heroContent: {
    position: "absolute",
    inset: 0,
    display: "flex",
    flexDirection: "column",
    justifyContent: "space-between",
    padding: 20,
  },
  heroTopRow: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 10,
    flexWrap: "wrap",
  },
  categoryChip: {
    padding: "9px 13px",
    borderRadius: 999,
    fontSize: 12,
    fontWeight: 700,
    backdropFilter: "blur(10px)",
  },
  mediaCountChip: {
    padding: "9px 13px",
    borderRadius: 999,
    background: "rgba(255,255,255,0.12)",
    color: "white",
    fontSize: 12,
    fontWeight: 700,
    border: "1px solid rgba(255,255,255,0.12)",
    backdropFilter: "blur(10px)",
  },
  heroTitle: {
    margin: "0 0 12px 0",
    fontSize: "clamp(40px, 8vw, 72px)",
    lineHeight: 0.96,
    letterSpacing: "-3px",
    fontWeight: 800,
    wordBreak: "break-word",
    overflowWrap: "anywhere",
  },
  heroMetaRow: {
    display: "flex",
    alignItems: "center",
    gap: 10,
    flexWrap: "wrap",
    marginBottom: 10,
  },
  heroMetaText: {
    color: "rgba(255,255,255,0.88)",
    fontSize: 17,
  },
  heroMetaDot: {
    color: "rgba(255,255,255,0.35)",
  },
  noImageHeader: {
    padding: 24,
  },
  infoCard: {
    borderRadius: 24,
    border: "1px solid rgba(255,255,255,0.08)",
    background: "linear-gradient(180deg, rgba(18,18,20,0.98), rgba(10,10,12,0.98))",
    boxShadow: "0 10px 30px rgba(0,0,0,0.35)",
    padding: 22,
    marginBottom: 20,
  },
  actionButton: {
    minWidth: 56,
    padding: "13px 17px",
    borderRadius: 999,
    border: "1.5px solid rgba(255,255,255,0.22)",
    background: "rgba(255,255,255,0.05)",
    color: "white",
    fontWeight: 700,
    fontSize: 15,
    cursor: "pointer",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    boxShadow: "0 0 0 1px rgba(255,255,255,0.03) inset",
  },
  actionIcon: {
    fontSize: 17,
    lineHeight: 1,
  },
  actionButtonActive: {
    background: "rgba(255,255,255,0.08)",
    border: "1.5px solid rgba(255,255,255,0.32)",
    color: "white",
  },
  actionButtonDanger: {
    background: "rgba(255, 70, 110, 0.12)",
    border: "1px solid rgba(255, 70, 110, 0.30)",
    color: "#ffd6e2",
  },
  deleteModalCard: {
    width: "100%",
    maxWidth: 480,
    borderRadius: 24,
    border: "1px solid rgba(255,255,255,0.08)",
    background:
      "linear-gradient(180deg, rgba(18,18,20,0.98), rgba(10,10,12,0.98))",
    boxShadow: "0 10px 40px rgba(0,0,0,0.45)",
    padding: 24,
  },
  deleteTitle: {
    margin: "0 0 10px 0",
    fontSize: 28,
    fontWeight: 800,
    letterSpacing: "-1px",
  },
  deleteBody: {
    margin: "0 0 22px 0",
    color: "rgba(255,255,255,0.75)",
    lineHeight: 1.55,
    fontSize: 15,
  },
  deleteButtonRow: {
    display: "flex",
    gap: 10,
    flexWrap: "wrap",
    justifyContent: "flex-end",
  },
  deleteCancelButton: {
    padding: "13px 18px",
    borderRadius: 999,
    border: "1px solid rgba(255,255,255,0.10)",
    background: "rgba(255,255,255,0.04)",
    color: "white",
    fontWeight: 700,
    fontSize: 15,
    cursor: "pointer",
  },
  deleteConfirmButton: {
    padding: "13px 18px",
    borderRadius: 999,
    border: "1px solid rgba(255, 70, 110, 0.45)",
    background: "rgba(255, 70, 110, 0.22)",
    color: "#ffd6e2",
    fontWeight: 800,
    fontSize: 15,
    cursor: "pointer",
  },
  posterRow: {
    display: "flex",
    alignItems: "flex-start",
    gap: 14,
    flexWrap: "wrap",
  },
  posterAvatarWrap: {
    width: 64,
    height: 64,
    borderRadius: "50%",
    flexShrink: 0,
  },
  posterAvatar: {
    width: 64,
    height: 64,
    borderRadius: "50%",
    objectFit: "cover",
    border: "1px solid rgba(255,255,255,0.10)",
    flexShrink: 0,
  },
  posterAvatarPlaceholder: {
    width: 64,
    height: 64,
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
    marginBottom: 6,
  },
  posterName: {
    margin: 0,
    fontSize: 28,
    fontWeight: 800,
    letterSpacing: "-1px",
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
  posterBio: {
    margin: 0,
    color: "rgba(255,255,255,0.76)",
    fontSize: 15,
    lineHeight: 1.6,
  },
  commentComposer: {
    display: "grid",
    gap: 12,
    marginBottom: 18,
  },
  commentInput: {
    padding: "16px",
    borderRadius: 18,
    border: "1px solid rgba(255,255,255,0.08)",
    background: "rgba(255,255,255,0.03)",
    color: "white",
    outline: "none",
    fontSize: 15,
    resize: "vertical",
    minHeight: 100,
  },
  commentButton: {
    justifySelf: "start",
    padding: "14px 18px",
    borderRadius: 999,
    border: "1px solid rgba(255,255,255,0.18)",
    background: "rgba(255,255,255,0.96)",
    color: "#050505",
    fontWeight: 800,
    fontSize: 15,
    cursor: "pointer",
  },
  commentCard: {
    borderRadius: 18,
    border: "1px solid rgba(255,255,255,0.08)",
    background: "rgba(255,255,255,0.03)",
    padding: 16,
  },
  commentHeader: {
    marginBottom: 10,
  },
  commentUserRow: {
    display: "flex",
    alignItems: "center",
    gap: 10,
    flexWrap: "wrap",
  },
  commentAvatarWrap: {
    width: 42,
    height: 42,
    borderRadius: "50%",
  },
  commentAvatar: {
    width: 42,
    height: 42,
    borderRadius: "50%",
    objectFit: "cover",
    border: "1px solid rgba(255,255,255,0.10)",
  },
  commentAvatarPlaceholder: {
    width: 42,
    height: 42,
    borderRadius: "50%",
    background: "rgba(255,255,255,0.08)",
    border: "1px solid rgba(255,255,255,0.08)",
  },
  commentNameRow: {
    display: "flex",
    alignItems: "center",
    gap: 8,
    flexWrap: "wrap",
  },
  commentName: {
    margin: 0,
    fontSize: 15,
    fontWeight: 700,
    color: "white",
  },
  commentVerifiedBadge: {
    padding: "5px 8px",
    borderRadius: 999,
    background: "rgba(92,120,255,0.18)",
    border: "1px solid rgba(92,120,255,0.35)",
    color: "#dbe4ff",
    fontSize: 10,
    fontWeight: 700,
  },
  commentDate: {
    margin: "2px 0 0 0",
    fontSize: 13,
    color: "rgba(255,255,255,0.56)",
  },
  commentText: {
    margin: 0,
    color: "rgba(255,255,255,0.88)",
    lineHeight: 1.65,
    fontSize: 15,
    wordBreak: "break-word",
    overflowWrap: "anywhere",
  },
  commentActionsRow: {
    marginTop: 12,
    display: "flex",
    gap: 10,
  },
  replyToggleButton: {
    padding: "8px 12px",
    borderRadius: 999,
    border: "1px solid rgba(255,255,255,0.10)",
    background: "rgba(255,255,255,0.04)",
    color: "white",
    fontWeight: 700,
    fontSize: 13,
    cursor: "pointer",
  },
  deleteCommentButton: {
    padding: "8px 12px",
    borderRadius: 999,
    border: "1px solid rgba(255, 90, 120, 0.22)",
    background: "rgba(255, 90, 120, 0.10)",
    color: "#ffd8e2",
    fontWeight: 700,
    fontSize: 13,
    cursor: "pointer",
  },
  replyComposer: {
    display: "grid",
    gap: 10,
    marginTop: 14,
    paddingTop: 14,
    borderTop: "1px solid rgba(255,255,255,0.08)",
  },
  replyInput: {
    padding: "14px",
    borderRadius: 16,
    border: "1px solid rgba(255,255,255,0.08)",
    background: "rgba(255,255,255,0.03)",
    color: "white",
    outline: "none",
    fontSize: 14,
    resize: "vertical",
    minHeight: 84,
  },
  replyButtonRow: {
    display: "flex",
    gap: 10,
    justifyContent: "flex-end",
    flexWrap: "wrap",
  },
  replyCancelButton: {
    padding: "11px 14px",
    borderRadius: 999,
    border: "1px solid rgba(255,255,255,0.10)",
    background: "rgba(255,255,255,0.04)",
    color: "white",
    fontWeight: 700,
    fontSize: 13,
    cursor: "pointer",
  },
  replySubmitButton: {
    padding: "11px 14px",
    borderRadius: 999,
    border: "1px solid rgba(255,255,255,0.18)",
    background: "rgba(255,255,255,0.96)",
    color: "#050505",
    fontWeight: 800,
    fontSize: 13,
    cursor: "pointer",
  },
  replyList: {
    display: "grid",
    gap: 10,
    marginTop: 14,
    paddingLeft: 18,
    borderLeft: "1px solid rgba(255,255,255,0.08)",
  },
  replyCard: {
    borderRadius: 16,
    border: "1px solid rgba(255,255,255,0.07)",
    background: "rgba(255,255,255,0.025)",
    padding: 14,
  },
  emptyText: {
    margin: 0,
    color: "rgba(255,255,255,0.56)",
    fontSize: 15,
  },
  sectionCard: {
    borderRadius: 24,
    border: "1px solid rgba(255,255,255,0.08)",
    background: "linear-gradient(180deg, rgba(18,18,20,0.98), rgba(10,10,12,0.98))",
    boxShadow: "0 10px 30px rgba(0,0,0,0.35)",
    padding: 22,
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
  sectionTitle: {
    margin: 0,
    fontSize: "clamp(24px, 4vw, 34px)",
    lineHeight: 1,
    letterSpacing: "-1px",
    fontWeight: 800,
  },
  sectionCount: {
    padding: "7px 11px",
    borderRadius: 999,
    background: "rgba(255,255,255,0.06)",
    border: "1px solid rgba(255,255,255,0.08)",
    color: "rgba(255,255,255,0.7)",
    fontSize: 13,
  },
  description: {
    margin: 0,
    color: "rgba(255,255,255,0.88)",
    lineHeight: 1.75,
    fontSize: 16,
    wordBreak: "break-word",
    overflowWrap: "anywhere",
  },
  photoGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
    gap: 14,
  },
  photoWrap: {
    width: "100%",
    height: 260,
    borderRadius: 18,
  },
  photo: {
    width: "100%",
    height: 260,
    objectFit: "cover",
    borderRadius: 18,
    display: "block",
  },
  videoGrid: {
    display: "grid",
    gap: 16,
  },
  video: {
    width: "100%",
    borderRadius: 18,
    backgroundColor: "#111",
    display: "block",
  },
}
