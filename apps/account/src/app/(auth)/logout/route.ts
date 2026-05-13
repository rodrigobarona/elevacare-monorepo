import { NextResponse, type NextRequest } from "next/server"
import { signOut } from "@workos-inc/authkit-nextjs"

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || "https://eleva.care"

async function handler(_req: NextRequest) {
  await signOut()
  return NextResponse.redirect(new URL("/", APP_URL))
}

export const GET = handler
export const POST = handler
