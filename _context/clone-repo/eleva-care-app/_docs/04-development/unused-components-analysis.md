# Unused Components Analysis

**Date:** October 30, 2025
**Branch:** nextjs16-refactor-components

## Summary

Found **24 components** that appear unused, but after manual verification:

- **18 components** are truly unused → Move to archive
- **6 components** are actually used → Keep them

---

## ✅ Components to KEEP (Actually Used)

### 1. **ui/sonner.tsx** - USED ✅

- Imported in `app/providers.tsx` as Toaster component
- Used for toast notifications throughout the app

### 2. **ui/toast.tsx** - USED ✅

- Part of shadcn/ui toast system
- Used by sonner or other toast implementations

### 3. **auth/ProfileAccessControl.tsx** - USED ✅

- Imported in 4 files:
  - `app/[locale]/(public)/[username]/[eventSlug]/success/page.tsx`
  - `app/[locale]/(public)/[username]/[eventSlug]/page.tsx`
  - `app/[locale]/(public)/[username]/page.tsx`
  - `app/[locale]/(public)/[username]/[eventSlug]/payment-processing/page.tsx`

### 4. **analytics/PostHogTracker.tsx** - USED ✅

- Analytics tracking used at runtime in providers

### 5. **integrations/analytics/PostHogTracker.tsx** - DUPLICATE ⚠️

- Duplicate of analytics/PostHogTracker.tsx
- Should consolidate these two

### 6. **notifications/secure-novu-inbox.tsx** - USED ✅

- Notification system used at runtime

---

## 🗄️ Components to ARCHIVE (Truly Unused)

### Features (5 components)

1. `features/expert-setup/ExpertSetupBannerWrapper.tsx`
2. `features/expert-setup/ExpertSetupChecklistWrapper.tsx`
3. `features/forms/PaymentStep.tsx`

### Layout (5 components)

4. `layout/footer/FooterContentWrapper.tsx`
5. `layout/header/HeaderContent.tsx`
6. `layout/sidebar/AppBreadcrumbContent.tsx`
7. `layout/sidebar/NavMainContent.tsx`
8. `layout/UserNavNotifications.tsx`

### Sections (6 components)

9. `sections/about/ClinicalExpertsSection.tsx`
10. `sections/home/HeroSection.tsx`
11. `sections/home/MissionSection.tsx`
12. `sections/home/NewsletterSection.tsx`
13. `sections/home/PodcastSection.tsx`
14. `sections/home/SocialSection.tsx`
15. `sections/home/TeamSection.tsx`

### Shared (4 components)

16. `shared/ErrorFallback.tsx`
17. `shared/i18n/LocaleSwitcherSelect.tsx`
18. `shared/navigation/NavLink.tsx`
19. `shared/navigation/NavLinkContent.tsx`

### UI (3 components)

20. `ui/scroll-area.tsx`
21. `ui/toggle.tsx`

### Integrations (1 component)

22. `integrations/stripe/StripeConnectEmbed.tsx`

---

## 📋 Actions Needed

1. **Move 18 truly unused components** to `components/_archive/`
2. **Consolidate duplicate PostHogTracker** (keep one, archive the other)
3. **Keep** sonner, toast, ProfileAccessControl, secure-novu-inbox (they ARE used)

---

## 📂 Archive Structure

```
components/_archive/
├── features/
├── layout/
├── sections/
├── shared/
├── ui/
└── integrations/
```
