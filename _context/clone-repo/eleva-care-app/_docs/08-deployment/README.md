# Deployment Documentation

This directory contains guides and documentation related to deploying and managing the Eleva Care application in production environments.

## Contents

- `01-production-migration-guide.md` - Comprehensive guide for production migrations and deployments

## Deployment Environments

### Production

- **Platform**: Vercel
- **Domain**: eleva.care
- **Database**: Neon (PostgreSQL)
- **Cache**: Upstash Redis
- **CDN**: Vercel Edge Network

### Preview

- **Platform**: Vercel Preview Deployments
- **Automatic deployment**: On pull requests
- **Testing**: Full feature testing before production

## Key Processes

1. **Database Migrations**: Using Drizzle ORM
2. **Environment Variables**: Secure configuration management
3. **Health Checks**: Automated monitoring and alerting
4. **Rollback Procedures**: Safe deployment rollback strategies

## Related Documentation

- See `03-infrastructure/` for infrastructure setup
- See `02-core-systems/` for system-specific deployment notes
