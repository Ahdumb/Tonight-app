import { supabase } from "@/lib/supabase"

type ReportTarget =
  | {
      reporterProfileId: string
      targetType: "event"
      targetEventId: number
      reason: string
      details?: string
    }
  | {
      reporterProfileId: string
      targetType: "profile"
      targetProfileId: string
      reason: string
      details?: string
    }

export async function createReport(report: ReportTarget) {
  const payload =
    report.targetType === "event"
      ? {
          reporter_profile_id: report.reporterProfileId,
          target_type: report.targetType,
          target_event_id: report.targetEventId,
          reason: report.reason,
          details: report.details || null,
        }
      : {
          reporter_profile_id: report.reporterProfileId,
          target_type: report.targetType,
          target_profile_id: report.targetProfileId,
          reason: report.reason,
          details: report.details || null,
        }

  const { error } = await supabase.from("reports").insert(payload)

  if (error) {
    console.error("Report insert error:", error.message || error)
    throw error
  }
}
