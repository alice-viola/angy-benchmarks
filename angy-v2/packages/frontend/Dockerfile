FROM node:22-alpine AS base
WORKDIR /app

COPY package.json package-lock.json* ./
COPY packages/shared/package.json ./packages/shared/
COPY packages/frontend/package.json ./packages/frontend/

RUN npm install --workspace=packages/shared --workspace=packages/frontend

COPY packages/shared/ ./packages/shared/
COPY packages/frontend/ ./packages/frontend/
COPY tsconfig.base.json ./

EXPOSE 5173
CMD ["npx", "--workspace=packages/frontend", "vite", "--host", "0.0.0.0"]
