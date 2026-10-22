import type { Root } from "fumadocs-core/page-tree"
import Link from "next/link"

function SidebarNode({
  node,
  localePrefix,
  depth = 0,
}: {
  node: Root["children"][number]
  localePrefix: string
  depth?: number
}) {
  if (node.type === "folder") {
    return (
      <li className="space-y-1">
        <p
          className="text-xs font-medium tracking-wide text-muted-foreground uppercase"
          style={{ paddingLeft: depth * 12 }}
        >
          {node.name}
        </p>
        <ul className="space-y-0.5">
          {node.children.map((child, index) => (
            <SidebarNode
              key={String(child.$id ?? child.name ?? index)}
              node={child}
              localePrefix={localePrefix}
              depth={depth + 1}
            />
          ))}
        </ul>
      </li>
    )
  }

  if (node.type !== "page") return null

  return (
    <li>
      <Link
        href={`${localePrefix}${node.url}`}
        className="block rounded-md py-1.5 text-sm text-muted-foreground transition-colors hover:bg-muted/60 hover:text-foreground"
        style={{ paddingLeft: 12 + depth * 12 }}
      >
        {node.name}
      </Link>
    </li>
  )
}

export function DocsSidebar({
  tree,
  localePrefix,
  title,
}: {
  tree: Root
  localePrefix: string
  title: string
}) {
  return (
    <nav aria-label={title} className="text-sm">
      <p className="eyebrow text-muted-foreground">{title}</p>
      <ul className="mt-4 space-y-3">
        {tree.children.map((node, index) => (
          <SidebarNode
            key={String(node.$id ?? node.name ?? index)}
            node={node}
            localePrefix={localePrefix}
          />
        ))}
      </ul>
    </nav>
  )
}
