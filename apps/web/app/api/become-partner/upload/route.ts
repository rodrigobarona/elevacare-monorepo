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
    return await handleApplicationDocumentUpload({
      request,
      // Auth runs INSIDE authorize so Vercel Blob's signed
      // server-to-server completion callback (which carries no user
      // session) is not 401'd by a top-of-route gate.
      authorize: async (pathname) => {
        const session = await getSession()
        if (!session) {
          throw new Error("unauthorized")
        }
        // Pathname shape: become-partner/<kind>/<filename>
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
