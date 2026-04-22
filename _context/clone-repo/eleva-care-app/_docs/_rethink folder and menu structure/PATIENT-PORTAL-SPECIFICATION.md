# Patient Portal & Review System Specification

**Version:** 1.0  
**Date:** November 12, 2025  
**Status:** 🎨 Design Proposal  
**Priority:** High

---

## Executive Summary

This document defines the **Patient Portal** - a dedicated dashboard for patients to:

- ✅ View and manage their appointments
- ✅ Access session summaries and notes
- ✅ Update personal information
- ✅ Manage preferences and settings
- ✅ **Submit reviews and ratings** (like Airbnb)
- ✅ View billing and payment history
- 🔮 Future: Access learning content (LMS)

---

## Navigation Structure

### Patient Dashboard

```
🏠 Patient Portal
├─ 📊 Overview
│  └── /patient/dashboard
│      ├── Upcoming appointments
│      ├── Recent session summaries
│      ├── Quick actions
│      └── Recommended experts
│
├─ 📅 My Appointments
│  └── /patient/appointments
│      ├── /patient/appointments/upcoming      # Default view
│      ├── /patient/appointments/past
│      ├── /patient/appointments/[id]          # Appointment details
│      │   ├── Session summary/notes
│      │   ├── Reschedule/Cancel
│      │   ├── Join video call
│      │   └── Leave review (after session) 🆕
│      └── /patient/appointments/calendar      # Calendar view
│
├─ 📝 Session Notes
│  └── /patient/sessions
│      ├── /patient/sessions                   # All sessions list
│      └── /patient/sessions/[id]              # Session details
│          ├── Expert notes (shared)
│          ├── Recommendations
│          ├── Homework/exercises
│          └── Related resources
│
├─ ⭐ My Reviews
│  └── /patient/reviews
│      ├── /patient/reviews                    # All my reviews
│      ├── /patient/reviews/pending            # Pending reviews
│      └── /patient/reviews/[id]               # Edit review
│
├─ 👥 My Experts
│  └── /patient/experts
│      ├── /patient/experts                    # Experts I've worked with
│      └── /patient/experts/[username]         # Expert profile + review
│
├─ 💳 Billing
│  └── /patient/billing
│      ├── /patient/billing/payments           # Payment history
│      ├── /patient/billing/invoices           # Invoices
│      └── /patient/billing/methods            # Payment methods
│
├─ 👤 Profile
│  └── /patient/profile
│      ├── Personal information
│      ├── Health information (optional)
│      ├── Emergency contact
│      └── Privacy settings
│
└─ ⚙️ Settings
   └── /patient/settings
       ├── Notifications
       ├── Privacy preferences
       ├── Communication preferences
       └── Account security
```

---

## Review System (Like Airbnb)

### Overview

Implement a **post-session review system** that allows patients to rate and review their experience with experts, similar to Airbnb's guest review system.

### Key Features

1. **Automatic Review Prompts**
   - Send review request 24 hours after session ends
   - Email + in-app notification
   - Show banner in patient dashboard

2. **Two-Way Review System** (Optional - Future)
   - Patients review experts
   - Experts can leave feedback notes (private)
   - Both published simultaneously

3. **Review Components**
   - Overall rating (1-5 stars)
   - Category ratings (optional)
   - Written review
   - Tags/highlights

4. **Review Display**
   - Expert public profile
   - Average rating calculation
   - Recent reviews section
   - Verified badge for reviewed sessions

---

## Data Model

### Review Entity

```typescript
interface Review {
  id: string;

  // Relationships
  patientId: string; // Patient who left review
  expertId: string; // Expert being reviewed
  appointmentId: string; // Specific appointment
  organizationId?: string; // If part of partner

  // Rating (1-5 stars)
  overallRating: number; // Required: 1, 2, 3, 4, or 5

  // Category Ratings (optional)
  categoryRatings?: {
    professionalism?: number; // 1-5
    communication?: number; // 1-5
    effectiveness?: number; // 1-5
    environment?: number; // 1-5 (for in-person)
  };

  // Review Content
  title?: string; // Short title (optional)
  comment: string; // Required: detailed review
  highlights?: string[]; // Tags: ['Great listener', 'Very helpful', 'Punctual']

  // Media (optional - future)
  photos?: string[]; // Photo URLs

  // Metadata
  isAnonymous: boolean; // Hide patient name
  isVerified: boolean; // Confirmed attended session

  // Response (expert can respond)
  expertResponse?: {
    comment: string;
    respondedAt: Date;
  };

  // Moderation
  status: 'pending' | 'published' | 'flagged' | 'removed';
  flagReason?: string;
  moderatedBy?: string;
  moderatedAt?: Date;

  // Helpfulness
  helpfulCount: number; // Users who found review helpful
  reportCount: number; // Users who reported review

  // Timestamps
  createdAt: Date;
  updatedAt: Date;
  publishedAt?: Date;
}

// Review Tags/Highlights
const REVIEW_HIGHLIGHTS = [
  // Positive
  'Great listener',
  'Very helpful',
  'Punctual',
  'Professional',
  'Caring',
  'Knowledgeable',
  'Comfortable environment',
  'Clear communication',
  'Effective treatment',
  'Highly recommend',

  // Neutral/Constructive
  'Good value',
  'Convenient location',
  'Easy to book',
  'Flexible scheduling',
] as const;
```

### Appointment Enhancement

```typescript
interface Appointment {
  // ... existing fields

  // Review tracking
  reviewStatus: {
    canReview: boolean; // True after session ends
    hasReviewed: boolean;
    reviewId?: string;
    reviewRequestedAt?: Date; // When review email was sent
    reviewReminderSentAt?: Date; // When reminder was sent
  };

  // Session completion
  sessionCompletedAt?: Date; // When session actually happened
  sessionStatus: 'scheduled' | 'completed' | 'cancelled' | 'no-show';
}
```

---

## Review Flow (Patient Journey)

### 1. Session Completion

```
Session ends (sessionCompletedAt recorded)
    ↓
Wait 24 hours
    ↓
Send review request
├─ Email with link
├─ In-app notification
└─ Dashboard banner
```

### 2. Patient Writes Review

```
┌─────────────────────────────────────────┐
│ Rate Your Experience with Dr. João      │
├─────────────────────────────────────────┤
│                                          │
│ Overall Rating *                         │
│ ⭐ ⭐ ⭐ ⭐ ⭐                            │
│                                          │
│ How would you describe your experience?  │
│                                          │
│ [Great listener] [Very helpful]          │
│ [Professional] [Caring] + Add tag        │
│                                          │
│ Share more about your experience *       │
│ [Large text area for detailed review]    │
│                                          │
│ Category Ratings (optional)              │
│ Professionalism    ⭐⭐⭐⭐⭐          │
│ Communication      ⭐⭐⭐⭐⭐          │
│ Effectiveness      ⭐⭐⭐⭐⭐          │
│                                          │
│ ☐ Post anonymously (hide my name)       │
│                                          │
│ [Cancel]  [Submit Review]                │
└─────────────────────────────────────────┘
```

### 3. Review Moderation (Optional)

```
Review submitted
    ↓
Auto-check for inappropriate content
├─ Pass → Publish immediately
└─ Flagged → Manual review
```

### 4. Review Display

```
Expert Public Profile:
┌─────────────────────────────────────────┐
│ Dr. João Silva                           │
│ ⭐ 4.8 (127 reviews)                    │
├─────────────────────────────────────────┤
│                                          │
│ Recent Reviews:                          │
│                                          │
│ ⭐⭐⭐⭐⭐ Maria S. - 2 days ago       │
│ "Dr. João é um profissional excepcional" │
│ Great listener • Very helpful            │
│                                          │
│ ⭐⭐⭐⭐ Ana R. - 1 week ago           │
│ "Atendimento muito bom, recomendo!"     │
│ Professional • Caring                    │
│                                          │
│ [See all 127 reviews]                    │
└─────────────────────────────────────────┘
```

---

## Implementation Options

### Option A: Self-Hosted (Recommended) ✅

**Pros:**

- Full control over data
- No recurring costs
- HIPAA/LGPD compliant
- Custom features
- No vendor lock-in

**Cons:**

- Need to build UI components
- Build moderation tools
- Maintain system

**Implementation:**

```typescript
// Simple implementation using your existing stack

// 1. Database table (already defined above)
// 2. API routes
POST /api/reviews              # Create review
GET  /api/reviews              # List reviews
GET  /api/reviews/:id          # Get single review
PATCH /api/reviews/:id         # Update review
DELETE /api/reviews/:id        # Delete review

// Expert-specific
GET  /api/experts/:username/reviews  # Public reviews for expert
GET  /api/experts/:username/stats    # Rating stats

// Patient-specific
GET  /api/patient/reviews             # My reviews
GET  /api/patient/reviews/pending     # Pending reviews

// 3. React components
<StarRating value={5} onChange={setRating} />
<ReviewForm appointmentId={id} />
<ReviewCard review={review} />
<ReviewList reviews={reviews} />
```

**Estimated Effort:** 1-2 weeks (1 developer)

---

### Option B: Yotpo (Third-Party) ❌ Not Recommended

**Why not Yotpo for healthcare:**

- ❌ Designed for e-commerce, not healthcare
- ❌ Expensive ($299-$999/month+)
- ❌ Data privacy concerns (third-party)
- ❌ Not HIPAA compliant
- ❌ Generic review UI (not healthcare-specific)
- ❌ Overkill features (loyalty, UGC, etc.)
- ❌ Complex integration

**Verdict:** Not suitable for healthcare appointments

---

### Option C: Review Components Library (Best Balance) ✅

**Use a UI library + Your backend:**

**Recommended Libraries:**

1. **`react-rating-stars-component`** (Simple stars)

```bash
pnpm add react-rating-stars-component
```

```typescript
import ReactStars from 'react-rating-stars-component';

<ReactStars
  count={5}
  value={rating}
  onChange={setRating}
  size={32}
  activeColor="#ffd700"
/>
```

2. **`@smastrom/react-rating`** (Modern, accessible)

```bash
pnpm add @smastrom/react-rating
```

```typescript
import { Rating } from '@smastrom/react-rating';

<Rating
  value={rating}
  onChange={setRating}
  style={{ maxWidth: 250 }}
/>
```

3. **Custom with shadcn/ui** (Most flexible)

```typescript
// components/reviews/star-rating.tsx
import { Star } from 'lucide-react';
import { cn } from '@/lib/utils';

export function StarRating({
  value,
  onChange,
  readonly = false
}: StarRatingProps) {
  return (
    <div className="flex gap-1">
      {[1, 2, 3, 4, 5].map((star) => (
        <button
          key={star}
          type="button"
          disabled={readonly}
          onClick={() => onChange?.(star)}
          className={cn(
            "transition-colors",
            readonly && "cursor-default"
          )}
        >
          <Star
            className={cn(
              "h-6 w-6",
              star <= value
                ? "fill-yellow-400 text-yellow-400"
                : "fill-muted text-muted-foreground"
            )}
          />
        </button>
      ))}
    </div>
  );
}
```

**Verdict:** Build custom with shadcn/ui components + React rating library

---

## Database Schema

```sql
-- Reviews table
CREATE TABLE reviews (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

  -- Relationships
  patient_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  expert_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  appointment_id UUID NOT NULL REFERENCES meetings(id) ON DELETE CASCADE,
  organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,

  -- Ratings
  overall_rating INT NOT NULL CHECK (overall_rating BETWEEN 1 AND 5),
  category_ratings JSONB, -- {professionalism: 5, communication: 4, ...}

  -- Content
  title VARCHAR(255),
  comment TEXT NOT NULL,
  highlights TEXT[], -- Array of tags
  photos TEXT[], -- Photo URLs (future)

  -- Metadata
  is_anonymous BOOLEAN DEFAULT false,
  is_verified BOOLEAN DEFAULT true,

  -- Expert response
  expert_response JSONB, -- {comment: string, respondedAt: timestamp}

  -- Moderation
  status VARCHAR(50) DEFAULT 'published'
    CHECK (status IN ('pending', 'published', 'flagged', 'removed')),
  flag_reason TEXT,
  moderated_by UUID REFERENCES users(id),
  moderated_at TIMESTAMPTZ,

  -- Engagement
  helpful_count INT DEFAULT 0,
  report_count INT DEFAULT 0,

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  published_at TIMESTAMPTZ,

  -- Constraints
  UNIQUE(appointment_id), -- One review per appointment
  CONSTRAINT valid_ratings CHECK (
    overall_rating BETWEEN 1 AND 5 AND
    (category_ratings IS NULL OR
     jsonb_typeof(category_ratings) = 'object')
  )
);

-- Review helpful votes
CREATE TABLE review_votes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  review_id UUID NOT NULL REFERENCES reviews(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  vote_type VARCHAR(20) NOT NULL CHECK (vote_type IN ('helpful', 'report')),
  created_at TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(review_id, user_id, vote_type)
);

-- Indexes
CREATE INDEX idx_reviews_expert_id ON reviews(expert_id);
CREATE INDEX idx_reviews_patient_id ON reviews(patient_id);
CREATE INDEX idx_reviews_appointment_id ON reviews(appointment_id);
CREATE INDEX idx_reviews_status ON reviews(status);
CREATE INDEX idx_reviews_published_at ON reviews(published_at DESC);
CREATE INDEX idx_reviews_overall_rating ON reviews(overall_rating);

-- Update meetings table
ALTER TABLE meetings
  ADD COLUMN session_completed_at TIMESTAMPTZ,
  ADD COLUMN session_status VARCHAR(50) DEFAULT 'scheduled'
    CHECK (session_status IN ('scheduled', 'completed', 'cancelled', 'no-show')),
  ADD COLUMN review_requested_at TIMESTAMPTZ,
  ADD COLUMN review_reminder_sent_at TIMESTAMPTZ;
```

---

## API Endpoints

### Reviews API

```typescript
// Create review (Patient only)
POST /api/reviews
Body: {
  appointmentId: string;
  overallRating: number;
  categoryRatings?: object;
  title?: string;
  comment: string;
  highlights?: string[];
  isAnonymous?: boolean;
}
Response: Review

// Get reviews for expert (Public)
GET /api/experts/:username/reviews
Query: {
  page?: number;
  limit?: number;
  sort?: 'recent' | 'highest' | 'lowest';
}
Response: {
  reviews: Review[];
  stats: {
    averageRating: number;
    totalReviews: number;
    ratingDistribution: { [key: number]: number };
  };
  pagination: PaginationMeta;
}

// Get my reviews (Patient)
GET /api/patient/reviews
Response: Review[]

// Get pending reviews (Patient)
GET /api/patient/reviews/pending
Response: {
  appointment: Appointment;
  expert: Expert;
  canReview: boolean;
}[]

// Update review (Patient, within 30 days)
PATCH /api/reviews/:id
Body: Partial<ReviewInput>
Response: Review

// Delete review (Patient, within 7 days)
DELETE /api/reviews/:id
Response: { success: boolean }

// Mark review as helpful
POST /api/reviews/:id/helpful
Response: { helpfulCount: number }

// Report review
POST /api/reviews/:id/report
Body: { reason: string }
Response: { success: boolean }

// Expert response (Expert only)
POST /api/reviews/:id/response
Body: { comment: string }
Response: Review
```

---

## UI Components

### 1. Star Rating Component

```typescript
// components/reviews/star-rating.tsx
'use client';

import { Star } from 'lucide-react';
import { cn } from '@/lib/utils';

interface StarRatingProps {
  value: number;
  onChange?: (value: number) => void;
  readonly?: boolean;
  size?: 'sm' | 'md' | 'lg';
}

export function StarRating({
  value,
  onChange,
  readonly = false,
  size = 'md'
}: StarRatingProps) {
  const sizeClasses = {
    sm: 'h-4 w-4',
    md: 'h-6 w-6',
    lg: 'h-8 w-8',
  };

  return (
    <div className="flex gap-1">
      {[1, 2, 3, 4, 5].map((star) => (
        <button
          key={star}
          type="button"
          disabled={readonly}
          onClick={() => onChange?.(star)}
          onMouseEnter={() => !readonly && onChange?.(star)}
          className={cn(
            "transition-all hover:scale-110",
            readonly && "cursor-default"
          )}
        >
          <Star
            className={cn(
              sizeClasses[size],
              star <= value
                ? "fill-yellow-400 text-yellow-400"
                : "fill-none text-muted-foreground"
            )}
          />
        </button>
      ))}
    </div>
  );
}
```

### 2. Review Form Component

```typescript
// components/reviews/review-form.tsx
'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { StarRating } from './star-rating';
import { toast } from 'sonner';

const HIGHLIGHTS = [
  'Great listener',
  'Very helpful',
  'Punctual',
  'Professional',
  'Caring',
  'Knowledgeable',
  'Clear communication',
  'Effective treatment',
];

interface ReviewFormProps {
  appointmentId: string;
  expertName: string;
  onSuccess?: () => void;
}

export function ReviewForm({
  appointmentId,
  expertName,
  onSuccess
}: ReviewFormProps) {
  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState('');
  const [highlights, setHighlights] = useState<string[]>([]);
  const [isAnonymous, setIsAnonymous] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const toggleHighlight = (highlight: string) => {
    setHighlights(prev =>
      prev.includes(highlight)
        ? prev.filter(h => h !== highlight)
        : [...prev, highlight]
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (rating === 0) {
      toast.error('Please select a rating');
      return;
    }

    if (comment.length < 20) {
      toast.error('Please write at least 20 characters');
      return;
    }

    setIsSubmitting(true);

    try {
      const response = await fetch('/api/reviews', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          appointmentId,
          overallRating: rating,
          comment,
          highlights,
          isAnonymous,
        }),
      });

      if (!response.ok) throw new Error('Failed to submit review');

      toast.success('Review submitted successfully!');
      onSuccess?.();
    } catch (error) {
      toast.error('Failed to submit review');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div>
        <Label>Overall Rating *</Label>
        <StarRating value={rating} onChange={setRating} size="lg" />
      </div>

      <div>
        <Label>How would you describe your experience?</Label>
        <div className="mt-2 flex flex-wrap gap-2">
          {HIGHLIGHTS.map((highlight) => (
            <Badge
              key={highlight}
              variant={highlights.includes(highlight) ? 'default' : 'outline-solid'}
              className="cursor-pointer"
              onClick={() => toggleHighlight(highlight)}
            >
              {highlight}
            </Badge>
          ))}
        </div>
      </div>

      <div>
        <Label htmlFor="comment">Share more about your experience *</Label>
        <Textarea
          id="comment"
          value={comment}
          onChange={(e) => setComment(e.target.value)}
          placeholder={`Tell others about your experience with ${expertName}...`}
          rows={6}
          minLength={20}
          required
        />
        <p className="mt-1 text-xs text-muted-foreground">
          {comment.length}/500 characters (minimum 20)
        </p>
      </div>

      <div className="flex items-center space-x-2">
        <Checkbox
          id="anonymous"
          checked={isAnonymous}
          onCheckedChange={(checked) => setIsAnonymous(checked as boolean)}
        />
        <Label htmlFor="anonymous" className="font-normal">
          Post anonymously (your name will be hidden)
        </Label>
      </div>

      <div className="flex gap-2">
        <Button type="button" variant="outline">
          Cancel
        </Button>
        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting ? 'Submitting...' : 'Submit Review'}
        </Button>
      </div>
    </form>
  );
}
```

### 3. Review Card Component

```typescript
// components/reviews/review-card.tsx
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { StarRating } from './star-rating';
import { formatDistanceToNow } from 'date-fns';

interface ReviewCardProps {
  review: {
    id: string;
    overallRating: number;
    comment: string;
    highlights?: string[];
    isAnonymous: boolean;
    createdAt: Date;
    patient?: {
      name: string;
      avatar?: string;
    };
  };
}

export function ReviewCard({ review }: ReviewCardProps) {
  const patientName = review.isAnonymous
    ? 'Anonymous'
    : review.patient?.name || 'Patient';

  const initials = review.isAnonymous
    ? 'A'
    : patientName.split(' ').map(n => n[0]).join('');

  return (
    <Card>
      <CardContent className="pt-6">
        <div className="flex items-start gap-4">
          <Avatar>
            {!review.isAnonymous && review.patient?.avatar && (
              <AvatarImage src={review.patient.avatar} />
            )}
            <AvatarFallback>{initials}</AvatarFallback>
          </Avatar>

          <div className="flex-1 space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium">{patientName}</p>
                <p className="text-sm text-muted-foreground">
                  {formatDistanceToNow(new Date(review.createdAt), {
                    addSuffix: true
                  })}
                </p>
              </div>
              <StarRating value={review.overallRating} readonly size="sm" />
            </div>

            {review.highlights && review.highlights.length > 0 && (
              <div className="flex flex-wrap gap-1">
                {review.highlights.map((highlight) => (
                  <Badge key={highlight} variant="secondary" className="text-xs">
                    {highlight}
                  </Badge>
                ))}
              </div>
            )}

            <p className="text-sm leading-relaxed">{review.comment}</p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
```

---

## Review Request System

### Automated Review Requests

```typescript
// lib/reviews/review-requests.ts

/**
 * Send review request 24 hours after session
 * Runs via cron job or similar
 */
export async function sendReviewRequests() {
  const yesterday = new Date();
  yesterday.setHours(yesterday.getHours() - 24);

  // Find completed sessions from 24 hours ago without reviews
  const appointments = await db.query.MeetingsTable.findMany({
    where: and(
      eq(MeetingsTable.sessionStatus, 'completed'),
      gte(MeetingsTable.sessionCompletedAt, yesterday),
      isNull(MeetingsTable.reviewRequestedAt),
    ),
    with: {
      patient: true,
      expert: true,
    },
  });

  for (const appointment of appointments) {
    // Send email
    await sendEmail({
      to: appointment.patient.email,
      subject: `How was your session with ${appointment.expert.name}?`,
      template: 'review-request',
      data: {
        patientName: appointment.patient.name,
        expertName: appointment.expert.name,
        reviewUrl: `${process.env.NEXT_PUBLIC_APP_URL}/patient/appointments/${appointment.id}/review`,
      },
    });

    // Update appointment
    await db
      .update(MeetingsTable)
      .set({ reviewRequestedAt: new Date() })
      .where(eq(MeetingsTable.id, appointment.id));
  }
}
```

### Cron Job Setup

```typescript
// app/api/cron/review-requests/route.ts
import { sendReviewRequests } from '@/lib/reviews/review-requests';
import { NextResponse } from 'next/server';

export async function GET(request: Request) {
  // Verify cron secret
  const authHeader = request.headers.get('authorization');
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return new Response('Unauthorized', { status: 401 });
  }

  try {
    await sendReviewRequests();
    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ error: 'Failed' }, { status: 500 });
  }
}
```

**Vercel Cron Configuration:**

```json
// vercel.json
{
  "crons": [
    {
      "path": "/api/cron/review-requests",
      "schedule": "0 */6 * * *"
    }
  ]
}
```

---

## Success Metrics

### Review System Health

- **Review Rate:** % of completed sessions with reviews
- **Average Rating:** Overall expert rating average
- **Response Time:** How quickly experts respond to reviews
- **Moderation Rate:** % of reviews flagged/removed

### Patient Engagement

- **Portal Usage:** % of patients who log in
- **Review Completion:** % who complete reviews within 7 days
- **Repeat Bookings:** Correlation between reviews and re-bookings

### Expert Benefits

- **Profile Views:** Increase after positive reviews
- **Booking Rate:** Correlation between rating and bookings
- **Expert Satisfaction:** NPS for review system

---

## Privacy & Compliance

### LGPD/HIPAA Considerations

1. **No Health Information in Reviews**
   - Reviews should NOT contain medical details
   - Auto-flag PHI keywords
   - Clear guidelines for patients

2. **Right to Delete**
   - Patients can delete reviews within 7 days
   - After 7 days, contact support
   - Soft delete (mark as removed, keep for records)

3. **Data Access**
   - Patients can export their reviews
   - Experts cannot access patient info via reviews
   - Anonymous reviews protect patient identity

4. **Review Guidelines**

```
✅ DO share:
- Your overall experience
- How you felt about the service
- Communication quality
- Environment/comfort

❌ DON'T share:
- Medical conditions or diagnoses
- Treatment details
- Personal health information
- Other patients' information
```

---

## Implementation Roadmap

### Phase 1: Basic Review System (Week 1-2)

- [ ] Database schema
- [ ] API endpoints (create, read)
- [ ] Review form component
- [ ] Display reviews on expert profile
- [ ] Basic star rating

### Phase 2: Review Requests (Week 3)

- [ ] Automated review request emails
- [ ] Cron job setup
- [ ] Dashboard banner for pending reviews
- [ ] In-app notifications

### Phase 3: Enhanced Features (Week 4)

- [ ] Category ratings
- [ ] Review highlights/tags
- [ ] Expert response to reviews
- [ ] "Helpful" voting
- [ ] Review moderation

### Phase 4: Analytics & Optimization (Week 5)

- [ ] Review analytics dashboard
- [ ] A/B test review request timing
- [ ] Review impact on bookings
- [ ] Expert performance insights

---

## Recommendation

**Build self-hosted review system with:**

- ✅ Custom backend (Next.js API routes + Neon database)
- ✅ shadcn/ui components for UI
- ✅ Simple star rating library (`@smastrom/react-rating`)
- ✅ Email via Resend/SendGrid
- ✅ Automated requests via Vercel Cron

**Total Effort:** 3-4 weeks (1 developer)  
**Cost:** $0 (no third-party fees)  
**Control:** Full ownership and customization

**Skip:** Yotpo, Trustpilot, or other third-party review platforms (expensive, not healthcare-specific, privacy concerns)

---

## Next Steps

1. Review and approve this specification
2. Design review UI/UX mockups
3. Prioritize features (Phase 1 first)
4. Begin database schema implementation
5. Create review components
6. Set up automated review requests
7. Launch with small group of beta testers
8. Iterate based on feedback

---

**Questions or Feedback?**  
Contact: dev-team@eleva.care
