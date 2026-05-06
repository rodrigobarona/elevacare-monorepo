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
    en: "Issue Portuguese fiscal invoices (FT) via TOConline ERP.",
    pt: "Emita faturas fiscais portuguesas (FT) via TOConline ERP.",
    es: "Emita facturas fiscales portuguesas (FT) a través de TOConline ERP.",
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
    en: "Handle invoicing manually outside of Eleva. You acknowledge responsibility for fiscal compliance.",
    pt: "Fature manualmente fora da Eleva. Reconhece a responsabilidade pelo cumprimento fiscal.",
    es: "Facture manualmente fuera de Eleva. Reconoce la responsabilidad del cumplimiento fiscal.",
  },
}

registerManifest(toconline)
registerManifest(moloni)
registerManifest(manual)
