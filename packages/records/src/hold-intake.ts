import { decryptForOrg, encryptForOrg } from "@eleva/encryption"

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
): Promise<string> {
  return decryptForOrg(orgId, ciphertext, holdIntakeAad(reservationId))
}
