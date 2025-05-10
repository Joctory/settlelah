#!/bin/bash
set -e

# ANSI color codes
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

echo -e "${GREEN}=== SettleLah Security Setup ===${NC}"
echo -e "This script will set up security enhancements for your SettleLah application."

# Check if npm is installed
if ! command -v npm &> /dev/null; then
    echo -e "${RED}Error: npm is not installed. Please install Node.js and npm first.${NC}"
    exit 1
fi

# Check if Firebase CLI is installed
if ! command -v firebase &> /dev/null; then
    echo -e "${YELLOW}Firebase CLI not found. Installing...${NC}"
    sudo npm install -g firebase-tools
else
    echo -e "${GREEN}Firebase CLI already installed.${NC}"
fi

# Install required dependencies
echo -e "${YELLOW}Installing security-related dependencies...${NC}"
sudo npm install express-rate-limit --save

# Ask for Firebase login
echo -e "${YELLOW}We need to authenticate with Firebase to deploy security rules.${NC}"
read -p "Do you want to log in to Firebase now? (y/n): " firebase_login
if [[ $firebase_login == "y" || $firebase_login == "Y" ]]; then
    firebase login
fi

# Check if Firebase is initialized in this project
if [ ! -f "firebase.json" ]; then
    echo -e "${YELLOW}Firebase hasn't been initialized in this project yet.${NC}"
    read -p "Do you want to initialize Firebase now? (y/n): " firebase_init
    if [[ $firebase_init == "y" || $firebase_init == "Y" ]]; then
        echo -e "${YELLOW}Initializing Firebase. Make sure to select Firestore when prompted.${NC}"
        firebase init
    fi
fi

# Remind about NPM dependencies
echo -e "${YELLOW}Updating package.json with rate limiting dependency...${NC}"
if ! grep -q "express-rate-limit" package.json; then
    sudo npm install express-rate-limit --save
fi

# Deploy Firestore rules
if [ -f "firestore.rules" ]; then
    echo -e "${YELLOW}Firestore rules file detected.${NC}"
    read -p "Do you want to deploy the Firestore security rules now? (y/n): " deploy_rules
    if [[ $deploy_rules == "y" || $deploy_rules == "Y" ]]; then
        echo -e "${YELLOW}Deploying Firestore security rules...${NC}"
        firebase deploy --only firestore:rules
    fi
else
    echo -e "${RED}Error: firestore.rules file not found!${NC}"
    echo -e "${YELLOW}Please make sure you've created the firestore.rules file as described in the setup guide.${NC}"
fi

echo -e "${GREEN}Setup completed!${NC}"
echo -e "${YELLOW}Next steps:${NC}"
echo "1. Make sure your index.js file includes the ownership tracking changes"
echo "2. Consider adding App Check to your Firebase project for additional security"
echo "3. Review the firebase-security-setup.md file for more security recommendations"
echo -e "${GREEN}Your SettleLah application now has improved security!${NC}" 