"use client"

import { useEffect } from "react"

function isIOSDevice() {
  if (typeof window === "undefined") return false

  const userAgent = window.navigator.userAgent
  const platform = window.navigator.platform
  const maxTouchPoints = window.navigator.maxTouchPoints || 0

  return (
    /iPad|iPhone|iPod/.test(userAgent) ||
    (platform === "MacIntel" && maxTouchPoints > 1)
  )
}

export default function PlatformClassName() {
  useEffect(() => {
    const root = document.documentElement

    if (isIOSDevice()) {
      root.classList.add("platform-ios")
    }

    return () => {
      root.classList.remove("platform-ios")
    }
  }, [])

  return null
}
