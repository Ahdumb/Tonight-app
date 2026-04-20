"use client"

import { createContext, useContext, useState, useCallback, ReactNode } from "react"

type ToastType = "success" | "error" | "info"

type Toast = {
  id: number
  message: string
  type: ToastType
}

type ToastContextValue = {
  success: (message: string) => void
  error: (message: string) => void
  info: (message: string) => void
}

const ToastContext = createContext<ToastContextValue | null>(null)

export function useToast() {
  const context = useContext(ToastContext)
  if (!context) {
    throw new Error("useToast must be used inside a ToastProvider")
  }
  return context
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([])

  const removeToast = useCallback((id: number) => {
    setToasts((prev) => prev.filter((t) => t.id !== id))
  }, [])

  const addToast = useCallback(
    (message: string, type: ToastType) => {
      const id = Date.now() + Math.random()
      setToasts((prev) => [...prev, { id, message, type }])

      setTimeout(() => {
        removeToast(id)
      }, 4000)
    },
    [removeToast]
  )

  const value: ToastContextValue = {
    success: (message) => addToast(message, "success"),
    error: (message) => addToast(message, "error"),
    info: (message) => addToast(message, "info"),
  }

  return (
    <ToastContext.Provider value={value}>
      {children}

      <div style={styles.container}>
        {toasts.map((toast) => (
          <div
            key={toast.id}
            style={{
              ...styles.toast,
              ...getTypeStyles(toast.type),
            }}
            onClick={() => removeToast(toast.id)}
          >
            <span style={styles.icon}>{getIcon(toast.type)}</span>
            <span style={styles.message}>{toast.message}</span>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  )
}

function getIcon(type: ToastType) {
  switch (type) {
    case "success":
      return "✓"
    case "error":
      return "✕"
    case "info":
      return "i"
  }
}

function getTypeStyles(type: ToastType): React.CSSProperties {
  switch (type) {
    case "success":
      return {
        background: "rgba(30, 40, 38, 0.96)",
        border: "1px solid rgba(80, 210, 170, 0.35)",
        color: "#d9fff2",
      }
    case "error":
      return {
        background: "rgba(40, 28, 32, 0.96)",
        border: "1px solid rgba(255, 70, 110, 0.35)",
        color: "#ffd6e2",
      }
    case "info":
      return {
        background: "rgba(28, 32, 40, 0.96)",
        border: "1px solid rgba(92, 120, 255, 0.35)",
        color: "#dbe4ff",
      }
  }
}

const styles: Record<string, React.CSSProperties> = {
  container: {
    position: "fixed",
    top: 20,
    left: "50%",
    transform: "translateX(-50%)",
    display: "flex",
    flexDirection: "column",
    gap: 10,
    zIndex: 200,
    pointerEvents: "none",
    width: "calc(100% - 32px)",
    maxWidth: 480,
  },
  toast: {
    padding: "14px 18px",
    borderRadius: 16,
    boxShadow: "0 10px 30px rgba(0,0,0,0.45)",
    backdropFilter: "blur(18px)",
    WebkitBackdropFilter: "blur(18px)",
    display: "flex",
    alignItems: "center",
    gap: 12,
    cursor: "pointer",
    pointerEvents: "auto",
    fontSize: 15,
    fontWeight: 600,
    animation: "toastSlideIn 260ms ease",
  },
  icon: {
    fontSize: 16,
    fontWeight: 800,
    flexShrink: 0,
  },
  message: {
    flex: 1,
    lineHeight: 1.4,
    wordBreak: "break-word",
  },
}