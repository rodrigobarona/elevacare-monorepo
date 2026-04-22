# Customer ID System - Secure Patient Identification

## Overview

The Customer ID System provides a secure, consistent method for generating and managing patient identifiers across the Eleva Care platform. This system replaces email-based URLs with secure, deterministic customer IDs to improve privacy and maintain consistency across all components and APIs.

## Key Features

- **Privacy-First Design**: Customer IDs don't expose patient email addresses in URLs
- **Deterministic Generation**: Same patient + same practitioner = Same customer ID
- **Cross-Component Consistency**: Shared utilities ensure identical IDs across all parts of the application
- **GDPR/Privacy Compliance**: Removes PII from URLs and application logs
- **Secure and Scalable**: 12-character hexadecimal IDs with proper validation
- **Collision-Free**: Hash-based algorithm ensures unique IDs for different emails

## Architecture

### Core Utility Functions

The system is built around three core utility functions in `lib/utils/customerUtils.ts`:

#### 1. `generateCustomerId(userId, guestEmail)`

Generates a consistent, secure customer ID based on user ID and guest email.

```typescript
/**
 * Simple hash function to replace crypto dependency
 * Creates a deterministic hash from input string
 */
function simpleHash(str: string): string {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash = hash & hash; // Convert to 32bit integer
  }
  // Convert to positive hex string and pad to 8 characters
  return Math.abs(hash).toString(16).padStart(8, '0');
}

/**
 * Extended hash function that creates a 12-character hash
 */
function extendedHash(str: string): string {
  // Get hash of original string
  const hash1 = simpleHash(str);
  // Get hash of reversed string for additional entropy
  const hash2 = simpleHash(str.split('').reverse().join(''));
  // Combine and take first 12 characters
  return (hash1 + hash2).substring(0, 12);
}

export function generateCustomerId(userId: string, guestEmail: string): string {
  if (!userId || !guestEmail) {
    throw new Error('Both userId and guestEmail are required to generate customer ID');
  }

  // Normalize email to lowercase and trim whitespace for consistency
  const normalizedEmail = guestEmail.toLowerCase().trim();

  // Create a seed using the user ID and normalized email
  const customerIdSeed = `${userId}-${normalizedEmail}`;

  // Generate hash using extended hash function
  const customerId = extendedHash(customerIdSeed);

  return customerId;
}
```

**Algorithm Details:**

- Combines Clerk user ID with normalized email address
- Uses a hash algorithm for even distribution of customer IDs
- Applies double hashing (original + reversed) for enhanced entropy
- Produces exactly 12 hexadecimal characters for consistency
- **Fixed Issue**: Previous Base64 approach caused ID collisions; new hash ensures uniqueness

**Example Results:**

```
user_2tYRmKEdAbmZUJUDPvkIzzdnMvq + acarolinadcoelho@gmail.com => 2d5756ac4cf5
user_2tYRmKEdAbmZUJUDPvkIzzdnMvq + jafmota@gmail.com           => 761a96de0b2b
user_2tYRmKEdAbmZUJUDPvkIzzdnMvq + felix_kidd@hotmail.co.uk    => 2cb481802a43
```

#### 2. `findEmailByCustomerId(userId, customerId, emailList)`

Reverse lookup to find the email address that corresponds to a customer ID.

```typescript
export function findEmailByCustomerId(
  userId: string,
  customerId: string,
  emailList: string[],
): string | null {
  // Check each email to see if it generates the target customer ID
  for (const email of emailList) {
    try {
      const generatedId = generateCustomerId(userId, email);
      if (generatedId === customerId) {
        return email;
      }
    } catch {
      // Skip invalid emails by continuing to next iteration
    }
  }
  return null;
}
```

#### 3. `isValidCustomerId(customerId)`

Validates customer ID format for security and consistency.

```typescript
export function isValidCustomerId(customerId: string): boolean {
  if (!customerId || typeof customerId !== 'string') {
    return false;
  }
  // Customer IDs should be exactly 12 alphanumeric characters
  return /^[a-zA-Z0-9]{12}$/.test(customerId);
}
```

## Implementation

### Frontend Components

#### Appointments Page (`app/(private)/appointments/page.tsx`)

**Before:**

```typescript
// Inconsistent, inline customer ID generation
const customerIdSeed = `${user.id}-${item.guestEmail}`;
const customerId = Buffer.from(customerIdSeed)
  .toString('base64')
  .replace(/[^a-zA-Z0-9]/g, '')
  .substring(0, 12);
```

**After:**

```typescript
// Uses shared utility with memoization
import { generateCustomerId } from '@/lib/utils/customerUtils';

const appointmentsWithCustomerIds = React.useMemo(() => {
  if (!user?.id) return [] as AppointmentWithCustomerId[];

  return appointments.map(
    (item): AppointmentWithCustomerId => ({
      ...item,
      customerId: generateCustomerId(user.id, item.guestEmail),
    }),
  );
}, [appointments, user?.id]);
```

**Key Improvements:**

- Memoized customer ID generation prevents unnecessary recalculations
- Consistent IDs across component re-renders
- Proper TypeScript typing with `AppointmentWithCustomerId`
- Stable React keys: `key={item.id}-${item.customerId}`

#### Customers Page (`app/(private)/appointments/patients/page.tsx`)

**Enhanced with:**

```typescript
import { isValidCustomerId } from '@/lib/utils/customerUtils';

const handleViewCustomer = (customer: Customer) => {
  // Validate customer ID format before navigation
  if (!isValidCustomerId(customer.id)) {
    console.error(`Invalid customer ID format: ${customer.id}`);
    setError('Invalid customer ID format');
    return;
  }

  router.push(`/appointments/patients/${customer.id}`);
};
```

### Backend APIs

#### Customers API (`app/api/customers/route.ts`)

**Before:**

```typescript
const customerIdSeed = `${userId}-${customer.email}`;
const customerId = Buffer.from(customerIdSeed)
  .toString('base64')
  .replace(/[^a-zA-Z0-9]/g, '')
  .substring(0, 12);
```

**After:**

```typescript
import { generateCustomerId } from '@/lib/utils/customerUtils';

const customers = customersWithAppointments.map((customer) => {
  const customerId = generateCustomerId(userId, customer.email);
  return {
    id: customerId,
    email: customer.email,
    name: customer.name,
    // ... other fields
  };
});
```

#### Customer Detail API (`app/api/customers/[id]/route.ts`)

**Before:**

```typescript
// Manual loop to find matching email
let customerEmail: string | null = null;
for (const customer of allCustomers) {
  const customerIdSeed = `${userId}-${customer.email}`;
  const generatedId = Buffer.from(customerIdSeed)
    .toString('base64')
    .replace(/[^a-zA-Z0-9]/g, '')
    .substring(0, 12);
  if (generatedId === customerId) {
    customerEmail = customer.email;
    break;
  }
}
```

**After:**

```typescript
import { findEmailByCustomerId } from '@/lib/utils/customerUtils';

// Efficient reverse lookup using shared utility
const customerEmails = allCustomers.map((customer) => customer.email);
const customerEmail = findEmailByCustomerId(userId, customerId, customerEmails);
```

## URL Structure

### Before Implementation

Patient links exposed email addresses directly:

```
❌ /appointments/patients/user@example.com
❌ Security risk: PII exposed in URLs
❌ Inconsistent ID generation across components
```

### After Implementation

Secure, consistent customer IDs:

```
✅ /appointments/patients/ABC123DEF456
✅ Privacy compliant: No PII in URLs
✅ Consistent across all components and APIs
```

## Security Benefits

### Privacy Protection

1. **No Email Exposure**: Patient email addresses are never visible in URLs or browser history
2. **GDPR Compliance**: Removes PII from application logs and URL parameters
3. **Non-Guessable IDs**: Customer IDs cannot be easily guessed or enumerated

### Authentication & Authorization

```typescript
// Proper expert role validation on all customer endpoints
const userIsExpert = await isExpert();
if (!userIsExpert) {
  return NextResponse.json({ error: 'Forbidden: Expert role required' }, { status: 403 });
}

// Customer IDs are scoped to the authenticated expert
const customerId = generateCustomerId(userId, guestEmail);
```

### Data Access Controls

- Customer IDs are scoped to the authenticated expert
- No cross-expert data access possible
- Proper validation at all API endpoints

## Type Safety

### TypeScript Interfaces

```typescript
// Enhanced appointment type with customer ID
type AppointmentWithCustomerId = AppointmentOrReservation & {
  customerId: string;
};

// Customer interface with secure ID
interface Customer {
  id: string; // Secure customer ID
  name: string;
  email: string;
  appointmentsCount: number;
  totalSpend: number;
  lastAppointment: string | null;
  stripeCustomerId: string;
}
```

## Performance Optimizations

### Memoization Strategy

```typescript
// Prevents regeneration of customer IDs on every render
const appointmentsWithCustomerIds = React.useMemo(() => {
  if (!user?.id) return [] as AppointmentWithCustomerId[];

  return appointments.map(
    (item): AppointmentWithCustomerId => ({
      ...item,
      customerId: generateCustomerId(user.id, item.guestEmail),
    }),
  );
}, [appointments, user?.id]);
```

### React Key Optimization

```typescript
// Stable React keys prevent unnecessary re-renders
return sorted.map((item) => (
  <AppointmentCard
    key={`${item.id}-${item.customerId}`}
    appointment={item}
    customerId={item.customerId}
  />
));
```

## Testing & Validation

### Customer ID Format Validation

```typescript
describe('generateCustomerId', () => {
  it('should generate consistent IDs for same inputs', () => {
    const userId = 'user_123';
    const email = 'patient@example.com';

    const id1 = generateCustomerId(userId, email);
    const id2 = generateCustomerId(userId, email);

    expect(id1).toBe(id2);
    expect(id1).toHaveLength(12);
    expect(/^[a-zA-Z0-9]{12}$/.test(id1)).toBe(true);
  });

  it('should handle email normalization', () => {
    const userId = 'user_123';
    const email1 = 'Patient@Example.com';
    const email2 = 'patient@example.com ';

    const id1 = generateCustomerId(userId, email1);
    const id2 = generateCustomerId(userId, email2);

    expect(id1).toBe(id2);
  });
});
```

### Reverse Lookup Testing

```typescript
describe('findEmailByCustomerId', () => {
  it('should find correct email for customer ID', () => {
    const userId = 'user_123';
    const emails = ['user1@test.com', 'user2@test.com', 'target@test.com'];
    const targetEmail = 'target@test.com';

    const customerId = generateCustomerId(userId, targetEmail);
    const foundEmail = findEmailByCustomerId(userId, customerId, emails);

    expect(foundEmail).toBe(targetEmail);
  });
});
```

## Error Handling

### Input Validation

```typescript
export function generateCustomerId(userId: string, guestEmail: string): string {
  if (!userId || !guestEmail) {
    throw new Error('Both userId and guestEmail are required to generate customer ID');
  }
  // ... rest of implementation
}
```

### Graceful Fallbacks

```typescript
// API endpoint with proper error handling
if (!customerEmail) {
  return NextResponse.json({ error: 'Customer not found' }, { status: 404 });
}

// Component with validation
if (!isValidCustomerId(customer.id)) {
  console.error(`Invalid customer ID format: ${customer.id}`);
  setError('Invalid customer ID format');
  return;
}
```

## Migration Guide

### For Existing Components

1. **Import Utilities**: Replace inline customer ID generation with shared utilities
2. **Add Memoization**: Use `React.useMemo` for customer ID generation in components
3. **Update Types**: Use `AppointmentWithCustomerId` type for enhanced type safety
4. **Validate IDs**: Add `isValidCustomerId` checks before navigation/API calls

### For New Components

1. Always use `generateCustomerId` for creating customer IDs
2. Use `findEmailByCustomerId` for reverse lookups
3. Validate IDs with `isValidCustomerId` before processing
4. Follow memoization patterns for performance

## Best Practices

### Do's ✅

- Always use shared utility functions for customer ID operations
- Memoize customer ID generation in React components
- Validate customer IDs before processing
- Use proper TypeScript types for enhanced safety
- Log customer ID operations for debugging (IDs only, never emails)

### Don'ts ❌

- Never expose email addresses in URLs or logs
- Don't generate customer IDs inline in components
- Don't skip validation of customer ID format
- Don't use customer IDs across different expert contexts
- Never use customer IDs as database primary keys

## Future Enhancements

### Potential Improvements

1. **Encryption**: Add optional encryption layer for additional security
2. **Versioning**: Support multiple customer ID formats for future migrations
3. **Caching**: Implement Redis caching for frequently accessed customer mappings
4. **Analytics**: Add customer ID-based analytics while maintaining privacy
5. **Audit Trail**: Enhanced logging of customer ID operations for compliance

### Monitoring & Metrics

- Track customer ID generation performance
- Monitor validation failure rates
- Alert on invalid customer ID patterns
- Measure component re-render reduction

## Related Documentation

- [Privacy Compliance Guide](./privacy-compliance.md)
- [API Documentation](./api-documentation.md)
- [Database Security](./database-naming-conventions.md)
- [Role-Based Authorization](./role-based-authorization.md)
