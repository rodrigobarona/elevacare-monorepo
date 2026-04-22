# Cron Jobs Documentation

This document provides detailed information about the automated cron jobs running in the Eleva Care application.

## Overview

The application uses QStash for scheduling and executing cron jobs. All jobs are configured in `config/qstash.ts` and implemented in the `app/api/cron` directory.

## Cron Jobs

### 1. Process Tasks (`/api/cron/process-tasks`)

**Schedule**: Daily at 4 AM UTC (`0 4 * * *`)

**Purpose**: Main daily task processor that handles:

- Processing pending expert transfers
- Verifying payment statuses
- Updating transfer records in the database

**Key Features**:

- Handles both time-based and manually approved transfers
- Includes retry mechanism (max 3 retries)
- Updates transfer statuses (PENDING → COMPLETED/FAILED)
- Creates Stripe transfers for expert payouts
- Maintains detailed error logging

### 2. Process Expert Transfers (`/api/cron/process-expert-transfers`)

**Schedule**: Every 2 hours (`0 */2 * * *`)

**Purpose**: Handles the transfer of funds to expert accounts based on:

- Payment aging requirements
- Country-specific payout delays
- Manual approval status

**Key Features**:

- Respects country-specific payment aging rules
- Processes approved transfers immediately
- Updates transfer statuses and records
- Creates Stripe transfers with proper metadata
- Handles failed transfers with retry logic

### 3. Check Upcoming Payouts (`/api/cron/check-upcoming-payouts`)

**Schedule**: Daily at noon UTC (`0 12 * * *`)

**Purpose**: Notifies experts about upcoming payouts that will be eligible soon.

**Key Features**:

- Checks pending transfers without notifications
- Calculates remaining days based on country rules
- Sends notifications for payouts eligible in 1-2 days
- Updates notification timestamps
- Handles multiple currencies and amounts

### 4. Cleanup Expired Reservations (`/api/cron/cleanup-expired-reservations`)

**Schedule**: Every 15 minutes (`*/15 * * * *`)

**Purpose**: Maintains system hygiene by removing expired slot reservations.

**Key Features**:

- Deletes reservations past their expiration time
- Logs detailed cleanup information
- Handles timezone-aware expiration checks
- Provides cleanup statistics
- Maintains audit trail of deleted reservations

### 5. Cleanup Blocked Dates (`/api/cron/cleanup-blocked-dates`)

**Schedule**: Daily at midnight UTC (`0 0 * * *`)

**Purpose**: Removes expired blocked dates from expert calendars.

**Key Features**:

- Respects timezone-specific date calculations
- Handles multiple timezone conversions
- Provides detailed cleanup logs
- Returns statistics about cleaned dates
- Maintains data consistency across timezones

## Security

All cron endpoints implement multiple layers of authentication:

1. QStash signature verification
2. API key validation
3. Upstash signature headers
4. User agent verification
5. Legacy cron secret (for backward compatibility)

## Error Handling

Each cron job includes:

- Detailed error logging
- Retry mechanisms where appropriate
- Status updates in the database
- Error notifications when critical
- Fallback mechanisms in production

## Monitoring

All cron jobs provide:

- Detailed execution logs
- Success/failure statistics
- Performance metrics
- Error tracking
- Execution timestamps

## Development Guidelines

When modifying cron jobs:

1. Always maintain proper authentication
2. Include comprehensive error handling
3. Add detailed logging
4. Update documentation
5. Test in development environment first
6. Consider timezone implications
7. Follow the retry pattern for critical operations

## Configuration

Cron schedules are centrally managed in `config/qstash.ts`. Changes to schedules should be made there and then synchronized with QStash using the setup script.
