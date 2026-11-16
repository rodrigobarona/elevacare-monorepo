import { expertWorkspaceBase } from "@eleva/config/routing"

/**
 * Expert tools base path: `/expert/:slug` (ADR-026), for an expert's own
 * practice and for a clinician seat in a clinic. `/:slug` stays the public
 * marketplace profile.
 */
export function resolveExpertWorkspaceBase(orgSlug: string): string {
  return expertWorkspaceBase(orgSlug)
}

/** Clinic manager/staff workspace base path. */
export function resolveTeamAdminBase(orgSlug: string): string {
  return `/${orgSlug}/admin`
}
