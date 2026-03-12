FROM node:22-alpine AS base
WORKDIR /app

COPY package.json package-lock.json* ./
COPY packages/shared/package.json ./packages/shared/
COPY packages/backend/package.json ./packages/backend/

RUN npm install --workspace=packages/shared --workspace=packages/backend

COPY packages/shared/ ./packages/shared/
COPY packages/backend/ ./packages/backend/
COPY tsconfig.base.json ./

RUN npm run build --workspace=packages/shared --if-present

RUN npx --workspace=packages/backend tsc || true

EXPOSE 3000
CMD ["npx", "--workspace=packages/backend", "tsx", "src/server.ts"]
