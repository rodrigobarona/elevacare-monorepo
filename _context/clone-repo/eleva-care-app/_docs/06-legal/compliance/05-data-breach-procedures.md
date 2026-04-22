# 🚨 Data Breach Response and Notification Procedures

**GDPR Articles 33-34 Compliance**

---

## Document Control

| Field                | Details                                           |
| -------------------- | ------------------------------------------------- |
| **Company**          | Búzios e Tartarugas, Lda. (trading as Eleva.care) |
| **NIF**              | PT515001708                                       |
| **Address**          | Rua Gil Vicente, 2, 2775-198 Parede, Portugal     |
| **Document Version** | 1.0                                               |
| **Effective Date**   | [Date]                                            |
| **Next Review**      | [Date + 12 months]                                |
| **Document Owner**   | Data Protection Officer                           |

---

## Executive Summary

This document establishes **mandatory procedures** for responding to personal data breaches in compliance with **GDPR Articles 33 and 34** and Portuguese data protection law.

**Key Timelines** (STRICT):

- ⏰ **72 hours**: Notify CNPD (from awareness of breach)
- ⏰ **Without undue delay**: Notify affected individuals (if high risk)
- ⏰ **Immediate**: Activate incident response team

**Penalties for Non-Compliance**:

- Up to **€10 million** or **2% of global annual turnover** (whichever is higher) for violations of notification requirements (Article 83(4))
- Up to **€20 million** or **4% of global annual turnover** for violations of security principles (Article 83(5))

---

## 1. What Constitutes a Personal Data Breach?

### 1.1 Definition (Article 4(12) GDPR)

> "A breach of security leading to the **accidental or unlawful destruction, loss, alteration, unauthorised disclosure of, or access to**, personal data transmitted, stored or otherwise processed"

### 1.2 Types of Breaches

#### **Confidentiality Breach** (Unauthorized Disclosure/Access)

**Examples**:

- ✅ Unauthorized access to patient medical records
- ✅ Email sent to wrong recipient containing health data
- ✅ Database exposed publicly (misconfigured)
- ✅ Employee accessing patient data without authorization
- ✅ Stolen laptop with unencrypted patient data
- ✅ Phishing attack compromising user accounts

**Risk Level**: 🔴 **HIGH** (for health data)

#### **Integrity Breach** (Unauthorized Alteration)

**Examples**:

- ✅ Ransomware encrypting medical records
- ✅ Unauthorized modification of patient data
- ✅ Database corruption or tampering
- ✅ Malicious data modification

**Risk Level**: 🔴 **HIGH**

#### **Availability Breach** (Loss of Access/Data)

**Examples**:

- ✅ Accidental deletion of patient records
- ✅ System outage preventing access to medical data
- ✅ DDoS attack making platform unavailable
- ✅ Hardware failure losing unbackuped data
- ✅ Natural disaster destroying servers

**Risk Level**: 🟡 **MEDIUM to HIGH** (depends on recoverability)

### 1.3 Eleva.care-Specific Breach Scenarios

| Scenario                                                 | Type                     | CNPD Notification? | Individual Notification? |
| -------------------------------------------------------- | ------------------------ | ------------------ | ------------------------ |
| **Unauthorized access to encrypted medical records**     | Confidentiality          | ✅ YES             | ⚠️ LIKELY NO (encrypted) |
| **Unauthorized access to unencrypted medical records**   | Confidentiality          | ✅ YES             | ✅ YES (high risk)       |
| **Phishing compromises user account**                    | Confidentiality          | ✅ YES             | ✅ YES (if PHI accessed) |
| **Database backup leaked (encrypted)**                   | Confidentiality          | ✅ YES             | ⚠️ LIKELY NO (encrypted) |
| **Database backup leaked (unencrypted)**                 | Confidentiality          | ✅ YES             | ✅ YES (high risk)       |
| **Ransomware encrypts medical records**                  | Availability + Integrity | ✅ YES             | ✅ YES (high risk)       |
| **Employee accesses 10 patient records inappropriately** | Confidentiality          | ✅ YES             | ✅ YES (to those 10)     |
| **Email sent to wrong patient (contains PHI)**           | Confidentiality          | ✅ YES             | ✅ YES (both patients)   |
| **System outage (2 hours, no data loss)**                | Availability             | ⚠️ NO              | ❌ NO (temporary)        |
| **Laptop stolen (full disk encrypted)**                  | Confidentiality          | ✅ YES             | ⚠️ LIKELY NO (encrypted) |
| **Laptop stolen (no encryption)**                        | Confidentiality          | ✅ YES             | ✅ YES (high risk)       |

**Key Principle**: When in doubt, **REPORT TO CNPD**. Over-notification is better than under-notification.

---

## 2. Incident Response Team

### 2.1 Team Structure

**Incident Commander** (Overall Authority)

- **Role**: Managing Director or designated deputy
- **Responsibility**: Final decisions, external communication authority
- **Contact**: [Name, Phone, Email]

**Data Protection Officer** (Lead Coordinator)

- **Role**: Breach assessment, CNPD liaison, compliance
- **Responsibility**: Determine notification requirements, draft CNPD report
- **Contact**: dpo@eleva.care, [Phone]

**Technical Lead** (Investigation & Containment)

- **Role**: CTO or Senior Developer
- **Responsibility**: Technical investigation, containment, remediation
- **Contact**: [Name, Phone, Email]

**Legal Counsel** (Legal Advice)

- **Role**: External lawyer or in-house legal
- **Responsibility**: Legal implications, liability assessment
- **Contact**: [Law Firm, Phone, Email]

**Communications Lead** (Optional - for large breaches)

- **Role**: PR or Marketing lead
- **Responsibility**: Public communications, media relations
- **Contact**: [Name, Phone, Email]

### 2.2 Escalation Matrix

| Severity                                            | Response Team           | Notification Level          | Timeline  |
| --------------------------------------------------- | ----------------------- | --------------------------- | --------- |
| **CRITICAL** (>1000 records, unencrypted PHI)       | Full team + CEO         | CNPD + Individuals + Public | Immediate |
| **HIGH** (100-1000 records, or any unencrypted PHI) | DPO + Technical + Legal | CNPD + Individuals          | <6 hours  |
| **MEDIUM** (1-100 records, encrypted PHI)           | DPO + Technical         | CNPD (likely)               | <24 hours |
| **LOW** (Encrypted, no access risk)                 | DPO + Technical         | CNPD (assessment)           | <48 hours |

---

## 3. Breach Response Procedure (Step-by-Step)

### Phase 1: DETECTION & IMMEDIATE RESPONSE (0-2 hours)

#### Step 1.1: Detect and Identify (0-30 minutes)

**Detection Sources**:

- ✅ Security monitoring alerts (PostHog, Vercel logs)
- ✅ User reports (customer complaint)
- ✅ Employee reports
- ✅ Third-party notification (Neon, Clerk, etc.)
- ✅ Audit log anomalies
- ✅ System alerts

**Action**: Anyone detecting a potential breach **MUST**:

1. **DO NOT ignore or wait**
2. **Immediately notify**: dpo@eleva.care AND [Technical Lead]
3. **Document**: Date, time, what was observed
4. **Preserve evidence**: Do NOT delete logs, take screenshots

**Template Email**:

```
To: dpo@eleva.care, tech-lead@eleva.care
Subject: URGENT: Potential Data Breach Detected

Date/Time of Detection: [Date and time]
Detected By: [Your name]
What Happened: [Brief description]
Systems Affected: [Database, application, etc.]
Data Potentially Affected: [Type of data]
Estimated Number of Records: [Number or "Unknown"]

Initial Evidence: [Attach screenshots, log excerpts]

[Your Name]
[Contact Info]
```

#### Step 1.2: Activate Incident Response Team (30-60 minutes)

**DPO Actions**:

1. ✅ Acknowledge receipt of report
2. ✅ Assemble incident response team
3. ✅ Schedule emergency meeting (virtual/in-person)
4. ✅ Create incident tracking document
5. ✅ Start breach log (see Section 6)

**Emergency Meeting Agenda** (30 minutes):

- Confirm breach occurred (yes/no)
- Classify breach type and severity
- Assign investigation tasks
- Determine immediate containment actions
- Set next check-in time (2-4 hours)

#### Step 1.3: Immediate Containment (1-2 hours)

**Technical Lead Actions**:

- ✅ **Stop ongoing breach** (disable compromised accounts, block IPs)
- ✅ **Isolate affected systems** (if necessary, without destroying evidence)
- ✅ **Preserve logs and evidence** (backup all relevant logs immediately)
- ✅ **Notify third-party providers** (Neon, Vercel, Clerk if their systems involved)

**DO NOT**:

- ❌ Delete or modify logs
- ❌ Publicly announce (until legal/DPO clearance)
- ❌ Contact individuals yet (wait for DPO assessment)
- ❌ Restore from backup without analysis

---

### Phase 2: INVESTIGATION & ASSESSMENT (2-24 hours)

#### Step 2.1: Detailed Investigation (2-12 hours)

**Technical Team Tasks**:

1. **Determine Cause**:
   - What vulnerability or error led to breach?
   - Was it external attack, internal error, or system failure?
   - Attack vector analysis (phishing, SQL injection, misconfiguration?)

2. **Determine Scope**:
   - Which data was accessed/disclosed/lost?
   - How many data subjects affected?
   - Which data elements (name, email, health data, payment data)?
   - Time period of exposure

3. **Determine Risk**:
   - Was data encrypted? (AES-256-GCM)
   - Was data anonymized or pseudonymized?
   - What's the potential harm to individuals?

**Investigation Report Template**:

```
=== BREACH INVESTIGATION REPORT ===

1. BREACH SUMMARY
   - Incident ID: [Auto-generated ID]
   - Date/Time Detected: [Timestamp]
   - Breach Type: [ ] Confidentiality [ ] Integrity [ ] Availability

2. CAUSE ANALYSIS
   - Root Cause: [Description]
   - Attack Vector: [How breach occurred]
   - Vulnerability Exploited: [What weakness]

3. SCOPE ASSESSMENT
   - Number of Data Subjects: [Number]
   - Categories of Data:
     * [ ] Names
     * [ ] Email addresses
     * [ ] Phone numbers
     * [ ] Health data (specify): _____________
     * [ ] Payment data
     * [ ] Passwords (hashed/unhashed)
     * [ ] Other: _____________

   - Geographical Scope: [ ] Portugal [ ] EU [ ] Outside EU
   - Time Period: From [Date] to [Date]

4. ENCRYPTION STATUS
   - Data at Rest: [ ] Encrypted (AES-256-GCM) [ ] Not Encrypted
   - Data in Transit: [ ] Encrypted (TLS 1.3) [ ] Not Encrypted
   - Backups: [ ] Encrypted [ ] Not Encrypted

5. PRELIMINARY RISK ASSESSMENT
   - Risk to Individuals: [ ] Low [ ] Medium [ ] High
   - Justification: [Explanation]

6. CONTAINMENT MEASURES TAKEN
   - [List all actions taken to stop breach]

7. EVIDENCE PRESERVED
   - [List of logs, screenshots, forensic data collected]

Prepared By: [Name, Role]
Date: [Date]
```

#### Step 2.2: Risk Assessment for Notification (12-24 hours)

**DPO Task**: Determine notification requirements using GDPR criteria

**CNPD Notification Required?** (Article 33)

✅ **YES** if breach is "likely to result in a risk to the rights and freedoms of natural persons"

**Risk Factors** (WP29 Guidelines):
| Factor | Low Risk | Medium Risk | High Risk |
|--------|----------|-------------|-----------|
| **Data Type** | Contact info only | Sensitive personal data | **Health data (Article 9)** |
| **Volume** | <10 people | 10-100 people | >100 people |
| **Ease of Identification** | Pseudonymized | Partially identifiable | Fully identifiable |
| **Severity of Consequences** | Minor inconvenience | Financial loss | **Discrimination, physical harm** |
| **Special Characteristics** | General public | Specific group | **Vulnerable (patients)** |
| **Controller Characteristics** | One-time | Regular processor | **Healthcare provider** |

**Eleva.care Default**: ⚠️ **ANY breach involving health data = HIGH RISK = CNPD notification required**

**Individual Notification Required?** (Article 34)

✅ **YES** if breach is "likely to result in a **HIGH RISK** to the rights and freedoms"

**High Risk Indicators**:

- ✅ Health data exposed **without encryption**
- ✅ Data could lead to discrimination or reputational damage
- ✅ Large-scale breach affecting many individuals
- ✅ Children or vulnerable individuals affected
- ✅ Data includes passwords (unhashed) or financial data

**Exemptions from Individual Notification** (Article 34(3)):

- ✅ (a) Data was encrypted with strong encryption (AES-256-GCM) and keys not compromised
- ✅ (b) Controller took subsequent measures eliminating high risk
- ✅ (c) Would involve disproportionate effort (alternative: public communication)

**Decision Matrix**:

```
Encrypted health data + keys secure = CNPD YES, Individuals NO
Unencrypted health data = CNPD YES, Individuals YES
Encrypted data + keys compromised = CNPD YES, Individuals YES
<10 records, encrypted, contained quickly = CNPD YES, Individuals NO (likely)
```

---

### Phase 3: CNPD NOTIFICATION (Within 72 hours of awareness)

#### Step 3.1: Prepare CNPD Notification (24-48 hours)

**Timeline**: **Strict 72-hour deadline** from "becoming aware" of breach

**How to Notify CNPD**:

- **Method**: Online form at https://www.cnpd.pt → "Notificação de violação de dados pessoais"
- **Alternative**: Email to geral@cnpd.pt (if system unavailable)
- **Language**: Portuguese (official) or English (accepted)

**Required Information** (Article 33(3)):

1. **Nature of the Breach**:
   - Type: Confidentiality / Integrity / Availability
   - Categories of data concerned
   - Approximate number of data subjects
   - Approximate number of records

2. **DPO Contact** (or other contact point):
   - Name: [DPO Name]
   - Email: dpo@eleva.care
   - Phone: [DPO Phone]

3. **Likely Consequences**:
   - Description of potential risks to individuals
   - Severity assessment

4. **Measures Taken/Proposed**:
   - Containment actions
   - Remediation plan
   - Measures to mitigate adverse effects

**CNPD Notification Template** (Portuguese - official language):

```
===== NOTIFICAÇÃO DE VIOLAÇÃO DE DADOS PESSOAIS =====
(Artigo 33.º do RGPD)

1. IDENTIFICAÇÃO DO RESPONSÁVEL PELO TRATAMENTO
   - Nome: Búzios e Tartarugas, Lda.
   - Nome comercial: Eleva.care
   - NIF: PT515001708
   - Morada: Rua Gil Vicente, 2, 2775-198 Parede, Portugal
   - Email: support@eleva.care
   - Telefone: +351 931 897 950

2. IDENTIFICAÇÃO DO ENCARREGADO DE PROTEÇÃO DE DADOS
   - Nome: [Nome do DPO]
   - Email: dpo@eleva.care
   - Telefone: [Telefone do DPO]

3. DATA E HORA DA VIOLAÇÃO
   - Data da violação: [DD/MM/AAAA]
   - Hora (aproximada): [HH:MM]
   - Data de conhecimento da violação: [DD/MM/AAAA às HH:MM]

4. NATUREZA DA VIOLAÇÃO
   - Tipo: [ ] Confidencialidade [ ] Integridade [ ] Disponibilidade
   - Descrição do incidente: [Descrição detalhada de como ocorreu]

5. CATEGORIAS E NÚMERO DE TITULARES AFETADOS
   - Número aproximado de titulares: [Número]
   - Categorias de titulares:
     * [ ] Profissionais de saúde (especialistas)
     * [ ] Pacientes/Clientes
     * [ ] Funcionários
     * [ ] Outro: __________

6. CATEGORIAS E NÚMERO DE REGISTOS AFETADOS
   - Número aproximado de registos: [Número]
   - Categorias de dados:
     * [ ] Dados de identificação (nome, morada)
     * [ ] Dados de contacto (email, telefone)
     * [ ] Dados de saúde (especificar): __________
     * [ ] Dados de pagamento
     * [ ] Credenciais de acesso
     * [ ] Outro: __________

7. ESTADO DE ENCRIPTAÇÃO
   - Os dados estavam encriptados? [ ] Sim [ ] Não
   - Se sim, algoritmo: AES-256-GCM
   - As chaves de encriptação foram comprometidas? [ ] Sim [ ] Não

8. CONSEQUÊNCIAS PROVÁVEIS
   - Risco para os titulares: [ ] Baixo [ ] Médio [ ] Elevado
   - Descrição das consequências prováveis: [Explicação]

9. MEDIDAS DE CONTENÇÃO ADOTADAS
   - Medidas imediatas: [Listar ações tomadas]
   - Cronograma: [DD/MM/AAAA às HH:MM - ação realizada]

10. MEDIDAS PARA ATENUAR OS EFEITOS ADVERSOS
    - Medidas técnicas: [Exemplo: alteração de passwords, revogação de acessos]
    - Medidas organizacionais: [Exemplo: formação adicional]
    - Medidas de comunicação: [Notificação aos titulares - sim/não]

11. NOTIFICAÇÃO AOS TITULARES
    - Será efetuada notificação aos titulares? [ ] Sim [ ] Não
    - Se não, justificação (Art. 34.º, n.º 3): [Explicação]
    - Se sim, data prevista: [DD/MM/AAAA]

12. MEDIDAS CORRETIVAS E PREVENTIVAS
    - Correções implementadas: [Listar]
    - Medidas preventivas futuras: [Listar]
    - Responsável pela implementação: [Nome, Cargo]

13. INFORMAÇÕES ADICIONAIS
    - [Qualquer informação relevante adicional]

14. DECLARAÇÃO
    Declaro que as informações prestadas são verdadeiras e completas.

    Data: [DD/MM/AAAA]
    Nome: [Nome do Responsável]
    Cargo: Gerente / Diretor Geral
    Assinatura: _______________________

```

#### Step 3.2: Phased Notification (if information incomplete)

If **72-hour deadline approaching** and investigation incomplete:

**Phase 1 Notification** (within 72 hours):

- Basic facts known so far
- "Investigation ongoing, more information to follow"

**Phase 2 Notification** (as soon as available):

- Complete information
- Reference to initial notification

**CNPD accepts phased notifications** - it's better to notify on time with partial info than miss deadline.

---

### Phase 4: INDIVIDUAL NOTIFICATION (Without Undue Delay)

#### Step 4.1: Determine Affected Individuals (24-48 hours)

**Technical Task**: Extract list of affected data subjects from investigation

**Required Information**:

- Name
- Contact email (primary notification method)
- Phone (backup notification method)
- Specific data elements compromised for that individual

#### Step 4.2: Draft Individual Notification (48-60 hours)

**Required Content** (Article 34(2)):

1. **Nature of breach** (in clear and plain language)
2. **DPO contact** (name and contact details)
3. **Likely consequences** (what risk to them)
4. **Measures taken** (how breach was addressed)
5. **Measures recommended** (what they should do)

**Individual Notification Template** (Email):

```
Subject: Important Security Notice - Eleva.care Data Incident

Dear [Patient Name / Healthcare Professional Name],

We are writing to inform you of a security incident that may have affected your
personal information stored on the Eleva.care platform.

---

**WHAT HAPPENED**

On [Date], we discovered [brief description of breach]. We immediately took action
to secure our systems and investigate the incident.

**WHAT INFORMATION WAS INVOLVED**

The following types of your personal information may have been affected:
- [e.g., Name and email address]
- [e.g., Appointment scheduling information]
- [e.g., Medical records] (encrypted)
- [List specific data elements]

**WHAT WE ARE DOING**

We have taken the following steps:
- [e.g., Secured the vulnerability that caused this incident]
- [e.g., Reset your password as a precaution]
- [e.g., Enhanced our security monitoring]
- [e.g., Reported this incident to the Portuguese Data Protection Authority (CNPD)]

**WHAT WE RECOMMEND YOU DO**

For your protection, we recommend you:
1. Change your Eleva.care password immediately
2. Enable two-factor authentication on your account
3. Monitor your account for any unusual activity
4. Be cautious of phishing emails (we will never ask for your password via email)
5. [Any other specific recommendations based on breach type]

**YOUR RIGHTS**

You have the right to:
- Access your personal data
- Request correction or deletion
- Lodge a complaint with CNPD (www.cnpd.pt, geral@cnpd.pt)

**CONTACT US**

If you have any questions or concerns, please contact our Data Protection Officer:
- Email: dpo@eleva.care
- Phone: [DPO Phone]
- Address: Rua Gil Vicente, 2, 2775-198 Parede, Portugal

We sincerely apologize for this incident and any concern it may cause. The security
and privacy of your data is our highest priority.

Sincerely,

[Name]
[Title]
Búzios e Tartarugas, Lda. (Eleva.care)

---

This notification is required under the General Data Protection Regulation (GDPR).
```

#### Step 4.3: Send Individual Notifications (60-72 hours)

**Method**: Email (primary)

**Backup Methods** (if email unavailable):

- Postal mail (registered letter)
- Phone call (for small numbers)
- **Public communication** (if >1000 affected or disproportionate effort)

**Public Communication** (Article 34(3)(c)) - When required:

- Post on website homepage: https://eleva.care
- Email to all users (general notice)
- Press release (if media coverage likely)

**Documentation**: Keep records of:

- ✅ Who was notified (list of emails sent)
- ✅ When (timestamp)
- ✅ What was communicated (copy of message)
- ✅ Delivery confirmations (if available)

---

### Phase 5: REMEDIATION & PREVENTION (Ongoing)

#### Step 5.1: Root Cause Remediation (1-4 weeks)

**Technical Team Tasks**:

1. **Fix Vulnerability**:
   - Patch software
   - Fix misconfiguration
   - Enhance security controls
   - Update access controls

2. **Enhance Monitoring**:
   - Improve alert mechanisms
   - Add anomaly detection
   - Increase audit logging

3. **Testing**:
   - Penetration testing
   - Vulnerability assessment
   - Security audit

#### Step 5.2: Policy and Process Updates (2-4 weeks)

**DPO Tasks**:

1. **Update Policies** (if needed):
   - Security Policy
   - Access Control Policy
   - Data Retention Policy

2. **Training**:
   - Security awareness training for all employees
   - Specific training for affected teams
   - Phishing simulation exercises

3. **DPIA Update**:
   - Review and update DPIA with lessons learned
   - Re-assess risks

#### Step 5.3: Follow-up with CNPD (As required)

**If CNPD requests**:

- Provide additional information
- Attend meetings/hearings
- Submit compliance reports

**Potential CNPD Actions**:

- Request additional safeguards
- Impose corrective measures
- Issue warnings
- Impose administrative fines (if serious violations)

---

## 4. Breach Severity Classification

### Classification Criteria

| Level                   | Criteria                                                                   | Example                                        | CNPD               | Individuals           |
| ----------------------- | -------------------------------------------------------------------------- | ---------------------------------------------- | ------------------ | --------------------- |
| **LEVEL 1<br>CRITICAL** | - >1000 data subjects<br>- Unencrypted PHI exposed<br>- High risk of harm  | Database leak with unencrypted medical records | ✅ YES<br>(0-24h)  | ✅ YES<br>(0-48h)     |
| **LEVEL 2<br>HIGH**     | - 100-1000 data subjects<br>- Encrypted PHI accessed<br>- Medium-high risk | Unauthorized employee access to patient files  | ✅ YES<br>(0-48h)  | ⚠️ LIKELY<br>(48-72h) |
| **LEVEL 3<br>MEDIUM**   | - 10-100 data subjects<br>- Non-PHI or encrypted<br>- Medium risk          | Email list exposed                             | ✅ YES<br>(48-72h) | ⚠️ ASSESS             |
| **LEVEL 4<br>LOW**      | - <10 data subjects<br>- Encrypted, contained<br>- Low risk                | Single-email mis-sent (corrected)              | ⚠️ ASSESS          | ❌ NO (likely)        |

---

## 5. Communication Templates

### 5.1 Internal Alert Template

```
SUBJECT: **DATA BREACH ALERT - IMMEDIATE ACTION REQUIRED**

Classification: [CRITICAL / HIGH / MEDIUM / LOW]
Incident ID: [ID]
Detected: [Date/Time]

SITUATION:
[1-2 sentence description]

AFFECTED SYSTEMS:
[List]

IMMEDIATE ACTIONS REQUIRED:
1. [Action]
2. [Action]

INCIDENT RESPONSE TEAM ACTIVATED:
- Commander: [Name]
- DPO: [Name]
- Technical Lead: [Name]

NEXT MEETING: [Date/Time/Location]

DO NOT discuss this incident outside the response team until cleared by DPO.

[Incident Commander Name]
```

### 5.2 Third-Party Vendor Notification

```
To: [Vendor Security Team]
Subject: Security Incident Notification - Eleva.care

Dear [Vendor Name] Security Team,

We are writing to inform you of a security incident affecting our Eleva.care
platform that may involve systems or services provided by your organization.

Incident Summary:
- Date: [Date]
- Nature: [Description]
- Systems Potentially Affected: [List]

We are requesting:
1. Your assistance in investigating whether your systems were compromised
2. Relevant logs from [Date] to [Date]
3. Confirmation of security status of [specific service]

Our incident response team contact:
- Name: [Name]
- Email: [Email]
- Phone: [Phone]

We appreciate your urgent attention to this matter.

Best regards,
[Name]
Data Protection Officer
Búzios e Tartarugas, Lda. (Eleva.care)
```

---

## 6. Breach Log and Documentation

### 6.1 Breach Register (Article 33(5))

**Requirement**: Maintain documentation of **ALL** breaches (even those not notified to CNPD)

**Breach Register Template** (Spreadsheet or Database):

| Column                 | Description                                |
| ---------------------- | ------------------------------------------ |
| Incident ID            | Unique identifier (e.g., BR-2025-001)      |
| Date Occurred          | When breach happened                       |
| Date Detected          | When we became aware                       |
| Type                   | Confidentiality / Integrity / Availability |
| Cause                  | Root cause description                     |
| Data Subjects (Number) | Approximate number affected                |
| Data Categories        | Types of data involved                     |
| Encrypted?             | Yes / No                                   |
| Risk Level             | Low / Medium / High / Critical             |
| CNPD Notified?         | Yes / No + Date                            |
| Individuals Notified?  | Yes / No + Date                            |
| DPO Assessment         | Summary of assessment                      |
| Remediation            | Actions taken                              |
| Status                 | Open / Closed                              |
| Lessons Learned        | Improvements made                          |

**Retention**: **3 years minimum** (CNPD may request at any time)

### 6.2 Incident File Contents

For each breach, maintain file with:

- ✅ Initial detection report
- ✅ Investigation report
- ✅ Risk assessment
- ✅ CNPD notification (if sent)
- ✅ Individual notifications (samples + distribution list)
- ✅ CNPD correspondence
- ✅ Evidence (logs, screenshots)
- ✅ Remediation plan and proof of completion
- ✅ Lessons learned document

**Storage**: Secure, encrypted, access-controlled

---

## 7. Training and Awareness

### 7.1 Required Training

**All Employees**:

- Annual data protection awareness training
- How to recognize and report breaches
- Do's and don'ts during incident

**Incident Response Team**:

- Detailed breach response procedures (this document)
- Simulation exercises (twice per year)
- CNPD notification process training

**Developers/Technical Staff**:

- Secure coding practices
- Security incident detection
- Forensic evidence preservation

### 7.2 Simulation Exercises

**Frequency**: **Twice per year**

**Scenarios to Practice**:

1. Phishing attack compromising admin account
2. Database misconfiguration exposing data
3. Ransomware attack
4. Insider threat (employee snooping)
5. Third-party vendor breach

**Evaluation**:

- Response time
- Notification accuracy
- Team coordination
- Lessons learned

---

## 8. Quick Reference - 72-Hour Timeline

```
HOUR 0: BREACH DETECTED
↓
HOUR 0-2: IMMEDIATE CONTAINMENT
- Notify DPO + Technical Lead
- Activate incident response team
- Emergency meeting
- Stop ongoing breach
- Preserve evidence
↓
HOUR 2-24: INVESTIGATION
- Determine cause, scope, risk
- Complete investigation report
- DPO risk assessment
↓
HOUR 24-48: PREPARE CNPD NOTIFICATION
- Decide: CNPD notification required?
- Decide: Individual notification required?
- Draft CNPD notification (Portuguese)
- Identify affected individuals
↓
HOUR 48-72: SUBMIT CNPD NOTIFICATION
- Submit via CNPD website
- Confirm receipt
- Prepare individual notifications
↓
HOUR 72+: INDIVIDUAL NOTIFICATION + REMEDIATION
- Send individual notifications (if required)
- Implement fixes
- Monitor for CNPD follow-up
- Update breach register
- Lessons learned review
```

---

## 9. Contact Information

### CNPD (Comissão Nacional de Proteção de Dados)

- **Website**: https://www.cnpd.pt
- **Notification Portal**: https://www.cnpd.pt → "Notificação de violação"
- **Email**: geral@cnpd.pt
- **Phone**: +351 213 928 400
- **Address**: Av. D. Carlos I, 134 - 1º, 1200-651 Lisboa, Portugal
- **Hours**: Monday-Friday, 9:30-12:30 and 14:30-17:00

### Eleva.care Internal

- **DPO**: dpo@eleva.care, [Phone]
- **Technical Lead**: [Email], [Phone]
- **Managing Director**: [Email], [Phone]
- **24/7 Emergency**: [Phone]

---

## 10. Legal References

- **GDPR Article 33**: Notification of a personal data breach to the supervisory authority
- **GDPR Article 34**: Communication of a personal data breach to the data subject
- **GDPR Article 83**: General conditions for imposing administrative fines
- **Portuguese Data Protection Law**: Lei n.º 58/2019
- **WP29 Guidelines on Personal Data Breach Notification** (WP250rev.01)

---

**Document Status**: ACTIVE - Mandatory Compliance  
**Classification**: INTERNAL - All employees must be familiar  
**Review**: Annually or after each breach  
**Owner**: Data Protection Officer

**Version History**:
| Version | Date | Changes | Author |
|---------|------|---------|--------|
| 1.0 | [Date] | Initial version | [Name] |

---

## Appendix A: CNPD Breach Notification Form (Online)

**Access**: https://www.cnpd.pt → "Notificação de violação de dados pessoais"

**Required Fields**:

1. Controller identification (NIF, name, address)
2. DPO contact
3. Breach details (date, type, description)
4. Data subjects and categories
5. Data records and categories
6. Consequences
7. Measures taken
8. Individual notification (yes/no)

**Confirmation**: CNPD will send email confirmation with reference number

---

**END OF DOCUMENT**
