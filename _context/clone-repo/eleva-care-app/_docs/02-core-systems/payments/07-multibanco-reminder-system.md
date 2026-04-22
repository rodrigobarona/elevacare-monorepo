# ⏰ Multibanco Payment Reminder System

> **Automated reminder system to prevent payment abandonment for Multibanco transactions in the Eleva Care platform**

## 🎯 Overview

The Multibanco Payment Reminder System sends automated reminder emails to customers who have pending Multibanco payments for their appointment reservations. This system prevents customers from forgetting to pay and reduces lost bookings.

## 📋 Prerequisites

- Understanding of CRON job scheduling
- Knowledge of QStash for webhook management
- Familiarity with Stripe Multibanco payment flow
- Basic understanding of the slot reservation system

## 🔧 Architecture

### System Components

1. **Email Templates** (`components/emails/MultibancoPaymentReminder.tsx`)
2. **CRON Job** (`app/api/cron/send-payment-reminders/route.ts`)
3. **Database Tracking** (SlotReservationTable with reminder timestamps)
4. **Payment Flow Integration** (Webhook handlers)

## 📅 Reminder Schedule

### Two-Stage Reminder System

| Stage     | Timing               | Type   | Description                           |
| --------- | -------------------- | ------ | ------------------------------------- |
| **Day 3** | 4 days before expiry | Gentle | Friendly reminder with plenty of time |
| **Day 6** | 1 day before expiry  | Urgent | Final warning before expiration       |

### Timeline Example

```
Day 0: Customer selects Multibanco → Reservation created (7-day expiry)
Day 3: 🟢 Gentle reminder sent ("You have 4 days left")
Day 6: 🔴 Urgent reminder sent ("Final day to pay!")
Day 7: ❌ Reservation expires and is cleaned up
```

## 📧 Email Templates

### Template Features

- **Dynamic Content**: Appointment details, payment info, expert information
- **Urgency Styling**: Color-coded based on reminder type (blue/red)
- **Localization Ready**: Translation system for multiple languages
- **Responsive Design**: Works across all email clients
- **Security Messaging**: Clear explanations about payment requirements

### Template Props

```typescript
interface MultibancoPaymentReminderProps {
  customerName: string;
  expertName: string;
  serviceName: string;
  appointmentDate: string;
  appointmentTime: string;
  timezone: string;
  duration: number;
  multibancoEntity: string;
  multibancoReference: string;
  multibancoAmount: string;
  voucherExpiresAt: string;
  hostedVoucherUrl: string;
  reminderType: 'gentle' | 'urgent';
  daysRemaining: number;
}
```

## 🗄️ Database Schema

### Reminder Tracking Fields

Added to `SlotReservationTable`:

```sql
-- New fields for tracking sent reminders
gentle_reminder_sent_at TIMESTAMP NULL,
urgent_reminder_sent_at TIMESTAMP NULL
```

These fields prevent duplicate reminders and enable proper tracking.

## ⚙️ CRON Job Configuration

### Scheduling

- **Frequency**: Every 6 hours (`0 */6 * * *`)
- **Runtime**: Node.js
- **Authentication**: Multiple verification methods (QStash, API key, cron secret)

### Process Flow

1. Calculate reminder time windows
2. Query reservations needing reminders
3. Filter out already-sent reminders
4. Send emails and mark as sent
5. Log results and metrics

### Query Logic

```typescript
// Find reservations that need reminders
const reservationsNeedingReminders = await db.select(/* ... */).where(
  and(
    // Within reminder window
    gt(SlotReservationTable.expiresAt, reminderWindowStart),
    lt(SlotReservationTable.expiresAt, reminderWindowEnd),
    // Still active
    gt(SlotReservationTable.expiresAt, currentTime),
    // Has Multibanco payment
    isNotNull(SlotReservationTable.stripePaymentIntentId),
    // Hasn't received this reminder type yet
    isNull(SlotReservationTable.gentleReminderSentAt), // or urgentReminderSentAt
  ),
);
```

## 🔒 Security Features

### Duplicate Prevention

- **Database tracking** with timestamp fields
- **Idempotent operations** for safe retries
- **Time-based safety checks** to prevent premature sending

### Authentication

- QStash signature verification
- API key validation
- CRON secret verification
- User agent validation

## 🔧 Integration Points

### Payment Flow Integration

The reminder system integrates with:

1. **Multibanco Payment Creation** (`payment.ts` webhook)
   - Creates slot reservations with 7-day expiry
   - Sends initial booking confirmation
   - Sets up payment tracking

2. **Payment Completion** (`checkout.session.completed`)
   - Creates actual meeting
   - Cleans up slot reservation
   - Stops reminder sequence

3. **Cleanup System** (`cleanup-expired-reservations`)
   - Runs after payment expiry
   - Removes abandoned reservations
   - No more reminders needed

### Email System Integration

Uses existing Resend infrastructure:

- React Email components
- Professional template styling
- Reliable delivery
- Error handling and logging

## 📊 Monitoring & Metrics

### CRON Job Metrics

```json
{
  "success": true,
  "totalRemindersSent": 5,
  "stages": [
    {
      "stage": "Gentle reminder (Day 3)",
      "found": 3,
      "sent": 3
    },
    {
      "stage": "Urgent final reminder (Day 6)",
      "found": 2,
      "sent": 2
    }
  ],
  "timestamp": "2024-01-15T10:30:00.000Z"
}
```

### Key Metrics to Monitor

- Reminder delivery success rate
- Customer payment completion after reminders
- System performance and error rates
- Email bounce/unsubscribe rates

## 🚀 Deployment Requirements

### Environment Variables

```env
# Email service
RESEND_API_KEY=your_resend_key

# CRON authentication
CRON_API_KEY=your_cron_key
CRON_SECRET=your_cron_secret
QSTASH_SIGNING_KEY=your_qstash_key

# Feature flags
ENABLE_CRON_FALLBACK=true
```

### Database Migration

```bash
# Apply reminder tracking fields
npx drizzle-kit push:pg
```

### CRON Setup

Set up the following endpoint to run every 6 hours:

```
GET /api/cron/send-payment-reminders
POST /api/cron/send-payment-reminders
```

## 💡 Usage Examples

### Manual CRON Trigger

```bash
# Test reminder job manually
curl -H "x-api-key: $CRON_API_KEY" \
  https://your-domain.com/api/cron/send-payment-reminders
```

### Database Queries

```sql
-- Check recent reservations
SELECT * FROM slot_reservations
WHERE created_at > NOW() - INTERVAL '7 days';

-- Monitor reminder tracking
SELECT gentle_reminder_sent_at, urgent_reminder_sent_at
FROM slot_reservations
WHERE stripe_payment_intent_id IS NOT NULL;
```

## 🔍 Troubleshooting

### Common Issues

**Duplicate Reminders**

- Check database timestamp fields
- Verify CRON job isn't running too frequently
- Review error logs for failed updates

**Missing Reminders**

- Confirm CRON job is running
- Check authentication configuration
- Verify database query logic

**Email Delivery Issues**

- Monitor Resend dashboard
- Check email bounce rates
- Verify template rendering

### Debugging Commands

```bash
# Check CRON job logs
kubectl logs -l app=eleva-care --since=1h | grep "send-payment-reminders"

# Verify QStash schedule
curl -H "Authorization: Bearer $QSTASH_TOKEN" \
  https://qstash.upstash.io/v2/schedules

# Test email template rendering
npm run test -- --testNamePattern="MultibancoPaymentReminder"
```

## 🔗 Related Documentation

- [Payment Flow Analysis](./01-payment-flow-analysis.md)
- [Stripe Integration](./02-stripe-integration.md)
- [Multibanco Integration](./05-multibanco-integration.md)
- [Race Condition Fixes](./04-race-condition-fixes.md)
- [Automation Systems Summary](../06-automation-systems-summary.md)

## 🚀 Future Enhancements

### Planned Improvements

1. **SMS Reminders** for urgent notifications
2. **Customizable Timing** per expert preferences
3. **A/B Testing** for reminder effectiveness
4. **Analytics Dashboard** for reminder performance
5. **Machine Learning** for optimal timing

### Potential Optimizations

- Batch email processing for performance
- Redis caching for frequently accessed data
- Webhook-based triggers instead of polling
- Dynamic reminder timing based on historical conversion data

## 📈 Performance Considerations

### Scalability

- Chunked processing for large reminder batches
- Database indexing on reminder timestamp fields
- Rate limiting for email service integration
- Horizontal scaling support

### Error Handling

- Retry logic for failed email sends
- Dead letter queue for persistent failures
- Monitoring and alerting for system health
- Graceful degradation for service outages

---

**Last updated**: January 15, 2025 | **Next review**: April 15, 2025
