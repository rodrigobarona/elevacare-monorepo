import type { SessionDocumentError } from "@eleva/records"

export const DOCUMENT_STATUS: Record<SessionDocumentError["code"], number> = {
  NOT_FOUND: 404,
  FORBIDDEN: 403,
  INVALID_PATHNAME: 422,
  SCOPE_FORBIDDEN: 403,
  GRANT_EXPIRED: 410,
  CONFLICT: 409,
}
