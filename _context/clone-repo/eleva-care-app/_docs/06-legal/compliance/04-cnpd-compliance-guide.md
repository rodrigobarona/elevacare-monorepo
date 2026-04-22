# 🇵🇹 CNPD Compliance Guide

**Portuguese Data Protection Authority (Comissão Nacional de Proteção de Dados)**

---

## Document Control

| Field                | Details                                             |
| -------------------- | --------------------------------------------------- |
| **Company**          | Búzios e Tartarugas, Lda. (trading as Eleva.care)   |
| **NIF**              | PT515001708                                         |
| **Address**          | Rua Gil Vicente, 2, 2775-198 Parede, Portugal       |
| **CAE Codes**        | 5520 (Principal), 86950, 62201, 55204, 62900, 85591 |
| **Document Version** | 1.0                                                 |
| **Last Updated**     | October 1, 2025                                     |

---

## Executive Summary

This guide explains **CNPD** (Comissão Nacional de Proteção de Dados) requirements for Eleva.care's health data processing operations in Portugal.

**Key Facts**:

- CNPD is Portugal's **supervisory authority** under GDPR
- Responsible for enforcing data protection laws in Portugal
- Powers include inspections, corrective measures, and administrative fines
- **Healthcare data processing** falls under special scrutiny (Article 9 GDPR)

---

## 1. What is CNPD?

### 1.1 Legal Authority

**Official Name**: Comissão Nacional de Proteção de Dados  
**Legal Basis**:

- **GDPR** (Regulation (EU) 2016/679) - European level
- **Lei n.º 58/2019** - Portuguese implementation law
- **Lei n.º 67/98** (historic, replaced by Lei 58/2019)

**Powers** (Article 58 GDPR):

- **Investigative**: Request information, conduct audits, access data
- **Corrective**: Issue warnings, reprimands, limitations, fines
- **Authorization**: Approve processing activities (where required)
- **Advisory**: Provide guidance on GDPR compliance

### 1.2 Contact Information

**CNPD - Comissão Nacional de Proteção de Dados**

**Address**:

```
Av. D. Carlos I, 134 - 1º
1200-651 Lisboa
Portugal
```

**Phone**: +351 213 928 400  
**Fax**: +351 213 976 832  
**Email**: geral@cnpd.pt  
**Website**: https://www.cnpd.pt

**Office Hours**:

- Monday to Friday: 9:30-12:30 and 14:30-17:00
- Closed: Weekends and Portuguese public holidays

**Public Service Desk**:

- **No appointment needed** for general inquiries
- **Email preferred** for formal notifications

---

## 2. When Must You Notify/Consult CNPD?

### 2.1 Mandatory Notifications

#### ✅ **Data Breach Notification** (REQUIRED - ALWAYS)

**Legal Basis**: GDPR Article 33

**When**: Within **72 hours** of becoming aware of personal data breach

**How**: Online form at https://www.cnpd.pt → "Notificação de violação de dados pessoais"

**Who**: Data Controller (Búzios e Tartarugas, Lda.) or DPO

**Cost**: FREE

**See**: Full procedures in `DATA_BREACH_PROCEDURES.md`

---

#### ✅ **DPO Designation** (REQUIRED - within 30 days)

**Legal Basis**: GDPR Article 37(7)

**When**: Within 30 days of appointing Data Protection Officer

**How**: Online notification at https://www.cnpd.pt

**Information Required**:

- Controller details (Company name, NIF, address)
- DPO name and contact details (email, phone)
- Type of appointment (internal/external)

**Cost**: FREE

**See**: Full details in `DPO_DESIGNATION.md`

---

### 2.2 Prior Consultation (Conditional)

#### ⚠️ **DPIA with High Residual Risk** (ONLY IF HIGH RISK REMAINS)

**Legal Basis**: GDPR Article 36

**When**: DPIA shows **high residual risk** that cannot be mitigated

**Status for Eleva.care**:

- ✅ **NOT REQUIRED** (our DPIA shows LOW residual risk after mitigation)
- ⚠️ Only required if DPIA concludes with HIGH RISK rating

**Timeline**: **Minimum 8 weeks before** starting processing

**How**: Written consultation sent to geral@cnpd.pt with complete DPIA

---

### 2.3 NOT Required Anymore (Historic Requirement)

#### ❌ **Health Data Processing Notification** (ABOLISHED)

**Historic Context**: Under old Portuguese law (Lei 67/98), health data processing required **prior authorization** from CNPD.

**Current Status (GDPR)**: ✅ **NOT REQUIRED**

**Reason**:

- GDPR removed general notification/authorization requirements
- Health data processing allowed with appropriate legal basis (Article 9)
- No prior permission needed from CNPD

**Eleva.care Status**: ✅ **No authorization needed** (Article 9(2)(a) - explicit consent)

---

## 3. CNPD's Role in Healthcare Data Processing

### 3.1 Supervisory Powers for Health Data

**Enhanced Scrutiny**: CNPD pays special attention to **Article 9 special category data** (health data)

**Possible CNPD Actions**:

1. **Routine Inspections**: Random audits of healthcare data controllers
2. **Complaint Investigations**: If data subject files complaint
3. **Breach Investigations**: Following data breach notification
4. **Proactive Investigations**: Based on media reports or suspicion

**Penalties for Non-Compliance**:
| Violation Type | Maximum Fine | GDPR Article |
|----------------|-------------|--------------|
| **Security breach** (Article 32) | €10M or 2% revenue | Article 83(4)(a) |
| **No DPIA** (Article 35) | €10M or 2% revenue | Article 83(4)(a) |
| **Missing DPO** (Article 37) | €10M or 2% revenue | Article 83(4)(a) |
| **No breach notification** (Article 33) | €10M or 2% revenue | Article 83(4)(a) |
| **Processing violations** (Article 6, 9) | €20M or 4% revenue | Article 83(5) |
| **Data subject rights** (Article 15-22) | €20M or 4% revenue | Article 83(5)(b) |

**Note**: CNPD also issues warnings, reprimands, and processing bans (not just fines)

### 3.2 CNPD's Cooperation with Healthcare Sector

**CNPD Special Focus Areas**:

- ✅ Electronic health records (EHR) systems
- ✅ Telemedicine platforms (like Eleva.care)
- ✅ Health apps and wearables
- ✅ Clinical research databases

**CNPD Guidance Documents** (Portuguese language):

- "Tratamento de Dados de Saúde" (Health Data Processing)
- "Segurança do Tratamento" (Processing Security)
- Available at: https://www.cnpd.pt → "Documentação" → "Orientações"

---

## 4. Eleva.care's CNPD Compliance Obligations

### 4.1 Completed Requirements

| Obligation                            | Status  | Evidence                             | Date        |
| ------------------------------------- | ------- | ------------------------------------ | ----------- |
| **Legal basis for health data**       | ✅ DONE | Article 9(2)(a) - Explicit consent   | Implemented |
| **Privacy Policy published**          | ✅ DONE | https://eleva.care/legal/privacy     | April 2025  |
| **Data Processing Agreement (DPA)**   | ✅ DONE | https://eleva.care/trust/dpa         | April 2025  |
| **Terms and Conditions**              | ✅ DONE | https://eleva.care/legal/terms       | April 2025  |
| **Cookie consent**                    | ✅ DONE | Cookie banner implemented            | Implemented |
| **Encryption (Article 32)**           | ✅ DONE | AES-256-GCM + TLS 1.3                | Implemented |
| **EU data residency**                 | ✅ DONE | All vendors EU-hosted                | Implemented |
| **Processor agreements (Article 28)** | ✅ DONE | DPAs with Neon, Vercel, Stripe, etc. | Executed    |

### 4.2 Required Actions (Next 90 Days)

| Obligation                          | Priority    | Deadline          | Assigned To | Status     |
| ----------------------------------- | ----------- | ----------------- | ----------- | ---------- |
| **Appoint Data Protection Officer** | 🚨 CRITICAL | 30 days           | Management  | ⚠️ PENDING |
| **Register DPO with CNPD**          | 🚨 CRITICAL | 30 days after DPO | DPO         | ⚠️ PENDING |
| **Complete DPIA**                   | 🚨 CRITICAL | 45 days           | DPO         | ⚠️ PENDING |
| **Finalize Breach Procedures**      | 🚨 CRITICAL | 45 days           | DPO         | ⚠️ PENDING |
| **Employee Training (GDPR)**        | 🟡 HIGH     | 60 days           | HR + DPO    | ⚠️ PENDING |
| **Verify CNPD compliance**          | 🟡 HIGH     | 90 days           | DPO         | ⚠️ PENDING |

### 4.3 Ongoing Compliance (Annual)

| Task                       | Frequency | Responsible | Next Due          |
| -------------------------- | --------- | ----------- | ----------------- |
| **DPIA Review**            | Annual    | DPO         | [Date + 1 year]   |
| **Privacy Policy Review**  | Annual    | Legal + DPO | [Date + 1 year]   |
| **Processor Assessment**   | Annual    | DPO         | [Date + 1 year]   |
| **Employee Training**      | Annual    | HR + DPO    | [Date + 1 year]   |
| **Security Audit**         | Annual    | IT + DPO    | [Date + 1 year]   |
| **Breach Register Review** | Quarterly | DPO         | [Date + 3 months] |

---

## 5. How to Interact with CNPD

### 5.1 General Inquiries (Non-urgent)

**Method**: Email to geral@cnpd.pt

**Email Template**:

```
Assunto: Pedido de Esclarecimento - Tratamento de Dados de Saúde

Exmos. Senhores,

Vimos por este meio solicitar esclarecimento sobre [descrição da questão].

Dados da Entidade:
- Denominação Social: Búzios e Tartarugas, Lda.
- Nome Comercial: Eleva.care
- NIF: PT515001708
- Morada: Rua Gil Vicente, 2, 2775-198 Parede, Portugal
- Email: support@eleva.care
- Encarregado de Proteção de Dados: [Nome], dpo@eleva.care

Questão:
[Descrição detalhada da questão]

Agradecemos antecipadamente a vossa atenção.

Com os melhores cumprimentos,
[Nome]
[Cargo]
Búzios e Tartarugas, Lda.
```

**Expected Response Time**:

- Simple inquiries: 1-2 weeks
- Complex matters: 4-8 weeks

### 5.2 Data Breach Notification (URGENT)

**Method**: Online form (preferred) or email geral@cnpd.pt

**Timeline**: **Within 72 hours** of awareness

**See**: Full procedures in `DATA_BREACH_PROCEDURES.md`

### 5.3 Responding to CNPD Requests

**If CNPD contacts you**:

1. ✅ **Acknowledge immediately** (within 48 hours)
2. ✅ **Designate point of contact** (preferably DPO)
3. ✅ **Respond within deadline** (usually 30 days, but check request)
4. ✅ **Be cooperative and transparent**
5. ✅ **Seek legal counsel** if complex or potential sanctions

**Common CNPD Requests**:

- Documentation of processing activities (Article 30 records)
- DPIA documentation
- Proof of legal basis for processing
- Processor agreements (DPAs)
- Security measures documentation
- Breach register
- Data subject request handling logs

**What NOT to do**:

- ❌ Ignore or delay response
- ❌ Provide incomplete information
- ❌ Argue or be defensive (be factual and professional)
- ❌ Destroy evidence or documentation

---

## 6. CNPD Complaint Process (If Data Subject Files Complaint)

### 6.1 How Complaints Reach CNPD

**Data subjects can file complaints**:

- Online: https://www.cnpd.pt → "Queixa"
- Email: geral@cnpd.pt
- Postal mail: Av. D. Carlos I, 134 - 1º, 1200-651 Lisboa
- In-person: Walk-in during office hours

**What triggers complaints**:

- Denied data subject access request
- Unresolved privacy concerns
- Suspected data breach
- Unwanted marketing communications
- Belief that data is processed unlawfully

### 6.2 CNPD Investigation Process

**Steps**:

1. **CNPD receives complaint** → assesses admissibility
2. **CNPD notifies controller** (Eleva.care) → requests response
3. **Controller responds** (usually 30-day deadline)
4. **CNPD investigates** → may request additional info, conduct audit
5. **CNPD decision** → dismissal, corrective measures, or sanctions

**Timeline**: 3-12 months (depends on complexity)

**Possible Outcomes**:

- ✅ **Complaint dismissed** (no violation found)
- ⚠️ **Warning or reprimand** (minor violation, corrected)
- ❌ **Corrective measures ordered** (implement specific changes)
- ❌ **Administrative fine** (serious or repeated violations)
- ❌ **Processing ban** (severe violations)

### 6.3 Preventing Complaints

**Best Practices**:

1. ✅ **Respond to data subject requests promptly** (within 30 days)
2. ✅ **Provide clear, understandable information**
3. ✅ **Honor opt-out requests immediately**
4. ✅ **Maintain good records** of all data subject interactions
5. ✅ **Apologize and correct** if mistake made

**If complaint filed**:

- ✅ Take it seriously (don't dismiss)
- ✅ Investigate internally first
- ✅ Attempt resolution with data subject
- ✅ Prepare comprehensive response for CNPD
- ✅ Involve DPO and legal counsel

---

## 7. CNPD Resources and Guidance

### 7.1 Useful CNPD Documents (Portuguese)

**Available at**: https://www.cnpd.pt → "Documentação"

**Key Documents**:

1. **"Orientações para Tratamento de Dados de Saúde"**
   - CNPD's guidance on health data processing
   - Covers consent, security, and legal bases

2. **"Segurança do Tratamento de Dados Pessoais"**
   - Technical and organizational security measures
   - Encryption, access control, audit logging

3. **"Direitos dos Titulares"**
   - Data subject rights (access, rectification, erasure)
   - How to handle requests

4. **"Responsável pelo Tratamento vs. Subcontratante"**
   - Controller vs. Processor distinction
   - When DPA (Article 28) is required

5. **FAQs on GDPR**
   - Common questions about GDPR compliance

**Language**: Primarily Portuguese (some documents have English summaries)

### 7.2 CNPD Training and Events

**CNPD offers**:

- Periodic webinars on GDPR topics (free)
- Annual CNPD conference
- Sector-specific guidance sessions (healthcare sector)

**To stay updated**:

- Subscribe to CNPD newsletter: https://www.cnpd.pt → "Newsletter"
- Follow CNPD on social media (LinkedIn, Twitter)
- Monitor "Deliberações" (decisions) for case law

---

## 8. CAE Code Considerations for Eleva.care

### 8.1 Your Registered CAE Codes

| CAE Code              | Activity                                     | Relevance to Data Protection                         |
| --------------------- | -------------------------------------------- | ---------------------------------------------------- |
| **5520** (Principal)  | Alojamento de curta duração                  | ⚠️ Not health-related, but company primary activity  |
| **86950** (Secondary) | **Atividades de enfermagem**                 | ✅ **HEALTHCARE** - triggers Article 9 GDPR          |
| **62201** (Secondary) | Consultoria em tecnologias de informação     | ✅ IT consultancy - relevant for SaaS platform       |
| **55204** (Secondary) | Outros locais de alojamento de curta duração | ⚠️ Accommodation - not health-related                |
| **62900** (Secondary) | Outras atividades dos serviços de informação | ✅ Information services - relevant for platform      |
| **85591** (Secondary) | Formação profissional                        | ✅ Professional training - may process personal data |

### 8.2 Implications

**CAE 86950 (Nursing/Healthcare)**:

- ✅ Confirms you're **healthcare provider** (subject to health data rules)
- ✅ **Article 9(2)(h)** applies: "medical diagnosis, provision of health or social care"
- ✅ Strengthens legal basis for processing health data

**Recommendation**:

- ✅ Emphasize CAE 86950 in GDPR documentation (legal basis)
- ✅ Ensure all healthcare activities conducted by **licensed professionals** (otherwise, CAE may be challenged)

**Question for Legal Review**:

- Is **Eleva.care platform** actually performing CAE 86950 activities?
- Or is it a **platform connecting** healthcare professionals (who perform CAE 86950)?

**Distinction**:

- **If Eleva.care = healthcare provider**: Article 9(2)(h) applies directly
- **If Eleva.care = platform**: Article 9(2)(a) (consent) is more appropriate

**Recommendation**: ⚠️ **Clarify with legal counsel** which model applies (affects legal basis in GDPR)

---

## 9. Checklist: CNPD Compliance for Eleva.care

### 9.1 Immediate Actions (0-30 days)

- [ ] **Appoint Data Protection Officer** (DPO)
  - Decide: Internal vs. External
  - Budget: €3,600-€18,000/year
  - See: `DPO_DESIGNATION.md`

- [ ] **Register DPO with CNPD**
  - Online at https://www.cnpd.pt
  - Within 30 days of appointment
  - Cost: FREE

- [ ] **Set up dpo@eleva.care email**
  - Forward to appointed DPO
  - Publish in Privacy Policy

- [ ] **Review Privacy Policy**
  - Ensure DPO contact included
  - Verify all processing activities listed
  - Current version: April 2025 (review annually)

### 9.2 Short-term Actions (30-90 days)

- [ ] **Complete DPIA** (Data Protection Impact Assessment)
  - Use template: `GDPR_DPIA_TEMPLATE.md`
  - DPO to lead
  - Consultation with stakeholders
  - Timeline: 45 days

- [ ] **Finalize Breach Notification Procedures**
  - Adopt: `DATA_BREACH_PROCEDURES.md`
  - Train incident response team
  - Test with simulation exercise
  - Timeline: 45 days

- [ ] **Employee GDPR Training**
  - All employees (data protection awareness)
  - Incident response team (detailed procedures)
  - Developers (security best practices)
  - Timeline: 60 days

- [ ] **Document Article 30 Records**
  - Record of processing activities
  - Required for all controllers
  - CNPD may request at any time

- [ ] **Verify CAE Code Alignment**
  - Legal review: Is Eleva.care "healthcare provider" or "platform"?
  - Adjust legal basis if needed (Article 9(2)(a) vs. 9(2)(h))

### 9.3 Ongoing Compliance (Annual)

- [ ] **Annual DPIA Review** (every 12 months)
  - Update if processing changes
  - Reassess risks
  - DPO to coordinate

- [ ] **Annual Privacy Policy Review**
  - Update if services change
  - Verify accuracy
  - Legal + DPO

- [ ] **Annual Processor Assessment**
  - Review Neon, Vercel, Stripe, etc.
  - Verify DPAs still valid
  - Check for security incidents

- [ ] **Annual Employee Training**
  - Refresher on GDPR principles
  - New hires onboarding

- [ ] **Quarterly Breach Register Review**
  - Ensure all incidents documented
  - Review for patterns
  - Implement preventive measures

---

## 10. Quick Reference

### When to Contact CNPD

| Situation              | Timeline                            | Method               | Mandatory?              |
| ---------------------- | ----------------------------------- | -------------------- | ----------------------- |
| **Data Breach**        | Within 72 hours                     | Online form          | ✅ YES (if risk exists) |
| **DPO Appointment**    | Within 30 days                      | Online notification  | ✅ YES                  |
| **DPIA High Risk**     | Before processing                   | Written consultation | ⚠️ ONLY IF HIGH RISK    |
| **General Question**   | No deadline                         | Email                | ❌ NO (optional)        |
| **Complaint Response** | Per CNPD deadline (usually 30 days) | Email or portal      | ✅ YES (if requested)   |

### Key CNPD Details

```
Comissão Nacional de Proteção de Dados (CNPD)
Av. D. Carlos I, 134 - 1º
1200-651 Lisboa, Portugal

Phone: +351 213 928 400
Email: geral@cnpd.pt
Website: https://www.cnpd.pt

Office Hours: Mon-Fri, 9:30-12:30 and 14:30-17:00
```

### Eleva.care Quick Facts

```
Legal Entity: Búzios e Tartarugas, Lda.
Commercial Name: Eleva.care
NIF: PT515001708
Address: Rua Gil Vicente, 2, 2775-198 Parede, Portugal

Primary Activity (CAE): 5520 - Short-term accommodation
Healthcare Activity (CAE): 86950 - Nursing activities
IT Activity (CAE): 62201 - IT consultancy

DPO: [To be appointed]
DPO Email: dpo@eleva.care
DPO Phone: [To be provided]

Support: support@eleva.care
Phone: +351 931 897 950
```

---

## 11. Legal References

### Portuguese Law

- **Lei n.º 58/2019, de 8 de agosto** - Portuguese Data Protection Law (implements GDPR)
- **Lei n.º 67/98** (revoked) - Former data protection law
- **Regulamento n.º 796/2019** - CNPD internal regulations

### EU Law

- **GDPR** (Regulation (EU) 2016/679)
- **ePrivacy Directive** (2002/58/EC)
- **WP29 Guidelines** (now EDPB guidelines)

### CNPD Guidance

- All available at: https://www.cnpd.pt → "Documentação" → "Orientações"

---

**Document Status**: ACTIVE - Compliance Guide  
**Classification**: INTERNAL  
**Review**: Annually or upon regulatory changes  
**Owner**: Data Protection Officer

**Next Steps**:

1. ✅ Appoint DPO (30 days)
2. ✅ Complete DPIA (45 days)
3. ✅ Train employees (60 days)
4. ✅ Schedule annual reviews

---

## Appendix: Portuguese Translations of Key Terms

| English                                  | Portuguese                                            |
| ---------------------------------------- | ----------------------------------------------------- |
| Data Protection                          | Proteção de Dados                                     |
| Personal Data                            | Dados Pessoais                                        |
| Data Subject                             | Titular dos Dados                                     |
| Data Controller                          | Responsável pelo Tratamento                           |
| Data Processor                           | Subcontratante                                        |
| Data Protection Officer (DPO)            | Encarregado de Proteção de Dados (EPD)                |
| Processing                               | Tratamento                                            |
| Consent                                  | Consentimento                                         |
| Data Breach                              | Violação de Dados Pessoais                            |
| Supervisory Authority                    | Autoridade de Controlo                                |
| GDPR                                     | RGPD (Regulamento Geral sobre a Proteção de Dados)    |
| Privacy Policy                           | Política de Privacidade                               |
| Data Protection Impact Assessment (DPIA) | Avaliação de Impacto sobre a Proteção de Dados (AIPD) |

---

**END OF DOCUMENT**
