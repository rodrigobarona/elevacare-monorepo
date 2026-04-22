# 📋 Data Protection Impact Assessment (DPIA)

**GDPR Article 35 Compliance Document**

---

## Document Control

| Field                | Details                                           |
| -------------------- | ------------------------------------------------- |
| **Company**          | Búzios e Tartarugas, Lda. (trading as Eleva.care) |
| **NIF**              | PT515001708                                       |
| **Address**          | Rua Gil Vicente, 2, 2775-198 Parede, Portugal     |
| **Document Version** | 1.0                                               |
| **Date Prepared**    | [Date]                                            |
| **Prepared By**      | [Name, Position]                                  |
| **Reviewed By**      | [Name, Position]                                  |
| **Approved By**      | [Name, Position]                                  |
| **Next Review Date** | [Date + 12 months]                                |
| **Status**           | DRAFT / FINAL                                     |

---

## Executive Summary

This Data Protection Impact Assessment (DPIA) has been conducted in accordance with **Article 35 of the GDPR** to assess the risks associated with Eleva.care's processing of **special categories of personal data** (health data) as defined in **Article 9 GDPR**.

**Conclusion**: [To be completed after assessment]

**Risk Level**: [ ] LOW [ ] MEDIUM [ ] HIGH

**Consultation with CNPD Required**: [ ] YES [ ] NO

---

## 1. Description of Processing Operations

### 1.1 Purpose of Processing

Eleva.care processes health data for the following purposes:

- **Primary Purpose**: Provision of digital healthcare platform connecting healthcare professionals with patients
- **Appointment Scheduling**: Management of medical appointments and consultations
- **Medical Records**: Secure storage and management of encrypted medical records
- **Payment Processing**: Processing payments for healthcare services rendered
- **Communication**: Facilitating communication between healthcare providers and patients
- **Analytics**: Anonymized analytics to improve platform performance (no PHI)

**Legal Basis** (Article 6 & 9 GDPR):

- ✅ **Article 6(1)(a)**: Consent of the data subject
- ✅ **Article 9(2)(a)**: Explicit consent for processing special category data (health data)
- ✅ **Article 9(2)(h)**: Medical diagnosis, provision of health care (for healthcare professionals)

### 1.2 Scope of Processing

**Data Controller**: Búzios e Tartarugas, Lda. (Eleva.care)

**Categories of Data Subjects**:

1. **Healthcare Professionals** (Experts)
   - Pelvic health specialists
   - Pregnancy and postpartum care providers
   - Women's health consultants
   - Physical therapists
   - Other registered healthcare providers

2. **Patients/Clients**
   - Individuals seeking women's healthcare services
   - Pregnant and postpartum women
   - Patients requiring pelvic health treatment
   - General wellness clients

3. **Administrative Staff**
   - Eleva.care employees
   - Support personnel

**Geographic Scope**:

- **Primary**: Portugal and European Union
- **Future Expansion**: Potential US market (HIPAA-ready infrastructure in place)

**Volume of Data Subjects**:

- **Current**: [Number] healthcare professionals, [Number] patients
- **Projected (12 months)**: [Number] professionals, [Number] patients

**Duration**: Ongoing processing throughout platform operation

### 1.3 Categories of Personal Data

#### Standard Personal Data (Article 6 GDPR):

- **Identity Data**: Name, date of birth, gender
- **Contact Data**: Email address, phone number, postal address
- **Account Data**: Username, hashed password, account preferences
- **Professional Data** (healthcare providers): Credentials, specialties, license numbers
- **Payment Data**: Payment methods, billing addresses, transaction history
- **Technical Data**: IP addresses, device information, cookies
- **Communication Data**: Messages, emails, chat logs

#### Special Categories of Personal Data (Article 9 GDPR):

- **Health Data**:
  - Appointment types and scheduling information
  - Medical notes and records (encrypted)
  - Diagnoses and treatment information (encrypted)
  - Healthcare service provision records
  - Pregnancy and postpartum health information
  - Pelvic health information
  - Medical history (when provided)

**Encryption Status**: ALL health data encrypted at rest using AES-256-GCM

### 1.4 Data Flow

```
┌─────────────────────────────────────────────────────────────┐
│                     DATA COLLECTION                          │
└─────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────┐
│  User Registration (Clerk - EU Region)                       │
│  - Identity verification                                     │
│  - Role assignment (Expert/Client)                           │
└─────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────┐
│  Data Storage (Neon.tech - Frankfurt, Germany)               │
│  - PostgreSQL with Drizzle ORM                               │
│  - HIPAA-compliant infrastructure                            │
│  - Row-level security ready                                  │
│  - Encrypted backups                                         │
└─────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────┐
│  Application Layer (Vercel - EU Region)                      │
│  - Next.js 15.3 application                                  │
│  - Server-side rendering                                     │
│  - API endpoints with authentication                         │
└─────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────┐
│  Supporting Services (All EU-Hosted)                         │
│  - Cache: Upstash Redis (EU)                                 │
│  - Queue: QStash (EU)                                        │
│  - Email: Resend (Ireland)                                   │
│  - Notifications: Novu (eu.api.novu.co)                      │
│  - Analytics: PostHog (EU option)                            │
│  - Payments: Stripe (EU processing)                          │
└─────────────────────────────────────────────────────────────┘
```

**Data Processors** (Article 28 GDPR):
| Processor | Service | Location | DPA Status | EU Hosting |
|-----------|---------|----------|------------|------------|
| Neon Inc. | Database | Frankfurt, DE | ✅ Executed + HIPAA BAA | ✅ Yes |
| Vercel Inc. | Hosting | EU Regions | ✅ Executed | ✅ Yes |
| Clerk Inc. | Authentication | EU Regions | ✅ Executed | ✅ Yes |
| Stripe Inc. | Payments | EU Processing | ✅ Executed | ✅ Yes |
| Upstash Inc. | Cache/Queue | EU Regions | ✅ Executed | ✅ Yes |
| Resend Inc. | Email | Ireland | ✅ Executed | ✅ Yes |
| PostHog Inc. | Analytics | EU Option | ✅ Executed | ✅ Yes |
| Novu Inc. | Notifications | EU API | ✅ Executed | ✅ Yes |

**No international data transfers outside the EU** occur during normal operations.

---

## 2. Necessity and Proportionality Assessment

### 2.1 Necessity Test

| Processing Activity          | Necessary?  | Justification                                                                                                  |
| ---------------------------- | ----------- | -------------------------------------------------------------------------------------------------------------- |
| **Health data collection**   | ✅ YES      | Essential for provision of healthcare services; cannot provide medical consultation without health information |
| **Medical records storage**  | ✅ YES      | Legal requirement for healthcare providers; necessary for continuity of care                                   |
| **Appointment scheduling**   | ✅ YES      | Core platform functionality; necessary to connect providers and patients                                       |
| **Payment processing**       | ✅ YES      | Essential for business operation and provider compensation                                                     |
| **Email communications**     | ✅ YES      | Necessary for appointment confirmations, reminders, and service delivery                                       |
| **Analytics (anonymized)**   | ✅ YES      | Legitimate interest in platform improvement; no PHI used                                                       |
| **Marketing communications** | ⚠️ OPTIONAL | Only with explicit opt-in consent; not necessary for service delivery                                          |

### 2.2 Proportionality Test

**Principle**: Only collect minimum data necessary for stated purposes.

**Data Minimization Measures**:

- ✅ Only health data directly relevant to consultation is collected
- ✅ No collection of unnecessary demographic data
- ✅ Medical records encrypted at application level before database storage
- ✅ Analytics use aggregated, anonymized data (no PHI)
- ✅ Automatic deletion of expired reservations and temporary data

**Access Controls**:

- ✅ Role-based access control (RBAC) implemented
- ✅ Experts can only access their own patient records
- ✅ Patients can only access their own data
- ✅ Administrators have limited access, logged via audit trail

**Retention Periods**:

- **Health Records**: 10 years (Portuguese healthcare record retention requirement)
- **Payment Data**: 7 years (tax and accounting requirements)
- **Account Data**: Duration of account + 30 days for legal obligations
- **Audit Logs**: 6 years (compliance and security requirements)
- **Analytics Data**: Anonymized, indefinite retention for platform improvement

---

## 3. Risk Assessment

### 3.1 Identified Risks to Data Subjects

#### Risk 1: Unauthorized Access to Health Data

**Description**: Unauthorized individuals gaining access to encrypted medical records

| Aspect           | Rating     | Explanation                                                                                                     |
| ---------------- | ---------- | --------------------------------------------------------------------------------------------------------------- |
| **Likelihood**   | LOW        | - Strong authentication (Clerk)<br>- RBAC implemented<br>- AES-256-GCM encryption<br>- All data EU-hosted       |
| **Severity**     | HIGH       | - Health data is highly sensitive<br>- GDPR Article 9 special category<br>- Potential discrimination if exposed |
| **Overall Risk** | **MEDIUM** | Low likelihood × High severity = MEDIUM                                                                         |

**Mitigation Measures**:

- ✅ Multi-factor authentication available
- ✅ Session timeout after inactivity
- ✅ Encrypted at rest (AES-256-GCM) and in transit (TLS 1.3)
- ✅ Row-level security ready for implementation
- ✅ Regular security audits
- ⚠️ **Recommendation**: Implement mandatory 2FA for healthcare providers

**Residual Risk After Mitigation**: **LOW**

#### Risk 2: Data Breach During Transmission

**Description**: Interception of health data during API communications

| Aspect           | Rating   | Explanation                                                         |
| ---------------- | -------- | ------------------------------------------------------------------- |
| **Likelihood**   | VERY LOW | - TLS 1.3 encryption<br>- HTTPS everywhere<br>- Certificate pinning |
| **Severity**     | HIGH     | - Could expose PHI<br>- GDPR breach notification required           |
| **Overall Risk** | **LOW**  | Very low likelihood × High severity = LOW                           |

**Mitigation Measures**:

- ✅ TLS 1.3 enforced for all connections
- ✅ HSTS headers implemented
- ✅ Content Security Policy (CSP) configured
- ✅ No sensitive data in URL parameters
- ✅ API authentication required for all endpoints

**Residual Risk After Mitigation**: **VERY LOW**

#### Risk 3: Insider Threat - Employee Access

**Description**: Eleva.care employees accessing patient health data inappropriately

| Aspect           | Rating     | Explanation                                                   |
| ---------------- | ---------- | ------------------------------------------------------------- |
| **Likelihood**   | LOW        | - Limited admin access<br>- Audit logging<br>- Small team     |
| **Severity**     | HIGH       | - Breach of professional confidence<br>- Regulatory violation |
| **Overall Risk** | **MEDIUM** | Low likelihood × High severity = MEDIUM                       |

**Mitigation Measures**:

- ✅ Comprehensive audit logging (Neon pgAudit)
- ✅ Principle of least privilege
- ✅ Confidentiality agreements with employees
- ⚠️ **Recommendation**: Implement regular access reviews
- ⚠️ **Recommendation**: Designated Data Protection Officer training
- ⚠️ **Recommendation**: Mandatory security awareness training

**Residual Risk After Mitigation**: **LOW**

#### Risk 4: Third-Party Processor Breach

**Description**: Data breach at processor level (Neon, Vercel, etc.)

| Aspect           | Rating     | Explanation                                                            |
| ---------------- | ---------- | ---------------------------------------------------------------------- |
| **Likelihood**   | LOW        | - Enterprise-grade processors<br>- SOC 2 certified<br>- Regular audits |
| **Severity**     | HIGH       | - Controller remains liable<br>- Large-scale exposure potential        |
| **Overall Risk** | **MEDIUM** | Low likelihood × High severity = MEDIUM                                |

**Mitigation Measures**:

- ✅ All processors have executed DPAs
- ✅ Neon has HIPAA BAA (highest healthcare standard)
- ✅ Regular processor security assessments
- ✅ EU-only data residency
- ✅ Processor incident notification obligations in DPAs
- ⚠️ **Recommendation**: Annual processor audit rights exercise

**Residual Risk After Mitigation**: **LOW**

#### Risk 5: Insufficient Data Deletion

**Description**: Personal data retained longer than necessary or not properly deleted

| Aspect           | Rating     | Explanation                                                   |
| ---------------- | ---------- | ------------------------------------------------------------- |
| **Likelihood**   | MEDIUM     | - Manual deletion processes<br>- Complex data relationships   |
| **Severity**     | MEDIUM     | - GDPR Article 5(e) violation<br>- Unnecessary data retention |
| **Overall Risk** | **MEDIUM** | Medium likelihood × Medium severity = MEDIUM                  |

**Mitigation Measures**:

- ✅ Documented retention policy
- ⚠️ **Required**: Automated deletion procedures
- ⚠️ **Required**: Regular data retention audits
- ⚠️ **Required**: Right to erasure workflow documented

**Residual Risk After Mitigation**: **LOW** (after implementing recommendations)

### 3.2 Risk Summary Matrix

| Risk                       | Initial Risk | Mitigations | Residual Risk | Action Required   |
| -------------------------- | ------------ | ----------- | ------------- | ----------------- |
| Unauthorized Access        | MEDIUM       | Strong      | LOW           | Implement 2FA     |
| Data Breach (Transmission) | LOW          | Excellent   | VERY LOW      | None - monitor    |
| Insider Threat             | MEDIUM       | Good        | LOW           | Training + DPO    |
| Processor Breach           | MEDIUM       | Good        | LOW           | Annual audits     |
| Insufficient Deletion      | MEDIUM       | Partial     | LOW           | Automate deletion |

**Overall Residual Risk Level**: **LOW** (after implementing recommendations)

**Consultation with CNPD Required**: **NO** (residual risk is low after mitigation)

---

## 4. Consultation and Sign-Off

### 4.1 Internal Consultation

| Stakeholder | Role                  | Date Consulted | Comments   |
| ----------- | --------------------- | -------------- | ---------- |
| [Name]      | DPO / Privacy Officer | [Date]         | [Comments] |
| [Name]      | Technical Lead        | [Date]         | [Comments] |
| [Name]      | Legal Counsel         | [Date]         | [Comments] |
| [Name]      | Healthcare Compliance | [Date]         | [Comments] |

### 4.2 Data Subject Consultation

**Method**: [Privacy Policy review, user feedback, patient advisory board]  
**Date**: [Date]  
**Summary**: [Summary of feedback and how addressed]

### 4.3 CNPD Consultation

**Required**: NO (low residual risk after mitigation)

If consultation becomes required:

- **Contact**: geral@cnpd.pt
- **Timeline**: Minimum 8 weeks before processing begins
- **Documentation to Submit**: This DPIA + supporting documentation

---

## 5. Action Plan

### 5.1 Immediate Actions (0-30 days)

| Action                                           | Responsible | Deadline | Status     |
| ------------------------------------------------ | ----------- | -------- | ---------- |
| Implement mandatory 2FA for healthcare providers | Tech Lead   | [Date]   | ⚠️ PENDING |
| Document data deletion procedures                | DPO         | [Date]   | ⚠️ PENDING |
| Conduct security awareness training              | HR + DPO    | [Date]   | ⚠️ PENDING |
| Designate Data Protection Officer                | Management  | [Date]   | ⚠️ PENDING |

### 5.2 Short-term Actions (30-90 days)

| Action                                 | Responsible | Deadline | Status     |
| -------------------------------------- | ----------- | -------- | ---------- |
| Implement automated data deletion      | Tech Lead   | [Date]   | ⚠️ PENDING |
| Conduct first processor security audit | DPO         | [Date]   | ⚠️ PENDING |
| Implement regular access reviews       | IT Security | [Date]   | ⚠️ PENDING |
| Create incident response plan          | DPO + Legal | [Date]   | ⚠️ PENDING |

### 5.3 Ongoing Actions

| Action                 | Frequency | Responsible |
| ---------------------- | --------- | ----------- |
| DPIA Review and Update | Annually  | DPO         |
| Security Audits        | Quarterly | IT Security |
| Employee Training      | Annually  | HR + DPO    |
| Processor Assessments  | Annually  | DPO         |
| Access Rights Review   | Quarterly | IT Security |

---

## 6. Approval and Sign-Off

### 6.1 DPIA Approval

**Prepared By**:

- Name: [Name]
- Position: [Position]
- Date: [Date]
- Signature: \***\*\*\*\*\***\_\_\_\***\*\*\*\*\***

**Reviewed By (DPO)**:

- Name: [Name]
- Position: Data Protection Officer
- Date: [Date]
- Signature: \***\*\*\*\*\***\_\_\_\***\*\*\*\*\***

**Approved By**:

- Name: [Name]
- Position: Managing Director
- Date: [Date]
- Signature: \***\*\*\*\*\***\_\_\_\***\*\*\*\*\***

### 6.2 Review Cycle

**Next Review Date**: [Date + 12 months]

**Trigger Events for Interim Review**:

- Significant changes to processing operations
- New categories of data subjects
- Introduction of new technologies
- Data breach incident
- Regulatory changes
- CNPD guidance or enforcement action

---

## 7. Supporting Documentation

**Attached Documents**:

1. Data Processing Agreement (DPA) with all processors
2. Privacy Policy (current version)
3. Security Policy and Procedures
4. Data Retention Policy
5. Employee Confidentiality Agreements
6. Technical Architecture Diagram
7. Encryption Implementation Documentation
8. Audit Logging Configuration

**Referenced Legal Basis**:

- GDPR Articles 5, 6, 9, 25, 30, 32, 35
- Portuguese Data Protection Law (Lei n.º 58/2019)
- Portuguese Healthcare Records Retention Regulations

---

**Document Classification**: CONFIDENTIAL  
**Retention Period**: 3 years after processing ceases  
**Access**: DPO, Legal, Management, CNPD (upon request)

---

## 8. Glossary

- **DPIA**: Data Protection Impact Assessment
- **GDPR**: General Data Protection Regulation (EU) 2016/679
- **PHI**: Protected Health Information
- **CNPD**: Comissão Nacional de Proteção de Dados (Portuguese Data Protection Authority)
- **DPO**: Data Protection Officer
- **DPA**: Data Processing Agreement
- **RBAC**: Role-Based Access Control
- **AES-256-GCM**: Advanced Encryption Standard (256-bit key, Galois/Counter Mode)
- **TLS**: Transport Layer Security
- **2FA**: Two-Factor Authentication

---

_This DPIA template must be completed and reviewed before commencing or significantly modifying health data processing operations._
