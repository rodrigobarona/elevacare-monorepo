/**
 * How the CI guards read an apps/api route file: its `ROUTE_POLICY` and
 * the HTTP methods it exports. Parsed with the TypeScript AST, so comments,
 * quoting and `as const` / `satisfies` wrappers never change the answer.
 * Shared by check-route-guards and check-botid-coverage.
 */
import { readdir } from "node:fs/promises"
import path from "node:path"
import ts from "typescript"

export const HTTP_METHODS = [
  "GET",
  "HEAD",
  "OPTIONS",
  "POST",
  "PUT",
  "PATCH",
  "DELETE",
]

/**
 * A file Next.js serves as a route handler. Only `route.ts` is allowed in
 * this repo, but every extension is walked so the guards can refuse the
 * others instead of never seeing them.
 */
const ROUTE_FILE = /^route\.(?:ts|tsx|js|jsx|mjs|cjs)$/

/** Every route handler file under `dir`, whatever its extension. */
export async function walkRoutes(dir) {
  const entries = await readdir(dir, { withFileTypes: true })
  const files = []
  for (const entry of entries) {
    const full = path.join(dir, entry.name)
    if (entry.isDirectory()) {
      if (entry.name === "node_modules" || entry.name === ".next") continue
      files.push(...(await walkRoutes(full)))
    } else if (ROUTE_FILE.test(entry.name)) {
      files.push(full)
    }
  }
  return files
}

function parse(source) {
  return ts.createSourceFile(
    "route.ts",
    source,
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TS
  )
}

function unwrap(node) {
  let current = node
  while (
    ts.isAsExpression(current) ||
    ts.isSatisfiesExpression(current) ||
    ts.isParenthesizedExpression(current)
  ) {
    current = current.expression
  }
  return current
}

function readLiteral(node) {
  if (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) {
    return node.text
  }
  if (node.kind === ts.SyntaxKind.TrueKeyword) return true
  if (node.kind === ts.SyntaxKind.FalseKeyword) return false
  return undefined
}

function isExported(node) {
  return (
    node.modifiers?.some(
      (modifier) => modifier.kind === ts.SyntaxKind.ExportKeyword
    ) ?? false
  )
}

/**
 * The literal fields of the exported `ROUTE_POLICY`, or null when the file
 * has none or builds it in a way that cannot be read (a spread, a call).
 */
export function extractPolicy(source) {
  let policy = null

  function visit(node) {
    if (ts.isVariableStatement(node) && isExported(node)) {
      for (const decl of node.declarationList.declarations) {
        if (!ts.isIdentifier(decl.name) || decl.name.text !== "ROUTE_POLICY") {
          continue
        }
        if (!decl.initializer) continue
        const init = unwrap(decl.initializer)
        if (!ts.isObjectLiteralExpression(init)) continue
        const fields = {}
        for (const prop of init.properties) {
          if (ts.isSpreadAssignment(prop)) {
            policy = null
            return
          }
          if (!ts.isPropertyAssignment(prop) || !ts.isIdentifier(prop.name)) {
            continue
          }
          fields[prop.name.text] = readLiteral(unwrap(prop.initializer))
        }
        policy = fields
      }
    }
    ts.forEachChild(node, visit)
  }

  visit(parse(source))
  return policy
}

/**
 * The HTTP methods a route file exports, however it exports them:
 * `export function POST`, `export const POST =`, `export const { GET, POST }
 * = …` and `export { handler as POST }`. `opaque` is true when the file
 * re-exports with `export *`, which can add methods this cannot see.
 */
export function exportedMethods(source) {
  const methods = new Set()
  let opaque = false
  const add = (name) => {
    if (HTTP_METHODS.includes(name)) methods.add(name)
  }
  const addBinding = (name) => {
    if (ts.isIdentifier(name)) add(name.text)
    else if (
      ts.isObjectBindingPattern(name) ||
      ts.isArrayBindingPattern(name)
    ) {
      for (const element of name.elements) {
        if (ts.isBindingElement(element)) addBinding(element.name)
      }
    }
  }

  for (const statement of parse(source).statements) {
    if (ts.isFunctionDeclaration(statement) && isExported(statement)) {
      if (statement.name) add(statement.name.text)
    } else if (ts.isVariableStatement(statement) && isExported(statement)) {
      for (const decl of statement.declarationList.declarations) {
        addBinding(decl.name)
      }
    } else if (ts.isExportDeclaration(statement)) {
      if (!statement.exportClause) opaque = true
      else if (ts.isNamedExports(statement.exportClause)) {
        for (const element of statement.exportClause.elements) {
          add(element.name.text)
        }
      } else {
        // `export * as ns from …` exports a namespace, never a method.
      }
    }
  }
  return { methods: [...methods], opaque }
}
