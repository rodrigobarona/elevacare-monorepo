# Unified Monitoring Architecture

## Overview

This document describes the consolidated observability architecture for Eleva Care. PostHog serves as the **PRIMARY** unified analytics platform for both web and product analytics, while each other tool handles its specialized responsibility.

## Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────────────┐
│                          ELEVA CARE APPLICATION                         │
└─────────────────────────────────────────────────────────────────────────┘
                                    │
        ┌───────────────────────────┼───────────────────────────┐
        │                           │                           │
        ▼                           ▼                           ▼
┌───────────────┐          ┌───────────────┐          ┌───────────────┐
│    SENTRY     │          │   POSTHOG     │          │    VERCEL     │
│               │          │   (PRIMARY)   │          │   (BACKUP)    │
│ ✓ Errors      │          │               │          │               │
│ ✓ Traces/APM  │          │ ✓ Web         │          │ ✓ Web Vitals  │
│ ✓ Session     │          │   Analytics   │          │   (LCP, CLS)  │
│   Replay      │          │ ✓ Product     │          │ ✓ Traffic     │
│ ✓ User        │          │   Analytics   │          │   (Quick View)│
│   Feedback    │          │ ✓ Feature     │          │               │
│ ✓ Logs        │          │   Flags       │          │               │
│               │          │ ✓ A/B Testing │          │               │
│               │          │ ✓ Funnels     │          │               │
│               │          │ ✓ Retention   │          │               │
└───────────────┘          └───────────────┘          └───────────────┘
        │                           │                           │
        │                           │                           │
        └───────────────────────────┼───────────────────────────┘
                                    │
                                    ▼
                          ┌───────────────┐
                          │  BETTER STACK │
                          │               │
                          │ ✓ Uptime      │
                          │   Monitoring  │
                          │ ✓ Status Page │
                          │ ✓ Heartbeats  │
                          │   (QStash)    │
                          └───────────────┘
```

## Why PostHog for Web + Product Analytics?

Having unified analytics enables powerful insights:

| Question                                          | Requires                            |
| ------------------------------------------------- | ----------------------------------- |
| "Which traffic source brings the best customers?" | Web analytics + Conversion tracking |
| "Do organic users have better retention?"         | Traffic source + Retention analysis |
| "What's the ROI of our paid campaigns?"           | Channel tracking + Revenue events   |

Vercel Analytics remains as a **BACKUP** for quick traffic checks in the Vercel dashboard.

## Tool Responsibilities

### Sentry - Technical Observability

**Primary Focus**: Error tracking, application performance monitoring, debugging

| Feature          | Description                                  | Docs                                           |
| ---------------- | -------------------------------------------- | ---------------------------------------------- |
| Error Monitoring | Automatic JS error capture with source maps  | [Sentry Docs](./06-sentry-error-monitoring.md) |
| Session Replay   | Video-like recordings linked to errors       | Included                                       |
| Tracing/APM      | Distributed tracing, spans, pageload metrics | Included                                       |
| User Feedback    | Bug report widget in footer                  | Included                                       |
| Logs             | Console error/warn capture                   | Included                                       |

**User Context**: WorkOS user ID, email, role tag

### PostHog - Unified Analytics (PRIMARY)

**Primary Focus**: Web analytics + Product analytics in one platform

**Web Analytics Features:**

| Feature          | Description                                | Docs                                      |
| ---------------- | ------------------------------------------ | ----------------------------------------- |
| Traffic Metrics  | Visitors, pageviews, sessions, bounce rate | [PostHog Docs](./02-posthog-analytics.md) |
| Traffic Sources  | Referrers, channels, UTM tracking          | Included                                  |
| Entry/Exit Paths | Where users land and leave                 | Included                                  |
| Geographic Data  | Visitor locations                          | Included                                  |

**Product Analytics Features:**

| Feature             | Description                                | Docs                                      |
| ------------------- | ------------------------------------------ | ----------------------------------------- |
| User Identification | WorkOS user ID tracking                    | [PostHog Docs](./02-posthog-analytics.md) |
| Group Analytics     | Role-based segmentation                    | Included                                  |
| Feature Flags       | Gradual rollouts, kill switches            | Included                                  |
| A/B Testing         | Experiment variants                        | Included                                  |
| Funnels             | Conversion analysis (with traffic source!) | Included                                  |
| Retention           | Cohort analysis (by acquisition channel!)  | Included                                  |

**Group Tracking**: Users grouped by role (`admin`, `expert_top`, `expert_community`, `user`)

**Web Analytics Dashboard**: `https://eu.posthog.com/web`

### Vercel Analytics & Speed Insights (BACKUP)

**Primary Focus**: Quick traffic overview and authoritative Web Vitals

| Feature    | Description                | Role                               |
| ---------- | -------------------------- | ---------------------------------- |
| Pageviews  | Basic traffic analytics    | BACKUP (PostHog is primary)        |
| Web Vitals | LCP, FCP, CLS, TTFB, INP   | PRIMARY (authoritative for Vercel) |
| Audience   | Geo, device, referrer data | BACKUP (PostHog is primary)        |

**Why keep Vercel Analytics**: Quick access in Vercel dashboard for at-a-glance traffic checks.
**Why Vercel for Web Vitals**: Authoritative source for Vercel deployments, optimized data collection.

### Better Stack

**Primary Focus**: External monitoring and status communication

| Feature             | Description                 | Docs                                                |
| ------------------- | --------------------------- | --------------------------------------------------- |
| Uptime Monitoring   | Multi-region health checks  | [Better Stack Docs](./01-betterstack-monitoring.md) |
| Status Page         | Public status communication | Included                                            |
| Heartbeats          | QStash cron job monitoring  | Included                                            |
| Incident Management | Alerting and escalation     | Included                                            |

## Cross-Platform Integration

### User ID Consistency

The WorkOS user ID (`user.id`) is the canonical identifier across all platforms:

```typescript
// Same ID used everywhere
const userId = user.id; // e.g., "user_01ABC123..."

// PostHog
posthog.identify(userId, { ... });

// Sentry
Sentry.setUser({ id: userId, ... });
```

### Context Linking

Sentry captures PostHog session info for cross-platform debugging:

```typescript
Sentry.setContext('posthog', {
  session_id: posthog.get_session_id(),
  distinct_id: posthog.get_distinct_id(),
  session_replay_url: posthog.get_session_replay_url(),
});

Sentry.setContext('workos', {
  user_id: user.id,
  email_verified: user.emailVerified,
});
```

### Role Tagging

User roles are tracked in both platforms:

- **PostHog**: `posthog.group('user_role', role)`
- **Sentry**: `Sentry.setTag('user_role', role)`

## Removed Duplications

The following duplicate tracking has been eliminated:

| Previously Tracked         | Now Single Source                   |
| -------------------------- | ----------------------------------- |
| PostHog error events       | Sentry only                         |
| PostHog session recording  | Sentry Replay only                  |
| PostHog manual Web Vitals  | Vercel Speed Insights + Sentry      |
| Multiple pageview trackers | PostHog (enhanced) + Vercel (basic) |

## File Structure

```
instrumentation-client.ts    # Sentry client-side (Replay, Feedback, Tracing)
sentry.server.config.ts      # Sentry server-side (Node.js)
sentry.edge.config.ts        # Sentry edge runtime (Middleware)
src/app/providers.tsx        # PostHog init + user tracking
src/app/PostHogPageView.tsx  # Enhanced pageview tracking
```

## Testing

The analytics integration has comprehensive tests:

```bash
pnpm test -- --testPathPattern="analytics-integration"
```

Tests cover:

- User ID consistency across platforms
- Role-based group priority logic
- PostHog group properties
- Sentry context building
- Route detection (public vs private)
- Cross-platform debugging workflow

## Monitoring Checklist

### Daily

- [ ] Check Sentry for new unhandled errors
- [ ] Review Better Stack uptime status

### Weekly

- [ ] Analyze PostHog user journeys
- [ ] Review Vercel Web Vitals trends
- [ ] Check Sentry performance metrics

### Monthly

- [ ] Audit feature flag usage in PostHog
- [ ] Review error trends and prioritize fixes
- [ ] Update status page if needed

## Environment Variables

| Variable                   | Platform       | Required |
| -------------------------- | -------------- | -------- |
| `NEXT_PUBLIC_SENTRY_DSN`   | Sentry         | Yes      |
| `SENTRY_AUTH_TOKEN`        | Sentry (build) | Yes      |
| `NEXT_PUBLIC_POSTHOG_KEY`  | PostHog        | Yes      |
| `NEXT_PUBLIC_POSTHOG_HOST` | PostHog        | Yes      |
| `BETTERSTACK_*`            | Better Stack   | Yes      |

## Troubleshooting

### Sentry not receiving events

1. Check DSN is correct in environment
2. Verify tunnel route `/monitoring` is accessible
3. Check browser console for Sentry Logger output

### PostHog user not identified

1. Verify user is authenticated (WorkOS)
2. Check browser console for PostHog initialization
3. Ensure API key is correct

### Missing role-based grouping

1. Role fetch requires authenticated user
2. Check `/api/user/roles` endpoint
3. Verify AuthorizationProvider is in component tree

### Web Vitals not appearing

1. Vercel Speed Insights needs production deployment
2. Sentry also tracks Web Vitals in BrowserTracing
3. Check Vercel Analytics dashboard

## Related Documentation

- [Sentry Error Monitoring](./06-sentry-error-monitoring.md)
- [PostHog Analytics](./02-posthog-analytics.md)
- [Better Stack Monitoring](./01-betterstack-monitoring.md)
- [Cursor Rules - Sentry](/.cursor/rules/sentry.mdc)
