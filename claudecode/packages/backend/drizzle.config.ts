import { defineConfig } from 'drizzle-kit';

export default defineConfig({
  schema: './packages/backend/src/db/schema.ts',
  out: './packages/backend/drizzle',
  dialect: 'postgresql',
  dbCredentials: {
    url: process.env.DATABASE_URL ?? 'postgresql://nexusfleet:nexusfleet_dev@localhost:5432/nexusfleet',
  },
});
