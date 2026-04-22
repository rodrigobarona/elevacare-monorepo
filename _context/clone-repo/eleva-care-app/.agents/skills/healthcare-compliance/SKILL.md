---
name: healthcare-compliance
description: Healthcare regulatory compliance for medical practices and health IT companies. Use when working with patient data, health records, PHI handling, HIPAA compliance, privacy policies, security assessments, breach response, BAAs, or any healthcare data processing. Triggers on terms like "HIPAA", "PHI", "healthcare compliance", "patient privacy", "medical records security", "breach notification", "business associate agreement".
---

# Healthcare Compliance

Expert healthcare regulatory compliance system designed for medical practices, healthcare organizations, health IT companies, and healthcare professionals navigating complex privacy, security, and operational regulations.

**Critical Legal Disclaimer**: This skill provides educational information and compliance frameworks based on federal regulations (primarily HIPAA). It does NOT constitute legal advice. Always consult qualified healthcare attorneys and compliance professionals.

## HIPAA Overview

The Health Insurance Portability and Accountability Act has three main rules:

### 1. Privacy Rule
- Sets boundaries on uses and disclosures of PHI
- Establishes patient rights over their health information
- Protects all "individually identifiable health information"

### 2. Security Rule
- Risk assessment is foundational requirement
- Requires administrative, physical, and technical safeguards
- Establishes national standards for protecting electronic PHI (ePHI)

### 3. Breach Notification Rule
- Requires notification of breaches of unsecured PHI
- Specific timelines: 60 days for 500+ individuals
- Annual notification for fewer than 500

## PHI Identifiers (18 Types)

These make information PHI: Names, Addresses (more specific than state), Dates (except year), Phone numbers, Fax numbers, Email addresses, SSN, Medical record numbers, Health plan beneficiary numbers, Account numbers, Certificate/license numbers, Vehicle identifiers, Device identifiers, URLs, IP addresses, Biometric identifiers, Full-face photos, Any other unique identifier.

## Key Compliance Requirements

### Access Controls
- Unique user IDs for each person
- Role-based access (least privilege)
- Multi-factor authentication for remote access
- Automatic logoff after 15 minutes inactivity
- Immediate access termination upon departure

### Encryption
- Full-disk encryption on laptops and mobile devices
- Encrypt ePHI in transit (TLS 1.2+)
- Encrypt backups and archives
- Consider encryption for ePHI at rest on servers

### Audit Logging
- Log authentication, access, modifications, deletions
- Review logs regularly (at least quarterly)
- Retain logs for 6 years
- Enable logs on all systems with ePHI

### Business Associate Agreements (BAAs)
- Required for ALL vendors handling PHI
- Must include specific HIPAA-required provisions
- Track BAA expiration and renewal dates
- Monitor vendor compliance ongoing
- No BAA = HIPAA violation

## Breach Response Protocol

### What is a Breach?
Unauthorized acquisition, access, use, or disclosure of PHI that compromises security or privacy.

### Risk Assessment (4 factors):
1. Nature and extent of PHI involved
2. Unauthorized person who used/received PHI
3. Whether PHI was actually acquired or viewed
4. Extent to which risk has been mitigated

### Notification Requirements:
- **Individuals**: Without unreasonable delay, no later than 60 days
- **HHS**: Within 60 days for 500+ affected; annual for fewer
- **Media**: Required if 500+ in a state/jurisdiction
- **Documentation**: Maintain for 6 years

## Patient Rights Under HIPAA
- Right to access PHI (provide within 30 days)
- Right to amend (allow corrections)
- Right to accounting of disclosures
- Right to restrict uses/disclosures
- Right to confidential communications
- Right to copy of Notice of Privacy Practices

## Enforcement & Penalties

| Tier | Description | Per Violation | Annual Max |
|------|-------------|---------------|------------|
| 1 | Did not know | $100-$50,000 | $25,000 |
| 2 | Reasonable cause | $1,000-$50,000 | $100,000 |
| 3 | Willful neglect, corrected | $10,000-$50,000 | $250,000 |
| 4 | Willful neglect, not corrected | $50,000 min | $1.5M |

Criminal penalties up to $250,000 fine and 10 years prison for selling/misusing PHI.

## Security Rule Technical Safeguards

- **Access Control**: Unique user IDs, emergency access, encryption, automatic logoff
- **Audit Controls**: Log and monitor all ePHI system activity
- **Integrity**: Protect ePHI from improper alteration/destruction
- **Authentication**: Verify identity before granting access
- **Transmission Security**: Encrypt ePHI during transmission

## Best Practices

### Compliance Culture
- Document everything (if not written, you didn't do it)
- Annual risk assessments and policy reviews
- Report incidents promptly
- Encrypt by default
- Make privacy everyone's responsibility

### Data Handling
- Minimum necessary: share only what's needed
- No PHI in regular email or text without encryption
- Clean desk policy for paper PHI
- Secure disposal (shred paper, wipe devices)
- Verify identity before disclosing PHI

### Vendor Management
- Assess vendor security (don't just take their word)
- BAAs are mandatory for all business associates
- Monitor vendor compliance ongoing
- Have vendor breach provisions
- Plan for vendor changes

## Resources

- HHS Office for Civil Rights: hhs.gov/ocr/privacy
- NIST Cybersecurity Framework
- HITRUST security framework
- HHS Security Risk Assessment Tool
