/**
 * Vercel Blob client-upload handler for Become-Partner documents.
 *
 * The route delegates to `@eleva/billing/uploads-handler` which owns
 * the @vercel/blob/client.handleUpload integration. Auth here is
 * mandatory: applicants must be signed in to mint an upload token.
 */

import { handleApplicationDocumentUpload } from "@eleva/billing/uploads-handler"
import { getSession } from "@eleva/auth"

const ALLOWED_KINDS = new Set(["license", "id", "cv", "professional_insurance"])

export async function POST(request: Request): Promise<Response> {
  const session = await getSession()
  if (!session) {
    return Response.json(
      { error: "unauthorized" },
      {
        status: 401,
        headers: { "Cache-Control": "no-store" },
      }
    )
  }

  try {
    return await handleApplicationDocumentUpload({
      request,
      authorize: (pathname) => {
        // Pathname shape: become-partner/<kind>/<filename>
        const match = pathname.match(
          /^become-partner\/(license|id|cv|professional_insurance)\/[^/]+$/
        )
        if (!match) {
          throw new Error("invalid-pathname")
        }
        const kind = match[1]!
        if (!ALLOWED_KINDS.has(kind)) {
          throw new Error("invalid-kind")
        }
        return {
          applicantUserId: session.user.workosUserId,
          kind,
        }
      },
      // No onCompleted: the form server action persists the URL onto
      // the application row. Keeping the route handler stateless makes
      // retries safe.
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
