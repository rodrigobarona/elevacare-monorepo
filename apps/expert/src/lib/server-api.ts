/**
 * Session and API client for the practice in the address. Every expert page
 * and action lives under `/expert/{slug}/…`; the shared implementation is in
 * `@eleva/dashboard/workspace-api`.
 */
export {
  getApiBaseUrl,
  getWorkspaceApiClient as getAuthedApiClient,
  requireWorkspaceSession as requireExpertSession,
} from "@eleva/dashboard/workspace-api"
