export const USERNAME_PATTERN = /^[A-Za-z0-9.]+$/

export function normalizeUsername(value: string) {
  return value.trim().replace(/^@+/, "").replace(/[^A-Za-z0-9.]/g, "")
}

export function isValidUsername(value: string) {
  return USERNAME_PATTERN.test(value)
}

type DbErrorLike = {
  code?: string
  message?: string
  details?: string
}

export function getUsernameErrorMessage(error?: DbErrorLike | null) {
  const details = `${error?.message || ""} ${error?.details || ""}`.toLowerCase()

  if (details.includes("profiles_username_unique_idx") || error?.code === "23505") {
    return "That username is already taken."
  }

  if (
    details.includes("profiles_username_format_check") ||
    error?.code === "23514"
  ) {
    return "Usernames can only contain letters, numbers, and periods."
  }

  return null
}
