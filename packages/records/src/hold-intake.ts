import { decryptForOrg, encryptForOrg } from "@eleva/encryption"
import { Decrypted, registerPhi } from "@eleva/observability"

function holdIntakeAad(reservationId: string): string {
  return `reservation-intake:${reservationId}`
}

export async function encryptHoldIntake(
  orgId: string,
  notes: string,
  reservationId: string
): Promise<string> {
  return encryptForOrg(orgId, notes, holdIntakeAad(reservationId))
}

export async function decryptHoldIntake(
  orgId: string,
  ciphertext: string,
  reservationId: string
): Promise<Decrypted<string>> {
  const notes = await decryptForOrg(
    orgId,
    ciphertext,
    holdIntakeAad(reservationId)
  )
  registerPhi(notes)
  return new Decrypted(notes)
}
