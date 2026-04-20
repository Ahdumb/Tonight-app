"use client"

import { useCallback, useState } from "react"
import Cropper, { Area } from "react-easy-crop"
import { getCroppedImg } from "@/lib/cropImage"

type Props = {
  imageSrc: string
  aspect: number
  open: boolean
  title?: string
  onClose: () => void
  onDone: (croppedFile: File, croppedUrl: string) => void
}

export default function ImageCropModal({
  imageSrc,
  aspect,
  open,
  title = "Crop image",
  onClose,
  onDone,
}: Props) {
  const [crop, setCrop] = useState({ x: 0, y: 0 })
  const [zoom, setZoom] = useState(1)
  const [croppedAreaPixels, setCroppedAreaPixels] = useState<Area | null>(null)
  const [saving, setSaving] = useState(false)

  const onCropComplete = useCallback((_: Area, croppedPixels: Area) => {
    setCroppedAreaPixels(croppedPixels)
  }, [])

  const handleDone = async () => {
    if (!croppedAreaPixels) return

    try {
      setSaving(true)
      const { file, url } = await getCroppedImg(imageSrc, croppedAreaPixels)
      onDone(file, url)
    } catch (error) {
      console.error(error)
      alert("There was a problem cropping the image.")
    } finally {
      setSaving(false)
    }
  }

  if (!open) return null

  return (
    <div style={styles.overlay} onClick={onClose}>
      <div style={styles.modal} onClick={(e) => e.stopPropagation()}>
        <div style={styles.header}>
          <h2 style={styles.title}>{title}</h2>
          <button style={styles.closeButton} onClick={onClose}>
            ✕
          </button>
        </div>

        <div style={styles.cropWrap}>
          <Cropper
            image={imageSrc}
            crop={crop}
            zoom={zoom}
            aspect={aspect}
            onCropChange={setCrop}
            onZoomChange={setZoom}
            onCropComplete={onCropComplete}
          />
        </div>

        <div style={styles.controls}>
          <label style={styles.zoomLabel}>Zoom</label>
          <input
            type="range"
            min={1}
            max={3}
            step={0.01}
            value={zoom}
            onChange={(e) => setZoom(Number(e.target.value))}
            style={styles.range}
          />
        </div>

        <div style={styles.buttonRow}>
          <button style={styles.secondaryButton} onClick={onClose}>
            Cancel
          </button>
          <button style={styles.primaryButton} onClick={handleDone} disabled={saving}>
            {saving ? "Saving..." : "Use Crop"}
          </button>
        </div>
      </div>
    </div>
  )
}

const styles: Record<string, React.CSSProperties> = {
  overlay: {
    position: "fixed",
    inset: 0,
    background: "rgba(0,0,0,0.72)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    padding: 18,
    zIndex: 200,
  },
  modal: {
    width: "100%",
    maxWidth: 820,
    borderRadius: 24,
    border: "1px solid rgba(255,255,255,0.08)",
    background: "linear-gradient(180deg, rgba(18,18,20,0.98), rgba(10,10,12,0.98))",
    boxShadow: "0 12px 40px rgba(0,0,0,0.45)",
    padding: 18,
  },
  header: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 14,
  },
  title: {
    margin: 0,
    color: "white",
    fontSize: 28,
    fontWeight: 800,
    letterSpacing: "-1px",
  },
  closeButton: {
    width: 40,
    height: 40,
    borderRadius: "50%",
    border: "1px solid rgba(255,255,255,0.08)",
    background: "rgba(255,255,255,0.04)",
    color: "white",
    cursor: "pointer",
    fontSize: 16,
  },
  cropWrap: {
    position: "relative",
    width: "100%",
    height: 420,
    borderRadius: 18,
    overflow: "hidden",
    background: "#111",
    marginBottom: 16,
  },
  controls: {
    display: "grid",
    gap: 8,
    marginBottom: 16,
  },
  zoomLabel: {
    color: "rgba(255,255,255,0.74)",
    fontSize: 14,
    fontWeight: 600,
  },
  range: {
    width: "100%",
  },
  buttonRow: {
    display: "flex",
    gap: 12,
    justifyContent: "flex-end",
    flexWrap: "wrap",
  },
  primaryButton: {
    padding: "12px 16px",
    borderRadius: 999,
    border: "1px solid rgba(255,255,255,0.18)",
    background: "rgba(255,255,255,0.96)",
    color: "#050505",
    fontWeight: 800,
    cursor: "pointer",
  },
  secondaryButton: {
    padding: "12px 16px",
    borderRadius: 999,
    border: "1px solid rgba(255,255,255,0.10)",
    background: "rgba(255,255,255,0.04)",
    color: "white",
    fontWeight: 700,
    cursor: "pointer",
  },
}