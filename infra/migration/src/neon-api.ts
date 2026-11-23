import { z } from "zod"
import { directHost, NeonLookupError, type NeonEndpointInfo } from "./guard"

/**
 * Reads the Neon API (v2) for the migration guard: which endpoint of the
 * v3 production project a hostname belongs to, and whether its branch is
 * the default one. Anything the API does not say clearly is treated as
 * unknown, and the guard refuses unknown targets.
 */

const NEON_API = "https://console.neon.tech/api/v2"

const EndpointsSchema = z.object({
  endpoints: z.array(
    z.object({
      id: z.string(),
      host: z.string(),
      project_id: z.string(),
      branch_id: z.string(),
      type: z.string(),
      hosts: z
        .object({
          read_write_host: z.string().optional(),
          read_write_pooled_host: z.string().optional(),
          read_only_host: z.string().optional(),
          read_only_pooled_host: z.string().optional(),
        })
        .optional(),
    })
  ),
})

const BranchSchema = z.object({
  branch: z.object({
    id: z.string(),
    name: z.string(),
    default: z.boolean(),
    // Older responses call the same thing `primary`. If both are sent they
    // must agree, or the branch is treated as unknown.
    primary: z.boolean().optional(),
  }),
})

export interface NeonApiOptions {
  apiKey: string
  projectId: string
  fetch?: typeof globalThis.fetch
}

export function createNeonEndpointResolver(
  options: NeonApiOptions
): (host: string) => Promise<NeonEndpointInfo | null> {
  const fetchFn = options.fetch ?? globalThis.fetch
  const project = encodeURIComponent(options.projectId)

  async function get(path: string): Promise<unknown> {
    const response = await fetchFn(`${NEON_API}${path}`, {
      headers: {
        accept: "application/json",
        authorization: `Bearer ${options.apiKey}`,
      },
    })
    if (!response.ok) {
      throw new NeonLookupError(
        `Neon API answered ${response.status} for ${path}`
      )
    }
    return response.json()
  }

  return async function resolveEndpoint(host) {
    const wanted = host.toLowerCase()
    const { endpoints } = EndpointsSchema.parse(
      await get(`/projects/${project}/endpoints`)
    )
    // A pooled host and its direct host are one endpoint. They are matched
    // as one, so a pooled host is found even when the API lists only the
    // direct one (`hosts` is optional in the answer).
    const endpoint = endpoints.find((candidate) =>
      [candidate.host, ...Object.values(candidate.hosts ?? {})].some(
        (name) => name && directHost(name) === directHost(wanted)
      )
    )
    if (!endpoint) return null

    const { branch } = BranchSchema.parse(
      await get(
        `/projects/${project}/branches/${encodeURIComponent(endpoint.branch_id)}`
      )
    )
    if (branch.primary !== undefined && branch.primary !== branch.default) {
      throw new NeonLookupError(
        `Neon reports branch ${branch.id} as default=${branch.default} and primary=${branch.primary}`
      )
    }
    return {
      endpointId: endpoint.id,
      projectId: endpoint.project_id,
      branchId: branch.id,
      branchName: branch.name,
      isDefaultBranch: branch.default,
      // A pooled or direct read-write host of a read-write compute.
      isReadWrite:
        endpoint.type === "read_write" &&
        [
          endpoint.host,
          endpoint.hosts?.read_write_host,
          endpoint.hosts?.read_write_pooled_host,
        ].some((name) => name && directHost(name) === directHost(wanted)),
    }
  }
}
