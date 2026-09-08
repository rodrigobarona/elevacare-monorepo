export class EncryptionError extends Error {
  readonly code: string

  constructor(code: string, message?: string) {
    super(message ?? code)
    this.name = "EncryptionError"
    this.code = code
  }
}
