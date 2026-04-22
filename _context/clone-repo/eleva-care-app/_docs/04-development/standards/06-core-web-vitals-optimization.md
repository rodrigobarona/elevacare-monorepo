# 🎯 Core Web Vitals Optimization Guide

**For:** Developers optimizing page performance  
**Status:** ✅ Production Ready  
**Last Updated:** December 2025

---

## Overview

This guide documents the Core Web Vitals optimizations implemented on the Eleva Care homepage and provides reusable patterns for other pages like user profiles (`[username]`) and booking pages (`[eventSlug]`).

### What are Core Web Vitals?

Core Web Vitals are Google's essential metrics for user experience:

| Metric | Full Name | Good | Needs Improvement | Poor |
|--------|-----------|------|-------------------|------|
| **LCP** | Largest Contentful Paint | < 2.5s | 2.5s - 4.0s | > 4.0s |
| **FID/INP** | First Input Delay / Interaction to Next Paint | < 100ms | 100ms - 300ms | > 300ms |
| **CLS** | Cumulative Layout Shift | < 0.1 | 0.1 - 0.25 | > 0.25 |
| **TTFB** | Time to First Byte | < 800ms | 800ms - 1800ms | > 1800ms |
| **FCP** | First Contentful Paint | < 1.8s | 1.8s - 3.0s | > 3.0s |

---

## 📊 Results Achieved (Homepage)

### Before Optimization

| Metric | Value | Status |
|--------|-------|--------|
| TTFB | ~570ms | ✅ Good |
| FCP | ~2660ms | ❌ Poor |
| LCP | ~3680ms | ❌ Poor |
| CLS | 0.96 | ❌ Poor |

### After Optimization

| Metric | Value | Status | Improvement |
|--------|-------|--------|-------------|
| TTFB | ~415ms | ✅ Excellent | ↓ 27% |
| FCP | ~1044ms | ✅ Excellent | ↓ 61% |
| LCP | ~1312ms | ✅ Excellent | ↓ 64% |
| CLS | Not detected | ✅ Excellent | ✅ Fixed |

---

## 🔧 Optimizations Implemented

### 1. Hero Section - Preventing CLS

**Problem:** Hero section had no fixed height, causing layout shifts when images/video load.

**Solution:** Add minimum height to reserve space before content loads.

```typescript
// src/components/sections/home/Hero.tsx
const Hero = async () => {
  return (
    <section
      // Reserve vertical space to prevent CLS
      // Mobile: 600px, Desktop: 720px
      className="relative m-2 min-h-[600px] overflow-hidden rounded-2xl bg-eleva-neutral-900 lg:min-h-[720px]"
      data-component-name="hero"
    >
      {/* Content */}
    </section>
  );
};
```

**Key Points:**
- Use `min-h-[Xpx]` instead of `h-[Xpx]` to allow content flexibility
- Match skeleton dimensions to actual component dimensions
- Use responsive values (`lg:min-h-[720px]`)

---

### 2. Header - Fixed Height to Prevent Layout Shifts

**Problem:** Header changed padding on scroll, causing 24px layout shift.

**Solution:** Use fixed height with only visual changes (background color).

```typescript
// src/components/layout/header/HeaderContent.tsx
return (
  <header
    // Fixed height prevents CLS - use consistent padding with visual changes only
    // Header always reserves the same space (80px on mobile, 96px on desktop)
    className={`fixed z-50 flex h-20 w-full items-center justify-between px-6 
      transition-colors duration-200 lg:h-24 lg:px-8 ${
      isRootPath && !isScrolled
        ? 'bg-transparent'
        : 'bg-white/20 backdrop-blur-md'
    }`}
  >
    {/* Use explicit dimensions for logo to prevent shifts */}
    <Link
      href="/"
      className={`flex h-8 w-[160px] items-center lg:h-12 lg:w-[240px]`}
    >
      <ElevaCareLogo
        className="h-8 w-[160px] lg:h-12 lg:w-[240px]"
        variant={isRootPath && !isScrolled ? 'white' : 'default'}
      />
    </Link>
  </header>
);
```

**Key Points:**
- Use fixed `h-X` classes for header height
- Only change visual properties (colors, opacity) on scroll
- Set explicit `w-[Xpx]` and `h-[Xpx]` for logo container

---

### 3. Video Player - CSS Overrides for Mux Player

**Problem:** Mux video player enforces aspect ratio, causing CLS when it loads.

**Solution:** CSS overrides to disable default aspect ratio behavior.

```css
/* src/app/globals.css */

/**
 * Mux Player CLS Fix
 * Override the default aspect ratio behavior of the Mux player
 * to prevent Cumulative Layout Shift when video loads
 */
[data-component-name="hero"] mux-player {
  aspect-ratio: unset !important;
  width: 100% !important;
  height: 100% !important;
  position: absolute !important;
  inset: 0 !important;
}

/* Target the internal media container */
[data-component-name="hero"] mux-player::part(container) {
  aspect-ratio: unset !important;
}

/* Target the video element itself */
[data-component-name="hero"] mux-player video {
  object-fit: cover !important;
  width: 100% !important;
  height: 100% !important;
}
```

**Video Component Configuration:**

```typescript
// src/components/sections/home/HeroVideo.tsx
// Import from /lazy for automatic code splitting
import MuxVideo from '@mux/mux-player-react/lazy';

<MuxVideo
  playbackId={MUX_PLAYBACK_ID}
  streamType="on-demand"
  autoPlay="muted"
  loop
  muted
  playsInline
  // Note: @mux/mux-player-react/lazy handles lazy loading automatically
  disableTracking
  disableCookies
  className="absolute inset-0 z-1 h-full w-full rounded-2xl object-cover"
  style={{
    '--controls': 'none',
    '--media-object-fit': 'cover',
    '--media-object-position': 'center',
    aspectRatio: 'unset',
    position: 'absolute',
    inset: '0',
  }}
/>
```

---

### 4. Skeleton Components - Match Actual Dimensions

**Problem:** Loading skeletons didn't match actual component dimensions, causing shifts when content loads.

**Solution:** Ensure skeletons have identical layout to final components.

```typescript
// src/components/shared/loading/HomePageSkeletons.tsx

/**
 * Hero section skeleton - MUST match Hero.tsx dimensions
 */
export function HeroSkeleton() {
  return (
    <section className="relative m-2 min-h-[600px] overflow-hidden rounded-2xl 
      bg-eleva-neutral-200 lg:min-h-[720px]">
      {/* Skeleton content matching Hero structure */}
    </section>
  );
}

/**
 * Approach section skeleton - MUST match ApproachSection layout
 * Including negative margins and gradient
 */
export function ApproachSkeleton() {
  return (
    <section className="relative -mt-20 w-full bg-linear-to-b 
      from-eleva-neutral-900 to-eleva-neutral-800 px-6 py-12 md:py-24 
      lg:-mt-32 lg:px-8 lg:py-32">
      {/* Skeleton content */}
    </section>
  );
}
```

**Skeleton Checklist:**
- [ ] Same `min-height` / `height` values
- [ ] Same margin values (including negative margins)
- [ ] Same padding values
- [ ] Same background color/gradient
- [ ] Same border-radius
- [ ] Same grid/flex layout structure

---

### 5. Image Optimization for LCP

**Problem:** Hero image not prioritized, causing slow LCP.

**Solution:** Use Next.js Image with proper priority and sizing.

```typescript
// src/components/sections/home/Hero.tsx
<Image
  src={MUX_POSTER_URL}
  alt="Eleva Care Hero"
  fill
  priority                    // Preload this image
  fetchPriority="high"        // Browser hint for priority
  quality={75}                // Balance quality vs. size
  className="rounded-2xl object-cover"
  // Provide accurate sizes for responsive images
  sizes="(max-width: 768px) 100vw, (max-width: 1200px) 100vw, 1920px"
/>
```

**Key Points:**
- Use `priority` for above-the-fold LCP images
- Use `fetchPriority="high"` for browser hints
- Provide accurate `sizes` attribute for responsive loading
- Use reasonable `quality` (75 is good balance)

---

### 6. Font Loading Optimization

**Problem:** Non-critical fonts being preloaded, blocking render.

**Solution:** Disable preload for secondary fonts.

```typescript
// src/app/layout.tsx
const dmSans = DM_Sans({
  subsets: ['latin'],
  variable: '--font-dm-sans',
  display: 'swap',            // Show fallback font immediately
  adjustFontFallback: true,   // Adjust metrics to reduce CLS
  preload: true,              // Preload primary font
});

const ibmPlexMono = IBM_Plex_Mono({
  subsets: ['latin'],
  weight: ['400', '500'],
  variable: '--font-ibm-plex-mono',
  display: 'swap',
  adjustFontFallback: true,
  preload: false,             // Don't preload secondary font
});
```

---

## 📋 Patterns for Other Pages

### Pattern 1: Profile Page (`[username]`)

**Current Implementation:**

```typescript
// src/app/(marketing)/[locale]/[username]/page.tsx
<div className="container max-w-7xl pb-10 pt-32">
  <div className="grid grid-cols-1 gap-8 md:grid-cols-[400px_1fr]">
    <React.Suspense fallback={<ProfileColumnSkeleton />}>
      <ProfileInfo {...props} />
    </React.Suspense>
    {/* ... */}
  </div>
</div>
```

**Recommended Optimizations:**

```typescript
// 1. Add explicit dimensions to profile image container
<div className="relative aspect-18/21 w-full overflow-hidden rounded-lg">
  <Image
    src={profileImage}
    alt={displayName}
    fill
    priority                  // Add priority for LCP
    fetchPriority="high"      // Add fetch priority
    className="object-cover"
    sizes="(max-width: 768px) 100vw, 400px"  // Add accurate sizes
  />
</div>

// 2. Reserve space for content sections
<div className="space-y-6 min-h-[200px]">  {/* Add min-height */}
  {/* Profile content */}
</div>

// 3. Update skeleton to match exact dimensions
export function ProfileColumnSkeleton() {
  return (
    <div className="space-y-6">
      {/* Match aspect-18/21 from actual component */}
      <Skeleton className="aspect-18/21 w-full rounded-lg" />
      <div className="space-y-12 min-h-[200px]">
        <Skeleton className="h-8 w-3/4" />
        <Skeleton className="h-4 w-1/2" />
      </div>
    </div>
  );
}
```

---

### Pattern 2: Booking Page (`[eventSlug]`)

**Current Implementation:**

```typescript
// src/app/(marketing)/[locale]/[username]/[eventSlug]/page.tsx
<Suspense fallback={<CalendarLoadingSkeleton />}>
  <CalendarWithAvailability {...props} />
</Suspense>
```

**Recommended Optimizations:**

```typescript
// 1. Use fixed container dimensions
<div className="mx-auto flex max-w-5xl flex-col items-center justify-center 
  min-h-[600px] p-4 md:min-h-[700px] md:p-6">  {/* Add min-height */}
  <CardContent className="p-0 pt-8 w-full">
    <Suspense fallback={<CalendarLoadingSkeleton />}>
      <CalendarWithAvailability {...props} />
    </Suspense>
  </CardContent>
</div>

// 2. Update skeleton with matching dimensions
function CalendarLoadingSkeleton() {
  return (
    <div className="w-full min-h-[500px] space-y-4">
      {/* Calendar header skeleton */}
      <div className="flex justify-between items-center">
        <Skeleton className="h-8 w-32" />
        <Skeleton className="h-8 w-24" />
      </div>
      {/* Calendar grid skeleton - match actual grid structure */}
      <div className="grid grid-cols-7 gap-2">
        {Array.from({ length: 35 }).map((_, i) => (
          <Skeleton key={i} className="h-10 w-10 rounded-md" />
        ))}
      </div>
      {/* Time slots skeleton */}
      <div className="grid grid-cols-3 gap-2 mt-4">
        {Array.from({ length: 9 }).map((_, i) => (
          <Skeleton key={i} className="h-10 rounded-md" />
        ))}
      </div>
    </div>
  );
}
```

---

## 🔍 Monitoring & Measurement

### Browser Console Metrics

Sentry automatically logs Core Web Vitals. Look for these messages:

```
Sentry Logger [log]: [Measurement] Setting measurement on root span: ttfb = 415 millisecond
Sentry Logger [log]: [Measurement] Setting measurement on root span: lcp = 1312 millisecond
Sentry Logger [log]: [Measurement] Setting measurement on root span: fp = 1044 millisecond
Sentry Logger [log]: [Measurement] Setting measurement on root span: fcp = 1044 millisecond
```

### Chrome DevTools

1. **Performance Panel:**
   - Open DevTools → Performance
   - Click "Start profiling and reload page"
   - Look for "Layout Shift" entries in the timeline

2. **Lighthouse:**
   - Open DevTools → Lighthouse
   - Run audit with "Performance" checked
   - Review CLS, LCP, FCP scores

3. **Web Vitals Extension:**
   - Install [Web Vitals Chrome Extension](https://chrome.google.com/webstore/detail/web-vitals/ahfhijdlegdabablpippeagghigmibma)
   - Real-time Core Web Vitals display

### Programmatic Measurement

```typescript
// Add to instrumentation-client.ts for custom tracking
import * as Sentry from '@sentry/nextjs';

// Track custom performance marks
performance.mark('hero-visible');
performance.measure('hero-load-time', 'navigationStart', 'hero-visible');

// Report to Sentry
const heroMeasure = performance.getEntriesByName('hero-load-time')[0];
Sentry.setMeasurement('hero-load-time', heroMeasure.duration, 'millisecond');
```

---

## ✅ Optimization Checklist

### Before Deploying a New Page

- [ ] **Images:**
  - [ ] Above-the-fold images have `priority` and `fetchPriority="high"`
  - [ ] All images have explicit `width` and `height` OR use `fill` with sized container
  - [ ] Images have accurate `sizes` attribute for responsive loading
  - [ ] Image quality is optimized (75 is good default)

- [ ] **Layout:**
  - [ ] Container elements have `min-height` to reserve space
  - [ ] No padding/margin changes on scroll or state changes
  - [ ] Fixed header height (if applicable)
  - [ ] Explicit dimensions on logo/brand elements

- [ ] **Skeletons:**
  - [ ] Skeleton dimensions match actual component dimensions
  - [ ] Skeleton has same margin/padding as actual component
  - [ ] Skeleton layout structure matches actual component

- [ ] **Video/Media:**
  - [ ] Video players use lazy imports (e.g., `@mux/mux-player-react/lazy`)
  - [ ] CSS overrides prevent aspect ratio enforcement
  - [ ] Poster image loads immediately

- [ ] **Fonts:**
  - [ ] Primary fonts have `preload: true`
  - [ ] Secondary fonts have `preload: false`
  - [ ] All fonts have `display: 'swap'`
  - [ ] All fonts have `adjustFontFallback: true`

---

## 📚 Related Documentation

- [Bundle Optimization Report](./04-bundle-optimization-report.md)
- [Build Optimization Guide](./05-build-optimization-guide.md)
- [Server/Client Composition](../server-client-composition.md)

---

**Maintained By:** Engineering Team  
**Last Updated:** December 2025

