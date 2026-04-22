/**
 * Add Lookup Keys to Existing Stripe Prices
 *
 * This script adds lookup keys to existing Stripe prices
 * to enable the new lookup-key based pricing system.
 *
 * Usage:
 *   bun scripts/utilities/add-lookup-keys-to-prices.ts
 */

import Stripe from 'stripe';
import * as dotenv from 'dotenv';
import * as path from 'path';
import { fileURLToPath } from 'url';

// Load environment variables from .env.local
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const envPath = path.resolve(__dirname, '../../.env.local');

console.log(`Loading environment from: ${envPath}`);
dotenv.config({ path: envPath });

if (!process.env.STRIPE_SECRET_KEY) {
  console.error('❌ Error: STRIPE_SECRET_KEY not found in .env.local');
  console.error('Please ensure your .env.local file contains STRIPE_SECRET_KEY');
  process.exit(1);
}

// Use API version from environment, with current default
// Current: 2025-09-30.clover (Latest: 2025-10-29.clover - not yet implemented)
const STRIPE_API_VERSION = (process.env.STRIPE_API_VERSION || '2025-09-30.clover') as Stripe.LatestApiVersion;

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
  apiVersion: STRIPE_API_VERSION,
  typescript: true,
});

/**
 * Mapping of existing price IDs to their lookup keys
 * Update these IDs with your actual Stripe price IDs
 */
const PRICE_LOOKUP_KEY_MAP = {
  // Community Expert
  'price_1SQbV5K5Ap4Um3SpD65qOwZB': 'community-expert-monthly',
  'price_1SQXF5K5Ap4Um3SpekZpC9fQ': 'community-expert-annual',

  // Top Expert
  'price_1SQbV6K5Ap4Um3SpwFKRCoJo': 'top-expert-monthly', // Note: This is $155, should be $177
  'price_1SQXF5K5Ap4Um3SpzT4S3agl': 'top-expert-annual',

  // Lecturer Module
  'price_1SQXF5K5Ap4Um3SpQCBwSFml': 'lecturer-module-annual',
} as const;

async function addLookupKeys() {
  console.log('🔑 Adding lookup keys to existing Stripe prices...\n');

  const results: Array<{ success: boolean; priceId: string; lookupKey: string; error?: string }> =
    [];

  for (const [priceId, lookupKey] of Object.entries(PRICE_LOOKUP_KEY_MAP)) {
    try {
      console.log(`📝 Processing: ${priceId} → ${lookupKey}`);

      // Check if price exists
      const price = await stripe.prices.retrieve(priceId);
      console.log(`   Found: ${price.nickname || 'No nickname'} ($${price.unit_amount ? price.unit_amount / 100 : 0})`);

      // Check if lookup key already set
      if (price.lookup_key) {
        console.log(`   ℹ️  Lookup key already set: ${price.lookup_key}`);
        if (price.lookup_key !== lookupKey) {
          console.log(`   ⚠️  WARNING: Current key "${price.lookup_key}" doesn't match desired "${lookupKey}"`);
          console.log(`   Updating to: ${lookupKey}`);
          await stripe.prices.update(priceId, {
            lookup_key: lookupKey,
          });
          console.log(`   ✅ Updated successfully\n`);
        } else {
          console.log(`   ✅ Already correct\n`);
        }
        results.push({ success: true, priceId, lookupKey });
        continue;
      }

      // Add lookup key
      await stripe.prices.update(priceId, {
        lookup_key: lookupKey,
      });

      console.log(`   ✅ Added lookup key: ${lookupKey}\n`);
      results.push({ success: true, priceId, lookupKey });
    } catch (error) {
      console.error(`   ❌ Error:`, error);
      results.push({
        success: false,
        priceId,
        lookupKey,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  // Summary
  console.log('\n' + '='.repeat(60));
  console.log('📊 Summary:');
  console.log('='.repeat(60));

  const successful = results.filter((r) => r.success).length;
  const failed = results.filter((r) => !r.success).length;

  console.log(`✅ Successful: ${successful}/${results.length}`);
  console.log(`❌ Failed: ${failed}/${results.length}\n`);

  if (failed > 0) {
    console.log('Failed updates:');
    results
      .filter((r) => !r.success)
      .forEach((r) => {
        console.log(`   - ${r.priceId} → ${r.lookupKey}`);
        console.log(`     Error: ${r.error}\n`);
      });
  }

  // Verification
  console.log('\n' + '='.repeat(60));
  console.log('🔍 Verification:');
  console.log('='.repeat(60));

  for (const lookupKey of Object.values(PRICE_LOOKUP_KEY_MAP)) {
    try {
      const prices = await stripe.prices.list({
        lookup_keys: [lookupKey],
        limit: 1,
      });

      if (prices.data.length > 0) {
        console.log(`✅ ${lookupKey}:`);
        console.log(`   ID: ${prices.data[0].id}`);
        console.log(`   Amount: $${prices.data[0].unit_amount ? prices.data[0].unit_amount / 100 : 0}`);
        console.log(`   Active: ${prices.data[0].active}`);
      } else {
        console.log(`❌ ${lookupKey}: Not found`);
      }
    } catch (error) {
      console.log(`❌ ${lookupKey}: Error - ${error}`);
    }
  }

  console.log('\n✨ Done!');
}

// Run the script
addLookupKeys().catch((error) => {
  console.error('💥 Script failed:', error);
  process.exit(1);
});

