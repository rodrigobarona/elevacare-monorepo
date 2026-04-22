/**
 * Stripe Recurring Price Setup Script
 *
 * This script creates recurring annual prices for the subscription products.
 * The Stripe MCP tool only creates one-time prices, so we need to manually
 * create the recurring annual prices.
 *
 * Run with: bun scripts/utilities/setup-stripe-recurring-prices.ts
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
  communityExpertAnnual: {
    productId: 'prod_TNHmsNWSOqt7M3',
    name: 'Community Expert Annual Subscription',
    amount: 49000, // $490/year
    description: 'Annual subscription with 12% commission (reduced from 20%)',
  },
  topExpertAnnual: {
    productId: 'prod_TNHnHt7MHvboaP',
    name: 'Top Expert Annual Subscription',
    amount: 149000, // $1,490/year
    description: 'Annual subscription with 8% commission (reduced from 15%)',
  },
  lecturerAddonAnnual: {
    productId: 'prod_TNHnIkS4cWC4MW',
    name: 'Lecturer Module Annual Add-on',
    amount: 49000, // $490/year
    description: 'Annual add-on with 3% commission on course sales',
  },
};

async function createRecurringPrices() {
  console.log('🎯 Creating recurring annual prices for subscription products...\n');

  try {
    // 1. Community Expert Annual
    console.log('Creating Community Expert Annual price...');
    const communityPrice = await stripe.prices.create({
      product: PRODUCTS.communityExpertAnnual.productId,
      unit_amount: PRODUCTS.communityExpertAnnual.amount,
      currency: 'usd',
      recurring: {
        interval: 'year',
        interval_count: 1,
      },
      nickname: 'Community Expert Annual',
      metadata: {
        tier: 'community',
        planType: 'annual',
        commissionRate: '1200', // 12% in basis points
      },
    });
    console.log(`✅ Community Expert Annual: ${communityPrice.id}`);
    console.log(`   → https://dashboard.stripe.com/prices/${communityPrice.id}\n`);

    // 2. Top Expert Annual
    console.log('Creating Top Expert Annual price...');
    const topPrice = await stripe.prices.create({
      product: PRODUCTS.topExpertAnnual.productId,
      unit_amount: PRODUCTS.topExpertAnnual.amount,
      currency: 'usd',
      recurring: {
        interval: 'year',
        interval_count: 1,
      },
      nickname: 'Top Expert Annual',
      metadata: {
        tier: 'top',
        planType: 'annual',
        commissionRate: '800', // 8% in basis points
      },
    });
    console.log(`✅ Top Expert Annual: ${topPrice.id}`);
    console.log(`   → https://dashboard.stripe.com/prices/${topPrice.id}\n`);

    // 3. Lecturer Add-on Annual
    console.log('Creating Lecturer Add-on Annual price...');
    const lecturerPrice = await stripe.prices.create({
      product: PRODUCTS.lecturerAddonAnnual.productId,
      unit_amount: PRODUCTS.lecturerAddonAnnual.amount,
      currency: 'usd',
      recurring: {
        interval: 'year',
        interval_count: 1,
      },
      nickname: 'Lecturer Module Annual',
      metadata: {
        addon: 'lecturer',
        planType: 'annual',
        commissionRate: '300', // 3% in basis points
      },
    });
    console.log(`✅ Lecturer Module Annual: ${lecturerPrice.id}`);
    console.log(`   → https://dashboard.stripe.com/prices/${lecturerPrice.id}\n`);

    // Summary
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('🎉 SUCCESS! All recurring prices created.');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

    console.log('📋 Add these to your .env file:\n');
    console.log(`STRIPE_PRICE_COMMUNITY_ANNUAL=${communityPrice.id}`);
    console.log(`STRIPE_PRICE_TOP_ANNUAL=${topPrice.id}`);
    console.log(`STRIPE_PRICE_LECTURER_ADDON_ANNUAL=${lecturerPrice.id}\n`);

    console.log('📝 Next steps:');
    console.log('1. Add the price IDs to .env and .env.local');
    console.log('2. Restart your dev server');
    console.log('3. Test subscription creation flow');
    console.log('4. Set up Stripe webhooks for subscription events\n');

    return {
      communityExpertAnnual: communityPrice.id,
      topExpertAnnual: topPrice.id,
      lecturerAddonAnnual: lecturerPrice.id,
    };
  } catch (error) {
    console.error('❌ Error creating prices:', error);
    throw error;
  }
}

// Run the script
createRecurringPrices()
  .then(() => {
    console.log('✅ Script completed successfully!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Script failed:', error);
    process.exit(1);
  });
