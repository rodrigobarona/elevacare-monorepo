# Infrastructure Documentation

> **DevOps, deployment, monitoring, CI/CD, and infrastructure management for Eleva Care**

## Overview

This section covers all infrastructure-related documentation including monitoring, CI/CD pipelines, cron job management, and deployment strategies.

---

## Infrastructure Components

### 1. Monitoring (`monitoring/`)

Comprehensive health monitoring and alerting with BetterStack.

- **BetterStack Integration**: Complete monitoring setup
- **Health Checks**: Service health endpoints
- **PostHog Analytics**: User analytics and event tracking
- **Performance Monitoring**: Response times and uptime

📄 **Key Files:**

- [BetterStack Monitoring](./monitoring/01-betterstack-monitoring.md) ⭐ **Complete monitoring guide**
- [Health Check Monitoring](./monitoring/01-health-check-monitoring.md)
- [PostHog Analytics](./monitoring/02-posthog-analytics.md)
- [PostHog Dashboard](./monitoring/03-posthog-dashboard.md)

---

### 2. Scheduling (`scheduling/`)

Cron job and scheduled task management with QStash.

- **QStash Integration**: Serverless cron job management
- **Scheduled Tasks**: Payment processing, reminders, cleanups
- **Heartbeat Monitoring**: Task execution monitoring

📄 **Key Files:**

- [Cron Jobs](./scheduling/01-cron-jobs.md)
- [QStash Integration](./scheduling/02-qstash-integration.md)

---

### 3. CI/CD (`ci-cd/`)

Continuous integration and deployment pipelines.

- **GitHub Actions**: Automated testing and deployment
- **Vercel Integration**: Preview deployments and production
- **Quality Checks**: Linting, type checking, testing

📄 **Key Files:**

- [CI/CD Integration](./ci-cd/01-ci-cd-integration.md)

---

### 4. Caching (`caching/`)

Distributed caching infrastructure.

- **Redis Setup**: Upstash Redis configuration
- **Cache Strategy**: TTL, invalidation, warming
- **Performance**: Cache hit rates and optimization

📄 **Key Files:**

- See [Core Systems - Caching](../02-core-systems/caching/) for implementation details

---

### 5. Automation Systems

Background automation and system maintenance.

- **Payment Automation**: Expert transfers and payouts
- **Notification Automation**: Scheduled reminders
- **Cleanup Tasks**: Expired reservations and blocked dates

📄 **Key Files:**

- [Automation Systems](./01-automation-systems.md)

---

### 6. Runtime & Security

Bun runtime migration and encryption architecture.

- **Bun Runtime**: Bun 1.3.4 with Node.js compatibility
- **Encryption**: WorkOS Vault (primary), Bun.CryptoHasher (HMAC)
- **Healthcheck**: Runtime detection and monitoring

📄 **Key Files:**

- [Bun Runtime Migration](./BUN-RUNTIME-MIGRATION.md) ⭐ **Runtime and crypto migration**
- [Encryption Architecture](./ENCRYPTION-ARCHITECTURE.md) ⭐ **Security architecture**

---

## Platform Architecture

### Hosting & Deployment

**Platform**: Vercel (Next.js 16)

- **Regions**: Global Edge Network
- **Deployment**: Git-based continuous deployment
- **Previews**: Automatic preview deployments for PRs

**Database**: Neon.tech (PostgreSQL)

- **Connection**: Serverless Postgres
- **Regions**: Primary in EU
- **Backups**: Automatic daily backups

### External Services

| Service         | Purpose        | Region | Status         |
| --------------- | -------------- | ------ | -------------- |
| **Vercel**      | Hosting & CDN  | Global | 🟢 Operational |
| **Neon**        | Database       | EU     | 🟢 Operational |
| **Upstash**     | Redis & QStash | Global | 🟢 Operational |
| **Stripe**      | Payments       | Global | 🟢 Operational |
| **WorkOS**      | Auth & Vault   | Global | 🟢 Operational |
| **Novu**        | Notifications  | US     | 🟢 Operational |
| **BetterStack** | Monitoring     | EU/US  | 🟢 Operational |

---

## Monitoring & Alerts

### Health Checks

**Primary Health Endpoint**

```bash
curl https://eleva.care/api/healthcheck?services=true
```

**Individual Service Health**

```bash
curl https://eleva.care/api/health/stripe
curl https://eleva.care/api/health/neon-database
curl https://eleva.care/api/health/workos
curl https://eleva.care/api/health/upstash-redis
```

### Alert Configuration

| Priority    | Services                 | Alert Time | Escalation |
| ----------- | ------------------------ | ---------- | ---------- |
| 🔴 Critical | Database, Stripe, WorkOS | Immediate  | 5 min      |
| 🟡 High     | Redis, QStash, Novu     | 2 failures | 10 min     |
| 🟢 Medium   | PostHog, Analytics      | 3 failures | 30 min     |

See [BetterStack Monitoring](./monitoring/01-betterstack-monitoring.md) for complete alert configuration.

---

## Cron Jobs & Automation

### Critical Jobs (Monitored with Heartbeats)

| Job                         | Schedule      | Purpose                   | Priority    |
| --------------------------- | ------------- | ------------------------- | ----------- |
| `process-expert-transfers`  | Every 2 hours | Transfer funds to experts | 🔴 Critical |
| `process-pending-payouts`   | Daily         | Create Stripe payouts     | 🔴 Critical |
| `send-payment-reminders`    | Every 6 hours | Multibanco reminders      | 🔴 Critical |
| `appointment-reminders`     | Daily         | 24h appointment reminders | 🟡 High     |
| `appointment-reminders-1hr` | Hourly        | 1h appointment reminders  | 🟡 High     |

### Maintenance Jobs

| Job                            | Schedule     | Purpose                 |
| ------------------------------ | ------------ | ----------------------- |
| `cleanup-expired-reservations` | Every 15 min | Clean expired slots     |
| `cleanup-blocked-dates`        | Daily        | Clean old blocked dates |
| `keep-alive`                   | Every 5 min  | Serverless warm-up      |

See [Automation Systems](./01-automation-systems.md) for complete job documentation.

---

## Deployment

### Environments

**Production**

- URL: https://eleva.care
- Branch: `main`
- Auto-deploy: On push to main
- Environment: Vercel Production

**Staging/Preview**

- URL: Auto-generated Vercel preview URLs
- Branch: Any non-main branch
- Auto-deploy: On PR creation
- Environment: Vercel Preview

### Deployment Process

1. **Development**: Feature branch → PR
2. **Preview**: Automatic preview deployment
3. **Review**: Code review + QA on preview
4. **Merge**: Merge to main
5. **Production**: Automatic production deployment
6. **Verification**: Health checks and smoke tests

### Environment Variables

**Required for All Environments:**

```bash
# Core Services
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=
CLERK_SECRET_KEY=
STRIPE_SECRET_KEY=
DATABASE_URL=

# Caching & Jobs
UPSTASH_REDIS_REST_URL=
UPSTASH_REDIS_REST_TOKEN=
QSTASH_TOKEN=

# Monitoring
BETTERSTACK_API_TOKEN=
NEXT_PUBLIC_POSTHOG_KEY=
```

See [Deployment Guide](../08-deployment/01-production-migration-guide.md) for complete setup.

---

## Performance & Optimization

### Response Time Targets

| Endpoint Type    | Target     | Alert Threshold |
| ---------------- | ---------- | --------------- |
| API Routes       | < 200ms    | > 1000ms        |
| Page Load        | < 1s (FCP) | > 3s            |
| Database Queries | < 100ms    | > 500ms         |
| Redis Operations | < 50ms     | > 200ms         |
| External APIs    | < 500ms    | > 2000ms        |

### Caching Strategy

- **Redis TTL**: 5 minutes for user data
- **CDN**: Static assets cached at edge
- **React.cache**: Request-level memoization
- **Rate Limiting**: Per-user and per-IP limits

See [Caching Documentation](../02-core-systems/caching/) for details.

---

## Disaster Recovery

### Backup Strategy

**Database Backups**

- **Frequency**: Daily automatic backups (Neon)
- **Retention**: 30 days
- **Testing**: Monthly restore tests

**Configuration Backups**

- **Frequency**: On every change (Git)
- **Retention**: Unlimited (Git history)
- **Recovery**: Redeploy from Git

### Incident Response

1. **Detection**: BetterStack alerts
2. **Notification**: On-call engineer via email/SMS
3. **Assessment**: Check health endpoints and logs
4. **Mitigation**: Follow runbooks
5. **Communication**: Status page updates
6. **Resolution**: Fix and verify
7. **Post-mortem**: Document and improve

---

## Security

### Network Security

- ✅ HTTPS everywhere (TLS 1.3)
- ✅ CORS configured for known origins
- ✅ Rate limiting on all public endpoints
- ✅ DDoS protection via Vercel
- ✅ Bot protection via BotID

### Data Security

- ✅ Encrypted at rest (Neon, Redis)
- ✅ Encrypted in transit (TLS)
- ✅ PCI DSS compliant (via Stripe)
- ✅ GDPR compliant data handling
- ✅ Audit logging for sensitive operations

See [Security Documentation](../06-legal/compliance/) for compliance details.

---

## Troubleshooting

### Common Issues

**High Response Times**

1. Check BetterStack dashboard
2. Review slow query logs
3. Check Redis hit rate
4. Verify external API status

**Failed Cron Jobs**

1. Check QStash dashboard
2. Review heartbeat status
3. Check function logs
4. Verify environment variables

**Database Connection Issues**

1. Check Neon dashboard
2. Verify connection pool
3. Review connection limits
4. Check health endpoint

**Cache Issues**

1. Check Redis health
2. Review cache hit rate
3. Verify TTL settings
4. Check memory usage

---

## Maintenance

### Daily

- [ ] Check BetterStack dashboard for alerts
- [ ] Review error rates in PostHog
- [ ] Verify cron job execution

### Weekly

- [ ] Review performance metrics
- [ ] Check resource utilization
- [ ] Update dependencies
- [ ] Review security alerts

### Monthly

- [ ] Test disaster recovery
- [ ] Review and update documentation
- [ ] Audit access controls
- [ ] Performance optimization review

---

## Related Documentation

- **Core Systems**: [Core Systems Docs](../02-core-systems/README.md)
- **Development**: [Development Guides](../04-development/README.md)
- **Deployment**: [Deployment Guides](../08-deployment/README.md)
- **Legal**: [Compliance Docs](../06-legal/README.md)

---

**Last Updated**: January 2025  
**Maintained By**: DevOps & Engineering Team  
**Questions?** Post in #infrastructure Slack channel
