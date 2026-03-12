# ---------------------------------------------------------------------------
# Stage 1: Install dependencies for all workspaces
# ---------------------------------------------------------------------------
FROM node:22-alpine AS deps

WORKDIR /app

# Copy root package files
COPY package.json package-lock.json* pnpm-lock.yaml* yarn.lock* ./

# Copy workspace package.json files
COPY packages/shared/package.json ./packages/shared/
COPY packages/backend/package.json ./packages/backend/

# Install dependencies
RUN if [ -f pnpm-lock.yaml ]; then \
      corepack enable && pnpm install --frozen-lockfile; \
    elif [ -f yarn.lock ]; then \
      yarn install --frozen-lockfile; \
    elif [ -f package-lock.json ]; then \
      npm ci; \
    else \
      npm install; \
    fi

# ---------------------------------------------------------------------------
# Stage 2: Dev image with tsx for hot reload
# ---------------------------------------------------------------------------
FROM node:22-alpine AS dev

WORKDIR /app

# Copy root package.json (needed for npm workspace resolution)
COPY --from=deps /app/package.json ./package.json

# Copy hoisted node_modules (npm workspaces hoists everything to root)
COPY --from=deps /app/node_modules ./node_modules

# Copy source code
COPY packages/shared/ ./packages/shared/
COPY packages/backend/ ./packages/backend/

EXPOSE 3000

CMD ["npx", "tsx", "watch", "src/server.ts"]
