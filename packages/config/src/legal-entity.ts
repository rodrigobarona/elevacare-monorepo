/**
 * The company that operates Eleva Care and is the controller of its data.
 * One source for the public footer, emails and anything else that must
 * name it. The long-form legal pages in `@eleva/content` state the same
 * details in prose.
 */
export const LEGAL_ENTITY = {
  name: "BÚZIOS E TARTARUGAS - LDA",
  nipc: "515001708",
  // Non-breaking spaces keep the street and the postcode from wrapping.
  address: "Rua\u00a0Gil\u00a0Vicente\u00a02, 2775-198\u00a0Parede, Portugal",
  supportEmail: "support@eleva.care",
  privacyEmail: "privacy@eleva.care",
} as const

/** "BÚZIOS E TARTARUGAS - LDA · NIPC 515001708 · Rua Gil Vicente 2, …". */
export const LEGAL_ENTITY_LINE = `${LEGAL_ENTITY.name} · NIPC ${LEGAL_ENTITY.nipc} · ${LEGAL_ENTITY.address}`
