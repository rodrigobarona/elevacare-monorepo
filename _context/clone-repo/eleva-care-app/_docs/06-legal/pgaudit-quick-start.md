# pgAudit Quick Start Checklist

## 🚀 Phase 1: Initial Setup (This Week)

### Day 1: Request pgAudit Configuration

- [ ] Get your Neon Project ID from [console.neon.tech](https://console.neon.tech)
- [ ] Send configuration request to Neon support (see template below)
- [ ] Wait for confirmation (typically 24-48 hours)

### Day 2-3: Verify and Configure

- [ ] Connect to database and verify pgAudit settings
- [ ] Run test queries to confirm audit logging works
- [ ] Review PHI tables list (see Phase 1 guide)
- [ ] Choose Session-Level vs Object-Level auditing strategy

### Day 4-5: Set Up Log Export

- [ ] Choose SIEM platform (CloudWatch/Datadog/ELK/Splunk)
- [ ] Configure log export from Neon
- [ ] Set 6-year retention policy
- [ ] Test log export pipeline

### Week 1-2: Configure Alerts

- [ ] Set up critical alerts (ROLE changes, DDL on PHI tables)
- [ ] Set up warning alerts (bulk operations, off-hours access)
- [ ] Test alert delivery
- [ ] Document alert response procedures

### Week 2-4: Burn-in Period

- [ ] Monitor log volume daily
- [ ] Track performance impact
- [ ] Verify coverage (all PHI access logged)
- [ ] Sample audit logs for quality

### End of Week 4: Evaluation

- [ ] Review burn-in metrics
- [ ] Decide if optimization needed
- [ ] Plan Phase 2 (application correlation)
- [ ] Update compliance documentation

---

## 📧 Email Template for Neon Support

**To**: support@neon.tech  
**Subject**: Enable and Configure pgAudit for HIPAA-Compliant Project

````
Hello Neon Support Team,

I need to enable and configure pgAudit for our HIPAA-compliant project:

**Project Details:**
- Project ID: [GET FROM: https://console.neon.tech > Project Settings > General]
- Project Name: eleva-care-app
- Organization: Eleva Care
- Environment: Production
- Region: [Your region, e.g., aws-us-east-2]

**Configuration Request:**

Please configure the following pgAudit settings for our HIPAA compliance requirements:

```sql
-- Session Audit Configuration
pgaudit.log = 'read, write, role, ddl'
pgaudit.log_relation = on
pgaudit.log_parameter = off
pgaudit.log_statement_once = on
pgaudit.log_catalog = off

-- Log Prefix for Correlation
log_line_prefix = '%m [%p] %q%u@%d [%a] '
````

**Rationale:**

- `read, write, role, ddl`: Captures all database operations affecting PHI
- `log_relation = on`: Logs each table affected for granular tracking
- `log_parameter = off`: Prevents logging sensitive data in query parameters
- `log_statement_once = on`: Reduces log volume while maintaining audit trail
- `log_catalog = off`: Excludes system catalog queries to reduce noise
- `log_line_prefix`: Includes application_name for correlation with app logs

**HIPAA Compliance:**
Our Neon organization already has HIPAA support enabled. This pgAudit configuration is required to meet HIPAA audit trail requirements (§164.312(b)).

**Timeline:**
We plan to begin our 2-week validation period as soon as pgAudit is enabled.

**Next Steps:**
After pgAudit is configured, we will:

1. Verify settings via SQL queries
2. Test audit log generation
3. Configure log export to our SIEM
4. Set up retention and alerting

Please confirm when pgAudit is enabled and configured.

Thank you for your support!

Best regards,
[Your Name]
[Your Role]
Eleva Care

````

---

## 🔍 Quick Verification Commands

### After Neon Enables pgAudit

```bash
# 1. Connect to your database
psql "$DATABASE_URL"
````

```sql
-- 2. Check pgAudit is installed
SELECT * FROM pg_extension WHERE extname = 'pgaudit';

-- 3. Verify configuration
SHOW pgaudit.log;
SHOW pgaudit.log_relation;
SHOW pgaudit.log_parameter;
SHOW pgaudit.log_statement_once;
SHOW pgaudit.log_catalog;
SHOW log_line_prefix;

-- 4. Run test queries
CREATE TABLE audit_test (id SERIAL, data TEXT);
INSERT INTO audit_test (data) VALUES ('test');
SELECT * FROM audit_test;
DROP TABLE audit_test;

-- ✅ Expected: Audit log entries in Neon logs
```

---

## 📊 PHI Tables Priority List

### 🔴 High Priority (Immediate Audit Required)

1. **`records`** - Medical records (encrypted PHI)
2. **`meetings`** - Appointment details, guest notes
3. **`users`** - Personal information, email addresses
4. **`profiles`** - Practitioner profiles, personal data

### 🟡 Medium Priority (Financial PHI)

5. **`payment_transfers`** - Payment information
6. **`slot_reservations`** - Booking data with email
7. **`events`** - Service definitions

### 🟢 Low Priority (Configuration)

8. `schedules` - Availability (no patient data)
9. `scheduling_settings` - System config
10. `categories` - Service categories

---

## ⚙️ SIEM Configuration Quick Guide

### Option 1: AWS CloudWatch

```bash
# Request from Neon Support
# Email subject: "Configure CloudWatch Log Export for Project [PROJECT_ID]"
```

**Configuration**:

- Log Group: `/aws/neon/eleva-care/audit-logs`
- Retention: **2557 days** (7 years)
- Encryption: AES-256
- Access: Restricted to DevOps + Compliance team

### Option 2: Datadog

1. Go to: [Neon Console](https://console.neon.tech) > **Integrations** > **Datadog**
2. Enter Datadog API key
3. Configure log pipeline: `source:neon status:info service:postgres`
4. Set retention: **7 years**
5. Create monitor for AUDIT entries

### Option 3: Custom (ELK/Splunk)

Request webhook from Neon:

- Endpoint: `https://logs.eleva.care/api/ingest/neon-audit`
- Auth: `Bearer [TOKEN]`
- Filter: AUDIT prefix only

---

## 🚨 Critical Alerts to Configure

### Immediate (PagerDuty/Opsgenie)

```
1. ROLE operations (permission changes)
   Filter: AUDIT.*ROLE

2. DROP/TRUNCATE on PHI tables
   Filter: AUDIT.*(DROP|TRUNCATE).*(records|meetings|users|profiles)

3. Permission denied on PHI access
   Filter: ERROR.*permission denied.*(records|meetings|users|profiles)
```

### Daily Review (Email/Slack)

```
4. Bulk DELETE (>100 rows)
   Filter: AUDIT.*DELETE.*rows

5. Weekend/off-hours PHI access
   Filter: AUDIT.*READ.*(records|meetings) AND (Saturday|Sunday|00-06:00)

6. Multiple failed authentication attempts
   Filter: ERROR.*authentication failed
```

---

## 📈 Success Metrics (2-Week Burn-in)

### Week 1

- [ ] **100% audit coverage** - All PHI access logged
- [ ] **< 5% performance impact** - Query latency increase acceptable
- [ ] **< 10GB/day log volume** - Storage growth manageable
- [ ] **0 missing audit entries** - Compare with app logs

### Week 2

- [ ] **All alerts tested** - Critical alerts fire correctly
- [ ] **SIEM integration stable** - Logs flowing consistently
- [ ] **Team trained** - Compliance/DevOps can access and interpret logs
- [ ] **Documentation complete** - Audit procedures documented

---

## ❓ Common Issues & Quick Fixes

### Issue: "unrecognized configuration parameter: pgaudit.log"

**Fix**: pgAudit not yet enabled. Follow up with Neon support.

### Issue: High log volume (>10GB/day)

**Fix**:

1. Confirm `pgaudit.log_catalog = off`
2. Confirm `pgaudit.log_statement_once = on`
3. Consider object-level auditing (Phase 2)

### Issue: Logs not appearing in SIEM

**Check**:

1. Log export configured in Neon Console?
2. SIEM endpoint accessible?
3. Authentication valid?
4. Correct filter (look for "AUDIT:" prefix)?

### Issue: Too many false-positive alerts

**Fix**:

1. Refine alert filters
2. Add time-of-day rules
3. Whitelist known service accounts
4. Adjust thresholds

---

## 🔗 Quick Links

- **Neon Console**: https://console.neon.tech
- **Neon HIPAA Docs**: https://neon.tech/docs/security/hipaa
- **pgAudit GitHub**: https://github.com/pgaudit/pgaudit
- **Full Phase 1 Guide**: `./pgaudit-phase-1-setup.md`
- **Schema Documentation**: `../drizzle/schema.ts`

---

## 📞 Support Contacts

| Issue Type           | Contact              | Response Time |
| -------------------- | -------------------- | ------------- |
| Neon Configuration   | support@neon.tech    | 24-48 hours   |
| Eleva Tech Issues    | [Your Team]          | Immediate     |
| Compliance Questions | [Compliance Officer] | Same day      |
| HIPAA Incidents      | [Security Team]      | Immediate     |

---

**Last Updated**: {{ date }}  
**Owner**: [Your Name]  
**Review Frequency**: Monthly during Phase 1, Quarterly after Phase 2
