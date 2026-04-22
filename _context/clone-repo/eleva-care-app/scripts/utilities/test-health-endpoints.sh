#!/bin/bash
# Test Health Endpoints for BetterStack Integration
# Usage: ./scripts/test-health-endpoints.sh [base-url]
# Example: ./scripts/test-health-endpoints.sh https://eleva.care
# Example: ./scripts/test-health-endpoints.sh http://localhost:3000

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Base URL (default to production)
BASE_URL="${1:-https://eleva.care}"

echo -e "${BLUE}🧪 Testing Health Endpoints${NC}"
echo -e "${BLUE}Base URL: ${BASE_URL}${NC}"
echo ""

# Function to test endpoint
test_endpoint() {
  local path=$1
  local name=$2
  
  echo -ne "${YELLOW}Testing ${name}...${NC} "
  
  # Make request and capture status code
  status_code=$(curl -s -o /dev/null -w "%{http_code}" "${BASE_URL}${path}")
  
  if [ "$status_code" == "200" ] || [ "$status_code" == "503" ]; then
    echo -e "${GREEN}✅ ${status_code}${NC}"
    return 0
  elif [ "$status_code" == "401" ]; then
    echo -e "${RED}❌ ${status_code} UNAUTHORIZED (Middleware blocking!)${NC}"
    return 1
  else
    echo -e "${RED}❌ ${status_code}${NC}"
    return 1
  fi
}

# Test overall health check
echo -e "${BLUE}=== Overall Health Check ===${NC}"
test_endpoint "/api/healthcheck" "Quick Health Check"
test_endpoint "/api/healthcheck?services=true" "Detailed Service Health"
echo ""

# Test service list
echo -e "${BLUE}=== Service List ===${NC}"
test_endpoint "/api/health/_list" "Available Services"
echo ""

# Test individual services
echo -e "${BLUE}=== Individual Service Health Checks ===${NC}"
test_endpoint "/api/health/vercel" "Vercel Deployment"
test_endpoint "/api/health/neon-database" "Neon Database"
test_endpoint "/api/health/audit-database" "Audit Database"
test_endpoint "/api/health/stripe" "Stripe API"
test_endpoint "/api/health/clerk" "Clerk Auth"
test_endpoint "/api/health/upstash-redis" "Upstash Redis"
test_endpoint "/api/health/upstash-qstash" "Upstash QStash"
test_endpoint "/api/health/resend" "Resend Email"
test_endpoint "/api/health/posthog" "PostHog Analytics"
test_endpoint "/api/health/novu" "Novu Notifications"

echo ""
echo -e "${GREEN}✅ All tests completed!${NC}"
echo ""
echo -e "${BLUE}Note:${NC}"
echo "- 200 = Service healthy ✅"
echo "- 503 = Service down (expected if service is actually down) ⚠️"
echo "- 401 = Middleware blocking (this is a BUG!) ❌"
