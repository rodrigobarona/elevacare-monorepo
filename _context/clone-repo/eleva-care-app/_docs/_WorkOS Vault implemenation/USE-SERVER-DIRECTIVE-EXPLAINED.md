# 'use server' Directive in Next.js 16

**Date:** January 15, 2025  
**Context:** WorkOS Vault Implementation - Understanding Server Directives

---

## 🤔 The Question

> "By default in Next.js 16, all is React Server Components and are server-side by default, right? You do not need to be specific, only if it's 'use client' you have to add it to be very clear."

**Answer:** You're **partially correct**, but there's an important distinction! Let me explain:

---

## 📚 The Two Types of Server-Side Code

### 1. **Server Components** (Default - NO directive needed)

```typescript
// ✅ This is a Server Component by default (no directive needed)
// app/page.tsx
export default async function Page() {
  const data = await fetch('https://api.example.com/data');
  return <div>{data}</div>;
}
```

**Characteristics:**

- ✅ Runs on server during rendering
- ✅ NO `'use server'` directive needed
- ✅ Default in Next.js App Router
- ✅ Can access database, file system, etc.
- ❌ CANNOT be called from Client Components
- ❌ CANNOT be used as form actions or event handlers

### 2. **Server Actions** (Requires `'use server'` directive)

```typescript
// ✅ This is a Server Action (needs 'use server')
// app/actions.ts
'use server';

export async function createPost(formData: FormData) {
  await db.insert(formData);
}
```

**Characteristics:**

- ✅ Runs on server when invoked
- ✅ REQUIRES `'use server'` directive
- ✅ Can be called from Client Components
- ✅ Can be used as form actions
- ✅ Can be passed as props to Client Components
- ✅ Accessible via POST requests from client

---

## 🎯 When to Use `'use server'`

### ❌ **DON'T NEED** `'use server'`:

```typescript
// Regular Server Component - NO directive needed
export default async function UserProfile({ userId }: { userId: string }) {
  const user = await db.users.findOne({ id: userId });
  return <div>{user.name}</div>;
}

// Regular utility function - NO directive needed
export function formatDate(date: Date): string {
  return date.toISOString();
}

// Server-side data fetching - NO directive needed
export async function getStaticProps() {
  const data = await fetch('...');
  return { props: { data } };
}
```

### ✅ **DO NEED** `'use server'`:

```typescript
// 1. Functions called from Client Components
'use server';

export async function updateProfile(formData: FormData) {
  await db.update(formData);
}

// 2. Form actions
('use server');

export async function handleSubmit(formData: FormData) {
  // Process form
}

// 3. Functions passed as props to Client Components
('use server');

export async function deletePost(id: string) {
  await db.posts.delete(id);
}
```

---

## 🔍 Why `vault.ts` Needs `'use server'`

### **Our Current Code:**

```typescript
// src/lib/integrations/workos/vault.ts
'use server'; // ✅ NEEDED!

export async function encryptForOrg(
  orgId: string,
  plaintext: string,
  context: EncryptionContext,
): Promise<string> {
  // ... encryption logic
}

export async function decryptForOrg(
  orgId: string,
  ciphertext: string,
  context: EncryptionContext,
): Promise<string> {
  // ... decryption logic
}
```

### **Why `'use server'` is Required:**

1. **Called from other Server Actions:**

   ```typescript
   // src/lib/utils/encryption-vault.ts
   'use server'

   import { encryptForOrg } from '@/lib/integrations/workos/vault';

   export async function vaultEncrypt(...) {
     return await encryptForOrg(...); // Calling Server Action
   }
   ```

2. **Used in form actions:**

   ```typescript
   // Future use case
   'use client'

   import { encryptForOrg } from '@/lib/integrations/workos/vault';

   export function EncryptForm() {
     return (
       <button onClick={() => encryptForOrg(...)}>
         Encrypt
       </button>
     );
   }
   ```

3. **Needs to be accessible across Server/Client boundary:**
   - These functions may be called from Client Components
   - They handle sensitive operations (encryption)
   - They need to run securely on the server

---

## 🔍 Why `vault-utils.ts` Does NOT Need `'use server'`

### **Our Utility File:**

```typescript
// src/lib/integrations/workos/vault-utils.ts
// NO 'use server' directive

export function isVaultEnabled(): boolean {
  return process.env.WORKOS_VAULT_ENABLED === 'true';
}

export function validateOrgId(orgId: string): boolean {
  if (!orgId.startsWith('org_')) {
    throw new Error('Invalid org ID');
  }
  return true;
}
```

### **Why NO `'use server'`:**

1. **Pure utility functions:**
   - No external calls
   - No database access
   - No side effects

2. **Only used server-side:**
   - Imported by `vault.ts` (server)
   - Not called from Client Components
   - Not passed as props

3. **Synchronous:**
   - Can't use `'use server'` with sync functions in Next.js 16
   - Would cause build error

---

## 📖 From Next.js Documentation

### **File-Level `'use server'`:**

```typescript
// ✅ CORRECT: All exports are async Server Actions
'use server';

export async function createUser(data) {
  await db.user.create({ data });
}

export async function deleteUser(id) {
  await db.user.delete({ id });
}
```

### **Function-Level `'use server'`:**

```typescript
// ✅ CORRECT: Individual function marked as Server Action
export default function Page() {
  async function createPost(formData: FormData) {
    'use server'
    await savePost(formData);
  }

  return <form action={createPost}>...</form>
}
```

### **Common Mistake:**

```typescript
// ❌ WRONG: Exporting non-async from 'use server' file
'use server';

export const value = 1; // ERROR!
export function getData() {
  return '...';
} // ERROR!
```

---

## 🎯 Decision Matrix

| Scenario                         | Need `'use server'`? | Example                          |
| -------------------------------- | -------------------- | -------------------------------- |
| Server Component                 | ❌ No                | `async function Page()`          |
| Utility function (sync)          | ❌ No                | `function formatDate()`          |
| Database query (internal)        | ❌ No                | `async function getUser()`       |
| Form action                      | ✅ Yes               | `async function handleSubmit()`  |
| Called from Client               | ✅ Yes               | `async function updateProfile()` |
| Passed as prop                   | ✅ Yes               | `async function deleteItem()`    |
| Mutation with cache invalidation | ✅ Yes               | `async function createPost()`    |

---

## ✅ Our Implementation is Correct

### **Files with `'use server'` (Correct):**

1. ✅ `src/lib/integrations/workos/vault.ts`
   - Exports async Server Actions
   - Can be called from anywhere
   - Handles sensitive encryption operations

2. ✅ `src/lib/utils/encryption-vault.ts`
   - Exports async Server Actions
   - Abstracts Vault functionality
   - Can be imported by other Server Actions

3. ✅ `src/lib/integrations/google/oauth-tokens.ts`
   - Handles Google OAuth token storage
   - Called from authentication flows
   - Needs server-side execution

### **Files WITHOUT `'use server'` (Also Correct):**

1. ✅ `src/lib/integrations/workos/vault-utils.ts`
   - Pure utility functions
   - Synchronous operations
   - Only used server-side

---

## 🚀 Summary

**Your intuition is correct about Server Components, BUT:**

1. **Server Components** (default):
   - No directive needed
   - Can't be called from Client Components

2. **Server Actions** (explicit):
   - Need `'use server'` directive
   - CAN be called from Client Components
   - This is why we need it in `vault.ts`

**Think of it this way:**

- `'use client'` = "I need browser APIs"
- `'use server'` = "I'm a function that can be called from the client"
- No directive = "I'm a Server Component (default)"

---

## 📚 References

- **Next.js Server Actions:** https://nextjs.org/docs/app/api-reference/directives/use-server
- **Server vs Client Components:** https://nextjs.org/docs/app/getting-started/server-and-client-components
- **Invalid 'use server' Error:** https://nextjs.org/docs/messages/invalid-use-server-value

---

**TL;DR:** We **DO** need `'use server'` in `vault.ts` because these are Server Actions that can be called from anywhere, not just regular Server Components. The directive makes them accessible across the client/server boundary. 🎯
