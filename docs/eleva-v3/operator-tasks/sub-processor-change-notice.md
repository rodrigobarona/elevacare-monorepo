# Telling experts and clinics about a sub-processor change

> **Draft, 2026-11-14. Not adopted.** Owner: Rodrigo Barona, founder. Review:
> after the first notice is sent, and whenever the DPA's section 12 changes.

The Data processing agreement promises experts and clinics at least 30 days'
notice before Eleva adds or replaces a vendor that handles personal data on
its instructions, by two routes: an email to the owner of each expert and
clinic account, and the change log on `/trust/sub-processors`
(`packages/content/content/trust/*/dpa.mdx` §12). This runbook is how that
promise is kept. The email is sent by hand; there is no automated notice yet.

Related: [`../legal/fact-sheet.md`](../legal/fact-sheet.md) §2,
[`../legal/experts-dpa-checklist.md`](../legal/experts-dpa-checklist.md).

## 1. When this applies

- Adding a vendor that will process personal data for Eleva.
- Replacing one vendor with another for the same job.
- Letting an existing vendor handle a new category of data, above all session
  records.

It does not apply to a vendor that only changes its own name, to a change of
region inside the EEA, or to vendors that are independent controllers (Google
and Microsoft sign-in, Stripe for its own legal duties).

**Urgent changes.** If a change cannot wait 30 days because of security, a
legal duty or keeping the service running, make it, then send the notice the
same day and say why it could not wait. The 30 days to object run from that
notice (DPA §12).

## 2. Steps

1. **Decide and record.** Add the vendor to [`fact-sheet.md`](../legal/fact-sheet.md)
   §2 with its region, transfer basis and DPA. Sign the vendor's DPA first.
2. **Set the date.** The change takes effect no earlier than 30 days after
   the email in step 4.
3. **Update the pages, in one PR, in EN, PT and ES.**
   - `trust/*/sub-processors.mdx`: the vendor table, a new row at the top of
     the change log with the date the change takes effect, and `lastUpdated`.
   - `trust/*/dpa.mdx` §12: the matching table, and `lastUpdated`.
   - `SUB_PROCESSOR_VENDORS` in `packages/content/src/content-compliance.test.ts`.
4. **Email the account owners** the day the PR is live. List them with:

   ```sql
   select distinct u.email, o.name as account, o.type
   from auth.organization o
   join auth.member m on m.organization_id = o.id and m.role = 'owner'
   join auth."user" u on u.id = m.user_id
   where o.type in ('expert', 'team')
   order by o.name;
   ```

   Send from `privacy@eleva.care`, one recipient per message or in blind copy.
   Use the text in §3.

5. **Log it** in §4: the date, the vendor, how many accounts were emailed and
   the date the change takes effect.
6. **Wait for objections** until that date. Handle each one under §5.
7. **Make the change** on or after the date.

## 3. Email text

Subject: A change to the companies that help us run Eleva

> Hello,
>
> From **[date]**, Eleva will use **[vendor]** for **[purpose]**. It will
> handle **[data, in plain words]**, in **[region]**. [One sentence on why:
> for example, "It replaces [old vendor]."]
>
> You do not need to do anything. The full list is always at
> eleva.care/trust/sub-processors.
>
> If you object to this change, reply to this email before **[date]** and
> tell us why. We will work with you to find a solution, and if we cannot,
> you can stop using the affected feature or end your agreement at no cost.
>
> Thank you for trusting us with your practice.
> The Eleva team

Send the Portuguese or Spanish version to accounts that use Eleva in that
language.

## 4. Log

| Date sent | Vendor and change  | Accounts emailed | Takes effect | Objections | By  |
| --------- | ------------------ | ---------------- | ------------ | ---------- | --- |
| —         | No notice sent yet | —                | —            | —          | —   |

The 2026-10-31 move from Vercel Blob to Cloudflare R2 is in the public change
log. No notice was sent because no expert or clinic had accepted the DPA.

## 5. If an expert or clinic objects

1. Acknowledge within 2 working days.
2. Ask what the concern is and whether a safeguard would resolve it (a
   different region, a feature switched off for their account).
3. If it cannot be resolved before the change takes effect, the expert or
   clinic may stop using the affected processing or end the agreement without
   penalty (DPA §12). Record the outcome in §4.
