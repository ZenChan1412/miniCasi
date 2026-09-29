# Multi-stage Dockerfile for High-Low Casual Mini-Game
# Stage 1: Build & Automated Tests
FROM oven/bun:latest AS builder
WORKDIR /app

# Install dependencies with lockfile verification
COPY package.json bun.lock tsconfig.json vite.config.ts ./
RUN bun install --frozen-lockfile

# Copy source code and test files
COPY . .

# Run automated tests and production build
RUN bun test
RUN bun run build

# Stage 2: Minimal Production Web Server with Security Headers
FROM nginx:alpine AS runner
COPY --from=builder /app/dist /usr/share/nginx/html
COPY public/_headers /usr/share/nginx/html/_headers

# Expose standard HTTP port
EXPOSE 80

HEALTHCHECK --interval=30s --timeout=3s \
  CMD wget --quiet --tries=1 --spider http://localhost/ || exit 1

CMD ["nginx", "-g", "daemon off;"]
