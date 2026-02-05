# Build argument to choose between dev, production, or lambda
ARG BUILD_TARGET=dev

# Development stage - optimized
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

# Builder stage for production
FROM node:20-alpine AS builder

WORKDIR /app

COPY package*.json ./
RUN npm ci --legacy-peer-deps \
    && npm cache clean --force

COPY . .
RUN npm run build

# Production stage - minimal nginx
FROM nginx:alpine AS production

# Copy custom nginx config
COPY nginx.conf /etc/nginx/nginx.conf

# Copy built files from builder
COPY --from=builder /app/dist /usr/share/nginx/html

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]

# Lambda stage - minimal
FROM public.ecr.aws/awsguru/aws-lambda-adapter:0.8.4 AS lambda-adapter
FROM node:20-alpine AS lambda

WORKDIR /app

# Copy Lambda adapter
COPY --from=lambda-adapter /lambda-adapter /opt/extensions/lambda-adapter

# Install serve and production dependencies only
RUN npm install -g serve && npm cache clean --force

# Copy built files from builder
COPY --from=builder /app/dist ./dist

# Expose port for Lambda
EXPOSE 8080

# Serve the static files
CMD ["serve", "-s", "dist", "-l", "8080"]

# Final stage selection
FROM ${BUILD_TARGET} AS final