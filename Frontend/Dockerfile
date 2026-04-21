# Build Stage
FROM node:22-alpine AS build

WORKDIR /app

# Improve build cache by copying package files first
COPY package*.json ./
RUN npm install

# Build arguments for production configuration
ARG VITE_API_URL
ARG VITE_GOOGLE_CLIENT_ID

# Map build args to environment variables for Vite
ENV VITE_API_URL=$VITE_API_URL
ENV VITE_GOOGLE_CLIENT_ID=$VITE_GOOGLE_CLIENT_ID

# Copy source and build
COPY . .
RUN npm run build

# Production Server Stage
FROM nginx:stable-alpine

# Set up Nginx to host the files and route all traffic to index.html for React Router
# Using listen 80 as it's the standard for Nginx, docker-compose maps it to 5173
RUN echo 'server { \
    listen 80; \
    location / { \
        root   /usr/share/nginx/html; \
        index  index.html index.htm; \
        try_files $uri $uri/ /index.html; \
    } \
    # Optional: Gzip compression for performance
    gzip on; \
    gzip_types text/plain text/css application/json application/javascript text/xml application/xml application/xml+rss text/javascript; \
}' > /etc/nginx/conf.d/default.conf

# Grab the static files from the build stage above
COPY --from=build /app/dist /usr/share/nginx/html

# Security: Adjust permissions for Nginx user
RUN touch /var/run/nginx.pid && \
    chown -R nginx:nginx /var/run/nginx.pid /usr/share/nginx/html /var/cache/nginx /var/log/nginx /etc/nginx/conf.d

USER nginx

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
