# 🚀 Eleva Care Quick Start Guide

> **Get up and running with the Eleva Care platform in under 30 minutes**

## 📋 Prerequisites

- **Node.js** 18+ and **npm** or **pnpm**
- **Git** for version control
- **PostgreSQL** database (local or cloud)
- **Redis** instance (local or cloud)
- **Stripe** account for payments
- **Clerk** account for authentication
- **Novu** account for notifications

## ⚡ Quick Setup (5 minutes)

### 1. Clone and Install

```bash
git clone https://github.com/your-org/eleva-care-app.git
cd eleva-care-app
npm install
```

### 2. Environment Setup

```bash
cp .env.example .env.local
# Edit .env.local with your credentials
```

### 3. Database Setup

```bash
npm run db:push
npm run db:seed
```

### 4. Start Development

```bash
npm run dev
```

Visit `http://localhost:3000` to see the application running.

## 🔧 Essential Configuration

### Required Environment Variables

```env
# Database
DATABASE_URL="postgresql://..."

# Authentication (Clerk)
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY="pk_..."
CLERK_SECRET_KEY="sk_..."

# Payments (Stripe)
STRIPE_SECRET_KEY="sk_..."
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY="pk_..."

# Notifications (Novu)
NOVU_API_KEY="..."
NEXT_PUBLIC_NOVU_APPLICATION_IDENTIFIER="..."

# Caching (Redis)
REDIS_URL="redis://..."
```

## 🏗️ System Architecture Overview

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Frontend      │    │   Backend       │    │   External      │
│   (Next.js)     │◄──►│   (API Routes)  │◄──►│   Services      │
│                 │    │                 │    │                 │
│ • React         │    │ • Drizzle ORM   │    │ • Stripe        │
│ • TypeScript    │    │ • PostgreSQL    │    │ • Clerk         │
│ • Tailwind CSS  │    │ • Redis Cache   │    │ • Novu          │
│ • PostHog       │    │ • Webhooks      │    │ • PostHog       │
└─────────────────┘    └─────────────────┘    └─────────────────┘
```

## 🎯 Core Features

### 1. **Expert Marketplace**

- Expert profile management
- Service listings and booking
- Payment processing
- Review system

### 2. **Appointment System**

- Real-time scheduling
- Calendar integration
- Automated reminders
- Buffer time management

### 3. **Payment Processing**

- Stripe integration
- Multiple payment methods
- Automatic payouts
- Transaction tracking

### 4. **Notification System**

- Multi-channel delivery (email, SMS, in-app)
- Workflow automation
- Real-time updates
- Localization support

## 📚 Next Steps

### For New Developers

1. **Read the API Overview**: [02-api-overview.md](./02-api-overview.md)
2. **Understand Core Systems**: [../02-core-systems/README.md](../02-core-systems/README.md)
3. **Review Testing Guide**: [../04-development/testing/01-testing-guide.md](../04-development/testing/01-testing-guide.md)

### For Frontend Developers

1. **UI/UX Guidelines**: [../04-development/ui-ux/01-dashboard-forms-design.md](../04-development/ui-ux/01-dashboard-forms-design.md)
2. **Component Standards**: [../04-development/ui-ux/02-react-hook-form-fixes.md](../04-development/ui-ux/02-react-hook-form-fixes.md)

### For Backend Developers

1. **Payment System**: [../02-core-systems/payments/01-payment-flow-analysis.md](../02-core-systems/payments/01-payment-flow-analysis.md)
2. **Authentication**: [../02-core-systems/authentication/01-clerk-configuration.md](../02-core-systems/authentication/01-clerk-configuration.md)
3. **Caching Strategy**: [../02-core-systems/caching/01-redis-implementation.md](../02-core-systems/caching/01-redis-implementation.md)

### For DevOps Engineers

1. **CI/CD Setup**: [../03-infrastructure/ci-cd/01-ci-cd-integration.md](../03-infrastructure/ci-cd/01-ci-cd-integration.md)
2. **Monitoring**: [../03-infrastructure/monitoring/01-health-check-monitoring.md](../03-infrastructure/monitoring/01-health-check-monitoring.md)

## 🔍 Common Commands

```bash
# Development
npm run dev              # Start development server
npm run build           # Build for production
npm run start           # Start production server

# Database
npm run db:push         # Push schema changes
npm run db:studio       # Open Drizzle Studio
npm run db:seed         # Seed database

# Testing
npm run test            # Run all tests
npm run test:critical   # Run critical tests only
npm run test:watch      # Run tests in watch mode

# Code Quality
npm run lint            # Run ESLint
npm run type-check      # Run TypeScript checks
npm run format          # Format code with Prettier
```

## 🆘 Troubleshooting

### Common Issues

**Database Connection Issues**

```bash
# Check database URL format
echo $DATABASE_URL
# Reset database
npm run db:reset
```

**Authentication Problems**

```bash
# Verify Clerk keys
echo $NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY
echo $CLERK_SECRET_KEY
```

**Build Failures**

```bash
# Clear cache and reinstall
rm -rf .next node_modules
npm install
npm run build
```

### Getting Help

- **Documentation**: Check the relevant section in [../README.md](../README.md)
- **Issues**: Create a GitHub issue with the "help wanted" label
- **Team Chat**: Ask in the development channel
- **Code Review**: Request review from team leads

## 📊 Development Workflow

1. **Create Feature Branch**: `git checkout -b feature/your-feature`
2. **Make Changes**: Follow coding standards and write tests
3. **Run Tests**: `npm run test:critical`
4. **Commit Changes**: Use conventional commit messages
5. **Push and PR**: Create pull request with description
6. **Review Process**: Address feedback and merge

---

**Last updated**: January 1, 2025 | **Next review**: February 1, 2025
