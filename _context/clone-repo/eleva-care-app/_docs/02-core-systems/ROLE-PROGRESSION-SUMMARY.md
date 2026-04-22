# ✨ Eleva Role Progression System - Executive Summary

**Created:** November 6, 2025  
**Status:** 📋 Design Complete - Ready for Implementation

---

## 🎯 What We Built

A comprehensive **role-based progression system** for Eleva, inspired by Airbnb's successful multi-sided marketplace model, combining:

- **WorkOS RBAC** for authentication and authorization
- **Stripe Subscriptions** for monetization
- **Dynamic Navigation** based on user roles
- **Performance Metrics** for tier progression

---

## 🏆 Role Hierarchy (5 Tiers)

### 1. **Patient/Client** (Free)

_Like Airbnb Guest_

**Entry:** Default for all registrations  
**Access:** Browse, book, review, basic profile

---

### 2. **Community Expert** (20% commission or $490/year + 12%)

_Like Airbnb Host_

**Entry:** Application + Approval  
**Requirements:**

- ✅ Professional credentials verified
- ✅ Stripe Identity check
- ✅ Complete onboarding

**Pricing Options:**

- **Commission-Based:** $0/month + 20% per booking
- **Annual Subscription:** $490/year + 12% per booking (save up to 40%)

**New Features:**

- Create up to 5 services
- Manage calendar & availability
- Receive bookings & payouts
- Basic analytics
- Email support
- 30-day free trial (commission-based)

---

### 3. **Top Expert** (15% commission or $1,490/year + 8%)

_Like Airbnb Superhost_

**Entry:** Earned through performance (evaluated quarterly)  
**Requirements:**

- ⭐ 4.8/5.0+ rating
- 📅 25+ completed appointments/90 days
- 💯 <5% cancellation rate
- 📊 90%+ response rate
- ✨ Promoted profile link
- 🎖️ 3+ months as Community Expert

**Pricing Options:**

- **Commission-Based:** $0/month + 15% per booking
- **Annual Subscription:** $1,490/year + 8% per booking (save up to 40%)

**Premium Features:**

- **Top Expert Badge** on profile
- Unlimited services
- Featured placement in search
- Advanced analytics
- Custom branding
- Group sessions
- Direct messaging
- Priority support
- Industry-leading 8-15% commission
- VIP annual benefits

---

### 4. **Lecturer** (+$49/month addon)

_Like Airbnb Experiences_

**Entry:** Any Expert can apply  
**New Platform:**

- Create & sell courses
- Host live webinars
- LMS access
- Student management
- 5% course commission

---

### 5. **Enterprise** (Custom pricing)

_Like Airbnb for Work_

**Entry:** B2B onboarding  
**Features:**

- Custom subdomain (e.g., `clinic-name.eleva.care`)
- White-label branding
- Team management
- API access
- SSO integration
- Dedicated support

---

## 💡 Key Innovations

### 1. **Performance-Based Progression**

- Automated quarterly evaluations
- Transparent metrics tracking
- Grace period before demotion
- Encourages quality service

### 2. **Flexible Monetization**

- Choose subscription OR commission
- Add-on modules (eLearning)
- Trial periods for new experts
- Enterprise custom pricing

### 3. **Dynamic Permissions**

- Granular permission system
- Role-based sidebar navigation
- Client & server-side checks
- Future-proof for new features

### 4. **Airbnb-Inspired UX**

- Clear progression path
- Achievement-based badges
- Featured placements
- Quality incentives

---

## 📊 Evaluation Metrics (Top Expert)

Automated quarterly review checks:

| Metric                   | Target   | Weight |
| ------------------------ | -------- | ------ |
| Average Rating           | ≥4.8/5.0 | High   |
| Completed Bookings (90d) | ≥25      | High   |
| Cancellation Rate        | <5%      | High   |
| Response Rate (24h)      | ≥90%     | Medium |
| Active Days (90d)        | 80%+     | Medium |
| Time as Expert           | 90+ days | Low    |

**Grace Period:** 1 month warning before demotion

---

## 🗂️ Documentation Created

### 1. **ROLE-PROGRESSION-SYSTEM.md** (Main Design)

- Complete role definitions
- Stripe subscription plans
- WorkOS RBAC structure
- Navigation access control
- Metrics tracking
- Evaluation system
- Implementation roadmap
- Success metrics & KPIs

### 2. **RBAC-SIDEBAR-IMPLEMENTATION.md** (Technical Guide)

- Permission definitions (50+ permissions)
- RBAC middleware functions
- Client-side auth hooks
- Dynamic sidebar component
- API route protection
- Usage examples
- Testing guidelines
- Best practices

---

## 🚀 Implementation Roadmap

### **Phase 1: Foundation** (Week 1-2) - 🎯 START HERE

- [ ] Update user roles in `schema-workos.ts`
- [ ] Implement permission system (`lib/auth/permissions.ts`)
- [ ] Create RBAC middleware (`lib/auth/rbac-middleware.ts`)
- [ ] Build client auth hook (`hooks/use-auth-role.ts`)
- [ ] Update sidebar to use dynamic navigation
- [ ] Integrate Stripe subscription products
- [ ] Build expert application flow

### **Phase 2: Metrics & Progression** (Week 3-4)

- [ ] Create `ExpertMetricsTable` schema
- [ ] Build metrics tracking system
- [ ] Implement automated Top Expert evaluation
- [ ] Create cron job for quarterly reviews
- [ ] Build notification system for status changes
- [ ] Add Top Expert badge UI

### **Phase 3: eLearning Module** (Month 2-3)

- [ ] Add Lecturer role
- [ ] Build course management system (LMS)
- [ ] Integrate video hosting
- [ ] Student enrollment system
- [ ] Webinar scheduling
- [ ] Course analytics

### **Phase 4: Enterprise** (Month 4-6)

- [ ] Multi-tenancy architecture
- [ ] Subdomain routing
- [ ] White-label branding system
- [ ] Team management
- [ ] API development
- [ ] WorkOS SSO integration

---

## 💻 Quick Start: Implementation Steps

### 1. **Update Database Schema**

```typescript
// Add to drizzle/schema-workos.ts

export type UserRole =
  | 'patient'
  | 'expert_community'
  | 'expert_top'
  | 'expert_lecturer'
  | 'enterprise_admin'
  | 'enterprise_member'
  | 'admin'
  | 'moderator';

export const ExpertMetricsTable = pgTable('expert_metrics', {
  // See ROLE-PROGRESSION-SYSTEM.md for full schema
});
```

### 2. **Create Permission System**

Copy from `RBAC-SIDEBAR-IMPLEMENTATION.md`:

- `lib/auth/permissions.ts`
- `lib/auth/rbac-middleware.ts`
- `hooks/use-auth-role.ts`

### 3. **Update Navigation**

- Copy `config/navigation.ts`
- Update `components/layout/sidebar/DynamicSidebar.tsx`

### 4. **Protect Routes**

```typescript
// Example: app/(private)/expert/services/page.tsx
import { requirePermission } from '@/lib/auth/rbac-middleware';

export default async function ExpertServicesPage() {
  const { user } = await requirePermission('services.create');
  // ...
}
```

### 5. **Setup Stripe Subscriptions**

```bash
# Create products via Stripe CLI or Dashboard
./stripe products create --name="Community Expert" --description="$29/month"
./stripe prices create \
  -d "product=prod_XXXXX" \
  -d "unit_amount=2900" \
  -d "currency=usd" \
  -d "recurring[interval]=month"
```

---

## 📈 Expected Outcomes

### User Growth

- **Patient → Expert:** 15% conversion target
- **Community → Top Expert:** 20% conversion target
- **Expert Retention:** 85% at 12 months

### Quality Metrics

- **Average Rating:** >4.5/5.0
- **Booking Completion:** >92%
- **Response Time:** <2 hours

### Revenue

- **Subscription MRR:** 15% MoM growth
- **ARPU:** $150/month per expert
- **Churn:** <5%

---

## 🔧 Next Actions

1. **Review & Approve Design**
   - [ ] Product team reviews role definitions
   - [ ] Legal reviews expert terms
   - [ ] Finance approves pricing model

2. **Technical Setup**
   - [ ] Create Stripe products
   - [ ] Configure WorkOS roles
   - [ ] Set up development database

3. **Begin Implementation**
   - [ ] Create Phase 1 tickets in project management
   - [ ] Assign developers
   - [ ] Set sprint goals

4. **Analytics Setup**
   - [ ] Define tracking events
   - [ ] Set up dashboards
   - [ ] Create reports

---

## 📚 Resources

- **Main Design:** `docs/02-core-systems/ROLE-PROGRESSION-SYSTEM.md`
- **Implementation:** `docs/02-core-systems/RBAC-SIDEBAR-IMPLEMENTATION.md`
- **WorkOS Docs:** https://workos.com/docs/authkit/roles-and-permissions
- **Stripe Subscriptions:** https://stripe.com/docs/billing/subscriptions
- **Airbnb Superhost:** https://www.airbnb.com/help/article/828

---

## ❓ FAQs

**Q: Why quarterly evaluation instead of monthly?**  
A: Provides stability and reduces anxiety. Experts need time to adjust and improve. Airbnb uses similar cadence.

**Q: Can a Top Expert be demoted?**  
A: Yes, if metrics fall below threshold. But there's a 1-month grace period to improve.

**Q: What if an expert doesn't want subscription, prefers commission only?**  
A: Great question! We should offer both: either flat subscription OR commission-only at a higher rate (20% vs 10/15%). Add this option.

**Q: How do we prevent gaming the system?**  
A: Multiple metrics balance each other. Can't fake response rate AND booking volume AND ratings simultaneously.

**Q: What about experts in multiple specialties?**  
A: One role applies to the account. They can offer multiple services under that role.

---

## 🎉 Comparison with Airbnb

| Feature            | Airbnb            | Eleva              |
| ------------------ | ----------------- | ------------------ |
| Base User          | Guest             | Patient            |
| Provider Tier 1    | Host              | Community Expert   |
| Provider Tier 2    | Superhost         | Top Expert         |
| Alt Services       | Experiences       | eLearning/Lecturer |
| B2B Platform       | Airbnb for Work   | Eleva for Clinics  |
| Evaluation         | Quarterly         | Quarterly          |
| Progression        | Performance-based | Performance-based  |
| Badge System       | ✅                | ✅                 |
| Featured Placement | ✅                | ✅                 |

---

**Questions? Issues?**  
Reach out to the tech lead or product manager.

---

_This is a living document. Updates will be made as implementation progresses._
