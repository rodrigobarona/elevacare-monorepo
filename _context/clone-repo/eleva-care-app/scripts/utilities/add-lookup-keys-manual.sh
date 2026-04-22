#!/bin/bash

# Add Lookup Keys to Existing Stripe Prices
# This script uses the Stripe CLI to add lookup keys

echo "🔑 Adding Lookup Keys to Existing Stripe Prices"
echo ""

# Check if Stripe CLI is installed
if ! command -v stripe &> /dev/null; then
    echo "❌ Stripe CLI not found"
    echo "Install it: https://stripe.com/docs/stripe-cli"
    exit 1
fi

echo "✅ Stripe CLI found"
echo ""

# Community Expert Monthly
echo "📝 Updating: Community Expert Monthly"
stripe prices update price_1SQbV5K5Ap4Um3SpD65qOwZB \
  --lookup-key community-expert-monthly

# Community Expert Annual
echo "📝 Updating: Community Expert Annual"
stripe prices update price_1SQXF5K5Ap4Um3SpekZpC9fQ \
  --lookup-key community-expert-annual

# Top Expert Monthly (Note: This is $155, should be $177)
echo "📝 Updating: Top Expert Monthly"
stripe prices update price_1SQbV6K5Ap4Um3SpwFKRCoJo \
  --lookup-key top-expert-monthly

# Top Expert Annual
echo "📝 Updating: Top Expert Annual"
stripe prices update price_1SQXF5K5Ap4Um3SpzT4S3agl \
  --lookup-key top-expert-annual

# Lecturer Module Annual
echo "📝 Updating: Lecturer Module Annual"
stripe prices update price_1SQXF5K5Ap4Um3SpQCBwSFml \
  --lookup-key lecturer-module-annual

echo ""
echo "✅ Done! Verifying..."
echo ""

# Verify
echo "🔍 Verifying lookup keys:"
stripe prices list --lookup-keys community-expert-monthly
stripe prices list --lookup-keys top-expert-monthly
stripe prices list --lookup-keys community-expert-annual
stripe prices list --lookup-keys top-expert-annual
stripe prices list --lookup-keys lecturer-module-annual

echo ""
echo "✨ Lookup keys added successfully!"

