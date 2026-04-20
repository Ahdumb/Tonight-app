import { NextResponse } from "next/server"

export async function GET() {
  return NextResponse.json({
    ok: true,
    service: "whats-going-on",
    timestamp: new Date().toISOString(),
  })
}
