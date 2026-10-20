const SETUP_ERROR_CODES = [
  "validation",
  "save-failed",
  "practice-incomplete",
  "invoicing-required",
  "identity-required",
  "invalid-step",
] as const

type SetupErrorCode = (typeof SETUP_ERROR_CODES)[number]

function isSetupErrorCode(code: string): code is SetupErrorCode {
  return (SETUP_ERROR_CODES as readonly string[]).includes(code)
}

/** Localized sentence for a setup Server Action error code. */
export function setupErrorMessage(
  t: (key: `errors.${SetupErrorCode}`) => string,
  code: string
): string {
  return t(`errors.${isSetupErrorCode(code) ? code : "save-failed"}`)
}
