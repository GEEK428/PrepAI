# Build Stage
FROM node:20-alpine AS build
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .
# Compile the React/Vite app down to static HTML/CSS files
RUN npm run build

# Production Server Stage
FROM nginx:alpine
# Set up Nginx to host the files and route all traffic (React Router support)
RUN echo 'server { \
    listen 5173; \
    location / { \
        root   /usr/share/nginx/html; \
        index  index.html index.htm; \
        try_files $uri $uri/ /index.html; \
    } \
}' > /etc/nginx/conf.d/default.conf

# Grab the static files from the build stage above
COPY --from=build /app/dist /usr/share/nginx/html

# Expose the port docker-compose expects
EXPOSE 5173
CMD ["nginx", "-g", "daemon off;"]
