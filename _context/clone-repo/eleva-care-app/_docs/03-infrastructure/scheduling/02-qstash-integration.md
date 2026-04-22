# QStash Integration

This document explains how QStash is integrated into the Eleva Care application for reliable background job processing.

## Overview

[QStash](https://upstash.com/docs/qstash/overall/getstarted) is a message queue and task scheduler that allows us to:

1. Schedule recurring tasks (cron jobs)
2. Process background jobs reliably
3. Handle distributed task processing

## Configuration

QStash requires the following environment variables:

```
QSTASH_TOKEN=your_qstash_token
QSTASH_CURRENT_SIGNING_KEY=your_current_signing_key
QSTASH_NEXT_SIGNING_KEY=your_next_signing_key
NEXT_PUBLIC_APP_URL=https://your-app-url.com
```

## Scheduled Jobs

The application uses QStash to run the following scheduled jobs:

1. **Process Tasks** - Daily at 4 AM
   - Endpoint: `/api/cron/process-tasks`
   - Purpose: Process daily tasks and cleanup

2. **Process Expert Transfers** - Every 2 hours
   - Endpoint: `/api/cron/process-expert-transfers`
   - Purpose: Process payments to experts

3. **Check Upcoming Payouts** - Daily at noon
   - Endpoint: `/api/cron/check-upcoming-payouts`
   - Purpose: Notify experts about upcoming payouts

## Implementation Details

### Validation

Before any QStash operation, we validate the configuration using the `validateQStashConfig()` function in `lib/qstash-config.ts`. This ensures all required environment variables are present.

### Request Handling

QStash sends requests to the `/api/qstash` endpoint, which:

1. Verifies the request signature for security
2. Extracts the target endpoint from the header
3. Forwards the request to the appropriate internal API route

### Error Handling

If QStash is not properly configured:

1. Scheduled jobs will not be created during build
2. The health check endpoint will return an appropriate error
3. Log messages will indicate the missing configuration

## Usage

### Setting Up Schedules

Schedules are set up automatically during the build process via the `postbuild` script, or you can manually run:

```bash
npm run qstash:update
```

### Testing QStash Integration

You can verify QStash is properly configured by visiting:

```
/api/admin/qstash-health
```

This endpoint will check:

- Configuration validity
- Connection to QStash API
- Existing schedules

### Adding a New Scheduled Job

To add a new scheduled job:

1. Add the schedule configuration to `config/qstash.ts`
2. Create the API endpoint that will handle the job
3. Update schedules by running `npm run qstash:update`

## Troubleshooting

If QStash jobs are not running:

1. Check the QStash health endpoint to verify connectivity
2. Ensure all environment variables are properly set
3. Check QStash logs in the Upstash console
4. Verify the receiving endpoint works correctly when called directly
