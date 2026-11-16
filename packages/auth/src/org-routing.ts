import {
  academyWorkspaceBase,
  expertWorkspaceBase,
  teamWorkspaceBase,
} from "@eleva/config/routing"

/**
 * Expert tools base path: `/expert/:slug` (ADR-026), for an expert's own
 * practice and for a clinician seat in a clinic. `/:slug` stays the public
 * marketplace profile.
 */
export function resolveExpertWorkspaceBase(orgSlug: string): string {
  return expertWorkspaceBase(orgSlug)
}

/** Clinic management base path for managers and staff: `/team/:slug`. */
export function resolveTeamWorkspaceBase(orgSlug: string): string {
  return teamWorkspaceBase(orgSlug)
}

/** Lecturer tools base path: `/academy/:slug`. */
export function resolveAcademyWorkspaceBase(orgSlug: string): string {
  return academyWorkspaceBase(orgSlug)
}
