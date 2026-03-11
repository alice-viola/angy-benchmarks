FROM node:22-alpine

WORKDIR /app

COPY package.json package-lock.json* ./
COPY packages/shared/package.json ./packages/shared/
COPY packages/frontend/package.json ./packages/frontend/

RUN npm install --workspace=packages/frontend --workspace=packages/shared

COPY packages/shared/ ./packages/shared/
COPY packages/frontend/ ./packages/frontend/

EXPOSE 5173

CMD ["npm", "run", "dev", "-w", "packages/frontend", "--", "--host", "0.0.0.0"]
