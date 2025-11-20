#!/bin/bash

# Locust User Simulation Test Runner V3 (Checkout Failure Scenario)
# Simulates order-service checkout failures with DB connection errors

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
LOCUST_FILE="${SCRIPT_DIR}/locustfile_user_v3.py"
REPORTS_DIR="$( cd "${SCRIPT_DIR}/.." && pwd )/reports"

echo -e "${BLUE}=================================================${NC}"
echo -e "${BLUE}🦗 Locust User Simulation Test Runner V3${NC}"
echo -e "${BLUE}   (Order-Service Checkout Failure Scenario)${NC}"
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
echo -e "${YELLOW}Scenario: POST /orders/checkout with 5% DB connection failures${NC}"
echo ""

# Display menu
echo "Select test mode:"
echo "  1) Short Test - 10 minutes (5 users, Headless)"
echo "  2) Medium Test - 1 hour (5 users, Headless)"
echo "  3) Long Test - 3 hours (5 users, Headless)"
echo "  4) Full Day Test - 24 hours (5 users, Headless)"
echo "  5) Web UI mode (Interactive - manually control duration)"
echo "  6) Custom parameters"
echo ""
read -p "Enter choice [1-6]: " choice

case $choice in
    1)
        echo -e "${GREEN}Starting 10-minute checkout failure simulation (V3)...${NC}"
        echo -e "${YELLOW}Duration: 10 minutes${NC}"
        echo -e "${YELLOW}Users: 5 concurrent users${NC}"
        echo -e "${YELLOW}Scenario: 5% checkout DB failures${NC}"
        echo ""
        mkdir -p "$REPORTS_DIR"
        $LOCUST_CMD -f "$LOCUST_FILE" \
               --host "$PRODUCER_URL" \
               --users 5 \
               --spawn-rate 1 \
               --run-time 10m \
               --headless \
               --print-stats \
               --html "${REPORTS_DIR}/locust-user-v3-10m-$(date +%Y%m%d-%H%M%S).html"
        ;;
    2)
        echo -e "${GREEN}Starting 1-hour checkout failure simulation (V3)...${NC}"
        echo -e "${YELLOW}Duration: 1 hour${NC}"
        echo -e "${YELLOW}Users: 5 concurrent users${NC}"
        echo -e "${YELLOW}Scenario: 5% checkout DB failures${NC}"
        echo ""
        mkdir -p "$REPORTS_DIR"
        $LOCUST_CMD -f "$LOCUST_FILE" \
               --host "$PRODUCER_URL" \
               --users 5 \
               --spawn-rate 1 \
               --run-time 1h \
               --headless \
               --print-stats \
               --html "${REPORTS_DIR}/locust-user-v3-1h-$(date +%Y%m%d-%H%M%S).html"
        ;;
    3)
        echo -e "${GREEN}Starting 3-hour checkout failure simulation (V3)...${NC}"
        echo -e "${YELLOW}Duration: 3 hours${NC}"
        echo -e "${YELLOW}Users: 5 concurrent users${NC}"
        echo -e "${YELLOW}Scenario: 5% checkout DB failures${NC}"
        echo ""
        mkdir -p "$REPORTS_DIR"
        $LOCUST_CMD -f "$LOCUST_FILE" \
               --host "$PRODUCER_URL" \
               --users 5 \
               --spawn-rate 1 \
               --run-time 3h \
               --headless \
               --print-stats \
               --html "${REPORTS_DIR}/locust-user-v3-3h-$(date +%Y%m%d-%H%M%S).html"
        ;;
    4)
        echo -e "${GREEN}Starting 24-hour checkout failure simulation (V3)...${NC}"
        echo -e "${YELLOW}Duration: 24 hours${NC}"
        echo -e "${YELLOW}Users: 5 concurrent users${NC}"
        echo -e "${YELLOW}Scenario: 5% checkout DB failures${NC}"
        echo -e "${RED}WARNING: This will run for a full day!${NC}"
        echo ""
        read -p "Are you sure? (y/n): " confirm
        if [[ "$confirm" != "y" && "$confirm" != "Y" ]]; then
            echo -e "${YELLOW}Test cancelled${NC}"
            exit 0
        fi
        mkdir -p "$REPORTS_DIR"
        $LOCUST_CMD -f "$LOCUST_FILE" \
               --host "$PRODUCER_URL" \
               --users 5 \
               --spawn-rate 1 \
               --run-time 24h \
               --headless \
               --print-stats \
               --html "${REPORTS_DIR}/locust-user-v3-24h-$(date +%Y%m%d-%H%M%S).html"
        ;;
    5)
        echo -e "${GREEN}Starting Locust in Web UI mode (V3)...${NC}"
        echo -e "${YELLOW}Open http://localhost:8089 in your browser${NC}"
        echo -e "${YELLOW}Recommended settings:${NC}"
        echo -e "${YELLOW}  - Number of users: 5${NC}"
        echo -e "${YELLOW}  - Spawn rate: 1${NC}"
        echo -e "${YELLOW}  - Run time: Set as needed (e.g., 3h)${NC}"
        echo ""
        mkdir -p "$REPORTS_DIR"
        $LOCUST_CMD -f "$LOCUST_FILE" \
               --host "$PRODUCER_URL" \
               --html "${REPORTS_DIR}/locust-user-v3-webui-$(date +%Y%m%d-%H%M%S).html"
        ;;
    6)
        echo ""
        read -p "Number of users: " users
        read -p "Spawn rate (users/sec): " spawn_rate
        read -p "Run time (e.g., 1h, 30m, 300s): " run_time
        read -p "Run in headless mode? (y/n): " headless

        if [[ "$headless" == "y" || "$headless" == "Y" ]]; then
            echo -e "${GREEN}Starting custom checkout failure simulation (V3)...${NC}"
            echo -e "${YELLOW}Users: ${users}, Spawn rate: ${spawn_rate}, Duration: ${run_time}${NC}"
            mkdir -p "$REPORTS_DIR"
            $LOCUST_CMD -f "$LOCUST_FILE" \
                   --host "$PRODUCER_URL" \
                   --users "$users" \
                   --spawn-rate "$spawn_rate" \
                   --run-time "$run_time" \
                   --headless \
                   --print-stats \
                   --html "${REPORTS_DIR}/locust-user-v3-custom-$(date +%Y%m%d-%H%M%S).html"
        else
            echo -e "${GREEN}Starting custom test in Web UI mode (V3)...${NC}"
            echo -e "${YELLOW}Open http://localhost:8089 in your browser${NC}"
            echo -e "${YELLOW}Set users to ${users}, spawn rate to ${spawn_rate}${NC}"
            mkdir -p "$REPORTS_DIR"
            $LOCUST_CMD -f "$LOCUST_FILE" \
                   --host "$PRODUCER_URL" \
                   --html "${REPORTS_DIR}/locust-user-v3-custom-$(date +%Y%m%d-%H%M%S).html"
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
    LATEST_REPORT=$(ls -t "${REPORTS_DIR}"/locust-user-v3-*.html 2>/dev/null | head -1)
    if [ -n "$LATEST_REPORT" ]; then
        echo -e "${YELLOW}Report saved: ${LATEST_REPORT}${NC}"
        echo -e "${YELLOW}Open it in a browser to view detailed results${NC}"
        echo ""
        echo -e "${YELLOW}Checkout Failure Stats:${NC}"
        echo -e "${YELLOW}  - Expected ~5% of checkout requests to fail${NC}"
        echo -e "${YELLOW}  - Look for 'Database connection timeout' errors${NC}"
    fi
fi
