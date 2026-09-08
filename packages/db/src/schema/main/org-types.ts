import { pgEnum } from "drizzle-orm/pg-core"

export const orgTypeEnum = pgEnum("org_type", [
  "personal",
  "expert",
  "team",
  "academy",
  "staff",
])

export type OrgType = (typeof orgTypeEnum.enumValues)[number]
