#!/usr/bin/env bash
# exit on error
set -o errexit

npm install
npm run db:generate

# Install Chrome for Puppeteer
# This will use .puppeteerrc.cjs to store it inside the project folder
npx puppeteer browsers install chrome
