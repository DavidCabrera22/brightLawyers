FROM ghcr.io/puppeteer/puppeteer:21.5.0

# Switch to root to install dependencies
USER root

# Set working directory
WORKDIR /usr/src/app

# Copy package files
COPY package*.json ./

# Install dependencies
# Note: Puppeteer is already installed in the base image, but we need other deps
# and we need to ensure the version matches or is compatible.
# We skip puppeteer download to use the one in the base image if possible, 
# BUT our package.json has a specific version. 
# To avoid conflicts, we can use the base image's chrome.
ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true
ENV PUPPETEER_EXECUTABLE_PATH=/usr/bin/google-chrome-stable

# Install app dependencies
RUN npm ci

# Copy the rest of the application
COPY . .

# Generate Prisma Client
RUN npx prisma generate

# Expose port
EXPOSE 4000

# Start the application
CMD ["node", "auth-server.js"]
