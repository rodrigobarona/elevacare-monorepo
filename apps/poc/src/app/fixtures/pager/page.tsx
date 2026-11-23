import { DataTableShell } from "@eleva/ui/components/data-table-shell"
import { Pager } from "@eleva/ui/components/pager"

/**
 * The footer of a paged list in each of its states, for
 * `e2e/pager.spec.ts`. Not a product surface: the rows are made up and the
 * copy is the staff console's (`apps/admin/messages`, namespace `queue`).
 */
const COPY = {
  en: {
    labels: {
      landmark: "Pages",
      previous: "Previous",
      next: "Next",
      previousPage: "Previous page",
      nextPage: "Next page",
    },
    range: (from: number, to: number, total: number) =>
      `Showing ${from} to ${to} of ${total}`,
    end: "You’ve reached the end of the queue.",
    columns: ["Clinic", "Legal name", "State", "Waiting since"],
    state: "To check",
  },
  pt: {
    labels: {
      landmark: "Páginas",
      previous: "Anterior",
      next: "Seguinte",
      previousPage: "Página anterior",
      nextPage: "Página seguinte",
    },
    range: (from: number, to: number, total: number) =>
      `A mostrar ${from} a ${to} de ${total}`,
    end: "Chegou ao fim da fila.",
    columns: ["Clínica", "Denominação social", "Estado", "À espera desde"],
    state: "Por verificar",
  },
} as const

const STATES = {
  "one-page": { from: 1, to: 12, total: 12, page: 1, pages: 1 },
  first: { from: 1, to: 25, total: 112, page: 1, pages: 5 },
  middle: { from: 26, to: 50, total: 112, page: 2, pages: 5 },
  last: { from: 101, to: 112, total: 112, page: 5, pages: 5 },
} as const

export default async function PagerFixturePage({
  searchParams,
}: {
  searchParams: Promise<{ locale?: string }>
}) {
  const { locale } = await searchParams
  const t = COPY[locale === "pt" ? "pt" : "en"]
  const href = (state: string, page: number) =>
    `/fixtures/pager?state=${state}&page=${page}`
  return (
    <main className="mx-auto max-w-5xl space-y-10 p-4 sm:p-6">
      <h1 className="font-display text-3xl">Pager</h1>
      {Object.entries(STATES).map(([name, s]) => (
        <section key={name} data-testid={`pager-${name}`}>
          <DataTableShell
            footer={
              <Pager
                rangeId={`range-${name}`}
                range={t.range(s.from, s.to, s.total)}
                end={s.pages > 1 && s.page === s.pages ? t.end : undefined}
                links={
                  s.pages > 1
                    ? {
                        previous: s.page > 1 ? href(name, s.page - 1) : null,
                        next: s.page < s.pages ? href(name, s.page + 1) : null,
                      }
                    : undefined
                }
                labels={t.labels}
              />
            }
          >
            <table className="w-full text-left text-sm">
              <thead className="border-b text-muted-foreground">
                <tr>
                  {t.columns.map((column) => (
                    <th key={column} className="p-4 font-medium">
                      {column}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {["Clínica Lumen", "Clínica do Parque"].map((clinic) => (
                  <tr key={clinic} className="border-b last:border-b-0">
                    <td className="p-4 font-medium text-primary">{clinic}</td>
                    <td className="p-4">{clinic}, Lda</td>
                    <td className="p-4">{t.state}</td>
                    <td className="p-4">21/11/2026</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </DataTableShell>
        </section>
      ))}
    </main>
  )
}
