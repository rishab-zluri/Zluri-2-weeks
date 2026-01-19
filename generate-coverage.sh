#!/bin/bash

# Test Coverage Report Generator
# Generates HTML coverage reports for both frontend and backend

set -e

echo "📊 Test Coverage Report Generator"
echo "=================================="
echo ""

# Colors for output
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Function to generate backend coverage
generate_backend() {
    echo -e "${BLUE}🔧 Generating Backend Coverage...${NC}"
    cd backend
    npm run test:coverage 2>&1 | tail -20
    cd ..
    echo -e "${GREEN}✅ Backend coverage generated!${NC}"
    echo -e "   Report: ${YELLOW}backend/coverage/index.html${NC}"
    echo ""
}

# Function to generate frontend coverage
generate_frontend() {
    echo -e "${BLUE}⚛️  Generating Frontend Coverage...${NC}"
    cd frontend
    npm run test:coverage 2>&1 | tail -20
    cd ..
    echo -e "${GREEN}✅ Frontend coverage generated!${NC}"
    echo -e "   Report: ${YELLOW}frontend/coverage/index.html${NC}"
    echo ""
}

# Function to open dashboard
open_dashboard() {
    echo -e "${BLUE}🌐 Opening Coverage Dashboard...${NC}"
    
    # Detect OS and open accordingly
    if [[ "$OSTYPE" == "darwin"* ]]; then
        # macOS
        open coverage-dashboard.html
    elif [[ "$OSTYPE" == "linux-gnu"* ]]; then
        # Linux
        xdg-open coverage-dashboard.html
    elif [[ "$OSTYPE" == "msys" ]] || [[ "$OSTYPE" == "win32" ]]; then
        # Windows
        start coverage-dashboard.html
    else
        echo -e "${YELLOW}⚠️  Please open coverage-dashboard.html manually${NC}"
    fi
}

# Main menu
echo "What would you like to do?"
echo "1) Generate Backend Coverage"
echo "2) Generate Frontend Coverage"
echo "3) Generate Both (Backend + Frontend)"
echo "4) Open Coverage Dashboard"
echo "5) Generate Both + Open Dashboard"
echo ""
read -p "Enter your choice (1-5): " choice

case $choice in
    1)
        generate_backend
        ;;
    2)
        generate_frontend
        ;;
    3)
        generate_backend
        generate_frontend
        ;;
    4)
        open_dashboard
        ;;
    5)
        generate_backend
        generate_frontend
        open_dashboard
        ;;
    *)
        echo -e "${YELLOW}Invalid choice. Exiting.${NC}"
        exit 1
        ;;
esac

echo ""
echo -e "${GREEN}✨ Done!${NC}"
echo ""
echo "📁 Coverage Reports:"
echo "   • Backend:  backend/coverage/index.html"
echo "   • Frontend: frontend/coverage/index.html"
echo "   • Dashboard: coverage-dashboard.html"
echo ""
echo "💡 Tip: Open coverage-dashboard.html for a unified view"
