"use client"

import Link from "next/link"
import { useRouter } from "next/navigation"
import { useState } from "react"
import { supabase } from "@/lib/supabase"
import { useToast } from "@/components/Toast"
import {
  getUsernameErrorMessage,
  isValidUsername,
  normalizeUsername,
} from "@/lib/username"

export default function AuthPage() {
  const router = useRouter()
  const toast = useToast()

  const [mode, setMode] = useState<"signin" | "signup">("signup")
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [username, setUsername] = useState("")
  const [organizationName, setOrganizationName] = useState("")
  const [accountType, setAccountType] = useState("organization")
  const [loading, setLoading] = useState(false)
  const isUserAccount = accountType === "user"
  const nameLabel = isUserAccount ? "Display name" : "Organization name"
  const namePlaceholder = isUserAccount ? "Your name" : "Organization name"

  const ensureProfile = async (userId: string, userEmail: string) => {
    const normalizedUsername = normalizeUsername(username)

    const { data: existing } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", userId)
      .maybeSingle()

    if (existing) return

    const { error } = await supabase.from("profiles").insert([
      {
        id: userId,
        email: userEmail,
        username: normalizedUsername || null,
        display_name: isUserAccount ? organizationName || null : null,
        organization_name: isUserAccount ? null : organizationName || null,
        account_type: accountType,
        is_verified: false,
      },
    ])

    if (error) {
      throw error
    }
  }

  const handleAuth = async () => {
    const normalizedUsername = normalizeUsername(username)

    if (!email || !password) {
      toast.error("Please enter your email and password.")
      return
    }

    if (mode === "signup" && !normalizedUsername) {
      toast.error("Please choose a username.")
      return
    }

    if (mode === "signup" && !isValidUsername(normalizedUsername)) {
      toast.error("Usernames can only contain letters, numbers, and periods.")
      return
    }

    setLoading(true)

    if (mode === "signup") {
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
      })

      if (error) {
        console.error(error)
        toast.error(error.message)
        setLoading(false)
        return
      }

      const user = data.user

      if (user?.id && user.email) {
        try {
          await ensureProfile(user.id, user.email)
        } catch (profileError) {
          console.error(profileError)
          toast.error(
            getUsernameErrorMessage(profileError as { code?: string; message?: string; details?: string }) ||
              "There was an error creating your profile."
          )
          setLoading(false)
          return
        }
      }

      setLoading(false)
      toast.success("Account created successfully.")
      router.push("/profile")
      return
    }

    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    })

    if (error) {
      console.error(error)
      toast.error(error.message)
      setLoading(false)
      return
    }

    const user = data.user

    if (user?.id && user.email) {
      try {
        await ensureProfile(user.id, user.email)
      } catch (profileError) {
        console.error(profileError)
        toast.error(
          getUsernameErrorMessage(profileError as { code?: string; message?: string; details?: string }) ||
            "There was an error loading your profile."
        )
        setLoading(false)
        return
      }
    }

    setLoading(false)
    router.push("/profile")
  }

  return (
    <main style={styles.page}>
      <div style={styles.container}>
        <Link href="/" style={styles.backLink}>
          ← Back
        </Link>

        <div style={styles.headerBlock}>
          <div style={styles.sectionPill}>Account</div>
          <h1 style={styles.title}>
            {mode === "signup" ? "Create Account" : "Sign In"}
          </h1>
          <p style={styles.subtitle}>
            {mode === "signup"
              ? "Set up your TONIGHT account."
              : "Welcome back."}
          </p>
        </div>

        <section style={styles.card}>
          <div style={styles.toggleRow}>
            <button
              onClick={() => setMode("signup")}
              style={{
                ...styles.toggleButton,
                ...(mode === "signup" ? styles.toggleButtonActive : {}),
              }}
            >
              Sign Up
            </button>
            <button
              onClick={() => setMode("signin")}
              style={{
                ...styles.toggleButton,
                ...(mode === "signin" ? styles.toggleButtonActive : {}),
              }}
            >
              Sign In
            </button>
          </div>

          <div style={styles.formGrid}>
            {mode === "signup" && (
              <>
                <div style={styles.fieldGroup}>
                  <label style={styles.label}>Username</label>
                  <input
                    type="text"
                    value={username}
                    onChange={(e) => setUsername(normalizeUsername(e.target.value))}
                    placeholder="@tonightuser"
                    style={styles.input}
                  />
                  <p style={styles.helperText}>
                    Use only letters, numbers, and periods.
                  </p>
                </div>

                <div style={styles.fieldGroup}>
                  <label style={styles.label}>Account type</label>
                  <select
                    value={accountType}
                    onChange={(e) => setAccountType(e.target.value)}
                    style={styles.input}
                  >
                    <option value="organization" style={{ color: "black" }}>
                      Organization
                    </option>
                    <option value="user" style={{ color: "black" }}>
                      User
                    </option>
                  </select>
                </div>

                <div style={styles.fieldGroupFull}>
                  <label style={styles.label}>{nameLabel}</label>
                  <input
                    type="text"
                    value={organizationName}
                    onChange={(e) => setOrganizationName(e.target.value)}
                    placeholder={namePlaceholder}
                    style={styles.input}
                  />
                </div>
              </>
            )}

            <div style={styles.fieldGroup}>
              <label style={styles.label}>Email</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="name@email.com"
                style={styles.input}
              />
            </div>

            <div style={styles.fieldGroup}>
              <label style={styles.label}>Password</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Password"
                style={styles.input}
              />
            </div>
          </div>

          <button
            onClick={handleAuth}
            disabled={loading}
            style={{
              ...styles.submitButton,
              opacity: loading ? 0.7 : 1,
            }}
          >
            {loading
              ? "Please wait..."
              : mode === "signup"
              ? "Create Account"
              : "Sign In"}
          </button>
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
    maxWidth: 760,
    margin: "0 auto",
  },
  backLink: {
    color: "rgba(255,255,255,0.62)",
    textDecoration: "none",
    display: "inline-block",
    marginBottom: 22,
    fontSize: 15,
  },
  headerBlock: {
    marginBottom: 24,
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
  card: {
    borderRadius: 28,
    border: "1px solid rgba(255,255,255,0.08)",
    background: "linear-gradient(180deg, rgba(18,18,20,0.98), rgba(10,10,12,0.98))",
    boxShadow: "0 10px 30px rgba(0,0,0,0.35)",
    padding: 22,
  },
  toggleRow: {
    display: "grid",
    gridTemplateColumns: "1fr 1fr",
    gap: 10,
    marginBottom: 18,
  },
  toggleButton: {
    padding: "14px 16px",
    borderRadius: 16,
    border: "1px solid rgba(255,255,255,0.08)",
    background: "rgba(255,255,255,0.03)",
    color: "rgba(255,255,255,0.72)",
    cursor: "pointer",
    fontWeight: 700,
  },
  toggleButtonActive: {
    background: "white",
    color: "#050505",
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
  helperText: {
    margin: 0,
    fontSize: 13,
    color: "rgba(255,255,255,0.48)",
    lineHeight: 1.45,
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
