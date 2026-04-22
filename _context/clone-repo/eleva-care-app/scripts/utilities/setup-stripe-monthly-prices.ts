/**
 * Stripe Monthly Price Setup Script
 *
 * This script creates recurring monthly prices for the subscription products.
 * Complements the existing annual prices with monthly options.
 *
 * Run with: bun scripts/utilities/setup-stripe-monthly-prices.ts
 */
import { STRIPE_CONFIG } from '@/config/stripe';
import dotenv from 'dotenv';
import Stripe from 'stripe';

// Load environment variables
dotenv.config();

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: STRIPE_CONFIG.API_VERSION as Stripe.LatestApiVersion,
});

const PRODUCTS = {
  communityExpertMonthly: {
    productId: 'prod_TNHmsNWSOqt7M3',
    name: 'Community Expert Monthly Subscription',
    amount: 4900, // $49/month ($588/year)
    description: 'Monthly subscription with 12% commission (reduced from 20%)',
  },
  topExpertMonthly: {
    productId: 'prod_TNHnHt7MHvboaP',
    name: 'Top Expert Monthly Subscription',
    amount: 15500, // $155/month ($1,860/year)
    description: 'Monthly subscription with 8% commission (reduced from 15%)',
  },
};

async function createMonthlyPrices() {
  console.log('🎯 Creating recurring monthly prices for subscription products...\n');

  try {
    // 1. Community Expert Monthly
    console.log('Creating Community Expert Monthly price...');
    const communityPrice = await stripe.prices.create({
      product: PRODUCTS.communityExpertMonthly.productId,
      unit_amount: PRODUCTS.communityExpertMonthly.amount,
      currency: 'usd',
      recurring: {
        interval: 'month',
        interval_count: 1,
      },
      nickname: 'Community Expert Monthly',
      metadata: {
        tier: 'community',
        planType: 'monthly',
        commissionRate: '1200', // 12% in basis points
      },
    });
    console.log(`✅ Community Expert Monthly: ${communityPrice.id}`);
    console.log(`   → https://dashboard.stripe.com/prices/${communityPrice.id}\n`);

    // 2. Top Expert Monthly
    console.log('Creating Top Expert Monthly price...');
    const topPrice = await stripe.prices.create({
      product: PRODUCTS.topExpertMonthly.productId,
      unit_amount: PRODUCTS.topExpertMonthly.amount,
      currency: 'usd',
      recurring: {
        interval: 'month',
        interval_count: 1,
      },
      nickname: 'Top Expert Monthly',
      metadata: {
        tier: 'top',
        planType: 'monthly',
        commissionRate: '800', // 8% in basis points
      },
    });
    console.log(`✅ Top Expert Monthly: ${topPrice.id}`);
    console.log(`   → https://dashboard.stripe.com/prices/${topPrice.id}\n`);

    // Summary
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('🎉 SUCCESS! All recurring monthly prices created.');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

    console.log('📋 Add these to your .env file:\n');
    console.log(`STRIPE_PRICE_COMMUNITY_MONTHLY=${communityPrice.id}`);
    console.log(`STRIPE_PRICE_TOP_MONTHLY=${topPrice.id}\n`);

    console.log('💰 Pricing Breakdown:');
    console.log('Community Expert:');
    console.log('  - Monthly: $49/month ($588/year total)');
    console.log('  - Annual: $490/year (save $98 = 20% off)');
    console.log('');
    console.log('Top Expert:');
    console.log('  - Monthly: $155/month ($1,860/year total)');
    console.log('  - Annual: $1,490/year (save $370 = 20% off)\n');

    console.log('📝 Next steps:');
    console.log('1. Add the monthly price IDs to .env and .env.local');
    console.log('2. Update config/subscription-pricing.ts');
    console.log('3. Update database schema with billingInterval column');
    console.log('4. Update UI to show monthly/annual toggle');
    console.log('5. Restart your dev server\n');

    return {
      communityExpertMonthly: communityPrice.id,
      topExpertMonthly: topPrice.id,
    };
  } catch (error) {
    console.error('❌ Error creating prices:', error);
    throw error;
  }
}

// Run the script
createMonthlyPrices()
  .then(() => {
    console.log('✅ Script completed successfully!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Script failed:', error);
    process.exit(1);
  });
