import { GET as handleGet, POST as handlePost } from "@eleva/auth/server/auth"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

export const GET = handleGet
export const POST = handlePost

export function OPTIONS(request: Request) {
  return handleGet(request)
}
