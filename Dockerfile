# ==============================================================================
# ProcessGuard Multi-Stage Production Dockerfile
# Stage 1: Build native C++ monitoring engine
# Stage 2: Build React + Vite frontend SPA
# Stage 3: Minimal production runtime container
# ==============================================================================

# ------------------------------------------------------------------------------
# STAGE 1: C++ Monitoring Engine Builder
# ------------------------------------------------------------------------------
FROM alpine:3.20 AS cpp-builder
RUN apk add --no-cache cmake make g++ musl-dev linux-headers

WORKDIR /app/agent
COPY agent/CMakeLists.txt ./
COPY agent/include/ ./include/
COPY agent/src/ ./src/
COPY agent/tests/ ./tests/

RUN cmake -B build -DCMAKE_BUILD_TYPE=Release \
    && cmake --build build --config Release --target processguard_engine engine_tests \
    && ./build/tests/engine_tests

# ------------------------------------------------------------------------------
# STAGE 2: React Frontend Builder
# ------------------------------------------------------------------------------
FROM node:20-alpine AS frontend-builder
WORKDIR /app/frontend

COPY frontend/package*.json ./
RUN npm ci

COPY frontend/ ./
RUN npm run build

# ------------------------------------------------------------------------------
# STAGE 3: Final Production Runtime Container
# ------------------------------------------------------------------------------
FROM node:20-alpine AS runner
RUN apk add --no-cache libstdc++

WORKDIR /app
ENV NODE_ENV=production
ENV PORT=5000

# Install backend production dependencies
COPY backend/package*.json ./backend/
RUN cd backend && npm ci --omit=dev

# Copy backend application source
COPY backend/ ./backend/

# Copy compiled C++ binary from Stage 1
COPY --from=cpp-builder /app/agent/build/processguard_engine ./agent/build/processguard_engine
RUN chmod +x ./agent/build/processguard_engine

# Copy compiled frontend static assets from Stage 2
COPY --from=frontend-builder /app/frontend/dist ./frontend/dist

# Create persistent data directory for SQLite
RUN mkdir -p /app/data
ENV DB_PATH=/app/data/processguard.sqlite
ENV ENGINE_PATH=/app/agent/build/processguard_engine

EXPOSE 5000

HEALTHCHECK --interval=30s --timeout=5s --start-period=5s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:${PORT}/api/health || exit 1

CMD ["node", "backend/src/server.js"]
