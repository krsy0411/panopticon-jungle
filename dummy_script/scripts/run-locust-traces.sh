#!/bin/bash

# Locust Traces Performance Test Runner
# This script helps run Locust trace tests with various configurations

set -e

# Colors for output
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Default configuration
PRODUCER_URL="${PRODUCER_URL:-https://api.jungle-panopticon.cloud/producer}"

# Get script directory and set locustfile path
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
LOCUST_FILE="${SCRIPT_DIR}/locustfile_traces.py"
REPORTS_DIR="$( cd "${SCRIPT_DIR}/.." && pwd )/reports"

echo -e "${BLUE}=================================================${NC}"
echo -e "${BLUE}🦗 Locust Traces Load Test Runner${NC}"
echo -e "${BLUE}=================================================${NC}"
echo ""

# Check if locust is installed (try both command and python module)
if command -v locust &> /dev/null; then
    LOCUST_CMD="locust"
elif python3 -m locust --version &> /dev/null; then
    LOCUST_CMD="python3 -m locust"
else
    echo -e "${RED}❌ Locust is not installed!${NC}"
    echo -e "${YELLOW}Install it with: pip3 install locust${NC}"
    exit 1
fi

echo -e "${GREEN}✓ Locust is installed${NC}"
echo -e "Target Server: ${BLUE}${PRODUCER_URL}${NC}"
echo ""

# Display menu
echo "Select test mode:"
echo "  1) Standard Test - 1M+ spans (10 users, Headless)"
echo "  2) Standard Test - Web UI mode (Interactive)"
echo "  3) Custom parameters"
echo ""
read -p "Enter choice [1-3]: " choice

case $choice in
    1)
        echo -e "${GREEN}Starting standard traces load test...${NC}"
        echo -e "${YELLOW}Goal: 1,000,000+ spans (333,334 requests × 3 spans each)${NC}"
        echo -e "${YELLOW}Users: 10 concurrent users${NC}"
        echo -e "${YELLOW}Test will auto-stop when target is reached${NC}"
        echo ""
        mkdir -p "$REPORTS_DIR"
        $LOCUST_CMD -f "$LOCUST_FILE" \
               --host "$PRODUCER_URL" \
               --users 10 \
               --spawn-rate 10 \
               --headless \
               --print-stats \
               --html "${REPORTS_DIR}/locust-traces-1m-$(date +%Y%m%d-%H%M%S).html"
        ;;
    2)
        echo -e "${GREEN}Starting Locust in Web UI mode...${NC}"
        echo -e "${YELLOW}Open http://localhost:8089 in your browser${NC}"
        echo -e "${YELLOW}Recommended settings:${NC}"
        echo -e "${YELLOW}  - Number of users: 10${NC}"
        echo -e "${YELLOW}  - Spawn rate: 10${NC}"
        echo -e "${YELLOW}  - Test will auto-stop at 1M+ spans${NC}"
        echo ""
        $LOCUST_CMD -f "$LOCUST_FILE" --host "$PRODUCER_URL" --html "${REPORTS_DIR}/locust-traces-webui-$(date +%Y%m%d-%H%M%S).html"
        ;;
    3)
        echo ""
        read -p "Number of users: " users
        read -p "Spawn rate (users/sec): " spawn_rate
        read -p "Run in headless mode? (y/n): " headless

        if [[ "$headless" == "y" || "$headless" == "Y" ]]; then
            echo -e "${GREEN}Starting custom traces load test...${NC}"
            echo -e "${YELLOW}Will run until 1M+ spans are sent${NC}"
            mkdir -p "$REPORTS_DIR"
            $LOCUST_CMD -f "$LOCUST_FILE" \
                   --host "$PRODUCER_URL" \
                   --users "$users" \
                   --spawn-rate "$spawn_rate" \
                   --headless \
                   --print-stats \
                   --html "${REPORTS_DIR}/locust-traces-custom-$(date +%Y%m%d-%H%M%S).html"
        else
            echo -e "${GREEN}Starting custom traces load test in Web UI mode...${NC}"
            echo -e "${YELLOW}Open http://localhost:8089 in your browser${NC}"
            echo -e "${YELLOW}Set users to ${users}, spawn rate to ${spawn_rate}${NC}"
            echo -e "${YELLOW}Test will auto-stop at 1M+ spans${NC}"
            $LOCUST_CMD -f "$LOCUST_FILE" --host "$PRODUCER_URL"
        fi
        ;;
    *)
        echo -e "${RED}Invalid choice!${NC}"
        exit 1
        ;;
esac

echo ""
echo -e "${BLUE}=================================================${NC}"
echo -e "${GREEN}✅ Test completed!${NC}"
echo -e "${BLUE}=================================================${NC}"

# Check if reports directory exists and show last report
if [ -d "$REPORTS_DIR" ]; then
    LATEST_REPORT=$(ls -t "${REPORTS_DIR}"/locust-traces-*.html 2>/dev/null | head -1)
    if [ -n "$LATEST_REPORT" ]; then
        echo -e "${YELLOW}Report saved: ${LATEST_REPORT}${NC}"
        echo -e "${YELLOW}Open it in a browser to view detailed results${NC}"
    fi
fi
