# Audit Logging Error Handling

## Overview

This document describes the audit logging error handling strategy implemented in Eleva Care to ensure audit failures are properly detected, logged, and monitored without breaking the main application flow.

## Architecture

### 1. Database Connection Validation (`drizzle/auditDb.ts`)

The audit database connection includes runtime validation to prevent production deployments with missing or invalid configuration:

```typescript
function getAuditDatabaseUrl(): string {
  const url = process.env.AUDITLOG_DATABASE_URL;
  const nodeEnv = process.env.NODE_ENV;

  // In production, the audit database URL MUST be configured
  if (nodeEnv === 'production') {
    if (!url) {
      throw new Error(
        'FATAL: AUDITLOG_DATABASE_URL is required in production environment. ' +
          'Audit logging is critical for compliance and security. ' +
          'Please configure AUDITLOG_DATABASE_URL in your environment variables.',
      );
    }
    if (url.includes('placeholder') || url.includes('localhost')) {
      throw new Error(
        'FATAL: AUDITLOG_DATABASE_URL contains a placeholder or localhost value in production. ' +
          'This is not allowed. Please configure a valid Neon database URL.',
      );
    }
  }

  // In non-production, allow placeholder for build/test environments
  return url || 'postgresql://placeholder:placeholder@localhost:5432/placeholder_audit';
}
```

#### Benefits:

- **Fail-fast validation**: Application won't start in production without proper audit DB configuration
- **Clear error messages**: Developers get explicit guidance on what needs to be fixed
- **Development flexibility**: Allows builds and tests to run without full configuration

### 2. Graceful Error Handling (`lib/logAuditEvent.ts`)

The `logAuditEvent` function wraps all audit operations in try/catch blocks to ensure audit failures don't break the main application flow:

```typescript
export async function logAuditEvent(
  clerkUserId: string,
  action: AuditEventType,
  resourceType: AuditResourceType,
  resourceId: string,
  oldValues: Record<string, unknown> | null,
  newValues: AuditEventMetadata,
  ipAddress: string,
  userAgent: string,
): Promise<void> {
  try {
    await auditDb.insert(auditLogs).values({
      clerkUserId,
      action,
      resourceType,
      resourceId,
      oldValues,
      newValues,
      ipAddress,
      userAgent,
      createdAt: new Date(),
    });
  } catch (error) {
    // Log the audit failure for monitoring and alerting
    const auditError = {
      message: 'AUDIT_LOGGING_FAILED',
      error: error instanceof Error ? error.message : String(error),
      auditData: {
        clerkUserId,
        action,
        resourceType,
        resourceId,
        timestamp: new Date().toISOString(),
      },
    };

    // Log to console for immediate visibility
    console.error('[AUDIT FAILURE]', JSON.stringify(auditError, null, 2));

    // In production, this should be sent to a monitoring service
    // Example: Sentry.captureException(error, { extra: auditError });
  }
}
```

#### Benefits:

- **Non-blocking**: Audit failures don't prevent user operations from completing
- **Visibility**: Errors are logged to console and can be monitored
- **Structured logging**: Error format is consistent and easy to parse
- **Context preservation**: All relevant audit data is included in error logs

## Call Site Patterns

### Pattern 1: Protected by `logAuditEvent` Internal Handling

Most call sites can rely on the internal error handling in `logAuditEvent`:

```typescript
// Server action example
await logAuditEvent(
  userId,
  'EVENT_CREATED',
  'event',
  eventId,
  null,
  { ...eventData },
  ipAddress,
  userAgent,
);
// Continues execution even if audit fails
```

### Pattern 2: Explicit Error Handling for Critical Operations

For operations where audit logging is particularly critical, add explicit error handling:

```typescript
try {
  await logAuditEvent(
    userId,
    'PRACTITIONER_AGREEMENT_ACCEPTED',
    'legal_agreement',
    agreementId,
    null,
    { ...agreementData },
    ipAddress,
    userAgent,
  );
} catch (auditError) {
  // Log but don't fail the operation
  console.error('Critical audit event failed:', auditError);
  // Optional: Alert to monitoring service
}
```

### Pattern 3: Error Handling in Webhook Contexts

Webhooks should handle audit failures gracefully:

```typescript
try {
  await logAuditEvent(
    clerkUserId,
    'MEETING_PAYMENT_FAILED',
    'meeting',
    meetingId,
    null,
    { ...paymentData },
    'SYSTEM_WEBHOOK',
    'Stripe Webhook',
  );
} catch (auditError) {
  console.error('Error logging payment failure audit event:', auditError);
  // Don't return error to webhook caller
}
```

## Monitoring and Alerting

### 1. Console Logging

All audit failures are logged to console with the prefix `[AUDIT FAILURE]`:

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

### 2. Production Monitoring (Recommended)

Integrate with monitoring services like Sentry, BetterStack, or DataDog:

```typescript
// Example Sentry integration
if (process.env.NODE_ENV === 'production') {
  Sentry.captureException(error, {
    tags: {
      type: 'audit_failure',
      action: auditData.action,
      resourceType: auditData.resourceType,
    },
    extra: auditError,
  });
}
```

### 3. Metrics and Dashboards

Set up monitoring for:

- **Audit failure rate**: Percentage of failed audit operations
- **Audit failure patterns**: Which operations fail most frequently
- **Recovery time**: How long until audit operations succeed again
- **Critical event failures**: Specific alerts for high-priority audit events

## Testing

### Unit Tests

Test both success and failure scenarios:

```typescript
describe('logAuditEvent', () => {
  it('should log successfully', async () => {
    await expect(
      logAuditEvent(
        'user_123',
        'EVENT_CREATED',
        'event',
        'evt_456',
        null,
        { name: 'Test' },
        '127.0.0.1',
        'Test Agent',
      ),
    ).resolves.not.toThrow();
  });

  it('should handle database errors gracefully', async () => {
    // Mock database failure
    jest.spyOn(auditDb, 'insert').mockRejectedValue(new Error('DB Error'));

    // Should not throw
    await expect(
      logAuditEvent(
        'user_123',
        'EVENT_CREATED',
        'event',
        'evt_456',
        null,
        { name: 'Test' },
        '127.0.0.1',
        'Test Agent',
      ),
    ).resolves.not.toThrow();
  });
});
```

### Integration Tests

Test audit logging in context of real operations:

```typescript
describe('Event Creation with Audit', () => {
  it('should create event even if audit fails', async () => {
    // Mock audit DB failure
    jest.spyOn(auditDb, 'insert').mockRejectedValue(new Error('Audit DB Down'));

    // Event should still be created
    const result = await createEvent(eventData);
    expect(result.error).toBe(false);
    expect(result.eventId).toBeDefined();
  });
});
```

## Deployment Checklist

Before deploying to production, ensure:

1. ✅ `AUDITLOG_DATABASE_URL` is set in production environment
2. ✅ Audit database is accessible from production environment
3. ✅ Monitoring is configured to alert on `[AUDIT FAILURE]` logs
4. ✅ Team has runbooks for responding to audit failures
5. ✅ Backup audit logging mechanism is in place (e.g., file logging)

## Critical Audit Events

Some audit events are more critical than others. Consider re-throwing errors for:

- `PRACTITIONER_AGREEMENT_ACCEPTED`: Legal compliance requirement
- `SECURITY_ALERT_NOTIFIED`: Security incident tracking
- `PAYMENT_PROCESSED`: Financial audit trail
- `MEDICAL_RECORD_ACCESS`: HIPAA compliance requirement

To implement critical event handling, uncomment and customize the code in `lib/logAuditEvent.ts`:

```typescript
// Uncomment to enable critical event handling
if (isCriticalAuditEvent(action)) {
  throw new AuditLoggingError('Critical audit event failed', { cause: error });
}
```

## Troubleshooting

### Issue: Audit DB Connection Fails at Startup

**Symptoms**: Application crashes with "FATAL: AUDITLOG_DATABASE_URL is required"

**Solution**:

1. Check environment variables: `echo $AUDITLOG_DATABASE_URL`
2. Verify URL format: `postgresql://user:pass@host:5432/database`
3. Test connection: `psql $AUDITLOG_DATABASE_URL`

### Issue: Frequent Audit Logging Failures

**Symptoms**: High rate of `[AUDIT FAILURE]` logs

**Solution**:

1. Check audit DB health and connectivity
2. Review audit DB resource limits (connections, storage)
3. Consider implementing retry logic with exponential backoff
4. Verify audit DB schema migrations are up to date

### Issue: Missing Audit Logs

**Symptoms**: Expected audit events not appearing in database

**Solution**:

1. Search logs for `[AUDIT FAILURE]` messages
2. Check if `logAuditEvent` is being called (add debug logging)
3. Verify audit DB permissions allow INSERT operations
4. Check if transaction rollbacks are affecting audit logs

## Future Enhancements

Consider implementing:

1. **Retry Logic**: Automatic retry with exponential backoff for transient failures
2. **Fallback Storage**: Write to file or message queue if database unavailable
3. **Batch Operations**: Buffer and batch audit logs to reduce database load
4. **Asynchronous Processing**: Use message queue for non-critical audit events
5. **Audit Log Validation**: Verify critical audit events were successfully logged

## Related Documentation

- [Audit Logging Strategy](../06-legal/audit-logging-strategy.md)
- [pgAudit Configuration](../06-legal/PGAUDIT-SUMMARY.md)
- [Database Testing Guidelines](../testing/database-testing.md)
- [Monitoring and Observability](../03-infrastructure/monitoring.md)
