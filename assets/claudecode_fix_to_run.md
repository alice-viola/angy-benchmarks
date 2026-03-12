# Claude Code implementation — fixes to run

## Fix 1: `pino-pretty` not installed

Backend uses `pino-pretty` as a Pino log transport in dev mode but it's not listed in `package.json`.
Docker build fails because `npm ci` detects lockfile mismatch.

**Files changed:**
- `packages/backend/package.json` — added `"pino-pretty": "^11.0.0"` to dependencies
- `package-lock.json` — ran `npm install` to regenerate lockfile

## Fix 2: Backend Dockerfile copies non-existent per-package `node_modules`

npm workspaces hoists all dependencies to the root `node_modules/`. The Dockerfile dev stage
tries to `COPY --from=deps /app/packages/shared/node_modules` and
`COPY --from=deps /app/packages/backend/node_modules`, which don't exist.
Also missing root `package.json` in dev stage (needed for workspace resolution).

**Files changed:**
- `packages/backend/Dockerfile` — removed per-package `node_modules` COPY lines, added
  `COPY --from=deps /app/package.json ./package.json` to dev stage

## Fix 3: JWT keys not loaded from files

docker-compose sets `JWT_PRIVATE_KEY_PATH=/app/keys/private.pem` and `JWT_PUBLIC_KEY_PATH`,
but all backend code reads `process.env.JWT_PRIVATE_KEY` and `process.env.JWT_PUBLIC_KEY`
(key *content*, not file paths). These env vars are never set, so keys default to empty strings.
`jwt.sign()` with RS256 throws `secretOrPrivateKey must have a value`.

Additionally, the original code used top-level `const JWT_PUBLIC_KEY = process.env.JWT_PUBLIC_KEY ?? ''`
which captures the (empty) value at ESM module-load time, before any startup code can populate it.

**Files changed:**
- `packages/backend/src/server.ts` — added `readFileSync` calls at top of file to read key files
  from `JWT_PRIVATE_KEY_PATH` / `JWT_PUBLIC_KEY_PATH` and set `JWT_PRIVATE_KEY` / `JWT_PUBLIC_KEY`
- `packages/backend/src/routes/auth.ts` — changed `const JWT_PRIVATE_KEY` to lazy getter `function getPrivateKey()`
- `packages/backend/src/plugins/auth.ts` — changed `const JWT_PUBLIC_KEY` to lazy getter `function getPublicKey()`
- `packages/backend/src/ws/dashboard.ts` — same lazy getter change
- `packages/backend/src/ws/tracking.ts` — same lazy getter change

## Fix 4: `VITE_API_URL` missing `/api/v1` prefix

docker-compose sets `VITE_API_URL=http://localhost:3000`, but backend routes are registered under
`/api/v1/*`. Frontend sends `POST /auth/login` instead of `POST /api/v1/auth/login` → 401.

**Files changed:**
- `docker-compose.yml` — changed `VITE_API_URL` to `http://localhost:3000/api/v1`

## Fix 5: Login response camelCase vs. frontend snake_case

Backend auth routes (`/register` and `/login`) return `{ firstName, lastName, tenantId }` but
the frontend `User` type and `AppLayout.vue` expect `{ first_name, last_name, tenant_id }`.
The AppLayout sidebar tries to render user initials as `user.first_name[0]` which is
`undefined[0]` → `TypeError: Cannot read properties of undefined (reading '0')`.

**Files changed:**
- `packages/backend/src/routes/auth.ts` — changed both register and login response objects
  to use snake_case field names (`first_name`, `last_name`, `tenant_id`)

## Additional fix: Seed command made non-fatal on restart

docker-compose chains `npm run db:migrate && npm run db:seed && npm run dev`. On restart,
seed fails with duplicate key violation (data already exists), killing the entire chain
and preventing the dev server from starting.

**Files changed:**
- `docker-compose.yml` — changed `npm run db:seed` to `npm run db:seed || true`

---

## Remaining runtime issues (not fixed)

After the 5 fixes above, these issues remain:

1. **404 on `/api/v1/notifications`** — The frontend `notifications.ts` store calls
   `api.get('/notifications')` on every page load (from `AppLayout.vue` → `onMounted`),
   but no notifications route exists in the backend. Returns 404 every time.

2. **ShipmentTimeline.vue crash — `.replace` on undefined`** — The component expects
   `event.event_type` but the `shipment_events` table schema uses `action`. Backend returns
   `{ action, from_status, to_status, actor_id }` while the frontend `ShipmentEvent` type
   expects `{ event_type, from_status, to_status, user_id, user_name }`. Accessing
   `event.event_type.replace(/_/g, ' ')` crashes on undefined.

3. **501 on shipment transition for `failed` → `confirmed`** — The frontend `actionMap`
   shows a "Confirm" button for failed shipments (because `SHIPMENT_TRANSITIONS['failed:confirmed']`
   is true), sending `{ action: 'confirm' }`. But the backend state machine registers this
   transition under the `retry` action (key `failed:retry`), not `confirm` (key `failed:confirm`).
   The transitionMap lookup returns undefined, falling through to the 501 "not implemented" path.
   Additionally, `retry` is not in the Zod `shipmentTransitionSchema` enum, so even if the
   frontend sent `retry`, it would be rejected by validation.

4. **Sidebar navigation broken** — Sidebar `RouterLink` elements render but clicks don't
   navigate. Direct URL access works. Likely a Vue Router / component interaction issue.

5. **Dashboard stats all 0** — Analytics endpoints return empty data. The seed creates
   shipments, vehicles, and drivers, but the dashboard analytics queries don't find them
   (likely a query/aggregation mismatch).

6. **No auth token persistence** — The access token is stored only in Pinia state (in-memory).
   A page refresh loses the session and redirects to login.

7. **WebSocket URLs broken** — `VITE_WS_URL=ws://localhost:3000` provides no path, but backend
   registers handlers at `/ws/tracking` and `/ws/dashboard`. The `tracking.ts` store also
   incorrectly uses `/ws/dashboard` as fallback instead of `/ws/tracking`.

8. **Geofence checker uses Haversine only** — Application-level Haversine distance instead of
   PostGIS `ST_Contains`. Polygon geofences would not work correctly.
