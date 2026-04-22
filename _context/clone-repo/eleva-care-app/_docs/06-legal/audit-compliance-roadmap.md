# Eleva Care Audit Logging Roadmap

## Current Status: Stage 1 - Startup Mode ✅

**Decision**: Keep current manual audit setup until growth triggers require upgrade.

---

## Current Setup (Active)

### What We Have Now

- ✅ Manual audit logging via `drizzle/auditSchema.ts`
- ✅ Application-level event tracking in `lib/logAuditEvent.ts`
- ✅ Basic Neon PostgreSQL tier
- ✅ Encryption at rest and in transit
- ✅ Clerk authentication with MFA
- ✅ GDPR basic compliance

### Coverage

- ✅ Application-level user actions
- ✅ Key business events (meetings, payments)
- ✅ User authentication events
- ⚠️ Does NOT capture: Direct SQL, DDL, or ROLE changes

### Compliance Status

- ✅ **GDPR**: Adequate for current EU operations
- ✅ **Portuguese Law**: Compliant with Lei n.º 58/2019
- ⚠️ **HIPAA**: Not applicable (no US clients yet)
- ⚠️ **Enterprise SOC 2**: Would need upgrade

### Cost

- Current: $0 extra (built into existing infrastructure)
- Monthly: ~$20 Neon basic tier

---

## Upgrade Triggers (When to Implement pgAudit)

### 🔴 Immediate Triggers (Upgrade Within 1 Week)

1. **First US Healthcare Client**
   - HIPAA compliance becomes mandatory
   - Need pgAudit for audit requirements
   - Action: Upgrade to Neon HIPAA tier + enable pgAudit

2. **Regulatory Audit Notice**
   - CNPD requests complete audit trail
   - Need to demonstrate comprehensive logging
   - Action: Enable full pgAudit immediately

3. **Data Breach or Security Incident**
   - Need complete forensics capability
   - Regulatory reporting requirements
   - Action: Enable pgAudit + SIEM immediately

### 🟡 Planning Triggers (Upgrade Within 1-3 Months)

4. **500+ Active Users**
   - Scale requires better audit infrastructure
   - Compliance complexity increases
   - Action: Plan pgAudit migration

5. **Enterprise Customer RFP**
   - SOC 2 Type II requirements
   - Customer security questionnaires
   - Action: Enable pgAudit before contract signing

6. **Series A Funding Round**
   - Investor due diligence requirements
   - Want to show robust compliance
   - Action: Plan pgAudit before fundraise

### 🟢 Optional Triggers (Evaluate Business Case)

7. **Revenue > €100K/year**
   - Cost becomes proportionally small
   - Business can afford compliance infrastructure
   - Action: Evaluate cost vs. benefit

8. **Expanding to Multiple EU Countries**
   - More regulatory complexity
   - Different data protection authorities
   - Action: Consider upgrade for consistency

---

## Upgrade Path (When Triggered)

### Phase 1: Minimal pgAudit (Week 1)

**For when you need it but want to start light**

```sql
-- Enable only DDL and ROLE auditing
pgaudit.log = 'ddl, role'
pgaudit.log_catalog = off
```

**Cost**: $0 extra (included in Neon HIPAA tier ~$100/month)
**Coverage**: Schema changes and permission changes only
**Good for**: Initial US clients, basic SOC 2

### Phase 2: Full pgAudit (Weeks 2-4)

**For enterprise customers or active audits**

```sql
-- Enable complete auditing
pgaudit.log = 'read, write, role, ddl'
pgaudit.log_relation = on
```

**Cost**: ~$50-100/month (SIEM storage)
**Coverage**: Complete database audit trail
**Good for**: HIPAA compliance, SOC 2 Type II, enterprise

### Phase 3: Full Production (Month 2+)

**For scale and enterprise requirements**

- SIEM integration (CloudWatch/Datadog)
- 6-year retention
- Real-time alerting
- Compliance reporting

**Cost**: ~$150/month total
**Coverage**: Enterprise-grade audit infrastructure

---

## Detailed Guides (Ready When You Need Them)

When upgrade triggers hit, refer to:

1. **[pgAudit Strategy](./audit-logging-strategy.md)** - Full architecture
2. **[Phase 1 Setup](./pgaudit-phase-1-setup.md)** - Implementation guide
3. **[Quick Start](./pgaudit-quick-start.md)** - Fast deployment
4. **[Visual Guide](./pgaudit-visual-guide.md)** - Diagrams and flows

**Current Status**: 📚 Archived for future use

---

## Monthly Compliance Checklist (Current Setup)

### Active Monitoring

- [ ] Review manual audit logs monthly
- [ ] Check for suspicious authentication patterns
- [ ] Verify encryption is working
- [ ] Update privacy policy if needed

### Documentation

- [ ] Keep BAAs with vendors current
- [ ] Document any compliance changes
- [ ] Track customer data requests (GDPR)

### Preparation

- [ ] Monitor customer growth (watch for 500 trigger)
- [ ] Track US customer inquiries
- [ ] Review enterprise RFPs for compliance requirements

---

## Cost Comparison by Stage

### Stage 1: Startup (Current - Recommended) ✅

```
Infrastructure:
├─ Neon Basic:              $20/month
├─ Manual audit:            $0 (built)
├─ Total:                   $20/month

Compliance Coverage:
├─ GDPR:                    ✅ Adequate
├─ EU Healthcare:           ✅ Basic
├─ HIPAA:                   ❌ N/A (no US clients)
├─ SOC 2:                   ⚠️ Partial

Risk Level:                 🟢 LOW (appropriate for stage)
```

### Stage 2: Growth (When Triggered)

```
Infrastructure:
├─ Neon HIPAA:              $100/month
├─ pgAudit:                 $0 (included)
├─ Minimal SIEM:            $0 (use Neon logs)
├─ Total:                   $100/month

Compliance Coverage:
├─ GDPR:                    ✅ Complete
├─ EU Healthcare:           ✅ Complete
├─ HIPAA:                   ✅ Basic
├─ SOC 2:                   ✅ Ready for Type I

Risk Level:                 🟡 MEDIUM (appropriate for growth)
```

### Stage 3: Scale (Future)

```
Infrastructure:
├─ Neon HIPAA:              $100/month
├─ pgAudit:                 $0 (included)
├─ SIEM + Retention:        $75/month
├─ Alerting:                $25/month
├─ Total:                   $200/month

Compliance Coverage:
├─ GDPR:                    ✅ Complete
├─ EU Healthcare:           ✅ Complete
├─ HIPAA:                   ✅ Complete
├─ SOC 2:                   ✅ Type II ready

Risk Level:                 🟢 LOW (enterprise-grade)
```

---

## Decision Framework

### Should I Upgrade Now?

```
Answer these questions:

1. Do you have ANY US clients?
   YES → Upgrade to Phase 1 (minimal pgAudit)
   NO → Continue

2. Are you in active SOC 2 audit?
   YES → Upgrade to Phase 2 (full pgAudit)
   NO → Continue

3. Do you have 500+ users?
   YES → Plan upgrade in next quarter
   NO → Continue

4. Is monthly revenue > €50K?
   YES → Consider upgrade (cost is <0.5% revenue)
   NO → Stay on current setup

5. Are investors doing due diligence?
   YES → Upgrade before closing round
   NO → Stay on current setup

IF ALL "NO" → Current setup is perfect ✅
```

---

## Contact for Upgrade Decision

When any trigger hits, contact:

- **Technical**: [DevOps Lead]
- **Compliance**: [Compliance Officer]
- **Business**: [CEO/Founder]

Timeline to upgrade: 1-2 weeks once triggered

---

## Summary

### Current Strategy ✅

**Keep current manual audit setup until growth requires upgrade.**

**Why this is smart:**

- You're early-stage, focused on product-market fit
- No US clients = no HIPAA pressure
- GDPR basic compliance is adequate for current EU operations
- Save ~$150/month for growth and marketing
- Can upgrade in 1-2 weeks when triggered

**When to revisit:**

- Every quarter during board/strategy meetings
- When first US client signs up
- When enterprise RFP arrives
- When hitting 500 active users

---

**Last Updated**: October 2, 2025  
**Next Review**: January 2026 (or when trigger hits)  
**Owner**: [Technical Lead]  
**Status**: ✅ Current setup adequate for stage
