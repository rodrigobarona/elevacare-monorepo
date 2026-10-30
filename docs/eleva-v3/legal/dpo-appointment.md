# Data protection officer (DPO) appointment

> **Draft for review by a Portuguese lawyer. Not legal advice. The provider is not yet chosen.**

**Founder decision, 2026-10-29:** Eleva will appoint an **external DPO service**
under GDPR art. 37(6), which allows a service contract. The provider is not yet
named: `[[FOUNDER INPUT: chosen DPO provider, named individual DPO, start date]]`.

## 1. Why a DPO is required

### 1.1 The legal test

GDPR art. 37(1)(c) requires a DPO where "the core activities of the
controller or the processor consist of processing on a large scale of special
categories of data pursuant to Article 9". Lei 58/2019 art. 13(b) repeats the
same test for private entities: activity "a título principal" that involves
large-scale processing of art. 9 or art. 10 data.

### 1.2 Applied to Eleva

- **Core activity.** WP243 rev.01 §2.1.2 defines core activities as the "key
  operations necessary to achieve the controller's or processor's goals",
  including processing that "forms an inextricable part" of the activity. Its
  example: for a hospital, processing health records is a core activity.
  Eleva's business is booking, paying for and supporting **health** sessions.
  Its intermediary role does not change that. Health data is inextricable from
  what it does as controller (bookings that reveal a health relationship,
  attendance) and as processor (encrypted clinical records).
- **Large scale.** WP243 §2.1.3 sets no number. It weighs:
  - the number of data subjects;
  - the volume of data;
  - the duration;
  - the geographic extent.

  Its examples:
  - "processing of patient data in the regular course of business by a
    hospital" is large scale;
  - an "individual physician" is not (recital 91).

  A platform serving many professionals and their members nationally sits on
  the hospital side.

- **Processors too.** WP243 §2.2 states that a processor may need a DPO even
  when its clients do not. Its example is an occupational-health processor
  with many similar clients. That is Eleva's position under RoPA P1–P6.

### 1.3 Conclusion and timing

A DPO is **required**. Even if the scale were argued to be small at launch,
appointing one voluntarily is the lower-risk course. A voluntary DPO is
subject to the same art. 37–39 rules (WP243 §1).

Appoint the DPO **before production health data**, so that the DPO can advise
on the DPIA (art. 35(2)) and the retention schedule.

## 2. Legal requirements for the role

| Topic            | Rule                                                                                                                                                                                                                            | Source                                |
| ---------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------- |
| Qualifications   | Designated on the basis of professional qualities, in particular "expert knowledge of data protection law and practices"                                                                                                        | GDPR art. 37(5)                       |
| Certification    | **No professional certification is required** in Portugal                                                                                                                                                                       | Lei 58/2019 art. 9                    |
| Service contract | May be a staff member or "fulfil the tasks on the basis of a service contract"                                                                                                                                                  | GDPR art. 37(6)                       |
| Natural person   | The CNPD accepts only a **natural person** as the notified DPO, even when a DPO-services company supplies them. A "delegate" is not accepted.                                                                                   | CNPD DPO page and form preamble       |
| Contacts         | Publish the DPO's contact details **and** communicate them to the CNPD. The name need not be published; the contact must be.                                                                                                    | GDPR art. 37(7). WP243 §2.6.          |
| Involvement      | Involved "properly and in a timely manner" in all data-protection issues                                                                                                                                                        | GDPR art. 38(1)                       |
| Resources        | Resources, access to data and processing operations, and the means to maintain expertise                                                                                                                                        | GDPR art. 38(2)                       |
| Independence     | No instructions on how to carry out the tasks. Not dismissed or penalised for performing them. Reports to the highest management level. Technical autonomy in Portugal "independentemente da natureza da sua relação jurídica". | GDPR art. 38(3). Lei 58/2019 art. 9.  |
| Data subjects    | Data subjects may contact the DPO on all issues about their data and their rights                                                                                                                                               | GDPR art. 38(4)                       |
| Secrecy          | Bound by professional secrecy "em tudo o que diga respeito ao exercício dessas funções", including after the role ends                                                                                                          | GDPR art. 38(5). Lei 58/2019 art. 10. |
| Conflicts        | Other tasks must not create a conflict of interest. The DPO cannot decide purposes and means. For Eleva, this excludes a manager or the engineering lead.                                                                       | GDPR art. 38(6). WP243 §3.5.          |

## 3. DPO tasks

**Under GDPR art. 39(1):**

- (a) inform and advise the controller, processors and staff;
- (b) monitor compliance, including the assignment of responsibilities,
  awareness-raising, training and audits;
- (c) advise on the DPIA and monitor its performance (art. 35);
- (d) cooperate with the CNPD;
- (e) act as the contact point for the CNPD, including on prior consultation
  (art. 36).

**Additional tasks in Portugal under Lei 58/2019 art. 11:**

- (a) periodic and unscheduled audits;
- (b) awareness of the duty to detect incidents promptly and report them
  immediately to the security lead;
- (c) relations with data subjects on data protection matters.

**What Eleva will ask of the DPO in year 1.** The DPO advises and monitors.
Approval decisions stay with Eleva as controller, which remains accountable for
compliance (GDPR arts. 24(1) and 39(1); WP243 §4.1). Any "sign-off" in this pack
means Eleva's decision, taken with the DPO's advice on record.

1. Advise on the DPIA ([`dpia.md`](./dpia.md); art. 35(2)) and the retention
   schedule ([`retention-schedule.md`](./retention-schedule.md)). Eleva then
   adopts them, which closes AUD-028.
2. Advise on D-06 (consumer aspects with the lawyer), D-11 and D-12
   ([`positions-d06-d11-d12.md`](./positions-d06-d11-d12.md)) before Eleva
   signs them.
3. Review the processor terms with experts
   ([`experts-dpa-checklist.md`](./experts-dpa-checklist.md)) and the vendor
   DPAs and TIAs.
4. Advise on the `ai_processing` and transcription consent copy before Eleva
   approves it and turns on `ff.ai_reports_beta`.
5. Advise during the breach procedure
   ([`breach-response.md`](./breach-response.md)) and act as the CNPD contact.
   The incident lead decides for Eleva.
6. Handle DSAR escalations and the question of access notification under Lei
   58/2019 art. 29(6).
7. Run an annual audit (Lei 58/2019 art. 11(a)) and staff training.

## 4. Selection checklist for an external DPO service

**Must have:**

- [ ] A named **individual** DPO, a natural person (CNPD requirement), with a
      named substitute for absences. The substitute is not notified to the
      CNPD as DPO.
- [ ] Demonstrable GDPR and **health-sector** experience in Portugal:
      health-data processing, Lei 58/2019 art. 29, the professional orders,
      ERS context.
- [ ] Portuguese and English working languages, since internal docs are in
      English. Spanish is a plus.
- [ ] Independence:
  - no other role at Eleva;
  - no conflict with Eleva's vendors;
  - a written commitment to art. 38(3) and (6).
- [ ] Professional secrecy (Lei 58/2019 art. 10) and a confidentiality clause
      covering the DPIA, incidents and vendor SOC 2 reports.
- [ ] Availability:
  - a response SLA for data-subject requests (e.g. 5 working days to
    acknowledge);
  - **reachable within 4 hours for a suspected breach**, including weekends,
    because of the 72-hour deadline under art. 33.
- [ ] Professional liability insurance.
- [ ] The provider's GDPR role classified with counsel **before** any DPA is
      required. Art. 28(3)(a) covers processing on the controller's documented
      instructions, while art. 38(3) bars instructions on how the DPO carries
      out the tasks, so an art. 28 DPA must not cover the DPO's tasks. Put any
      instructed support processing, such as DSAR mailbox or ticketing work,
      under a separate art. 28 DPA.
- [ ] Confidentiality terms covering the personal data the DPO sees. The
      provider must agree to use Eleva systems (mailbox, ticketing) for DSARs
      rather than copying data out.
- [ ] A fixed scope and fee, including:
  - the annual audit;
  - DPIA reviews on change;
  - training;
  - the hourly rate for incidents.

**Nice to have:**

- [ ] Experience with SaaS and engineering teams: able to read the RoPA and
      DPIA against the code.
- [ ] Experience with AI Act art. 50 and health AI.
- [ ] Experience with the CNPD's online forms and prior consultations.

**Questions for candidates:**

1. Would you treat Eleva's processing as large-scale health data
   (art. 37(1)(c))? What is your view on recital 91?
2. How do you read Lei 58/2019 art. 29(6), notification of access, for a
   platform that acts as processor?
3. What clinical-record retention default would you set for psychologists,
   physicians and physiotherapists?
4. Describe your breach-handling process and on-call arrangement.
5. Which other health or marketplace clients do you serve? Are there any
   conflicts?

## 5. Draft appointment letter

To be adapted by the lawyer. A Portuguese version should be the signed text.

> **BÚZIOS E TARTARUGAS - LDA** (Eleva.care), NIPC 515001708, with registered
> office at Rua Gil Vicente 2, 2775-198 Parede, Portugal ("Eleva"), represented
> by its manager `[[FOUNDER INPUT: manager name — do not commit]]`,
>
> **appoints** `[[FOUNDER INPUT: DPO full name]]`, acting under the service
> contract between Eleva and `[[FOUNDER INPUT: DPO provider legal name, NIPC]]`
> dated `[[date]]`, as **Data Protection Officer (Encarregado de Proteção de
> Dados)** under Article 37(1)(c) and (6) of Regulation (EU) 2016/679 and
> Articles 9 to 11 and 13 of Lei n.º 58/2019, with effect from `[[date]]`.
>
> 1. **Scope.** The DPO acts for Eleva both as controller and as processor,
>    for all processing described in Eleva's record of processing activities.
> 2. **Tasks.** The DPO performs the tasks in Article 39 GDPR and Article 11
>    of Lei 58/2019, including the audits, the incident-reporting awareness
>    and the relations with data subjects provided for there.
> 3. **Independence.** Eleva will not instruct the DPO on how to carry out
>    these tasks, will not dismiss or penalise the DPO for performing them,
>    and the DPO reports directly to the management. The DPO has technical
>    autonomy (Article 9 Lei 58/2019).
> 4. **Resources and access.** Eleva gives the DPO timely involvement in all
>    data-protection matters, access to the personal data and processing
>    operations needed for the tasks, and the resources and information listed
>    in the service contract. This includes the record of processing, DPIAs,
>    the incident register, audit logs and vendor DPAs.
> 5. **Conflicts.** The DPO holds no other role at Eleva and will declare any
>    conflict of interest arising from other engagements.
> 6. **Secrecy.** The DPO is bound by professional secrecy on everything
>    related to the role, including after it ends (Article 38(5) GDPR;
>    Article 10 Lei 58/2019).
> 7. **Contact.** Eleva publishes the DPO's contact as `privacy@eleva.care`
>    (routed to the DPO) and
>    `[[postal address]]` in its privacy notices, and communicates the DPO's
>    details to the CNPD.
> 8. **Term.** This appointment runs for the term of the service contract and
>    ends on written notice. Eleva will notify the CNPD of the end of the
>    appointment.
>
> Parede, `[[date]]`
>
> For Eleva: ............................ Accepted by the DPO: ............................

## 6. Communicating the DPO to the CNPD

**Source:** the CNPD DPO page
(<https://www.cnpd.pt/organizacoes/outras-obrigacoes/encarregado-de-protecao-de-dados/>)
and the online form (<https://www.cnpd.pt/dpo/>). Checked 2026-10-30. Only the
form's opening screen was reviewed; the fields in steps 2 to 4 were not
captured.

1. **Before filing:**
   - sign the service contract and the appointment letter;
   - route `privacy@eleva.care` to the DPO. **Proposed, not yet live:** it
     becomes the single published data protection contact, before and after
     the appointment. Today the public pages still publish `dpo@eleva.care`
     and label it the DPO contact although no DPO is appointed (fact sheet §1).
     The replacement is a tracked content handoff (decision log 2026-10-30; see
     [`experts-dpa-checklist.md`](./experts-dpa-checklist.md) §2). A dedicated
     `dpo@` alias is optional, only if the DPO asks for one.
2. **Open the CNPD DPO page**
   (<https://www.cnpd.pt/organizacoes/outras-obrigacoes/encarregado-de-protecao-de-dados/>)
   and follow its link to the online form, <https://www.cnpd.pt/dpo/>
   ("Notificações relativas ao Encarregado de Proteção de Dados"; checked
   2026-10-30). The form is an ASP.NET page that needs **cookies enabled**.
   Without cookies, its cookie-detection redirect
   (`?AspxAutoDetectCookieSupport=1`) loops. Then choose **"Fazer notificação de
   EPD"** (new notification). The form is for entities established in
   Portugal.
3. **Complete the four steps.** Expect the entity's identification (name, NIPC,
   address, contact) and the DPO's details:
   - name;
   - email;
   - phone;
   - whether the DPO is internal or external;
   - for an external DPO, the provider.

   **One form per entity.** The DPO must be a natural person.

4. **Keep the submission receipt** in the compliance folder and record the
   date in the decision log.
5. **Publish** the DPO contact in:
   - the privacy notice;
   - the health-data notice;
   - the DPA;
   - the trust pages.

   That is all three locales (another agent maintains these pages; open a
   content PR). Also update the fact sheet §1.

6. **Changes.** Use the same form:
   - "Alterar notificação (dados do EPD)" when the DPO changes;
   - "Alterar notificação (dados da entidade)" when Eleva's details change;
   - "Comunicar término de EPD" when the appointment ends.

## Points for lawyer/DPO review

1. Confirm that a DPO is mandatory under art. 37(1)(c) and Lei 58/2019
   art. 13(b), not merely advisable. The answer affects the
   timing: before launch, or before reaching scale.
2. Whether `privacy@eleva.care` and `dpo@eleva.care` should be separate
   inboxes, and who reads each one today
   (`[[FOUNDER INPUT: is dpo@eleva.care monitored, and by whom?]]`).
3. Review the service contract with the DPO provider: liability caps, on-call
   breach SLA, and the provider's GDPR role (§4). Confirm whether a separate
   art. 28 DPA is needed for any instructed support processing.
4. Whether the CNPD form asks for anything else (fields in steps 2 to 4 not
   verified).
5. The appointment letter in Portuguese as the signed version.

## Sources

- GDPR arts. 37–39: <https://eur-lex.europa.eu/eli/reg/2016/679/oj>
- Lei 58/2019 arts. 9–13:
  <https://diariodarepublica.pt/dr/detalhe/lei/58-2019-123815982>
- WP243 rev.01 (§4.1: compliance stays with the controller), DPO guidelines
  (EN):
  <https://ec.europa.eu/newsroom/article29/redirection/document/44100>; PT:
  <https://www.cnpd.pt/media/meplvdie/wp243rev01_pt.pdf>
- CNPD DPO page:
  <https://www.cnpd.pt/organizacoes/outras-obrigacoes/encarregado-de-protecao-de-dados/>
- CNPD DPO form (linked from the DPO page; needs cookies):
  <https://www.cnpd.pt/dpo/>
