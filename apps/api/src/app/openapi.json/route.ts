import { generateOpenApiSpec } from "@/lib/openapi"
import { corsHeaders } from "@/lib/cors"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

let cachedSpec: string | null = null

export async function GET(request: Request) {
  if (!cachedSpec) {
    cachedSpec = JSON.stringify(generateOpenApiSpec(), null, 2)
  }

  const headers = {
    ...corsHeaders(request, "GET, OPTIONS"),
    "Content-Type": "application/json",
    "Cache-Control": "public, max-age=300, s-maxage=3600",
  }

  return new Response(cachedSpec, { status: 200, headers })
}

export async function OPTIONS(request: Request) {
  return new Response(null, {
    status: 204,
    headers: corsHeaders(request, "GET, OPTIONS"),
  })
}
