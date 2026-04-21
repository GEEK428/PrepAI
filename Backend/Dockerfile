FROM node:22-bookworm-slim

# Install chromium and minimal dependencies for puppeteer PDF generation
RUN apt-get update && apt-get install -y --no-install-recommends \
    chromium \
    fonts-ipafont-gothic fonts-wqy-zenhei fonts-thai-tlwg fonts-kacst fonts-freefont-ttf libxss1 \
    ca-certificates \
    procps \
    libnss3 \
    libatk-bridge2.0-0 \
    libcups2 \
    libdrm2 \
    libxkbcommon0 \
    libgbm1 \
    libasound2 \
    libatspi0 \
    libx11-xcb1 \
    libcomposite1 \
    libxdamage1 \
    libxrandr2 \
    && rm -rf /var/lib/apt/lists/*

# Set environment variables for Puppeteer
ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true \
    PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium

WORKDIR /app

# Install dependencies first for better caching
COPY package*.json ./
RUN npm install --omit=dev

# Copy application code
COPY . .

# Security: Run as a non-root user
# Node image already provides a 'node' user
RUN chown -R node:node /app
USER node

# Expose backend API port
EXPOSE 3000

# Start server
# Using 'node server.js' directly or npm start if defined
CMD ["node", "server.js"]
