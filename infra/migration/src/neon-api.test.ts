import { describe, expect, it, vi } from "vitest"
import { createNeonEndpointResolver } from "./neon-api"

const PROJECT = "aged-wildflower-123456"
const HOST = "ep-cool-darkness-a5b6c7d8.c-5.us-east-2.aws.neon.tech"
const POOLED = "ep-cool-darkness-a5b6c7d8-pooler.c-5.us-east-2.aws.neon.tech"
const READ_ONLY = "ep-replica-b1b2c3d4.c-5.us-east-2.aws.neon.tech"

const endpoints = {
  endpoints: [
    {
      id: "ep-cool-darkness-a5b6c7d8",
      host: HOST,
      hosts: { read_write_host: HOST, read_write_pooled_host: POOLED },
      project_id: PROJECT,
      branch_id: "br-young-forest-a5b6c7d8",
      type: "read_write",
    },
    {
      id: "ep-replica-b1b2c3d4",
      host: READ_ONLY,
      hosts: { read_only_host: READ_ONLY },
      project_id: PROJECT,
      branch_id: "br-young-forest-a5b6c7d8",
      type: "read_only",
    },
  ],
}

function api(branch: Record<string, unknown>, status = 200) {
  return vi.fn(async (url: string | URL | Request) => {
    const body = String(url).includes("/branches/")
      ? { branch: { id: "br-young-forest-a5b6c7d8", name: "dev", ...branch } }
      : endpoints
    return new Response(JSON.stringify(body), { status })
  }) as unknown as typeof fetch
}

function resolver(fetchFn: typeof fetch) {
  return createNeonEndpointResolver({
    apiKey: "napi_test",
    projectId: PROJECT,
    fetch: fetchFn,
  })
}

describe("createNeonEndpointResolver", () => {
  it("finds a branch endpoint by its direct or pooled host", async () => {
    const fetchFn = api({ default: false, primary: false })
    for (const host of [HOST, POOLED.toUpperCase()]) {
      await expect(resolver(fetchFn)(host)).resolves.toEqual({
        endpointId: "ep-cool-darkness-a5b6c7d8",
        projectId: PROJECT,
        branchId: "br-young-forest-a5b6c7d8",
        branchName: "dev",
        isDefaultBranch: false,
        isReadWrite: true,
      })
    }
    const [url, init] = vi.mocked(fetchFn).mock.calls[0]!
    expect(String(url)).toBe(
      `https://console.neon.tech/api/v2/projects/${PROJECT}/endpoints`
    )
    expect((init?.headers as Record<string, string>).authorization).toBe(
      "Bearer napi_test"
    )
  })

  it("finds a pooled host when the API lists only the direct one", async () => {
    // `hosts` is optional in the answer. Without this, a pooled host of the
    // project would look like a host of another project.
    const bare = {
      endpoints: endpoints.endpoints.map(({ hosts: _hosts, ...rest }) => rest),
    }
    const fetchFn = vi.fn(async (url: string | URL | Request) => {
      const body = String(url).includes("/branches/")
        ? {
            branch: {
              id: "br-young-forest-a5b6c7d8",
              name: "dev",
              default: false,
            },
          }
        : bare
      return new Response(JSON.stringify(body))
    }) as unknown as typeof fetch
    await expect(resolver(fetchFn)(POOLED)).resolves.toMatchObject({
      endpointId: "ep-cool-darkness-a5b6c7d8",
      isReadWrite: true,
    })
    // A read replica found the same way is still not writable.
    await expect(
      resolver(fetchFn)(
        READ_ONLY.replace("ep-replica-b1b2c3d4", "ep-replica-b1b2c3d4-pooler")
      )
    ).resolves.toMatchObject({ isReadWrite: false })
  })

  it("says when the branch is the default one, and when the host is a replica", async () => {
    const fetchFn = api({ default: true, primary: true })
    await expect(resolver(fetchFn)(HOST)).resolves.toMatchObject({
      isDefaultBranch: true,
    })
    await expect(resolver(fetchFn)(READ_ONLY)).resolves.toMatchObject({
      isReadWrite: false,
    })
  })

  it("returns null for a host the project does not have", async () => {
    const fetchFn = api({ default: false })
    await expect(
      resolver(fetchFn)("ep-elsewhere-00000000.eu-central-1.aws.neon.tech")
    ).resolves.toBeNull()
    // The branch is never asked for.
    expect(fetchFn).toHaveBeenCalledTimes(1)
  })

  it("refuses to guess: no default flag, flags that disagree, an API error", async () => {
    await expect(resolver(api({}))(HOST)).rejects.toThrow()
    await expect(
      resolver(api({ default: false, primary: true }))(HOST)
    ).rejects.toThrow(
      /two different things about whether the branch is the default/
    )
    await expect(resolver(api({ default: false }, 401))(HOST)).rejects.toThrow(
      /401/
    )
  })
})
