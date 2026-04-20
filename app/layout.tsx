import type { Metadata } from "next"
import { Arimo } from "next/font/google"
import "./globals.css"
import BottomNav from "@/components/BottomNav"
import PlatformClassName from "@/components/PlatformClassName"
import { ToastProvider } from "@/components/Toast"

const arimo = Arimo({
  subsets: ["latin"],
  variable: "--font-ios-match",
  display: "swap",
})

export const metadata: Metadata = {
  title: "TONIGHT.",
  description: "Find what's happening after dark.",
  icons: {
    icon: [
      { url: "/icon.png", sizes: "512x512", type: "image/png" },
      { url: "/favicon.ico", sizes: "any" },
    ],
    apple: [{ url: "/apple-icon.png", sizes: "180x180", type: "image/png" }],
    shortcut: ["/favicon.ico"],
  },
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en" className={arimo.variable}>
      <body suppressHydrationWarning style={styles.body}>
        <ToastProvider>
          <PlatformClassName />
          <div style={styles.backgroundGlowOne} />
          <div style={styles.backgroundGlowTwo} />
          <div style={styles.backgroundGlowThree} />
          <div style={styles.backgroundGlowFour} />

          <div style={styles.appShell}>
            {children}
            <BottomNav />
          </div>
        </ToastProvider>
      </body>
    </html>
  )
}

const styles: Record<string, React.CSSProperties> = {
  body: {
    margin: 0,
    minHeight: "100vh",
    background:
      "radial-gradient(circle at top, rgba(48,48,60,0.18), transparent 30%), #050505",
    position: "relative",
    overflowX: "hidden",
  },
  appShell: {
    position: "relative",
    zIndex: 1,
    minHeight: "100vh",
  },
  backgroundGlowOne: {
    position: "fixed",
    top: 40,
    left: -120,
    width: 260,
    height: 260,
    borderRadius: "50%",
    background: "rgba(120, 120, 255, 0.09)",
    filter: "blur(70px)",
    pointerEvents: "none",
    zIndex: 0,
  },
  backgroundGlowTwo: {
    position: "fixed",
    top: 420,
    right: -110,
    width: 220,
    height: 220,
    borderRadius: "50%",
    background: "rgba(130, 170, 255, 0.05)",
    filter: "blur(70px)",
    pointerEvents: "none",
    zIndex: 0,
  },
  backgroundGlowThree: {
    position: "fixed",
    top: 880,
    left: -80,
    width: 200,
    height: 200,
    borderRadius: "50%",
    background: "rgba(100, 110, 255, 0.05)",
    filter: "blur(65px)",
    pointerEvents: "none",
    zIndex: 0,
  },
  backgroundGlowFour: {
    position: "fixed",
    bottom: 80,
    right: 30,
    width: 180,
    height: 180,
    borderRadius: "50%",
    background: "rgba(255, 255, 255, 0.03)",
    filter: "blur(60px)",
    pointerEvents: "none",
    zIndex: 0,
  },
}
