# Legal memo: Eleva and ERS registration

> **Draft for review by a Portuguese lawyer. Not legal advice. It supports a founder decision; it is not a regulator's opinion.**

- To: founder; external counsel; DPO (for information)
- From: legal drafting (internal)
- Date: 2026-10-29
- Re: whether BÚZIOS E TARTARUGAS - LDA (Eleva.care) must register with the
  Entidade Reguladora da Saúde (ERS) as a health-care provider, and what would
  change that

## 1. Question and short answer

**Question.** Eleva lets members book and pay for sessions with independent,
regulated health professionals ("experts"). The sessions take place by video
or in person. Does Eleva itself have to register at the ERS as an
"estabelecimento prestador de cuidados de saúde"?

**Short answer.** Probably not, **while Eleva remains a pure intermediary**.
Founder decision 1 of 2026-10-29: Eleva stays an intermediary and does not
register with the ERS as a provider, unless a §5 trigger occurs.

The ERS FAQ places the duty on the person or entity that owns, oversees,
manages, holds or otherwise operates an establishment where care is provided,
or that works on their own account in an establishment they control. A
professional is presumed to work on their own account when they provide care
autonomously and present themselves to the patient as responsible for it, for
example by issuing their own invoices or receipts or by holding care
agreements. Invoicing is one indicator, not the whole test. On that test the
experts must register, including as telemedicine units for video sessions.
Eleva must not take on the features listed in §5.

Four features of today's set-up weaken the position and need attention:

- the CAE 86950 on the company register;
- "digital health platform" wording on the public pages;
- Eleva being the merchant on the member's card statement (Stripe separate
  charges and transfers);
- Eleva-funded promotion codes.

See §4.

**Citation correction.** The fact sheet cites "DL 127/2014 — ERS registration
of care providers". DL 127/2014 is the **licensing** regime for establishments.
The **registration** duty is in **art. 26 of the ERS Statutes (DL 126/2014)**
and **ERS Regulamento n.º 66/2015**. This memo cites both; the fact sheet law
table is corrected in this PR.

## 2. Legal framework

### 2.1 DL 126/2014 (ERS Statutes)

- **Art. 4(2).** The ERS regulates "todos os estabelecimentos prestadores de
  cuidados de saúde, do setor público, privado, cooperativo e social,
  independentemente da sua natureza jurídica, nomeadamente hospitais,
  clínicas, centros de saúde, consultórios, laboratórios de análises clínicas,
  **equipamentos ou unidades de telemedicina**, unidades móveis de saúde e
  termas". In English: all health-care establishments in the public, private,
  cooperative and social sectors, whatever their legal form, including
  telemedicine equipment or units.
- **Art. 4(3)(a).** Health professionals are outside ERS regulation "no que
  respeita à sua atividade sujeita à regulação e disciplina das respetivas
  associações públicas profissionais". In English: for the part of their
  activity that their Ordem regulates. Their establishment is still subject to
  the ERS.
- **Art. 26.**
  - n.º 1: mandatory public register.
  - n.º 2: registration is a "condição de abertura e funcionamento" (condition
    for opening and operating).
  - n.º 3: register before starting activity; update within 30 days.
  - n.º 5: the ERS may register an establishment on its own initiative.
- **Art. 30(2).** Establishments send complaints, including those in their
  complaints book, to the ERS within 10 working days.
- **Art. 31(1).** A duty to cooperate with the ERS extends to "demais agentes
  da área da saúde" (other actors in the health sector). Art. 10(e) sets the
  objective of transparency of economic relations "entre todos os agentes do
  sistema". **These provisions can reach a platform as a cooperating actor.
  They do not make it an establishment.**
- **Art. 61(2)(a).** Operating without registration, or failing to update it,
  is an offence. Fines: €1,000–€3,740.98 for individuals; €1,500–€44,891.81
  for companies.

### 2.2 DL 127/2014 (licensing of establishments)

- **Art. 1(2).** An establishment is "um conjunto de meios organizado para a
  prestação de serviços de saúde" (an organised set of resources for providing
  health services).
- **Art. 1(3).** Health care means "as atividades de promoção da saúde,
  prevenção da doença ou qualquer intervenção com intenção terapêutica"
  (health promotion, disease prevention or any intervention with therapeutic
  intent).
- **Art. 17.** Operating without a licence is fined €4,000–€44,891.81 for
  companies.
- Telemedicine units are not yet subject to prior licensing because their
  portaria is pending. They are subject only to registration (ERS
  Recommendation of 25 May 2023, §16).

### 2.3 ERS guidance

**ERS FAQ on mandatory registration.** The duty falls on the "pessoa singular
ou coletiva que é proprietária, tutela, gere, detém ou, de qualquer outra
forma, explora" an establishment where care is provided, or that "exerça a sua
atividade profissional por conta própria em estabelecimento de saúde, desde que
sobre o mesmo detenha o controlo". In English: whoever owns, oversees, manages,
holds or otherwise operates the establishment, or works on their own account in
an establishment they control.

The ERS presumes own-account work when the professional provides care "de modo
autónomo, assumindo-se perante o utente como entidade responsável pela
prestação de tais cuidados, nomeadamente emitindo faturas ou recibos próprios
aos utentes, ou possuindo acordos ou convenções". In English: autonomously, and
presenting themselves to the patient as responsible for the care, in particular
by issuing their own invoices or receipts or by holding care agreements. Invoicing
is one indicator of that presumption, not the test itself.

The same FAQ says remote care to patients in mainland Portugal requires
registration **as a telemedicine unit**, even if the server is abroad.

**Registration fees.**

- Registration fee: €900 + €25 × NPS, minimum €1,000, maximum €50,000. NPS is
  the number of health professionals at the establishment.
- Annual contribution: €450 + €12.50 × NMPS, minimum €500, maximum €25,000.
  NMPS is the simple average of the number of associated professionals at the
  end of each month of the calendar year before payment.
- Reduced amounts: a €200 registration fee and a €25 annual contribution for
  legally recognised patient associations and for liberal professionals with
  no associated professionals, working part-time in their own establishment.

These figures come from the ERS FAQ; the fee portaria was not checked.

**ERS Regulamento n.º 66/2015, art. 10(1).** Telemedicine means "prestação de
cuidados de saúde à distância, nomeadamente os que utilizem para o efeito
qualquer meio de transmissão de dados, ou de comunicação eletrónica"
(provision of care at a distance by any means of data transmission or
electronic communication).

**ERS Recommendation on telemedicine (25 May 2023) and the ERS teleconsultation
guide (2024, with Alerta de Supervisão n.º 7/2024).** The provider must:

- inform the patient of costs;
- obtain informed consent;
- obtain separate consent for any recording;
- verify the identity of both parties;
- record the teleconsultation in the clinical file.

These duties fall on the **provider** (the expert). Eleva's product supports
them:

- price and policy are shown before payment;
- recording is off;
- the join page has identity-bound grants;
- the expert keeps the record.

**No ERS document reviewed addresses booking or payment intermediaries.** A
search of ers.pt for "plataforma", "intermediação" and "telessaúde" found
nothing on point. The absence of guidance is not proof that the ERS shares this
reading.

### 2.4 Related regimes

- **DL 238/2015 (health advertising)** applies to "quaisquer intervenientes".
  Art. 2(a) defines an interveniente as anyone who "beneficiam da, ou
  participam na, conceção ou na difusão" of health advertising (benefits from,
  or takes part in, designing or disseminating it). **This covers Eleva
  directly** as the platform that lists and promotes experts. See §6.
- **DL 156/2005 (Livro de Reclamações).** See §7.

## 3. Analysis: why Eleva is not a provider

| ERS test                                                                        | Eleva's facts                                                                                                                                                                                                                        |
| ------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Owns, oversees, manages, holds or otherwise operates an establishment (ERS FAQ) | Eleva holds no premises and employs no clinicians. It does run the software through which video sessions take place, so "otherwise operates" is the contestable point for telemedicine units (§4(2)).                                |
| Organised resources **for providing** care (DL 127/2014 art. 1(2))              | Eleva provides booking, payment, video and record-keeping software. It employs or contracts no clinicians to deliver care, sets no clinical protocols, assigns no patients to clinicians and operates no premises.                   |
| Who presents as responsible for the care (ERS FAQ)                              | The expert's own name, Ordem and cédula appear on the profile. The terms and health-data notice say the expert provides care and Eleva does not (`terms`, `health-data`, `trust/ers`). Members choose the expert.                    |
| One indicator: own invoices or receipts, or care agreements (ERS FAQ)           | **The expert invoices the member** for the session (founder decision 1). Eleva invoices only its 15% platform fee to the expert (ELEVA-FEE series). Clinic bookings carry no booking fee; clinics pay a seat subscription.           |
| Clinical decisions                                                              | Made by the expert alone. Expert agreement §1: Eleva "não interfere nem influencia o julgamento clínico".                                                                                                                            |
| Professional regulation                                                         | Only regulated professionals with an Ordem-verified licence may sell (founder decision 4). Their conduct is regulated by their Ordem (DL 126/2014 art. 4(3)(a)), and their establishment, including a telemedicine unit, by the ERS. |

**Conclusion.** On these facts Eleva is an information-society service provider
(DL 7/2004) and an online marketplace. It is not a health-care establishment.

## 4. Risks that weaken the position

1. **CAE 86950 ("outras atividades de saúde humana").** It appears among the
   company's activity codes on the Certidão Permanente. A CAE does not create
   a duty to register, but it is evidence the ERS may read against Eleva.
   - **Recommendation:** ask the accountant and lawyer whether to remove 86950. Keep 62xxx (software and IT services) as the main code, and
     consider 63120 / 74900 or a marketplace-appropriate code.
     `[[FOUNDER INPUT: is CAE 86950 used for any current activity (e.g. founder's own practice)?]]`
2. **"Digital health platform" wording.** The DPA and expert agreement say
   Eleva "opera uma plataforma digital de saúde … no âmbito das atividades de
   saúde digital e telemedicina". Telemedicine units are regulated
   establishments.
   - **Recommendation:** describe Eleva as a "marketplace and software
     platform that connects members with independent professionals". Avoid
     "telemedicine", "consultas Eleva" or "our therapists". The `/trust/ers`
     page also says "digital health platform" in all three locales. The public
     pages are owned elsewhere, so this is tracked as an open item in the
     decision log (2026-10-30: owner founder, next review 2026-11-16).
3. **Eleva is the merchant on the card statement.** Payments use Stripe
   **separate charges and transfers**: the charge sits on Eleva's platform
   account, and Eleva later transfers the expert's share
   (`payments-payouts-spec.md`). A member may perceive Eleva as the seller of
   the session.
   - **Recommendation:** the terms must state that Eleva collects payment
     **in the name and on behalf of the expert** (mandato de cobrança /
     commercial agency). The checkout must name the expert as the provider. The
     receipt must make clear the session invoice is issued by the expert. The
     accountant must confirm the VAT treatment of the collected amount
     (outside Eleva's turnover, with only the fee as Eleva's supply).
4. **Eleva-funded promotion codes** (founder decision 5): the expert's share is
   computed on list price and Eleva bears the discount. This is a commercial
   subsidy, not provision of care.
   - **Recommendation:**
     - present codes as an Eleva discount on the platform price, not as
       "free/discounted consultations by Eleva";
     - the expert invoices the full list price, with the accountant
       confirming the invoicing of a third-party-funded discount;
     - avoid contests and giveaways of health services (DL 238/2015
       art. 7(2)(c)).
5. **Licence checks** could be read as Eleva "organising" the professionals.
   Verification is a safety and advertising-law duty (DL 238/2015 art. 4(3)),
   not clinical governance. Keep it framed that way.
6. **Clinic product (Phase 11).** A clinic using Eleva as SaaS is itself the
   registered establishment. Eleva must not operate clinics or employ their
   staff.

## 5. Triggers that would require Eleva to register (and possibly license)

Eleva should re-run this analysis, and probably register at the ERS before
starting, if it does any of the following:

1. **Employs or engages health professionals to deliver care in Eleva's
   name.** This includes salaried or contracted clinicians, an "Eleva care
   team", or on-call professionals paid by Eleva per session.
2. **Invoices the member for the clinical service**, or becomes merchant of
   record for the care with the expert as a subcontractor.
3. **Assigns members to professionals** ("we match you with a therapist")
   where Eleva, not the member, chooses, or sets **clinical protocols,
   triage or care pathways**.
4. Offers **its own branded health services or programmes** (e.g. "Eleva
   menopause programme" delivered by professionals Eleva selects and pays),
   including academy courses with an individual clinical component.
5. **Operates physical premises** where care is delivered, or rents rooms
   with clinical equipment as a service.
6. **Supervises clinical quality** beyond licence verification, e.g. clinical
   directors who review experts' clinical decisions.
7. Adds **AI that gives health advice to members directly**, as opposed to
   drafting for the expert. This also raises medical-device questions.
8. Receives an **ERS request** or opinion treating it as a provider.

**What registration would mean if triggered:**

- registration before activity (DL 126/2014 art. 26(3)), as a telemedicine
  unit for remote care;
- a technical director where the typology requires one;
- registration fees and annual contribution;
- a physical and electronic complaints book with reporting to the ERS;
- ERS supervision;
- licensing under DL 127/2014 once telemedicine portarias exist.

## 6. Health advertising (DL 238/2015): Eleva's own duties

Eleva is an "interveniente" (art. 2(a)), so it is directly exposed.

- **Identification (art. 4(1)).** Each profile must identify the professional
  truthfully and completely. ERS Regulamento n.º 1058/2016 sets the fields.
  This memo relies on the OMD information note that quotes the regulation; the
  Diário da República text could not be loaded, so counsel should check it.
  - **Always (art. 2(2)):** name or firm and commercial designation.
  - **NIF (art. 2(2)(b), (4)):** required **only** when the advertised party is
    not subject to ERS registration. Those subject to registration are
    dispensed from it.
  - **When subject to ERS registration (art. 2(3)):** the ERS registration
    number; the operating licence number where the typology needs one; the
    establishment's address where the advertising concerns an establishment;
    and, for a health professional, the cédula number and professional
    qualifications.
  - **Any identifiable professional (art. 3(2)(b)):** the cédula or card number
    and its issuing body.
  - **Recommendation:** show the ERS registration number, the cédula number
    with the issuing Ordem, and qualifications on every public profile, plus
    the licence number and address where they apply. Do not treat NIF as a
    general public-profile field. Every sellable expert should be subject to
    ERS registration (art. 4(3) below), so the NIF is the exception.
- **Art. 4(3).** Advertising is unlawful where the provider "não se encontre
  devidamente registado na ERS" (is not duly registered at the ERS).
  - **Recommendation:** collect and verify each expert's **ERS registration
    number** at onboarding alongside the Ordem licence. Do not publish
    sellable offers without it. This goes beyond founder decision 4 and is
    needed to avoid Eleva advertising unregistered providers.
- **Prohibited practices (art. 7):**
  - misleading claims about a service;
  - cure claims or guaranteed results;
  - confusion about qualifications;
  - "grátis" or "com desconto" claims that are not true;
  - inducing unnecessary consumption;
  - health services as prizes.
  - **Recommendation:**
    - add a profile and listing content policy;
    - review promo-code copy;
    - give experts a takedown path.
- **Fines (art. 8).** Up to €44,891.81 for companies, with ancillary sanctions
  (up to a 2-year ban). The ERS enforces.

## 7. Experts' own obligations

Communicate these in the expert agreement and onboarding. They are the
expert's duties, not Eleva's.

1. **ERS registration** of their establishment before activity, including as a
   **telemedicine unit** for video sessions. Keep it updated within 30 days
   (DL 126/2014 art. 26). Pay the ERS fees.
2. **Licensing** under DL 127/2014 where their typology requires it, for
   in-person premises.
3. **Livro de Reclamações**, physical and electronic, and forwarding of
   complaints to the ERS within 10 working days (DL 126/2014 art. 30(2); ERS
   FAQ).
4. **Teleconsultation duties** (ERS guide 2024): informed consent, cost
   information, identity check, clinical record.
5. **Health advertising**: their own profile copy must comply with DL
   238/2015.
6. **Invoicing** the member, with their own tax position.
7. **Clinical records and GDPR** as controller: retention, rights, and art. 9
   basis ([`retention-schedule.md`](./retention-schedule.md)).
8. **Professional liability insurance** (expert agreement §2).

## 8. Eleva's complaints book

DL 156/2005 art. 2(2), as amended, extends the **electronic** Livro de
Reclamações to all suppliers of goods and service providers, including those
operating through digital means. The annex is only an example list.

Eleva's own intermediation service is therefore covered:

- it must hold the electronic book;
- it must link to <https://www.livroreclamacoes.pt> visibly (art. 5-B).

The complaints page already does this. The competent authority for Eleva's own
service is most likely **ASAE**, as the residual authority. The ERS is
competent for the experts.

## 9. Recommended actions

1. Founder decision 1 is in the decision log (2026-10-29), and this memo's
   corrections and open items in the 2026-10-30 entry. The ERS item is marked
   "decided — intermediary" in the fact sheet.
2. Lawyer to confirm the analysis. Optionally, request an informal ERS view
   (pedido de esclarecimento) before scale.
3. Fact-sheet law table corrected in this PR: registration is DL 126/2014
   art. 26 + ERS Reg. 66/2015; licensing is DL 127/2014.
4. Review CAE 86950 with the accountant.
5. Add to expert onboarding: ERS registration number (telemedicine unit),
   Ordem and cédula, and evidence of insurance.
6. Terms and checkout: state the collection mandate and name the expert as
   provider (§4(3)).
7. Adopt a content policy for profiles and promotions under DL 238/2015.

## Points for lawyer review

1. Is the intermediary analysis sound, given CAE 86950 and Eleva being merchant
   of record under separate charges and transfers?
2. The right legal vehicle for collecting payment on the expert's behalf
   (mandato sem representação vs agency), with VAT treatment by the
   accountant.
3. Whether Eleva should require ERS registration from every expert before
   selling, given DL 238/2015 art. 4(3) and Eleva's status as interveniente.
4. Whether DL 126/2014 art. 31 (cooperation of "demais agentes") creates any
   duty for Eleva to share information with the ERS on request.
5. Eleva-funded promotion codes under DL 238/2015 art. 7(1)(f) and
   art. 7(2)(c).
6. Whether an informal ERS consultation is advisable.
7. Wording of the public pages ("plataforma digital de saúde", "telemedicina")
   and of the DPA.
8. Whether "otherwise operates" in the ERS FAQ could reach a platform that runs
   the video software for independent experts.
9. Confirm the Regulamento 1058/2016 art. 2 and art. 3 fields against the
   Diário da República text.

## Sources

- DL 126/2014 (ERS Statutes):
  <https://diariodarepublica.pt/dr/detalhe/decreto-lei/126-2014-56304800>
  (original text: <https://www.omd.pt/content/uploads/2017/12/decreto-lei-126-2014.pdf>)
- DL 127/2014, consolidated:
  <https://diariodarepublica.pt/dr/legislacao-consolidada/decreto-lei/2014-75045539>
- ERS FAQ on mandatory registration:
  <https://www.ers.pt/pt/prestadores/perguntas-frequentes/faqs/perguntas-frequentes-sobre-obrigatoriedade-de-registo-na-ers/>
- ERS Recommendation on telemedicine, 25 May 2023:
  <https://www.ers.pt/media/npumau00/recomenda%C3%A7%C3%A3o-telemedicina_25-05-2023.pdf>
- ERS teleconsultation guide:
  <https://www.ers.pt/media/0grngycb/guia-pr%C3%A1tico_ers_-prestacao_teleconsultas.pdf>
- DL 238/2015 (health advertising):
  <https://www.omd.pt/content/uploads/2017/12/decreto-lei-238-2015-publicidade-saude.pdf>
- ERS Regulamento n.º 1058/2016, as quoted in the OMD information note:
  <https://www.omd.pt/content/uploads/2017/12/informacao-regulamento-ers-1058-2016.pdf>.
  Official text: <https://diariodarepublica.pt/dr/detalhe/regulamento/1058-2016-75796236>
  (not loaded). ERS good-practice manual:
  <https://www.ers.pt/media/e50by3ag/manual-boas-praticas-publicidade-saude.pdf>
- ERS leaflet on health advertising:
  <https://ers.pt/media/x3enq5ls/triptico_praticas-publicitarias-em-saude_web.pdf>
- DL 156/2005, consolidated:
  <https://www.pgdlisboa.pt/leis/lei_mostra_articulado.php?nid=737&tabela=leis>
- ERS FAQ on the electronic complaints book:
  <https://www.ers.pt/pt/prestadores/perguntas-frequentes/faqs/livro-de-reclamacoes-eletronico/>
