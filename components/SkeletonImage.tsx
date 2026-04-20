"use client"

import {
  type CSSProperties,
  type ImgHTMLAttributes,
  type RefCallback,
  type SyntheticEvent,
  useRef,
  useState,
} from "react"

type SkeletonImageProps = Omit<ImgHTMLAttributes<HTMLImageElement>, "style"> & {
  wrapperStyle?: CSSProperties
  style?: CSSProperties
  skeletonStyle?: CSSProperties
}

export default function SkeletonImage({
  alt = "",
  wrapperStyle,
  style,
  skeletonStyle,
  onLoad,
  onError,
  ...props
}: SkeletonImageProps) {
  const imgRef = useRef<HTMLImageElement | null>(null)
  const src = typeof props.src === "string" ? props.src : props.src?.toString() || ""
  const [loadedSrc, setLoadedSrc] = useState("")
  const loaded = !!src && loadedSrc === src

  const handleLoad = (event: SyntheticEvent<HTMLImageElement>) => {
    setLoadedSrc(src)
    onLoad?.(event)
  }

  const handleError = (event: SyntheticEvent<HTMLImageElement>) => {
    setLoadedSrc(src)
    onError?.(event)
  }

  const handleRef: RefCallback<HTMLImageElement> = (node) => {
    imgRef.current = node

    if (node?.complete && (node.naturalWidth || 0) > 0 && loadedSrc !== src) {
      setLoadedSrc(src)
    }
  }

  const borderRadius = wrapperStyle?.borderRadius ?? style?.borderRadius ?? 0

  return (
    <>
      <div
        style={{
          ...styles.wrapper,
          borderRadius,
          ...wrapperStyle,
        }}
      >
        {!loaded && (
          <div
            aria-hidden="true"
            style={{
              ...styles.skeleton,
              borderRadius,
              ...skeletonStyle,
            }}
          />
        )}

        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          ref={handleRef}
          {...props}
          alt={alt}
          onLoad={handleLoad}
          onError={handleError}
          style={{
            ...styles.image,
            ...style,
            opacity: loaded ? 1 : 0,
          }}
        />
      </div>

      <style jsx>{`
        @keyframes skeleton-shimmer {
          0% {
            transform: translateX(-100%);
          }

          100% {
            transform: translateX(100%);
          }
        }
      `}</style>
    </>
  )
}

const styles: Record<string, CSSProperties> = {
  wrapper: {
    position: "relative",
    overflow: "hidden",
    background:
      "linear-gradient(135deg, rgba(255,255,255,0.05), rgba(255,255,255,0.02))",
  },
  skeleton: {
    position: "absolute",
    inset: 0,
    background:
      "linear-gradient(90deg, rgba(255,255,255,0.04) 0%, rgba(255,255,255,0.12) 50%, rgba(255,255,255,0.04) 100%)",
    transform: "translateX(-100%)",
    animation: "skeleton-shimmer 1.15s ease-in-out infinite",
  },
  image: {
    display: "block",
    transition: "opacity 180ms ease",
  },
}
