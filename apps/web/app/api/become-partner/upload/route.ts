/**
 * Vercel Blob client-upload handler for Become-Partner documents.
 *
 * The route delegates to `@eleva/billing/uploads-handler` which owns
 * the @vercel/blob/client.handleUpload integration. Auth here is
 * mandatory: applicants must be signed in to mint an upload token.
 */

import { handleApplicationDocumentUpload } from "@eleva/billing/uploads-handler"
import { getSession } from "@eleva/auth"

export async function POST(request: Request): Promise<Response> {
  try {
    // Read session at route level where the Next.js ALS context (and
    // the proxy-injected x-workos-middleware header) is available.
    // Inside handleUpload's callbacks the context may no longer carry
    // the header, causing AuthKit's server-side withAuth() to throw.
    const session = await getSession()

    return await handleApplicationDocumentUpload({
      request,
      authorize: async (pathname) => {
        if (!session) {
          throw new Error("unauthorized")
        }
        const match = pathname.match(
          /^become-partner\/(license|id|cv|professional_insurance)\/[^/]+$/
        )
        if (!match) {
          throw new Error("invalid-pathname")
        }
        const kind = match[1]!
        return {
          applicantUserId: session.user.id,
          kind,
        }
      },
    })
  } catch (err) {
    console.error("become-partner upload failed", err)
    return Response.json(
      { error: "upload-rejected" },
      {
        status: 400,
        headers: { "Cache-Control": "no-store" },
      }
    )
  }
}
