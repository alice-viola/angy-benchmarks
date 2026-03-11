FROM node:22-alpine

WORKDIR /app

COPY package.json package-lock.json* ./
COPY packages/shared/package.json ./packages/shared/
COPY packages/backend/package.json ./packages/backend/

RUN npm install --workspace=packages/backend --workspace=packages/shared

COPY packages/shared/ ./packages/shared/
COPY packages/backend/ ./packages/backend/

EXPOSE 3000

CMD ["npm", "run", "dev", "-w", "packages/backend"]
