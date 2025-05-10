#!/bin/bash
set -e

GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

echo -e "${YELLOW}SettleLah - Firebase Security Rules Deployment${NC}"

# Check if Firebase CLI is installed
if ! command -v firebase &> /dev/null; then
    echo -e "${RED}Error: Firebase CLI not found. Please install it with: npm install -g firebase-tools${NC}"
    exit 1
fi

# Check if logged into Firebase
firebase projects:list &>/dev/null
if [ $? -ne 0 ]; then
    echo -e "${YELLOW}You need to log in to Firebase first${NC}"
    firebase login
fi

# Deploy the rules
echo -e "${YELLOW}Deploying Firestore security rules...${NC}"
firebase deploy --only firestore:rules

echo -e "${GREEN}Security rules deployed successfully!${NC}"
echo ""
echo -e "To run your app in development mode with relaxed security:"
echo -e "  ${YELLOW}./dev-mode.sh${NC}"
echo ""
echo -e "To run with full security for production:"
echo -e "  ${YELLOW}npm start${NC}" 