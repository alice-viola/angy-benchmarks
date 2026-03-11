FROM node:20-alpine AS base
WORKDIR /app

# Copy root workspace files
COPY package.json package-lock.json* ./
COPY packages/shared/package.json ./packages/shared/
COPY packages/backend/package.json ./packages/backend/

RUN npm install --workspace=packages/shared --workspace=packages/backend

# Copy source
COPY tsconfig.base.json ./
COPY packages/shared/ ./packages/shared/
COPY packages/backend/ ./packages/backend/

# Build shared first, then backend
RUN npm run build --workspace=packages/shared
RUN npm run build --workspace=packages/backend

# Generate keys for JWT
RUN apk add --no-cache openssl && \
    mkdir -p /app/keys && \
    openssl genrsa -out /app/keys/private.pem 2048 && \
    openssl rsa -in /app/keys/private.pem -pubout -out /app/keys/public.pem

EXPOSE 3000
CMD ["node", "packages/backend/dist/server.js"]
