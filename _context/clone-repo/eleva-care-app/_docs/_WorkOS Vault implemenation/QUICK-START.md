# WorkOS Vault - Quick Start Guide

**Get up and running with WorkOS Vault in 10 minutes!**

---

## 📋 Prerequisites

- ✅ WorkOS account with API key
- ✅ Neon database (already configured)
- ✅ Application using WorkOS AuthKit
- ✅ Node.js 18+ and pnpm installed

---

## 🚀 Quick Setup (3 Steps)

### Step 1: Configure Environment (2 minutes)

Add to your `.env.local`:

```bash
# WorkOS API Key (you already have this)
WORKOS_API_KEY=sk_test_your_key_here

# Enable Vault (start with false for testing)
WORKOS_VAULT_ENABLED=false

# Keep your legacy key during migration
ENCRYPTION_KEY=your_existing_encryption_key
```

### Step 2: Run Database Migration (1 minute)

```bash
# Generate and run migration
pnpm drizzle:generate
pnpm drizzle:migrate

# Or manually:
psql $DATABASE_URL < drizzle/migrations-manual/010_add_vault_encryption_columns.sql
```

### Step 3: Test the Implementation (2 minutes)

```typescript
// In any server component or API route
import { testVaultConnection } from '@/lib/integrations/workos/vault';

// Use a real org ID from your database
const result = await testVaultConnection('org_01H1234567890');

console.log('Vault Status:', result ? '✅ Working' : '❌ Failed');
```

---

## ✅ Verify Installation

### 1. Check Database Columns

```sql
-- Verify new columns exist
SELECT column_name FROM information_schema.columns 
WHERE table_name = 'records' AND column_name LIKE '%vault%';

-- Should return:
-- vault_encrypted_content
-- vault_encrypted_metadata  
-- encryption_method
```

### 2. Check Configuration

```typescript
import { getVaultStatus } from '@/config/vault';

const status = getVaultStatus();
console.log(status);
// {
//   enabled: false,
//   migrationEnabled: false,
//   apiKeyConfigured: true,
//   batchSize: 100,
//   verboseLogging: false
// }
```

---

## 🧪 Enable Vault for Testing

### Option 1: Test Mode (Recommended)

Keep `WORKOS_VAULT_ENABLED=false` and test manually:

```typescript
// Force Vault encryption for testing
import { encryptForOrg, decryptForOrg } from '@/lib/integrations/workos/vault';

const testData = 'Sensitive patient data';

// Encrypt
const encrypted = await encryptForOrg(
  'org_01H1234567890',
  testData,
  {
    userId: 'user_test',
    dataType: 'medical_record',
  }
);

// Decrypt
const decrypted = await decryptForOrg(
  'org_01H1234567890',
  encrypted,
  {
    userId: 'user_test',
    dataType: 'medical_record',
  }
);

console.assert(decrypted === testData, 'Should match!');
```

### Option 2: Enable for All New Data

```bash
# .env.local
WORKOS_VAULT_ENABLED=true
```

Restart your app. All new data will be dual-written (Vault + legacy).

---

## 📊 Monitor Your Implementation

### Check Encryption Distribution

```sql
-- See which encryption method is being used
SELECT 
  encryption_method,
  COUNT(*) as count,
  ROUND(COUNT(*) * 100.0 / SUM(COUNT(*)) OVER(), 2) as percentage
FROM records
GROUP BY encryption_method;
```

Expected results:
- Before enabling: `100% aes-256-gcm`
- After enabling: Mix of both (new = vault, old = aes-256-gcm)

### Check Application Logs

```bash
# Look for successful encryptions
grep "Vault.*Encrypted" logs/*.log

# Expected output:
# [Vault] ✅ Encrypted data { orgId: 'org_123', dataType: 'medical_record', duration: '45ms' }
```

---

## 🔄 Next Steps

### Immediate (Development/Staging)

1. ✅ **Test Google OAuth Connection**
   - Connect Google Calendar
   - Verify tokens are dual-written
   - Check logs for Vault encryption

2. ✅ **Create a Test Medical Record**
   ```typescript
   // Your existing records API will automatically use Vault if enabled
   POST /api/appointments/[id]/records
   {
     "content": "Test record with Vault encryption"
   }
   ```

3. ✅ **Verify Fallback Works**
   - Read old records (legacy encrypted)
   - Should work seamlessly with no errors

### Short-term (1-2 weeks)

1. 📝 **Write Unit Tests** (see migration plan for examples)
2. ⚡ **Performance Testing** (benchmark Vault vs legacy)
3. 🔒 **Security Audit** (verify key isolation)

### Medium-term (3-4 weeks)

1. 🚚 **Migrate Existing Data**
   ```bash
   # Run migration scripts (to be created)
   pnpm tsx scripts/migrate-records-to-vault.ts
   pnpm tsx scripts/migrate-google-tokens-to-vault.ts
   ```

2. 📈 **Monitor Production** (error rates, latency, fallback usage)

### Long-term (1-2 months)

1. 🧹 **Cleanup Phase**
   - Remove legacy encryption code
   - Drop legacy database columns
   - Remove `ENCRYPTION_KEY` from environment

---

## 🐛 Common Issues

### Issue: "Cannot find module '@/lib/integrations/workos/vault'"

**Solution:** Run `pnpm install` and restart TypeScript server

### Issue: Migration fails with "column already exists"

**Solution:** Migration already ran. Check with:
```sql
SELECT * FROM information_schema.columns 
WHERE table_name = 'records' AND column_name = 'vault_encrypted_content';
```

### Issue: Vault encryptions failing

**Checklist:**
- [ ] `WORKOS_API_KEY` is set
- [ ] API key is valid (check WorkOS dashboard)
- [ ] Organization ID is correct format (`org_...`)
- [ ] Network access to WorkOS API (check firewall)

**Debug:**
```bash
# Enable verbose logging
VAULT_VERBOSE_LOGGING=true
```

---

## 📚 Learn More

- 📖 **Full Migration Plan:** `workos-vault-migration-plan.md`
- 📖 **Implementation Details:** `IMPLEMENTATION-COMPLETE.md`
- 🌐 **WorkOS Vault Docs:** https://workos.com/docs/vault
- 💻 **WorkOS Node SDK:** https://github.com/workos/workos-node

---

## 🎯 Success Criteria

You're ready to move forward when:

- ✅ Database migration completed successfully
- ✅ Vault connection test passes
- ✅ New Google OAuth connections dual-write
- ✅ Logs show successful Vault operations
- ✅ Legacy data still decrypts correctly
- ✅ No errors in application logs

---

## 🆘 Need Help?

1. **Check Logs:** Enable `VAULT_VERBOSE_LOGGING=true`
2. **Test Connection:** Run `testVaultConnection(orgId)`
3. **Verify Config:** Check `getVaultStatus()`
4. **Review Docs:** See `IMPLEMENTATION-COMPLETE.md`

---

**🎉 Congratulations!** You're now ready to use WorkOS Vault for enterprise-grade encryption with org-level key isolation!

