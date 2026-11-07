# Backup, restore and KEK escrow

> **Adopted 2026-11-07.** Owner: Rodrigo Barona, founder. Closes SEC-3-06
> (backup, restore drill, KEK escrow) together with the breach procedure.
> Review: after each drill, after each KEK rotation, and at the latest on
> 2027-05-07.

Session records are encrypted with per-organisation DEKs, and each DEK is
wrapped by a KEK held only as a write-only Vercel environment variable
(`ELEVA_KEK_V<n>`, ADR-020). A database backup without the KEK is unreadable.
This runbook makes sure Eleva can always restore **both** the data and the key.

Related: [`../legal/breach-response.md`](../legal/breach-response.md),
[`../legal/dpia.md`](../legal/dpia.md) R10,
[`../legal/ropa.md`](../legal/ropa.md) §3,
[`../integration-runbooks.md`](../integration-runbooks.md) "Envelope KEK rotation",
`packages/encryption/README.md`.

## 1. Targets

| System                         | What it holds                                                   | Recovery point objective (RPO) | Recovery time objective (RTO)  |
| ------------------------------ | --------------------------------------------------------------- | ------------------------------ | ------------------------------ |
| Neon main project (Frankfurt)  | Accounts, bookings, payments, encrypted records                 | Minutes (continuous history)   | 4 hours                        |
| Neon audit project (Frankfurt) | Append-only `audit_events`                                      | Minutes (continuous history)   | 1 working day                  |
| R2 private bucket (EU)         | Session documents, DSAR exports                                 | 24 hours (§5)                  | 1 working day                  |
| KEK and key secrets            | `ELEVA_KEK_V<n>`, `RETENTION_PSEUDONYM_KEY`, `CONSENT_HASH_KEY` | Zero (escrow, §3)              | 2 hours (from the sealed copy) |

## 2. Neon restore window

**Configured on 2026-11-07:** the production plan keeps a **6-hour** restore
window (history retention) on the main project. That is enough for an operator mistake noticed the
same day, not for an incident found later.

**Before members outside the team book, the operator raises it to:**

- **at least 7 days** on the main project;
- **30 days** on the audit project.

How:

1. Neon Console → the project → **Settings** → **Instant restore** (restore
   window / history retention) → set the value → Save. Repeat for the audit
   project. If the plan caps the window below these values, upgrade the plan
   first.
2. Record the new values and the date in the log in §7.
3. Update the backup tail in the public DPA (`/trust/dpa`) and in RoPA §3 to
   the new window, in the same PR.

The window also decides how long a retired KEK must stay available (§3.4).

## 3. KEK escrow

### 3.1 Principle

- Every KEK version that wraps any DEK, or that wrapped a DEK within the Neon
  restore window, exists in **two sealed offline copies** in the founder's
  custody, in two separate physical places (for example, a home safe and a
  bank safe-deposit box).
- The copies are paper only: the base64 key printed or written by hand, with
  its version and fingerprint. No photo, cloud note, password manager or
  email copy.
- This repository records only the **fingerprint** (§3.5), never the key.
- The same applies to `RETENTION_PSEUDONYM_KEY` and `CONSENT_HASH_KEY`: losing
  them breaks the link between pseudonymised and hashed rows and the people
  they belong to.
- Preview has its own KEK (decision log 2026-11-07). It holds synthetic data
  only and is not escrowed.

### 3.2 First escrow (production `ELEVA_KEK_V1` cannot be read back)

`ELEVA_KEK_V1` was entered as a write-only Vercel variable and cannot be
exported. Escrow therefore starts with a new version, generated offline and
written down **before** it reaches Vercel.

1. On the founder's laptop, disconnect from the network and run:

   ```bash
   openssl rand -base64 32
   ```

2. Write the value on two sheets, each labelled `ELEVA_KEK_V2`, the date and
   the fingerprint from step 3. Read both copies back character by character.
3. Compute the fingerprint and record it in §3.5:

   ```bash
   printf '%s' '<base64 key>' | shasum -a 256 | cut -c1-16
   ```

4. Seal each sheet in a tamper-evident envelope, sign across the seal, and
   place the envelopes in the two locations.
5. Reconnect, add `ELEVA_KEK_V2` to every Vercel project that imports
   `@eleva/encryption` (at least `elevacare-api`), **Production scope only**,
   next to `ELEVA_KEK_V1`. Clear the terminal history and the clipboard.
6. Rotate as in `integration-runbooks.md` "Envelope KEK rotation": deploy, dry
   run `POST /workflows/kek-rotation` until it reports `kekVersion: 2`, apply
   until `hasMore: false`, then confirm a dry run reports `kekVersion: 2` and
   `orgs: 0`.
7. Do the same once for `RETENTION_PSEUDONYM_KEY` and `CONSENT_HASH_KEY` if
   their current values are not held offline: these keys cannot be rotated
   without breaking linkage, so if no copy exists, copy the value from the
   source where it was generated; if no source exists, record that in §7 and
   ask engineering for a re-keying plan before any rotation.

### 3.3 Each later rotation

1. Generate and escrow `ELEVA_KEK_V<n+1>` offline as in §3.2 steps 1–4,
   **before** adding it to Vercel.
2. Before rotating, verify the escrowed copy of the **current** KEK against
   its fingerprint (open one envelope, compute the fingerprint, reseal in a new
   envelope). A mismatch stops the rotation and is an incident (breach
   procedure, availability).
3. Rotate (§3.2 step 6) and record the date, versions and fingerprints in §7.

### 3.4 Retiring an old KEK

A restore to a point before a rotation brings back DEKs wrapped by the old
KEK. Keep `ELEVA_KEK_V<n>` in Vercel until **both**:

- a dry run confirms `orgs: 0` for the new version; and
- the rotation date is older than the Neon restore window (§2) on the main
  project.

Then remove it from Vercel. Keep its two sealed copies for as long as any
retained backup, export or Phase 14 record export may contain DEKs wrapped by
it; destroy them by shredding after that and record the destruction in §7.

### 3.5 Fingerprint register

| Secret      | Version | Fingerprint (sha256, first 16 hex)        | Escrowed on | Locations (A / B) | Retired on |
| ----------- | ------- | ----------------------------------------- | ----------- | ----------------- | ---------- |
| `ELEVA_KEK` | V1      | Not escrowed (write-only, replaced by V2) | —           | —                 | Per §3.4   |

Add one row per escrowed secret and version.

### 3.6 Suspected KEK exposure

Follow the breach procedure (S4). Rotate to a new escrowed version at once
(§3.3), revoke Vercel access for anyone who should not have it, and keep the
exposed version only as long as §3.4 requires.

## 4. Restore drill

Run before members outside the team book, then every quarter and after any
change to the encryption or database setup. The drill proves three things:
a point-in-time branch can be created, the application can read it, and the
**escrowed** KEK decrypts a record.

### 4.1 Canary data

Keep a canary organisation in production (`eleva-restore-canary`, owned by the
founder) with one session record of synthetic text, for example "Restore
canary, do not delete". The drill decrypts only this record, never member
data.

### 4.2 Steps

1. Note the time `T` (UTC) a few minutes in the past, after the canary record
   was last written.
2. Create a branch from that point in time:

   ```bash
   neon branches create --project-id <main-project-id> \
     --name restore-drill-YYYYMMDD --parent <T in RFC 3339, e.g. 2026-11-07T10:00:00Z>
   ```

3. Get the branch connection string (unpooled) and keep it only in the local
   shell session:

   ```bash
   neon connection-string restore-drill-YYYYMMDD --project-id <main-project-id>
   ```

4. Open one KEK envelope, compute the fingerprint and compare it with §3.5.
5. With the network kept to Neon only, run a one-off script from the repo
   root against the branch:

   ```bash
   DATABASE_URL='<branch url>' ELEVA_KEK_V<n>='<escrowed key>' \
     pnpm --filter @eleva/encryption exec tsx -e '
       import { decryptForOrg } from "./src/index.ts"
       // read the canary ciphertext and AAD with a select on the branch,
       // then print only whether the decrypted text equals the canary text.
     '
   ```

   Print `match` or `no match`, never the plaintext of any other row.

6. Repeat a smaller check on the audit project: create a branch at `T` and
   count `audit_events` rows for the last day.
7. Delete both branches:

   ```bash
   neon branches delete restore-drill-YYYYMMDD --project-id <main-project-id>
   ```

8. Reseal the KEK copy in a new signed envelope, clear shell history, and
   record the results in §7.

A `no match`, a missing envelope or a fingerprint mismatch is an availability
incident under the breach procedure.

### 4.3 Real restore (incident)

1. The incident lead decides the restore point.
2. Create the branch as in §4.2 step 2, check it with the canary.
3. Point `DATABASE_URL` and `DATABASE_URL_UNPOOLED` on `elevacare-api`
   Production to the branch (or use Neon's instant restore of `main` to that
   point), redeploy, and run the production smoke checks.
4. Record the data lost between the restore point and the incident in the
   breach register.

## 5. R2 private bucket

- Cloudflare stores R2 objects durably in the EU jurisdiction bucket. Objects
  are deleted only through `@eleva/storage` (retention sweep, erasure, DSAR
  expiry), and each delete is audited.
- **Copy for recovery:** the operator schedules a daily copy of the private
  bucket to a second EU-jurisdiction bucket (`eleva-private-backup`) with its
  own access key, using `rclone sync` from a scheduled job, and a lifecycle
  rule on the backup bucket that deletes objects 30 days after they are
  copied. Deleted source objects therefore leave the backup within 30 days,
  so retention and erasure still complete.
- **Restore:** copy the needed keys back from the backup bucket with `rclone
copy`, then verify that the matching `session_documents` rows exist.
- The backup bucket's credentials are in the secrets inventory (§6) and are
  never used by the application.

## 6. Secrets inventory

| Secret                                                                                                          | Where                                  | Can read              | Can rotate                   | Loss impact                                                              |
| --------------------------------------------------------------------------------------------------------------- | -------------------------------------- | --------------------- | ---------------------------- | ------------------------------------------------------------------------ |
| `ELEVA_KEK_V<n>`                                                                                                | Vercel Production (write-only); escrow | Founder (escrow only) | Founder                      | All records unreadable without escrow                                    |
| `RETENTION_PSEUDONYM_KEY`                                                                                       | Vercel Production; escrow              | Founder (escrow only) | Founder, with re-keying plan | Pseudonym linkage lost                                                   |
| `CONSENT_HASH_KEY`                                                                                              | Vercel Production; escrow              | Founder (escrow only) | Founder, with re-keying plan | Guest consent linkage lost                                               |
| `BETTER_AUTH_SECRET`                                                                                            | Vercel Production                      | Nobody (write-only)   | Founder                      | Sessions and DSAR links reset; calendar OAuth tokens must be reconnected |
| `DATABASE_URL`, `DATABASE_URL_UNPOOLED`, audit database URL                                                     | Vercel Production; Neon console        | Founder               | Founder                      | Rotate in Neon, redeploy                                                 |
| `R2_PRIVATE_ACCESS_KEY_ID`, `R2_PRIVATE_SECRET_ACCESS_KEY`                                                      | Vercel Production; Cloudflare          | Founder               | Founder                      | Rotate in Cloudflare, redeploy                                           |
| Stripe, Daily, Resend, Twilio, TOConline, Google and Microsoft OAuth, QStash, Upstash, webhook and cron secrets | Vercel Production; vendor consoles     | Founder               | Founder                      | Rotate at the vendor, redeploy                                           |

Production console access (Vercel, Neon, Stripe, Daily, Resend, Sentry,
Cloudflare, Upstash, Twilio) is held by the founder with MFA on each console.
Anyone added later is listed here with their scope, after signing a secrecy
undertaking (Lei 58/2019 art. 29(4)).

## 7. Log

| Date       | Action                                   | Result                                                                                 | Times (start → branch ready → canary match) | By      | Notes                                             |
| ---------- | ---------------------------------------- | -------------------------------------------------------------------------------------- | ------------------------------------------- | ------- | ------------------------------------------------- |
| 2026-11-07 | Runbook adopted; restore window recorded | Main project: 6 hours. Audit project: read the value in the console and record it here | —                                           | Founder | Raise per §2 before members outside the team book |
