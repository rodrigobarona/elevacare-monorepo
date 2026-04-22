# Audit Logging Call Sites - Error Handling Status

## Summary

This document provides an audit of all `logAuditEvent` call sites in the Eleva Care application and their error handling status.

**Date**: October 28, 2025  
**Status**: ✅ All call sites are protected (either explicitly or by internal handling)

## Changes Made

### 1. Database Connection Validation

**File**: `drizzle/auditDb.ts`

- ✅ Added `getAuditDatabaseUrl()` function with production validation
- ✅ Throws explicit error if `AUDITLOG_DATABASE_URL` is missing in production
- ✅ Validates URL doesn't contain placeholder/localhost in production
- ✅ Allows placeholder in development/test for build flexibility

### 2. Internal Error Handling

**File**: `lib/logAuditEvent.ts`

- ✅ Wrapped audit DB insert in try/catch block
- ✅ Logs failures to console with structured format `[AUDIT FAILURE]`
- ✅ Preserves all audit context in error logs
- ✅ Non-blocking: failures don't break application flow
- ✅ Added comments for future monitoring integration (Sentry, BetterStack)

## Call Site Audit Results

### Category A: Explicit Error Handling (Already Protected)

These call sites already have explicit try/catch blocks around `logAuditEvent`:

#### 1. `server/actions/expert-profile.ts`

**Lines**: 99-152  
**Operations**: Profile publish/unpublish, agreement acceptance  
**Status**: ✅ **Protected**

```typescript
try {
  await logAuditEvent(...);
} catch (auditError) {
  console.error('Error logging audit event:', auditError);
}
```

#### 2. `app/api/webhooks/stripe/handlers/payment.ts`

**Lines**: 1099-1117  
**Operations**: Meeting payment failures  
**Status**: ✅ **Protected**

```typescript
try {
  await logAuditEvent(...);
} catch (auditError) {
  console.error('Error logging MEETING_PAYMENT_FAILED audit event:', auditError);
}
```

#### 3. `app/api/records/route.ts`

**Lines**: 37-52  
**Operations**: Medical records read access  
**Status**: ✅ **Protected**

```typescript
try {
  await logAuditEvent(...);
} catch (auditError) {
  console.error('Error logging audit event for READ_MEDICAL_RECORDS_FOR_MEETING:', auditError);
}
```

#### 4. `app/api/appointments/[meetingId]/records/route.ts`

**Multiple locations**:

- Lines 48-69: CREATE_MEDICAL_RECORD
- Lines 76-108: FAILED_CREATE_MEDICAL_RECORD
- Lines 149-167: READ_MEDICAL_RECORDS_FOR_MEETING
- Lines 186-215: FAILED_GET_MEDICAL_RECORDS
- Lines 252-274: UPDATE_MEDICAL_RECORD
- Lines 299-331: FAILED_UPDATE_MEDICAL_RECORD

**Status**: ✅ **Protected**  
All calls wrapped in try/catch with error logging.

#### 5. `lib/clerk-security-utils.ts`

**Lines**: 243-268  
**Operations**: Security alerts (SECURITY_ALERT_NOTIFIED, SECURITY_ALERT_IGNORED)  
**Status**: ✅ **Protected**

```typescript
try {
  await logAuditEvent(...);
} catch (error) {
  console.error('Error logging security event to audit database:', error);
}
```

### Category B: Protected by Internal Error Handling

These call sites rely on the internal error handling in `logAuditEvent`:

#### 6. `server/actions/meetings.ts`

**Lines**: 294-308  
**Operations**: MEETING_CREATED  
**Status**: ✅ **Protected by internal handling**

```typescript
await logAuditEvent(
  data.clerkUserId,
  'MEETING_CREATED',
  'meeting',
  data.eventId,
  null,
  { ...data },
  ipAddress,
  userAgent,
);
```

**Note**: Wrapped in larger try/catch block (lines 104-107) that catches all errors in meeting creation.

#### 7. `server/actions/events.ts`

**Multiple locations**:

- Lines 82-91: EVENT_CREATED
- Lines 162-171: EVENT_UPDATED
- Lines 246-255: EVENT_DELETED
- Lines 340-353: EVENT_UPDATED (bulk update)

**Status**: ✅ **Protected by internal handling**  
Each function has outer try/catch that will catch errors, but relies primarily on internal handling to not break the operation flow.

#### 8. `server/actions/schedule.ts`

**Lines**: 115-124  
**Operations**: SCHEDULE_UPDATED  
**Status**: ✅ **Protected by internal handling**

```typescript
await logAuditEvent(
  userId,
  'SCHEDULE_UPDATED',
  'schedule',
  scheduleId,
  oldSchedule ?? null,
  { ...scheduleData, availabilities },
  ipAddress,
  userAgent,
);
```

**Note**: Function returns success after this, so audit failure won't break the operation.

## Error Handling Strategy

### Non-Blocking Approach

All audit logging is **non-blocking**, meaning:

- ✅ Audit failures are logged but don't break user operations
- ✅ User experience is not impacted by audit DB issues
- ✅ Failures are visible for monitoring and alerting
- ✅ Structured error format for easy parsing and monitoring

### Monitoring and Alerting

All audit failures are logged with:

```json
{
  "message": "AUDIT_LOGGING_FAILED",
  "error": "Connection timeout",
  "auditData": {
    "clerkUserId": "user_123",
    "action": "MEETING_CREATED",
    "resourceType": "meeting",
    "resourceId": "mtg_456",
    "timestamp": "2025-10-28T12:00:00.000Z"
  }
}
```

### Console Prefix

All errors use the prefix `[AUDIT FAILURE]` for easy filtering in logs.

## Recommendations

### 1. Immediate Actions

- ✅ **Done**: Add runtime validation for production
- ✅ **Done**: Internal error handling in `logAuditEvent`
- ✅ **Done**: Structured error logging
- ⏳ **TODO**: Set up monitoring alerts for `[AUDIT FAILURE]` in production logs

### 2. Future Enhancements

#### Priority 1: Monitoring Integration

Integrate with monitoring service:

```typescript
if (process.env.NODE_ENV === 'production') {
  Sentry.captureException(error, {
    tags: { type: 'audit_failure' },
    extra: auditError,
  });
}
```

#### Priority 2: Critical Event Handling

For compliance-critical events, consider re-throwing:

```typescript
const CRITICAL_EVENTS = ['PRACTITIONER_AGREEMENT_ACCEPTED', 'SECURITY_ALERT_NOTIFIED'];

if (CRITICAL_EVENTS.includes(action)) {
  throw new AuditLoggingError('Critical audit event failed', { cause: error });
}
```

#### Priority 3: Retry Logic

Add retry with exponential backoff for transient failures:

```typescript
async function logAuditEventWithRetry(...args, maxRetries = 3) {
  for (let i = 0; i < maxRetries; i++) {
    try {
      return await logAuditEvent(...args);
    } catch (error) {
      if (i === maxRetries - 1) throw error;
      await sleep(Math.pow(2, i) * 1000);
    }
  }
}
```

#### Priority 4: Fallback Storage

Implement fallback mechanism when DB is unavailable:

```typescript
// Write to file or message queue as backup
if (auditDbUnavailable) {
  await fs.appendFile('/var/log/audit-fallback.log', JSON.stringify(auditData) + '\n');
}
```

## Testing Requirements

### Unit Tests

- ✅ Test `getAuditDatabaseUrl()` throws in production without env var
- ✅ Test `getAuditDatabaseUrl()` rejects placeholder in production
- ✅ Test `logAuditEvent` handles DB errors gracefully
- ✅ Test error logging format

### Integration Tests

- ✅ Test operations complete even when audit DB fails
- ✅ Test audit failures are logged with proper context
- ⏳ Test critical events (when implemented) fail the operation

### Example Test

```typescript
describe('Audit Error Handling', () => {
  it('should complete meeting creation even if audit fails', async () => {
    // Mock audit DB failure
    jest.spyOn(auditDb, 'insert').mockRejectedValue(new Error('DB Down'));

    // Operation should succeed
    const result = await createMeeting(meetingData);
    expect(result.error).toBe(false);

    // Error should be logged
    expect(console.error).toHaveBeenCalledWith(
      expect.stringContaining('[AUDIT FAILURE]'),
      expect.any(String),
    );
  });
});
```

## Deployment Checklist

Before deploying to production:

- ✅ `AUDITLOG_DATABASE_URL` is set in production environment variables
- ✅ Audit database is accessible from production servers
- ✅ Database schema migrations are up to date
- ⏳ Monitoring is configured to alert on `[AUDIT FAILURE]` logs
- ⏳ Team has runbooks for responding to audit failures
- ⏳ Backup audit logging mechanism is documented (future)

## Compliance Notes

### Current State

- ✅ All audit events are attempted to be logged
- ✅ Failures are logged for investigation
- ✅ Production requires valid audit DB configuration
- ✅ Application fails fast if audit DB is misconfigured

### Gap Analysis

For full compliance (HIPAA, SOC 2), consider:

1. ⏳ **Guaranteed delivery**: Implement retry logic or fallback storage
2. ⏳ **Alerting**: Real-time alerts for audit failures
3. ⏳ **Recovery**: Automated recovery procedures
4. ⏳ **Reporting**: Regular audit completeness reports

## Related Documentation

- [Audit Error Handling Guide](./audit-error-handling.md)
- [Audit Logging Strategy](../06-legal/audit-logging-strategy.md)
- [pgAudit Configuration](../06-legal/PGAUDIT-SUMMARY.md)
- [Testing Guidelines](../testing/testing-guidelines.md)

## Change Log

| Date       | Change                                          | Author |
| ---------- | ----------------------------------------------- | ------ |
| 2025-10-28 | Initial audit and error handling implementation | System |
| 2025-10-28 | Added production validation for audit DB URL    | System |
| 2025-10-28 | Internal error handling in logAuditEvent        | System |

## Conclusion

✅ **All call sites are now protected** against audit logging failures either through:

1. Explicit try/catch blocks with error logging, or
2. Internal error handling in `logAuditEvent` function

✅ **Production deployments are safe** with:

1. Fail-fast validation for missing configuration
2. Clear error messages for misconfiguration
3. Non-blocking audit failures

⏳ **Next steps**:

1. Set up monitoring alerts
2. Implement retry logic for transient failures
3. Add critical event handling for compliance
4. Create runbooks for audit failure response
