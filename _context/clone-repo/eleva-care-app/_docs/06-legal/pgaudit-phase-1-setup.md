# Phase 1: pgAudit Setup for Neon HIPAA Compliance

## Overview

This guide covers **Phase 1** of implementing pgAudit for HIPAA-compliant database auditing in your Neon project. pgAudit provides PostgreSQL-level audit logging that captures all database access and modifications, which is required for HIPAA compliance.

## Current Status

✅ **HIPAA Support Enabled** at organization level in Neon dashboard  
⏳ **pgAudit Configuration** - needs to be requested from Neon support  
⏳ **Log Export Setup** - needs SIEM/log aggregation configuration  
⏳ **Application Correlation** - needs `application_name` integration

---

## Step 1: Request pgAudit Configuration from Neon Support

### 1.1 Contact Neon Support

**Contact Method**: Open a support ticket via [Neon Console](https://console.neon.tech/) or email support@neon.tech

**Subject**: "Enable and Configure pgAudit for HIPAA-Compliant Project"

**Message Template**:

```
Hello Neon Support Team,

I need to enable and configure pgAudit for our HIPAA-compliant project:

Project ID: [YOUR_PROJECT_ID]
Organization: Eleva Care
Environment: Production

Please configure the following pgAudit settings:

# Session Audit Configuration
pgaudit.log = 'read, write, role, ddl'
pgaudit.log_relation = on
pgaudit.log_parameter = off
pgaudit.log_statement_once = on
pgaudit.log_catalog = off

# Log Prefix for Correlation
log_line_prefix = '%m [%p] %q%u@%d [%a] '

These settings will:
- Audit all READ, WRITE, ROLE, and DDL operations
- Log each relation (table) affected in SELECT/DML statements
- Exclude parameter values to avoid logging sensitive data
- Reduce log verbosity while maintaining audit trail
- Exclude catalog queries to reduce noise
- Include application_name in log prefix for correlation

Please confirm when pgAudit is enabled and configured.

Thank you!
```

### 1.2 Verify Project ID

Get your Neon project ID:

```bash
# Via Neon CLI
neon projects list

# Via Neon Dashboard
# Navigate to: Project Settings > General > Project ID
```

### 1.3 Timeline Expectations

- **Response Time**: Typically 24-48 hours
- **Implementation**: Usually same day after approval
- **Verification**: Immediate (see Step 2)

---

## Step 2: Verify pgAudit is Enabled

Once Neon confirms pgAudit is configured, verify it's working:

### 2.1 Connect to Your Neon Database

```bash
# Using psql with your Neon connection string
psql "$DATABASE_URL"
```

### 2.2 Check pgAudit Settings

```sql
-- Verify pgAudit extension is loaded
SELECT * FROM pg_extension WHERE extname = 'pgaudit';

-- Check pgAudit configuration
SHOW pgaudit.log;
SHOW pgaudit.log_relation;
SHOW pgaudit.log_parameter;
SHOW pgaudit.log_statement_once;
SHOW pgaudit.log_catalog;

-- Check log prefix
SHOW log_line_prefix;
```

**Expected Output**:

```
pgaudit.log = 'read, write, role, ddl'
pgaudit.log_relation = on
pgaudit.log_parameter = off
pgaudit.log_statement_once = on
pgaudit.log_catalog = off
log_line_prefix = '%m [%p] %q%u@%d [%a] '
```

### 2.3 Test Audit Logging

Run a simple test query to generate an audit log entry:

```sql
-- Create a test table (DDL)
CREATE TABLE audit_test (
  id SERIAL PRIMARY KEY,
  test_data TEXT
);

-- Insert data (WRITE)
INSERT INTO audit_test (test_data) VALUES ('test');

-- Read data (READ)
SELECT * FROM audit_test;

-- Drop table (DDL)
DROP TABLE audit_test;
```

These operations should generate audit log entries in your Neon project logs.

---

## Step 3: Identify PHI Tables for Object-Level Auditing

### 3.1 PHI Tables in Eleva Care Schema

Based on your current schema, these tables contain **Protected Health Information (PHI)**:

#### **High-Priority PHI Tables** (Direct patient/health data):

1. **`profiles`** - Contains practitioner and potentially patient personal information
   - Fields: `firstName`, `lastName`, `profilePicture`, `socialLinks`
2. **`meetings`** - Contains appointment details and health-related notes
   - Fields: `guestEmail`, `guestName`, `guestNotes`, `meetingUrl`
3. **`records`** - **HIGHEST PRIORITY** - Contains encrypted medical records
   - Fields: `encryptedContent`, `encryptedMetadata`, `guestEmail`
4. **`users`** - Contains user authentication and personal details
   - Fields: `email`, `firstName`, `lastName`, `imageUrl`

#### **Secondary PHI Tables** (Financial/booking data related to health services):

5. **`events`** - Event/service definitions (contains service names)
6. **`payment_transfers`** - Payment information linked to health services
7. **`slot_reservations`** - Appointment booking data

#### **Non-PHI Tables** (Configuration/system data):

- `schedules`, `schedule_availabilities` - Practitioner availability (no patient data)
- `scheduling_settings` - System configuration
- `blocked_dates` - Calendar blocks
- `categories` - Service categories

### 3.2 Audit Logging Strategy Decision

**Option A: Session-Level Auditing (Recommended for Phase 1)**

✅ **Pros**:

- Captures all PHI access automatically
- No need to manage grants per table
- Simpler initial setup
- Complete audit trail

❌ **Cons**:

- Higher log volume
- May need volume optimization later

**Option B: Object-Level Auditing (For High-Volume Phase 2)**

✅ **Pros**:

- Reduced log volume
- Focused on specific tables
- Better performance in high-traffic scenarios

❌ **Cons**:

- Requires manual grant management
- More complex setup
- Need to add new tables explicitly

**Recommendation**: Start with **Session-Level Auditing (Option A)** for Phase 1. After 2 weeks of monitoring, evaluate log volume and performance, then optionally move to Object-Level for high-traffic tables.

---

## Step 4: Configure Log Export to SIEM

### 4.1 Why Log Export is Required

HIPAA requires:

- **6+ years retention** for audit logs
- **Tamper-proof storage** (immutable logs)
- **Centralized monitoring** and alerting
- **Incident investigation** capabilities

Neon stores logs for a limited time, so you must export to a SIEM/log aggregation platform.

### 4.2 Log Export Options

#### **Option 1: AWS CloudWatch (Recommended for AWS-based stack)**

```bash
# Contact Neon support to enable CloudWatch export
# Subject: "Configure CloudWatch Log Export for Project [PROJECT_ID]"
```

Configuration:

- Log Group: `/aws/neon/eleva-care/audit-logs`
- Retention: 2557 days (7 years)
- Encryption: AES-256

#### **Option 2: Datadog**

Neon supports native Datadog integration:

1. Go to **Neon Console > Integrations > Datadog**
2. Enter Datadog API key
3. Configure log pipeline: `source:neon status:info`
4. Set retention: 7 years

#### **Option 3: Custom Webhook (For ELK/Splunk/Other)**

Contact Neon support for webhook-based log forwarding:

```
Subject: "Configure Webhook Log Export for HIPAA Project"

Please set up log export webhook:
- Endpoint: https://logs.eleva.care/api/ingest/neon-audit
- Authentication: Bearer [YOUR_TOKEN]
- Filter: AUDIT logs only
```

### 4.3 Configure Alerts

Set up alerts for critical audit events:

**Critical Alerts** (immediate response):

- `ROLE` operations (permission changes)
- `DROP`, `ALTER`, `TRUNCATE` on PHI tables
- Failed authentication attempts
- Permission denied errors on PHI tables

**Warning Alerts** (daily review):

- Bulk `DELETE` operations (>100 rows)
- `UPDATE` operations on `records` table
- Weekend/off-hours access to PHI tables

**Example Alert Query (CloudWatch Insights)**:

```
fields @timestamp, @message
| filter @message like /AUDIT.*ROLE/
| sort @timestamp desc
```

### 4.4 Retention Policy

Configure **6-year minimum retention** in your SIEM:

- **AWS CloudWatch**: 2557 days
- **Datadog**: Custom retention policy
- **ELK/Splunk**: Index lifecycle management

---

## Step 5: Validate Configuration

### 5.1 Configuration Checklist

- [ ] pgAudit enabled by Neon support
- [ ] pgAudit settings verified (`pgaudit.log = 'read, write, role, ddl'`)
- [ ] Test audit logs generated successfully
- [ ] PHI tables identified and documented
- [ ] SIEM/log export configured
- [ ] 6-year retention policy set
- [ ] Critical alerts configured
- [ ] Log access restricted to authorized personnel

### 5.2 Documentation Requirements

Create internal documentation:

1. **Audit Log Access Procedures**
   - Who can access audit logs?
   - How to request access?
   - Access review frequency?

2. **Incident Response**
   - How to investigate suspicious activity?
   - Escalation procedures?
   - Forensics process?

3. **Regular Review Schedule**
   - Weekly: Critical alert review
   - Monthly: Audit log sampling
   - Quarterly: Access log review
   - Annually: Full audit trail review

---

## Step 6: Monitor for 2 Weeks (Burn-in Period)

### 6.1 What to Monitor

Track these metrics during the burn-in period:

1. **Log Volume**
   - Average logs per hour
   - Peak log volume times
   - Storage growth rate

2. **Performance Impact**
   - Query latency changes
   - Connection pool utilization
   - Database CPU/memory usage

3. **Coverage Verification**
   - All PHI access logged?
   - All DDL operations captured?
   - Role changes recorded?

### 6.2 Sample Monitoring Queries

```sql
-- Check recent audit logs (if accessible via Neon)
SELECT * FROM pg_stat_activity WHERE application_name LIKE 'eleva:%';

-- Check for missing audit entries (compare against your app logs)
-- Run this query in your application monitoring tool
```

### 6.3 Evaluation Criteria

After 2 weeks, evaluate:

✅ **Keep Session-Level Auditing if**:

- Log volume < 10GB/day
- No performance degradation
- Easy to search/analyze logs

⚠️ **Consider Object-Level Auditing if**:

- Log volume > 10GB/day
- Performance impact > 5% latency increase
- Too much noise in logs

---

## Step 7: Next Steps (Phase 2)

Once Phase 1 is complete and validated:

1. **Phase 2**: Add `application_name` correlation
   - Thread `userId` and `requestId` into DB connections
   - Enable correlation between app logs and DB audit logs

2. **Phase 3**: Review Eleva Audit table
   - Compare coverage with pgAudit
   - Decide if custom audit table is still needed
   - Plan migration/retirement if applicable

3. **Phase 4**: Optimize if needed
   - Move to object-level auditing for high-volume tables
   - Fine-tune log filtering
   - Adjust alert thresholds

---

## Troubleshooting

### pgAudit Not Enabled

**Error**: `unrecognized configuration parameter "pgaudit.log"`

**Solution**: Contact Neon support - pgAudit not yet enabled for your project

### High Log Volume

**Issue**: Excessive log entries

**Solutions**:

1. Set `pgaudit.log_catalog = off` (already configured)
2. Set `pgaudit.log_statement_once = on` (already configured)
3. Consider object-level auditing for high-traffic tables

### Logs Not Appearing in SIEM

**Check**:

1. Log export configured correctly in Neon Console?
2. SIEM endpoint accessible from Neon?
3. Authentication credentials valid?
4. Filter configuration correct?

---

## Compliance Notes

### HIPAA Requirements Met by pgAudit

✅ **Access Logging** - All PHI access recorded  
✅ **Change Tracking** - All modifications logged  
✅ **User Attribution** - Who performed each action  
✅ **Timestamp Accuracy** - Precise timestamps (UTC)  
✅ **Tamper Resistance** - Logs written to external SIEM  
✅ **Retention** - 6+ year retention in SIEM

### Additional HIPAA Controls

Beyond pgAudit, ensure:

- [ ] Encryption at rest (Neon default)
- [ ] Encryption in transit (TLS 1.2+, Neon default)
- [ ] Access controls (RLS policies implemented)
- [ ] Regular access reviews (quarterly minimum)
- [ ] Incident response plan documented
- [ ] BAA signed with Neon
- [ ] BAA signed with SIEM provider

---

## References

- [Neon HIPAA Documentation](https://neon.tech/docs/security/hipaa)
- [pgAudit Official Documentation](https://github.com/pgaudit/pgaudit)
- [Neon pgAudit Blog Post](https://neon.tech/blog/pgaudit-postgres-logging)
- [HIPAA Security Rule](https://www.hhs.gov/hipaa/for-professionals/security/index.html)

---

## Contact Information

**Neon Support**: support@neon.tech  
**Eleva Care Tech Lead**: [YOUR_CONTACT]  
**Compliance Officer**: [COMPLIANCE_CONTACT]

---

**Last Updated**: October 15, 2025  
**Next Review**: Phase 2 Planning (after 2-week burn-in)
