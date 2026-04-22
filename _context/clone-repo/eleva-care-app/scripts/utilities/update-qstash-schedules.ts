#!/usr/bin/env tsx
/**
 * This script updates QStash schedules using our new configuration
 * It uses the improved setup-qstash-schedules library instead of direct API calls
 *
 * Usage:
 * npx tsx scripts/update-qstash-schedules.ts
 */
// Load environment variables first
import * as dotenv from 'dotenv';
import { qstash } from '@/config/qstash';
import { isQStashAvailable } from '@/lib/integrations/qstash/config';
// Other imports
import { setupQStashSchedules } from '@/lib/integrations/qstash/schedules';

dotenv.config();

// Debug environment variables
console.log('Environment check:');
console.log(`QSTASH_TOKEN exists: ${!!process.env.QSTASH_TOKEN}`);
console.log(`QSTASH_CURRENT_SIGNING_KEY exists: ${!!process.env.QSTASH_CURRENT_SIGNING_KEY}`);
console.log(`QSTASH_NEXT_SIGNING_KEY exists: ${!!process.env.QSTASH_NEXT_SIGNING_KEY}`);

// Ensure this runs as a script
if (require.main === module) {
  main()
    .then(() => process.exit(0))
    .catch((error) => {
      console.error('Error updating QStash schedules:', error);
      process.exit(1);
    });
}

async function main() {
  console.log('🔄 Updating QStash schedules...');

  // Validate QStash availability
  const available = await isQStashAvailable();
  if (!available) {
    console.error('❌ QStash is not available or not properly configured.');
    console.error('Make sure your QSTASH_TOKEN and signing keys are set in environment variables.');
    process.exit(1);
  }

  console.log(`Using application base URL: ${qstash.baseUrl}`);

  // Set up the schedules
  const results = await setupQStashSchedules();

  // Summarize results
  const successCount = results.filter((r) => r.success).length;
  const failureCount = results.filter((r) => !r.success).length;

  console.log('\n📊 Summary:');
  console.log(`Created/updated ${successCount} schedules, ${failureCount} failures.`);

  if (failureCount > 0) {
    console.error('\n❌ Failures:');
    const failures = results.filter((r) => !r.success);
    for (const r of failures) {
      console.error(`- ${r.name}: ${r.error}`);
    }
    process.exit(1);
  }

  console.log('\n✅ All QStash schedules updated successfully!');
}
