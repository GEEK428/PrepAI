FROM node:20

# Install minimal chromium dependencies for puppeteer PDF generation
RUN DEBIAN_FRONTEND=noninteractive apt-get update --fix-missing && \
    DEBIAN_FRONTEND=noninteractive apt-get install -y --fix-missing \
    wget \
    gnupg \
    ca-certificates \
    procps \
    libxss1 \
    libnss3 \
    libatk-bridge2.0-0 \
    libcups2 \
    libdrm2 \
    libxkbcommon0 \
    libgbm1 \
    libasound2 \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Install dependencies
COPY package*.json ./
RUN npm install

# Copy application code
COPY . .

# Expose backend API port
EXPOSE 3000

# Start server
CMD ["npm", "run", "dev"]
