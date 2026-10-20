export type CrmErrorCode =
  | "NOT_FOUND"
  | "FORBIDDEN"
  | "NOT_A_LEAD"
  | "MEMBER_NOT_FOUND"

export class CrmError extends Error {
  override readonly name = "CrmError"

  constructor(readonly code: CrmErrorCode) {
    super(code)
  }
}
