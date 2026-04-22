# WorkOS: Separating SSO from Calendar OAuth

**Use Case:** Patients use Google SSO (login only), Experts use Google SSO + Calendar integration  
**Date:** January 2025  
**Status:** Best Practice Architecture ✅

---

## 🎯 Architecture Overview

WorkOS supports **two separate Google OAuth flows**:

1. **Authentication Connection** - Social login (all users)
2. **API Connection** - Calendar access (experts only)

This allows you to:
- ✅ Let patients login with Google (no calendar access required)
- ✅ Let experts login with Google AND connect calendar separately
- ✅ Follow principle of least privilege
- ✅ Comply with Google OAuth verification requirements

---

## 🏗️ Two-Connection Architecture

### **Connection 1: Google Social Login (Authentication)**

**Purpose:** User authentication for all users (patients + experts)

**WorkOS Dashboard:**
```
User Management > Authentication > Social Login > Google

Enabled: ✅
Scopes:
  - openid
  - email  
  - profile
```

**User Flow:**
```
User clicks "Sign in with Google"
  ↓
WorkOS redirects to Google
  ↓
Google shows: "Eleva wants to know who you are"
  ↓
User approves (ONLY login, NO calendar access)
  ↓
User redirected back to app
  ↓
WorkOS provides: userId, email, name
```

**What You Get:**
- ✅ User ID
- ✅ Email address
- ✅ Profile info (name, photo)
- ❌ NO calendar access
- ❌ NO sensitive data access

---

### **Connection 2: Google Calendar (API Access)**

**Purpose:** Calendar integration for experts only

**WorkOS Dashboard:**
```
Integrations > API Connections > Google Calendar

Enabled: ✅
Scopes:
  - https://www.googleapis.com/auth/calendar.events
```

**Expert Flow:**
```
Expert (already logged in) clicks "Connect Google Calendar"
  ↓
WorkOS redirects to Google OAuth
  ↓
Google shows: "Eleva wants to view and edit your calendar events"
  ↓
Expert approves calendar access
  ↓
WorkOS provides: access_token, refresh_token, scope
  ↓
App stores tokens (encrypted with Vault)
```

**What You Get:**
- ✅ Calendar API access token
- ✅ Ability to create/read/update/delete events
- ✅ Can be disconnected independently
- ✅ Separate from authentication

---

## 📊 User Type Comparison

| Feature | Patient | Expert |
|---------|---------|--------|
| **Google SSO (Login)** | ✅ Required | ✅ Required |
| **Calendar OAuth** | ❌ Not needed | ✅ Optional (setup step) |
| **Can book appointments** | ✅ Yes | ✅ Yes |
| **Can host appointments** | ❌ No | ✅ Yes (requires calendar) |
| **Calendar sync** | ❌ No | ✅ Yes |

---

## 💻 Implementation

### **1. Patient Login (Social Login Only)**

```typescript
// app/[locale]/auth/sign-in/page.tsx
export default function SignInPage() {
  return (
    <div>
      <h1>Sign In</h1>
      
      {/* WorkOS Social Login - NO calendar access */}
      <button onClick={() => signInWithGoogle()}>
        Sign in with Google
      </button>
    </div>
  );
}

// Uses WorkOS Authentication Connection
// Scopes: openid, email, profile
// NO calendar access
```

### **2. Expert Calendar Connection (Separate OAuth)**

```typescript
// app/[locale]/setup/google-calendar/page.tsx
export default async function GoogleCalendarSetupPage() {
  const user = await getAuthenticatedUser(); // Already logged in via SSO
  
  if (user.role !== 'expert') {
    redirect('/dashboard');
  }
  
  return (
    <div>
      <h1>Connect Google Calendar (Optional)</h1>
      <p>Sync your availability and appointments</p>
      
      {/* Separate OAuth flow for Calendar API */}
      <button onClick={() => connectGoogleCalendar()}>
        Connect Google Calendar
      </button>
    </div>
  );
}

// Uses WorkOS API Connection (separate from authentication)
// Scopes: calendar.events
// Requires explicit user consent
```

### **3. OAuth Callback Handler**

```typescript
// app/api/auth/google/calendar/callback/route.ts
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get('code');
  
  // Exchange code for tokens (WorkOS API Connection)
  const tokens = await workos.oauth.getToken({
    clientId: process.env.WORKOS_CLIENT_ID,
    clientSecret: process.env.WORKOS_CLIENT_SECRET,
    code,
  });
  
  // Store calendar tokens (encrypted with Vault)
  await storeGoogleTokens(userId, {
    access_token: tokens.access_token,
    refresh_token: tokens.refresh_token,
    expiry_date: tokens.expires_in * 1000 + Date.now(),
    token_type: 'Bearer',
    scope: tokens.scope, // Should be: calendar.events
  });
  
  redirect('/setup/complete');
}
```

### **4. Database Schema (Track Connection Status)**

```typescript
// drizzle/schema-workos.ts
export const UsersTable = pgTable('users', {
  // ... other fields ...
  
  // Google SSO (always present for Google-authenticated users)
  workosUserId: text('workos_user_id').notNull(),
  email: text('email').notNull(),
  
  // Google Calendar OAuth (only for experts who connected calendar)
  vaultGoogleAccessToken: text('vault_google_access_token'), // NULL if not connected
  vaultGoogleRefreshToken: text('vault_google_refresh_token'), // NULL if not connected
  googleTokenExpiry: timestamp('google_token_expiry'), // NULL if not connected
  googleCalendarConnected: boolean('google_calendar_connected').default(false),
  googleCalendarConnectedAt: timestamp('google_calendar_connected_at'),
});
```

---

## 🔒 Security Benefits

### **Principle of Least Privilege:**

```typescript
// Patient Flow
User → Google SSO → App
Scopes: openid, email, profile
Access: ONLY authentication
Calendar: ❌ NO ACCESS

// Expert Flow (Authentication)
Expert → Google SSO → App
Scopes: openid, email, profile  
Access: Authentication only
Calendar: ❌ NO ACCESS (yet)

// Expert Flow (Calendar - Separate)
Expert → "Connect Calendar" → Google OAuth → App
Scopes: calendar.events
Access: Calendar events only
Can disconnect: ✅ YES
```

### **Benefits:**

1. ✅ **Patients never prompted for calendar access**
   - Better UX (no confusing permissions)
   - Faster signup
   - Higher conversion

2. ✅ **Experts have control**
   - Can skip calendar connection initially
   - Can connect later in setup
   - Can disconnect without losing login

3. ✅ **Compliance**
   - Follows Google OAuth best practices
   - Easier Google OAuth verification
   - Minimal scopes requested

4. ✅ **Security**
   - Separate OAuth flows
   - Independent token revocation
   - Clear audit trail

---

## 🔄 User Flows

### **Patient Flow:**

```
1. Patient visits site
2. Click "Sign in with Google"
3. Google consent: "Eleva wants to know who you are"
   ✅ Email
   ✅ Profile
   ❌ NO calendar access requested
4. Patient approves
5. Patient logged in
6. Patient can book appointments
7. Done ✅
```

### **Expert Flow:**

```
1. Expert visits site
2. Click "Sign in with Google"
3. Google consent: "Eleva wants to know who you are"
   ✅ Email
   ✅ Profile
   ❌ NO calendar access requested
4. Expert approves
5. Expert logged in
6. Expert redirected to /setup
7. Setup Step 1: Profile ✅
8. Setup Step 2: Availability ✅
9. Setup Step 3: Google Calendar (OPTIONAL)
   → Click "Connect Google Calendar"
   → Google consent: "Eleva wants to view and edit calendar events"
   → Expert approves
   → Calendar tokens stored (encrypted)
10. Setup complete ✅
```

---

## 📱 WorkOS Dashboard Configuration

### **Step 1: Enable Google Social Login**

```
WorkOS Dashboard
└── User Management
    └── Authentication
        └── Social Login
            └── Google
                ├── Enabled: ✅
                ├── Client ID: [Your Google OAuth Client ID]
                ├── Client Secret: [Your Google OAuth Client Secret]
                └── Scopes:
                    - openid
                    - email
                    - profile
```

### **Step 2: Enable Google Calendar API Connection**

```
WorkOS Dashboard
└── Integrations
    └── API Connections
        └── Google Calendar
            ├── Enabled: ✅
            ├── Client ID: [Same Google OAuth Client ID]
            ├── Client Secret: [Same Google OAuth Client Secret]
            └── Scopes:
                - https://www.googleapis.com/auth/calendar.events
```

**Important:** You can use the **same Google OAuth credentials** for both connections!

---

## 🧪 Testing

### **Test 1: Patient Sign In (No Calendar)**

```typescript
// Test that patients can sign in without calendar prompt
test('Patient can sign in with Google SSO', async () => {
  // 1. Navigate to sign-in page
  await page.goto('/sign-in');
  
  // 2. Click "Sign in with Google"
  await page.click('button:has-text("Sign in with Google")');
  
  // 3. Google consent screen should show:
  // - Email access ✅
  // - Profile access ✅
  // - Calendar access ❌ (should NOT appear)
  
  // 4. User approves and lands on dashboard
  await expect(page).toHaveURL('/dashboard');
  
  // 5. Verify calendar NOT connected
  const user = await getUserFromDb();
  expect(user.googleCalendarConnected).toBe(false);
  expect(user.vaultGoogleAccessToken).toBeNull();
});
```

### **Test 2: Expert Calendar Connection (Separate)**

```typescript
test('Expert can connect calendar separately', async () => {
  // 1. Expert already logged in via SSO
  await signInAsExpert();
  
  // 2. Navigate to calendar setup
  await page.goto('/setup/google-calendar');
  
  // 3. Click "Connect Google Calendar"
  await page.click('button:has-text("Connect Google Calendar")');
  
  // 4. Google consent screen should show:
  // - Calendar events access ✅
  // - ONLY calendar (not email/profile again)
  
  // 5. Expert approves
  // 6. Verify calendar IS connected
  const user = await getUserFromDb();
  expect(user.googleCalendarConnected).toBe(true);
  expect(user.vaultGoogleAccessToken).not.toBeNull();
});
```

---

## 🚨 Common Mistakes to Avoid

### **❌ Mistake 1: Using Same Connection for Both**

```typescript
// ❌ WRONG - Requesting calendar for all users
const authUrl = workos.getAuthorizationUrl({
  provider: 'google',
  redirectUri: '/callback',
  scopes: ['openid', 'email', 'profile', 'calendar.events'], // ❌ Too many scopes
});

// ✅ CORRECT - Separate connections
// SSO: openid, email, profile (all users)
// Calendar: calendar.events (experts only, separate flow)
```

### **❌ Mistake 2: Not Checking if Calendar is Connected**

```typescript
// ❌ WRONG - Assuming calendar is always connected
async function createCalendarEvent(expertId: string) {
  const tokens = await getStoredGoogleTokens(expertId);
  // May be null if expert didn't connect calendar!
  const auth = await getGoogleOAuthClient(expertId);
  // ...
}

// ✅ CORRECT - Check connection first
async function createCalendarEvent(expertId: string) {
  const isConnected = await hasGoogleCalendarConnected(expertId);
  
  if (!isConnected) {
    throw new Error('Google Calendar not connected. Please connect in settings.');
  }
  
  const tokens = await getStoredGoogleTokens(expertId);
  const auth = await getGoogleOAuthClient(expertId);
  // ...
}
```

### **❌ Mistake 3: Requiring Calendar for Non-Experts**

```typescript
// ❌ WRONG - Blocking patients
export async function POST(request: Request) {
  const user = await getCurrentUser();
  
  const hasCalendar = await hasGoogleCalendarConnected(user.id);
  if (!hasCalendar) {
    return new Response('Google Calendar not connected', { status: 403 });
  }
  // ❌ This blocks patients who don't need calendar!
}

// ✅ CORRECT - Only check for experts
export async function POST(request: Request) {
  const user = await getCurrentUser();
  
  // Only require calendar for experts
  if (user.role === 'expert') {
    const hasCalendar = await hasGoogleCalendarConnected(user.id);
    if (!hasCalendar) {
      return new Response('Experts must connect Google Calendar', { status: 403 });
    }
  }
  
  // Patients can proceed without calendar
}
```

---

## 📚 References

- **Google OAuth Scopes:** https://developers.google.com/workspace/calendar/api/auth
- **WorkOS Social Login:** https://workos.com/docs/user-management/social-login
- **WorkOS OAuth:** https://workos.com/docs/user-management/oauth
- **Best Practices:** Principle of Least Privilege (request minimal scopes needed)

---

## ✅ Summary

**Your Architecture Should Be:**

```
Patient Sign-Up:
├── Google SSO (Authentication Connection)
│   └── Scopes: openid, email, profile
└── ✅ Done (NO calendar access)

Expert Sign-Up:
├── Google SSO (Authentication Connection)
│   └── Scopes: openid, email, profile
├── Expert Setup Flow
│   ├── Step 1: Profile ✅
│   ├── Step 2: Availability ✅
│   └── Step 3: Google Calendar (Optional)
│       └── Google Calendar OAuth (API Connection)
│           └── Scopes: calendar.events
└── ✅ Done
```

**Benefits:**
- ✅ Patients never prompted for calendar access
- ✅ Experts can skip calendar initially
- ✅ Follows Google OAuth best practices
- ✅ Easier Google OAuth verification
- ✅ Better security (least privilege)
- ✅ Separate token revocation
- ✅ Clear audit trail

---

**You can absolutely separate Google SSO from Calendar OAuth!** 🎉

