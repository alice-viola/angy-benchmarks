/**
 * Smoke test: CRUD API increment
 *
 * Verifies:
 * 1. POST /api/v1/vehicles → 201
 * 2. GET /api/v1/shipments → 200 with paginated data array
 * 3. Shipment state machine: create draft → confirm → assign → pickup
 * 4. GET /api/v1/analytics/overview → 200 with vehicles/drivers/shipments
 */
import { describe, it, expect, vi, beforeAll, afterAll } from 'vitest';
import crypto from 'node:crypto';

// ── Generate test RSA key pair ──────────────────────────────────────────────
const { testPublicKey, testPrivateKey } = vi.hoisted(() => {
  const c = require('node:crypto');
  const pair = c.generateKeyPairSync('rsa', {
    modulusLength: 2048,
    publicKeyEncoding: { type: 'spki', format: 'pem' },
    privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
  });
  return { testPublicKey: pair.publicKey as string, testPrivateKey: pair.privateKey as string };
});

// ── Shared state ────────────────────────────────────────────────────────────
const TEST_TENANT_ID = crypto.randomUUID();
const TEST_USER_ID = crypto.randomUUID();
const TEST_VEHICLE_ID = crypto.randomUUID();
const TEST_DRIVER_ID = crypto.randomUUID();

// Track created entities for state machine flow
let createdVehicleId: string;
let createdShipmentId: string;

// ── Mock node:fs ────────────────────────────────────────────────────────────
vi.mock('node:fs', async (importOriginal) => {
  const original = await importOriginal<typeof import('node:fs')>();
  return {
    ...original,
    readFileSync: (path: string, ...args: any[]) => {
      if (typeof path === 'string' && path.includes('private')) return testPrivateKey;
      if (typeof path === 'string' && path.includes('public')) return testPublicKey;
      return original.readFileSync(path, ...args);
    },
  };
});

// ── Mock env ────────────────────────────────────────────────────────────────
vi.mock('../env.js', () => ({
  env: {
    NODE_ENV: 'test',
    PORT: 0,
    HOST: '127.0.0.1',
    DATABASE_URL: 'postgres://test:test@localhost:5432/test',
    REDIS_URL: 'redis://localhost:6379',
    JWT_PRIVATE_KEY_PATH: '/fake/private.pem',
    JWT_PUBLIC_KEY_PATH: '/fake/public.pem',
    JWT_ISSUER: 'nexus-fleet',
    JWT_AUDIENCE: 'nexus-fleet-api',
    JWT_ACCESS_TOKEN_TTL: 900,
    JWT_REFRESH_TOKEN_TTL: 604800,
    CORS_ORIGIN: '*',
    LOG_LEVEL: 'silent',
  },
}));

// ── Mock Redis ──────────────────────────────────────────────────────────────
vi.mock('../lib/redis.js', () => ({
  redis: {
    get: vi.fn(async (key: string) => {
      // Return cached tenant info for tenant plugin
      if (key.startsWith('tenant:')) {
        return JSON.stringify({
          id: TEST_TENANT_ID,
          name: 'Test Corp',
          slug: 'test-corp',
          plan: 'pro',
          max_vehicles: 100,
          max_drivers: 50,
        });
      }
      return null;
    }),
    set: vi.fn(async () => {}),
    incr: vi.fn(async () => 42),
    expire: vi.fn(async () => {}),
    del: vi.fn(async () => {}),
    publish: vi.fn(async () => {}),
    lpush: vi.fn(async () => {}),
  },
}));

// ── Mock DB ─────────────────────────────────────────────────────────────────
// We use a lightweight in-memory store to track entities through the flow
const store = {
  vehicles: [] as any[],
  drivers: [] as any[],
  shipments: [] as any[],
  shipmentEvents: [] as any[],
};

function createMockQueryBuilder(results: () => any[]) {
  const builder: any = {
    from: () => builder,
    where: () => builder,
    orderBy: () => builder,
    limit: () => builder,
    offset: () => builder,
    for: () => builder,
    then: (resolve: any) => resolve(results()),
    [Symbol.iterator]: function* () { yield* results(); },
  };
  return builder;
}

vi.mock('../db/connection.js', () => {
  const c = require('node:crypto');

  // Track shipment status for state machine
  const selectProxy = () => {
    const builder: any = {};
    let _table: string | null = null;
    let _whereConditions: any = null;

    builder.from = (table: any) => {
      // Identify table by column names
      if (table.registration) _table = 'vehicles';
      else if (table.license_number) _table = 'drivers';
      else if (table.reference_code || table.customer_name) _table = 'shipments';
      else if (table.from_status) _table = 'shipmentEvents';
      else _table = 'unknown';
      return builder;
    };
    builder.where = () => builder;
    builder.orderBy = () => builder;
    builder.limit = () => builder;
    builder.offset = () => builder;
    builder.for = () => builder;
    builder.then = (resolve: any) => {
      if (_table === 'vehicles') return resolve(store.vehicles);
      if (_table === 'drivers') return resolve(store.drivers);
      if (_table === 'shipments') return resolve(store.shipments);
      if (_table === 'shipmentEvents') return resolve(store.shipmentEvents);
      return resolve([]);
    };

    return builder;
  };

  const insertProxy = (table: any) => {
    const builder: any = {};
    let _values: any = null;

    builder.values = (v: any) => { _values = v; return builder; };
    builder.returning = () => builder;
    builder.catch = (fn: any) => builder;
    builder.then = (resolve: any) => {
      const row = { id: c.randomUUID(), ..._values, created_at: new Date().toISOString() };

      if (table.registration) {
        store.vehicles.push(row);
      } else if (table.reference_code || table.customer_name) {
        store.shipments.push(row);
      } else if (table.from_status) {
        store.shipmentEvents.push(row);
      }

      return resolve([row]);
    };

    return builder;
  };

  const updateProxy = (table: any) => {
    const builder: any = {};
    let _setData: any = null;

    builder.set = (data: any) => { _setData = data; return builder; };
    builder.where = () => builder;
    builder.returning = () => builder;
    builder.catch = (fn: any) => builder;
    builder.then = (resolve: any) => {
      // Apply updates to store
      if (table.reference_code || table.customer_name) {
        if (store.shipments.length > 0) {
          const latest = store.shipments[store.shipments.length - 1];
          Object.assign(latest, _setData);
          return resolve([latest]);
        }
      }
      if (table.registration) {
        if (store.vehicles.length > 0) {
          const latest = store.vehicles[store.vehicles.length - 1];
          Object.assign(latest, _setData);
          return resolve([latest]);
        }
      }
      if (table.license_number) {
        if (store.drivers.length > 0) {
          const latest = store.drivers[store.drivers.length - 1];
          Object.assign(latest, _setData);
          return resolve([latest]);
        }
      }
      return resolve([_setData]);
    };

    return builder;
  };

  const deleteProxy = () => {
    const builder: any = {};
    builder.where = () => builder;
    builder.then = (resolve: any) => resolve(undefined);
    return builder;
  };

  return {
    db: {
      select: (fields?: any) => {
        if (fields && fields.count !== undefined) {
          // count query
          const builder: any = {};
          builder.from = () => builder;
          builder.where = () => builder;
          builder.then = (resolve: any) => resolve([{ count: 0 }]);
          return builder;
        }
        return selectProxy();
      },
      insert: (table: any) => insertProxy(table),
      update: (table: any) => updateProxy(table),
      delete: () => deleteProxy(),
      execute: vi.fn(async () => []),
      transaction: async (fn: any) => {
        // Transaction proxy provides same interface
        const tx = {
          select: (fields?: any) => {
            if (fields && fields.count !== undefined) {
              const builder: any = {};
              builder.from = () => builder;
              builder.where = () => builder;
              builder.then = (resolve: any) => resolve([{ count: 0 }]);
              return builder;
            }
            return selectProxy();
          },
          insert: (table: any) => insertProxy(table),
          update: (table: any) => updateProxy(table),
          delete: () => deleteProxy(),
        };
        return fn(tx);
      },
    },
  };
});

// ── Mock HoS service ────────────────────────────────────────────────────────
vi.mock('../services/hos.service.js', () => ({
  startDriving: vi.fn(async () => {}),
  stopDriving: vi.fn(async () => {}),
  checkHoursAvailable: vi.fn(async () => ({ available: true, current: 2, max: 9 })),
}));

// ── Build Fastify app ───────────────────────────────────────────────────────
import Fastify from 'fastify';
import cookie from '@fastify/cookie';
import jwt from 'jsonwebtoken';
import authPlugin from '../plugins/auth.plugin.js';
import tenantPlugin from '../plugins/tenant.plugin.js';
import rateLimitPlugin from '../plugins/rate-limit.plugin.js';
import vehicleRoutes from '../routes/vehicles.routes.js';
import shipmentRoutes from '../routes/shipments.routes.js';
import analyticsRoutes from '../routes/analytics.routes.js';

let app: ReturnType<typeof Fastify>;
let accessToken: string;

beforeAll(async () => {
  // Generate JWT
  accessToken = jwt.sign(
    { tid: TEST_TENANT_ID, role: 'owner' },
    testPrivateKey,
    {
      algorithm: 'RS256',
      subject: TEST_USER_ID,
      issuer: 'nexus-fleet',
      audience: 'nexus-fleet-api',
      expiresIn: 900,
    },
  );

  app = Fastify({ logger: false });
  await app.register(cookie);
  await app.register(authPlugin);
  await app.register(tenantPlugin);
  await app.register(rateLimitPlugin);
  await app.register(vehicleRoutes, { prefix: '/api/v1/vehicles' });
  await app.register(shipmentRoutes, { prefix: '/api/v1/shipments' });
  await app.register(analyticsRoutes, { prefix: '/api/v1/analytics' });
  await app.ready();
});

afterAll(async () => {
  await app.close();
});

// ── Tests ───────────────────────────────────────────────────────────────────

describe('CRUD API smoke test', () => {
  it('POST /api/v1/vehicles → 201', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/vehicles',
      headers: { authorization: `Bearer ${accessToken}` },
      payload: {
        plate_number: 'ABC-1234',
        vehicle_type: 'van',
        make: 'Ford',
        model: 'Transit',
        year: 2023,
      },
    });

    expect(res.statusCode).toBe(201);
    const body = res.json();
    expect(body.success).toBe(true);
    expect(body.data).toBeDefined();
    expect(body.data.id).toBeDefined();
    createdVehicleId = body.data.id;
  });

  it('GET /api/v1/shipments → 200 with paginated data array', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/shipments',
      headers: { authorization: `Bearer ${accessToken}` },
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.success).toBe(true);
    expect(Array.isArray(body.data)).toBe(true);
    expect(body.meta).toBeDefined();
    expect(body.meta.page).toBeDefined();
    expect(body.meta.pageSize).toBeDefined();
    expect(body.meta.totalItems).toBeDefined();
    expect(body.meta.totalPages).toBeDefined();
  });

  describe('Shipment state machine', () => {
    it('POST /api/v1/shipments (create draft) → 201', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/shipments',
        headers: { authorization: `Bearer ${accessToken}` },
        payload: {
          customer_name: 'Test Customer',
          origin_address: '123 Origin St, CityA',
          origin_lat: 40.7128,
          origin_lng: -74.006,
          dest_address: '456 Dest Ave, CityB',
          dest_lat: 34.0522,
          dest_lng: -118.2437,
          cargo_description: 'Test cargo',
          cargo_weight_kg: 500,
          cargo_volume_m3: 5,
        },
      });

      expect(res.statusCode).toBe(201);
      const body = res.json();
      expect(body.success).toBe(true);
      expect(body.data.id).toBeDefined();
      expect(body.data.status).toBe('draft');
      createdShipmentId = body.data.id;
    });

    it('POST transition action=confirm → 200 with status=confirmed and reference_code', async () => {
      const res = await app.inject({
        method: 'POST',
        url: `/api/v1/shipments/${createdShipmentId}/transition`,
        headers: { authorization: `Bearer ${accessToken}` },
        payload: { action: 'confirm' },
      });

      expect(res.statusCode).toBe(200);
      const body = res.json();
      expect(body.success).toBe(true);
      expect(body.data.status).toBe('confirmed');
      expect(body.data.reference_code).toBeDefined();
      expect(body.data.reference_code).toMatch(/^SHP-\d{8}-\d{5}$/);
    });

    it('POST transition action=assign → 200 with status=assigned', async () => {
      // Seed a mock vehicle and driver into the store for the assign guard
      // Clear existing vehicles/drivers so the guard picks the right ones
      const vehicleId = crypto.randomUUID();
      const driverId = crypto.randomUUID();

      store.vehicles.length = 0;
      store.drivers.length = 0;

      store.vehicles.push({
        id: vehicleId,
        tenant_id: TEST_TENANT_ID,
        status: 'available',
        type: 'van',
        capacity_kg: '5000',
        capacity_m3: '20',
        registration: 'XYZ-9999',
        is_active: true,
      });

      store.drivers.push({
        id: driverId,
        tenant_id: TEST_TENANT_ID,
        status: 'available',
        license_classes: ['B', 'C'],
        license_expiry: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString(),
        current_driving_hours: '2',
        max_driving_hours_day: '9',
        is_active: true,
      });

      const res = await app.inject({
        method: 'POST',
        url: `/api/v1/shipments/${createdShipmentId}/transition`,
        headers: { authorization: `Bearer ${accessToken}` },
        payload: {
          action: 'assign',
          vehicle_id: vehicleId,
          driver_id: driverId,
        },
      });

      expect(res.statusCode).toBe(200);
      const body = res.json();
      expect(body.success).toBe(true);
      expect(body.data.status).toBe('assigned');
    });

    it('POST transition action=pickup → 200 with status=in_transit and actual_pickup_at', async () => {
      const res = await app.inject({
        method: 'POST',
        url: `/api/v1/shipments/${createdShipmentId}/transition`,
        headers: { authorization: `Bearer ${accessToken}` },
        payload: { action: 'pickup' },
      });

      expect(res.statusCode).toBe(200);
      const body = res.json();
      expect(body.success).toBe(true);
      // pickup auto-transitions to in_transit
      expect(body.data.status).toBe('in_transit');
      expect(body.data.actual_pickup_at).toBeDefined();
    });
  });

  it('GET /api/v1/analytics/overview → 200 with vehicles/drivers/shipments counts', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/analytics/overview',
      headers: { authorization: `Bearer ${accessToken}` },
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.success).toBe(true);
    expect(body.data).toBeDefined();
    expect(body.data.vehicles).toBeDefined();
    expect(body.data.drivers).toBeDefined();
    expect(body.data.shipments).toBeDefined();
  });
});
