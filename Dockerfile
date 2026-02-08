# Build argument to choose between dev or production
ARG BUILD_TARGET=dev
ARG VERSION

# Development stage - optimized for local development
FROM node:20-alpine AS dev

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies and clean cache
RUN npm ci --legacy-peer-deps \
    && npm cache clean --force

# Copy source code
COPY . .

# Expose Vite dev server port
EXPOSE 5173

# Run Vite dev server with host binding
CMD ["npm", "run", "dev", "--", "--host", "0.0.0.0"]

# Builder stage for production builds
FROM node:20-alpine AS builder

WORKDIR /app

COPY package*.json ./
RUN npm ci --legacy-peer-deps \
    && npm cache clean --force

COPY . .
ENV VITE_VERSION=$VERSION
RUN npm run build

# Production stage - minimal nginx
FROM nginx:alpine AS production

# Copy custom nginx config
COPY nginx.conf /etc/nginx/nginx.conf

# Copy built files from builder
COPY --from=builder /app/dist /usr/share/nginx/html

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]

# Final stage selection
FROM ${BUILD_TARGET} AS final