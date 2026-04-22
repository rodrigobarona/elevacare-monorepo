#!/bin/bash

# Better Stack Health Check Test Script
# Tests all health check endpoints for Better Stack integration

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Default to localhost, but allow override
BASE_URL="${1:-http://localhost:3000}"

echo -e "${BLUE}🧪 Better Stack Health Check Test${NC}"
echo -e "${BLUE}===================================${NC}"
echo -e "Testing endpoint: ${BASE_URL}"
echo ""

# Check if jq is installed
if ! command -v jq &> /dev/null; then
    echo -e "${RED}❌ Error: jq is not installed${NC}"
    echo "Please install jq: brew install jq"
    exit 1
fi

# Test 1: Main Health Check
echo -e "${YELLOW}1️⃣ Testing main health check...${NC}"
RESPONSE=$(curl -s -w "\n%{http_code}" "${BASE_URL}/api/healthcheck")
HTTP_CODE=$(echo "$RESPONSE" | tail -n1)
BODY=$(echo "$RESPONSE" | sed '$d')

if [ "$HTTP_CODE" -eq 200 ]; then
    STATUS=$(echo "$BODY" | jq -r '.status')
    UPTIME=$(echo "$BODY" | jq -r '.uptime')
    echo -e "${GREEN}✅ Main health check: $STATUS (uptime: ${UPTIME}s)${NC}"
else
    echo -e "${RED}❌ Main health check failed (HTTP $HTTP_CODE)${NC}"
fi
echo ""

# Test 2: Health Check with Services Summary
echo -e "${YELLOW}2️⃣ Testing health check with services summary...${NC}"
RESPONSE=$(curl -s "${BASE_URL}/api/healthcheck?services=true")
OVERALL=$(echo "$RESPONSE" | jq -r '.services.overall')
TOTAL=$(echo "$RESPONSE" | jq -r '.services.summary.total')
HEALTHY=$(echo "$RESPONSE" | jq -r '.services.summary.healthy')
DEGRADED=$(echo "$RESPONSE" | jq -r '.services.summary.degraded')
DOWN=$(echo "$RESPONSE" | jq -r '.services.summary.down')

if [ "$OVERALL" == "healthy" ]; then
    echo -e "${GREEN}✅ Services overall: $OVERALL${NC}"
elif [ "$OVERALL" == "degraded" ]; then
    echo -e "${YELLOW}⚠️  Services overall: $OVERALL${NC}"
else
    echo -e "${RED}❌ Services overall: $OVERALL${NC}"
fi
echo -e "   Total: $TOTAL | Healthy: $HEALTHY | Degraded: $DEGRADED | Down: $DOWN"
echo ""

# Test 3: Detailed Health Check
echo -e "${YELLOW}3️⃣ Testing detailed health check...${NC}"
RESPONSE=$(curl -s "${BASE_URL}/api/healthcheck?detailed=true")
DETAILS_COUNT=$(echo "$RESPONSE" | jq -r '.services.details | length')
echo -e "${GREEN}✅ Retrieved detailed health for $DETAILS_COUNT services${NC}"
echo ""

# Test 4: List Available Services
echo -e "${YELLOW}4️⃣ Listing available services...${NC}"
RESPONSE=$(curl -s "${BASE_URL}/api/health/_list")
SERVICES=$(echo "$RESPONSE" | jq -r '.services[]')
TOTAL=$(echo "$RESPONSE" | jq -r '.total')
echo -e "${GREEN}✅ Found $TOTAL available services:${NC}"
echo "$SERVICES" | sed 's/^/   - /'
echo ""

# Test 5: Individual Service Health Checks
echo -e "${YELLOW}5️⃣ Testing individual service health checks...${NC}"
SERVICES_ARRAY=("vercel" "neon-database" "audit-database" "stripe" "clerk" "upstash-redis" "upstash-qstash" "resend" "posthog" "novu")

for service in "${SERVICES_ARRAY[@]}"; do
    RESPONSE=$(curl -s -w "\n%{http_code}" "${BASE_URL}/api/health/${service}")
    HTTP_CODE=$(echo "$RESPONSE" | tail -n1)
    BODY=$(echo "$RESPONSE" | sed '$d')
    
    if [ "$HTTP_CODE" -eq 200 ] || [ "$HTTP_CODE" -eq 503 ]; then
        STATUS=$(echo "$BODY" | jq -r '.status')
        RESPONSE_TIME=$(echo "$BODY" | jq -r '.responseTime')
        MESSAGE=$(echo "$BODY" | jq -r '.message')
        
        if [ "$STATUS" == "healthy" ]; then
            echo -e "   ${GREEN}✅ ${service}: $STATUS (${RESPONSE_TIME}ms)${NC}"
        elif [ "$STATUS" == "degraded" ]; then
            echo -e "   ${YELLOW}⚠️  ${service}: $STATUS (${RESPONSE_TIME}ms)${NC}"
            echo -e "      ${MESSAGE}"
        else
            echo -e "   ${RED}❌ ${service}: $STATUS (${RESPONSE_TIME}ms)${NC}"
            ERROR=$(echo "$BODY" | jq -r '.error')
            if [ "$ERROR" != "null" ]; then
                echo -e "      ${ERROR}"
            fi
        fi
    else
        echo -e "   ${RED}❌ ${service}: HTTP $HTTP_CODE${NC}"
    fi
done
echo ""

# Test 6: Better Stack User-Agent Detection
echo -e "${YELLOW}6️⃣ Testing Better Stack user-agent detection...${NC}"
RESPONSE=$(curl -s -H "User-Agent: BetterStack/1.0" "${BASE_URL}/api/healthcheck")
SOURCE=$(echo "$RESPONSE" | jq -r '.source')
if [ "$SOURCE" == "betterstack" ]; then
    echo -e "${GREEN}✅ Better Stack user-agent detected: $SOURCE${NC}"
else
    echo -e "${YELLOW}⚠️  Expected 'betterstack' but got: $SOURCE${NC}"
fi
echo ""

# Test 7: Response Time Analysis
echo -e "${YELLOW}7️⃣ Analyzing response times...${NC}"
echo -e "${BLUE}Service Response Times:${NC}"

RESPONSE=$(curl -s "${BASE_URL}/api/healthcheck?detailed=true")
echo "$RESPONSE" | jq -r '.services.details[] | "\(.service): \(.responseTime)ms - \(.status)"' | while IFS=: read -r service rest; do
    time=$(echo "$rest" | awk '{print $1}' | sed 's/ms//')
    status=$(echo "$rest" | awk '{print $3}')
    
    if [ "$time" -lt 200 ]; then
        echo -e "   ${GREEN}$service:$rest${NC}"
    elif [ "$time" -lt 1000 ]; then
        echo -e "   ${YELLOW}$service:$rest${NC}"
    else
        echo -e "   ${RED}$service:$rest${NC}"
    fi
done
echo ""

# Test 8: Configuration Check
echo -e "${YELLOW}8️⃣ Checking service configuration...${NC}"
RESPONSE=$(curl -s "${BASE_URL}/api/healthcheck")
CONFIG=$(echo "$RESPONSE" | jq -r '.config')

HAS_DATABASE=$(echo "$CONFIG" | jq -r '.hasDatabase')
HAS_AUTH=$(echo "$CONFIG" | jq -r '.hasAuth')
HAS_STRIPE=$(echo "$CONFIG" | jq -r '.hasStripe')
HAS_REDIS=$(echo "$CONFIG" | jq -r '.hasRedis')
HAS_QSTASH=$(echo "$CONFIG" | jq -r '.hasQStash')
HAS_EMAIL=$(echo "$CONFIG" | jq -r '.hasEmail')
HAS_NOVU=$(echo "$CONFIG" | jq -r '.hasNovu')

echo -e "   Database: $([ "$HAS_DATABASE" == "true" ] && echo -e "${GREEN}✅${NC}" || echo -e "${RED}❌${NC}")"
echo -e "   Auth (Clerk): $([ "$HAS_AUTH" == "true" ] && echo -e "${GREEN}✅${NC}" || echo -e "${RED}❌${NC}")"
echo -e "   Stripe: $([ "$HAS_STRIPE" == "true" ] && echo -e "${GREEN}✅${NC}" || echo -e "${RED}❌${NC}")"
echo -e "   Redis: $([ "$HAS_REDIS" == "true" ] && echo -e "${GREEN}✅${NC}" || echo -e "${RED}❌${NC}")"
echo -e "   QStash: $([ "$HAS_QSTASH" == "true" ] && echo -e "${GREEN}✅${NC}" || echo -e "${RED}❌${NC}")"
echo -e "   Email: $([ "$HAS_EMAIL" == "true" ] && echo -e "${GREEN}✅${NC}" || echo -e "${RED}❌${NC}")"
echo -e "   Novu: $([ "$HAS_NOVU" == "true" ] && echo -e "${GREEN}✅${NC}" || echo -e "${RED}❌${NC}")"
echo ""

# Summary
echo -e "${BLUE}===================================${NC}"
echo -e "${GREEN}✅ All tests completed!${NC}"
echo ""
echo -e "${BLUE}Next Steps:${NC}"
echo "1. Review any services showing 'down' or 'degraded' status"
echo "2. Set up Better Stack monitors using these endpoints"
echo "3. Create status page with service resources"
echo ""
echo -e "${BLUE}Better Stack Monitor URLs:${NC}"
echo "Overall Health:    ${BASE_URL}/api/healthcheck?services=true"
echo "Individual Services:"
for service in "${SERVICES_ARRAY[@]}"; do
    echo "  - ${service}: ${BASE_URL}/api/health/${service}"
done
echo ""
echo -e "${BLUE}Documentation:${NC}"
echo "Full Guide: docs/03-infrastructure/monitoring/02-betterstack-integration.md"
echo "Quick Ref:  docs/03-infrastructure/monitoring/betterstack-quick-reference.md"
