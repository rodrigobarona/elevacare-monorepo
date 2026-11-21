import type { IntegrationManifest } from "../types"
import { registerManifest } from "../registry"

const toconline: IntegrationManifest = {
  slug: "toconline",
  category: "invoicing",
  displayName: "TOConline",
  icon: "file-text",
  publisher: "TOConline",
  countries: ["PT"],
  connectType: "oauth",
  description: {
    en: "Link your TOConline account. You issue each invoice there, then mark it as issued under Member invoices.",
    pt: "Ligue a sua conta TOConline. Depois, emita cada fatura lá e marque-a como emitida em Faturas dos membros.",
    es: "Vincula tu cuenta de TOConline. Después, emite cada factura allí y márcala como emitida en Facturas de miembros.",
  },
  docsUrl: "https://www.toconline.com",
  featureFlag: "ff.invoicing.toconline",
}

const moloni: IntegrationManifest = {
  slug: "moloni",
  category: "invoicing",
  displayName: "Moloni",
  icon: "file-text",
  publisher: "Moloni",
  countries: ["PT"],
  connectType: "oauth",
  description: {
    en: "Issue Portuguese fiscal invoices via Moloni ERP.",
    pt: "Emita faturas fiscais portuguesas via Moloni ERP.",
    es: "Emita facturas fiscales portuguesas a través de Moloni ERP.",
  },
  docsUrl: "https://www.moloni.pt",
  featureFlag: "ff.invoicing.moloni",
}

const manual: IntegrationManifest = {
  slug: "manual",
  category: "invoicing",
  displayName: "Manual Invoicing",
  icon: "file-edit",
  publisher: "Eleva",
  countries: [],
  connectType: "manual",
  description: {
    en: "A certified invoice for each member, from your own invoicing software.",
    pt: "Uma fatura certificada para cada membro, no seu software de faturação.",
    es: "Una factura certificada para cada miembro, desde tu software de facturación.",
  },
}

registerManifest(toconline)
registerManifest(moloni)
registerManifest(manual)
