import assert from "node:assert/strict"
import { test } from "node:test"
import { findBotIdProblems } from "./check-botid-coverage.mjs"
import { exportedMethods, extractPolicy } from "./lib/route-policy.mjs"

const policy = (fields, wrapper = "as const satisfies RoutePolicy") =>
  `export const ROUTE_POLICY = { ${fields} } ${wrapper}\n`
const PUBLIC = `auth: "public", rateLimit: true, botId: false`
const PROTECTED = `auth: "public", rateLimit: true, botId: true`
const POST = `export async function POST() { return new Response() }\n`

const check = (source, exempt = {}) =>
  findBotIdProblems([{ route: "/probe", source }], exempt).problems

test("a public POST without BotID fails, with BotID passes", () => {
  assert.match(check(policy(PUBLIC) + POST)[0], /public mutation without BotID/)
  assert.deepEqual(check(policy(PROTECTED) + POST), [])
})

test("session, signature and internal routes are out of scope", () => {
  for (const auth of ["session", "signature", "internal"]) {
    const source =
      policy(`auth: "${auth}", rateLimit: true, botId: false`) + POST
    assert.deepEqual(check(source), [])
  }
})

test("a public GET is not a mutation", () => {
  const source = policy(PUBLIC) + `export function GET() {}\n`
  assert.deepEqual(check(source), [])
})

test("the policy is read whatever its wrapper, quotes or comments", () => {
  const shapes = [
    policy(PUBLIC, "satisfies RoutePolicy"),
    policy(PUBLIC, ""),
    `export const ROUTE_POLICY: RoutePolicy = { ${PUBLIC} }\n`,
    policy(`auth: 'public', rateLimit: true, botId: false`),
    // A comment that mentions botId: true is not protection.
    policy(`auth: "public", rateLimit: true, /* botId: true */ botId: false`),
  ]
  for (const shape of shapes) {
    assert.equal(check(shape + POST).length, 1, shape)
  }
})

test("every way of exporting a mutation is seen", () => {
  const exportsOf = (source) => exportedMethods(source).methods.sort()
  assert.deepEqual(exportsOf(`export const POST = handler\n`), ["POST"])
  assert.deepEqual(
    exportsOf(`export const { GET, POST } = toNextJsHandler(auth)\n`),
    ["GET", "POST"]
  )
  assert.deepEqual(
    exportsOf(`const run = () => {}\nexport { run as DELETE, run as GET }\n`),
    ["DELETE", "GET"]
  )
  assert.deepEqual(exportsOf(`export { PATCH } from "./handler"\n`), ["PATCH"])
  for (const body of [
    `export const { GET, POST } = handlers\n`,
    `const run = () => {}\nexport { run as PUT }\n`,
  ]) {
    assert.equal(check(policy(PUBLIC) + body).length, 1, body)
  }
})

test("what cannot be read fails instead of passing", () => {
  assert.match(check(POST)[0], /ROUTE_POLICY cannot be read/)
  assert.match(
    check(`export const ROUTE_POLICY = { ...BASE, botId: false }\n` + POST)[0],
    /ROUTE_POLICY cannot be read/
  )
  assert.match(
    check(
      `export const ROUTE_POLICY = { auth: MODE, botId: false }\n` + POST
    )[0],
    /ROUTE_POLICY cannot be read/
  )
  assert.match(
    check(policy(PUBLIC) + `export * from "./handlers"\n`)[0],
    /export \*/
  )
})

test("an exemption needs a matching route, and a route needs its exemption", () => {
  const source = policy(PUBLIC) + POST
  assert.deepEqual(check(source, { "/probe": "reason" }), [])
  assert.match(
    check(policy(PROTECTED) + POST, { "/probe": "reason" })[0],
    /no longer a public mutation without BotID/
  )
  assert.match(check("", { "/gone": "reason" }).at(-1), /Remove it from EXEMPT/)
})

test("extractPolicy returns literal fields only", () => {
  assert.deepEqual(extractPolicy(policy(PROTECTED)), {
    auth: "public",
    rateLimit: true,
    botId: true,
  })
  assert.equal(extractPolicy(`const ROUTE_POLICY = { auth: "public" }`), null)
})
