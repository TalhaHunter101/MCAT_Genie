#!/bin/bash

# MCAT Study Schedule Planner - Test Runner Script
# Runs comprehensive test suite and generates reports

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
API_URL="http://localhost:3000"
MAX_RETRIES=3
RETRY_DELAY=5

echo -e "${BLUE}🚀 MCAT Study Schedule Planner - Test Suite Runner${NC}"
echo "================================================================"

# Function to check if API is running
check_api() {
    echo -e "${YELLOW}🔍 Checking API availability...${NC}"
    
    for i in $(seq 1 $MAX_RETRIES); do
        if curl -s "$API_URL/health" > /dev/null 2>&1; then
            echo -e "${GREEN}✅ API is running at $API_URL${NC}"
            return 0
        else
            echo -e "${YELLOW}⏳ API not ready, attempt $i/$MAX_RETRIES...${NC}"
            if [ $i -lt $MAX_RETRIES ]; then
                sleep $RETRY_DELAY
            fi
        fi
    done
    
    echo -e "${RED}❌ API is not running at $API_URL${NC}"
    echo "Please start the server with: npm run dev"
    exit 1
}

# Function to run test suite
run_tests() {
    echo -e "${BLUE}🧪 Running comprehensive test suite...${NC}"
    echo ""
    
    cd "$SCRIPT_DIR"
    
    # Make test script executable
    chmod +x test-diverse-inputs.js
    
    # Run tests
    node test-diverse-inputs.js
    
    if [ $? -eq 0 ]; then
        echo -e "${GREEN}✅ Test suite completed successfully${NC}"
    else
        echo -e "${RED}❌ Test suite failed${NC}"
        exit 1
    fi
}

# Function to generate comparison report
generate_comparison_report() {
    echo -e "${BLUE}📊 Generating comparison report...${NC}"
    echo ""
    
    cd "$SCRIPT_DIR"
    
    # Make analyzer script executable
    chmod +x test-comparison-analyzer.js
    
    # Generate report
    node test-comparison-analyzer.js
    
    if [ $? -eq 0 ]; then
        echo -e "${GREEN}✅ Comparison report generated successfully${NC}"
    else
        echo -e "${YELLOW}⚠️  Comparison report generation failed (this is OK if no previous results exist)${NC}"
    fi
}

# Function to display results summary
display_summary() {
    echo ""
    echo -e "${BLUE}📋 Test Results Summary${NC}"
    echo "================================================================"
    
    RESULTS_DIR="$SCRIPT_DIR/results"
    
    if [ -d "$RESULTS_DIR" ]; then
        # Find latest test results
        LATEST_RESULTS=$(ls -t "$RESULTS_DIR"/test-results-*.json 2>/dev/null | head -1)
        LATEST_SUMMARY=$(ls -t "$RESULTS_DIR"/test-summary-*.json 2>/dev/null | head -1)
        
        if [ -n "$LATEST_RESULTS" ]; then
            echo -e "${GREEN}📁 Latest test results: $(basename "$LATEST_RESULTS")${NC}"
        fi
        
        if [ -n "$LATEST_SUMMARY" ]; then
            echo -e "${GREEN}📁 Latest summary: $(basename "$LATEST_SUMMARY")${NC}"
            
            # Extract key metrics from summary
            if command -v jq >/dev/null 2>&1; then
                echo ""
                echo -e "${YELLOW}📊 Key Metrics:${NC}"
                TOTAL_TESTS=$(jq -r '.overview.totalTests' "$LATEST_SUMMARY" 2>/dev/null || echo "N/A")
                PASSED_TESTS=$(jq -r '.overview.passedTests' "$LATEST_SUMMARY" 2>/dev/null || echo "N/A")
                OVERALL_SCORE=$(jq -r '.overview.overallScore' "$LATEST_SUMMARY" 2>/dev/null || echo "N/A")
                GRADE=$(jq -r '.overview.grade' "$LATEST_SUMMARY" 2>/dev/null || echo "N/A")
                
                echo "   Total Tests: $TOTAL_TESTS"
                echo "   Passed Tests: $PASSED_TESTS"
                echo "   Overall Score: $OVERALL_SCORE%"
                echo "   Grade: $GRADE"
            fi
        fi
        
        # List all result files
        echo ""
        echo -e "${YELLOW}📂 All result files:${NC}"
        ls -la "$RESULTS_DIR"/*.json 2>/dev/null | while read -r line; do
            echo "   $line"
        done
        
        # Check for reports
        REPORTS_DIR="$RESULTS_DIR/reports"
        if [ -d "$REPORTS_DIR" ]; then
            echo ""
            echo -e "${YELLOW}📊 Comparison reports:${NC}"
            ls -la "$REPORTS_DIR"/*.json 2>/dev/null | while read -r line; do
                echo "   $line"
            done
        fi
    else
        echo -e "${RED}❌ No test results found${NC}"
    fi
}

# Function to show usage
show_usage() {
    echo "Usage: $0 [OPTIONS]"
    echo ""
    echo "Options:"
    echo "  --check-only    Only check if API is running"
    echo "  --tests-only    Run tests without comparison report"
    echo "  --compare-only  Generate comparison report only"
    echo "  --summary-only  Show summary of existing results"
    echo "  --help          Show this help message"
    echo ""
    echo "Examples:"
    echo "  $0                    # Run full test suite with comparison"
    echo "  $0 --check-only       # Just check API status"
    echo "  $0 --tests-only       # Run tests only"
    echo "  $0 --summary-only     # Show existing results"
}

# Main execution
main() {
    case "${1:-}" in
        --help|-h)
            show_usage
            exit 0
            ;;
        --check-only)
            check_api
            exit 0
            ;;
        --tests-only)
            check_api
            run_tests
            display_summary
            ;;
        --compare-only)
            generate_comparison_report
            display_summary
            ;;
        --summary-only)
            display_summary
            ;;
        "")
            # Full test suite
            check_api
            run_tests
            generate_comparison_report
            display_summary
            ;;
        *)
            echo -e "${RED}❌ Unknown option: $1${NC}"
            show_usage
            exit 1
            ;;
    esac
}

# Run main function
main "$@"
