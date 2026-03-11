/**
 * State machine unit tests — covers every valid/invalid transition, guards, and side effects.
 */
import { describe, it, expect, vi, beforeAll, beforeEach } from 'vitest';
import crypto from 'node:crypto';

// ── Generate RSA key pair for auth ──────────────────────────────────────────
const { testPublicKey, testPrivateKey } = vi.hoisted(() => {
  const c = require('node:crypto');
  const pair = c.generateKeyPairSync('rsa', {
    modulusLength: 2048,
    publicKeyEncoding: { type: 'spki', format: 'pem' },
    privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
  });
  return { testPublicKey: pair.publicKey as string, testPrivateKey: pair.privateKey as string };
});

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

// ── Shared IDs ──────────────────────────────────────────────────────────────
const TENANT_ID = crypto.randomUUID();
const USER_ID = crypto.randomUUID();
const SHIPMENT_ID = crypto.randomUUID();
const VEHICLE_ID = crypto.randomUUID();
const DRIVER_ID = crypto.randomUUID();

const context = { userId: USER_ID, tenantId: TENANT_ID };

// ── In-memory store ─────────────────────────────────────────────────────────
const store = {
  shipments: [] as any[],
  shipmentEvents: [] as any[],
  vehicles: [] as any[],
  drivers: [] as any[],
};

function resetStore() {
  store.shipments.length = 0;
  store.shipmentEvents.length = 0;
  store.vehicles.length = 0;
  store.drivers.length = 0;
}

function seedShipment(overrides: Record<string, any> = {}) {
  const shipment = {
    id: SHIPMENT_ID,
    tenant_id: TENANT_ID,
    status: 'draft',
    customer_name: 'Acme Corp',
    origin_address: '123 Origin St',
    dest_address: '456 Dest Ave',
    origin_lat: '40.7128',
    origin_lng: '-74.006',
    dest_lat: '34.0522',
    dest_lng: '-118.2437',
    cargo_weight_kg: '500',
    cargo_volume_m3: '5',
    cargo_type: 'general',
    requires_temp_control: false,
    temp_min_c: null,
    temp_max_c: null,
    scheduled_pickup_at: null,
    assigned_vehicle_id: null,
    assigned_driver_id: null,
    reference_code: null,
    failure_reason: null,
    actual_pickup_at: null,
    actual_delivery_at: null,
    pod_signature_url: null,
    pod_photo_urls: null,
    pod_notes: null,
    cancellation_reason: null,
    ...overrides,
  };
  store.shipments.push(shipment);
  return shipment;
}

function seedVehicle(overrides: Record<string, any> = {}) {
  const vehicle = {
    id: VEHICLE_ID,
    tenant_id: TENANT_ID,
    status: 'available',
    type: 'van',
    capacity_kg: '5000',
    capacity_m3: '20',
    registration: 'XYZ-9999',
    is_active: true,
    ...overrides,
  };
  store.vehicles.push(vehicle);
  return vehicle;
}

function seedDriver(overrides: Record<string, any> = {}) {
  const driver = {
    id: DRIVER_ID,
    tenant_id: TENANT_ID,
    status: 'available',
    license_classes: ['B', 'C'],
    license_expiry: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString(),
    license_number: 'DL-12345',
    current_driving_hours: '2',
    max_driving_hours_day: '9',
    is_active: true,
    ...overrides,
  };
  store.drivers.push(driver);
  return driver;
}

// ── Mock Redis ──────────────────────────────────────────────────────────────
vi.mock('../lib/redis.js', () => ({
  redis: {
    get: vi.fn(async () => null),
    set: vi.fn(async () => {}),
    incr: vi.fn(async () => 42),
    expire: vi.fn(async () => {}),
    del: vi.fn(async () => {}),
    publish: vi.fn(async () => {}),
    lpush: vi.fn(async () => {}),
  },
}));

// ── Mock HoS ────────────────────────────────────────────────────────────────
const mockHos = vi.hoisted(() => ({
  checkHoursAvailable: vi.fn(async () => ({ available: true, current: 2, max: 9 })),
  startDriving: vi.fn(async () => {}),
  stopDriving: vi.fn(async () => {}),
}));
vi.mock('../services/hos.service.js', () => mockHos);

// ── Mock DB ─────────────────────────────────────────────────────────────────
vi.mock('../db/connection.js', () => {
  const c = require('node:crypto');

  function selectProxy() {
    const builder: any = {};
    let _table: string | null = null;

    builder.from = (table: any) => {
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
  }

  function insertProxy(table: any) {
    const builder: any = {};
    let _values: any = null;

    builder.values = (v: any) => { _values = v; return builder; };
    builder.returning = () => builder;
    builder.then = (resolve: any) => {
      const row = { id: c.randomUUID(), ..._values, created_at: new Date().toISOString() };

      if (table.from_status) {
        store.shipmentEvents.push(row);
      }

      return resolve([row]);
    };

    return builder;
  }

  function updateProxy(table: any) {
    const builder: any = {};
    let _setData: any = null;

    builder.set = (data: any) => { _setData = data; return builder; };
    builder.where = () => builder;
    builder.returning = () => builder;
    builder.then = (resolve: any) => {
      if (table.reference_code || table.customer_name) {
        if (store.shipments.length > 0) {
          const s = store.shipments[store.shipments.length - 1];
          Object.assign(s, _setData);
          return resolve([s]);
        }
      }
      if (table.registration) {
        if (store.vehicles.length > 0) {
          Object.assign(store.vehicles[store.vehicles.length - 1], _setData);
          return resolve([store.vehicles[store.vehicles.length - 1]]);
        }
      }
      if (table.license_number) {
        if (store.drivers.length > 0) {
          Object.assign(store.drivers[store.drivers.length - 1], _setData);
          return resolve([store.drivers[store.drivers.length - 1]]);
        }
      }
      return resolve([_setData]);
    };

    return builder;
  }

  const dbInterface = {
    select: () => selectProxy(),
    insert: (table: any) => insertProxy(table),
    update: (table: any) => updateProxy(table),
    delete: () => { const b: any = {}; b.where = () => b; b.then = (r: any) => r(undefined); return b; },
    execute: vi.fn(async () => []),
    transaction: async (fn: any) => {
      const tx = {
        select: () => selectProxy(),
        insert: (table: any) => insertProxy(table),
        update: (table: any) => updateProxy(table),
        delete: () => { const b: any = {}; b.where = () => b; b.then = (r: any) => r(undefined); return b; },
      };
      return fn(tx);
    },
  };

  return { db: dbInterface };
});

// ── Import transition after mocks ───────────────────────────────────────────
import { transition } from '../services/shipment-state-machine.js';

describe('Shipment State Machine', () => {
  beforeEach(() => {
    resetStore();
    vi.clearAllMocks();
    mockHos.checkHoursAvailable.mockResolvedValue({ available: true, current: 2, max: 9 });
  });

  // ── Valid transitions ───────────────────────────────────────────────────

  describe('Valid transitions', () => {
    it('draft → confirmed (confirm)', async () => {
      seedShipment({ status: 'draft' });
      const result = await transition(SHIPMENT_ID, 'confirm', {}, context);
      expect(result.status).toBe('confirmed');
    });

    it('confirmed → assigned (assign)', async () => {
      seedShipment({ status: 'confirmed' });
      seedVehicle();
      seedDriver();
      const result = await transition(SHIPMENT_ID, 'assign', {
        vehicle_id: VEHICLE_ID,
        driver_id: DRIVER_ID,
      }, context);
      expect(result.status).toBe('assigned');
    });

    it('assigned → in_transit via pickup (auto-transition)', async () => {
      seedShipment({ status: 'assigned' });
      const result = await transition(SHIPMENT_ID, 'pickup', {}, context);
      expect(result.status).toBe('in_transit');
    });

    it('in_transit → delivered (deliver)', async () => {
      seedShipment({ status: 'in_transit' });
      const result = await transition(SHIPMENT_ID, 'deliver', {
        pod_signature_url: 'https://example.com/sig.png',
      }, context);
      expect(result.status).toBe('delivered');
    });

    it('delivered → completed (complete)', async () => {
      seedShipment({ status: 'delivered', assigned_vehicle_id: VEHICLE_ID, assigned_driver_id: DRIVER_ID });
      seedVehicle();
      seedDriver();
      const result = await transition(SHIPMENT_ID, 'complete', {}, context);
      expect(result.status).toBe('completed');
    });

    it('in_transit → failed (fail)', async () => {
      seedShipment({ status: 'in_transit', assigned_vehicle_id: VEHICLE_ID, assigned_driver_id: DRIVER_ID });
      seedVehicle();
      seedDriver();
      const result = await transition(SHIPMENT_ID, 'fail', {
        failure_reason: 'Mechanical breakdown',
      }, context);
      expect(result.status).toBe('failed');
    });

    it('failed → confirmed (confirm from failed)', async () => {
      seedShipment({ status: 'failed', failure_reason: 'Old failure' });
      const result = await transition(SHIPMENT_ID, 'confirm', {}, context);
      expect(result.status).toBe('confirmed');
    });

    it('draft → cancelled (cancel)', async () => {
      seedShipment({ status: 'draft' });
      const result = await transition(SHIPMENT_ID, 'cancel', {
        cancellation_reason: 'Customer requested',
      }, context);
      expect(result.status).toBe('cancelled');
    });

    it('confirmed → cancelled (cancel)', async () => {
      seedShipment({ status: 'confirmed' });
      const result = await transition(SHIPMENT_ID, 'cancel', {
        cancellation_reason: 'Changed plans',
      }, context);
      expect(result.status).toBe('cancelled');
    });

    it('assigned → cancelled (cancel)', async () => {
      seedShipment({ status: 'assigned', assigned_vehicle_id: VEHICLE_ID, assigned_driver_id: DRIVER_ID });
      seedVehicle();
      seedDriver();
      const result = await transition(SHIPMENT_ID, 'cancel', {
        cancellation_reason: 'No longer needed',
      }, context);
      expect(result.status).toBe('cancelled');
    });
  });

  // ── Invalid transitions ─────────────────────────────────────────────────

  describe('Invalid transitions', () => {
    it('draft → delivered (409)', async () => {
      seedShipment({ status: 'draft' });
      await expect(transition(SHIPMENT_ID, 'deliver', { pod_signature_url: 'x' }, context))
        .rejects.toMatchObject({ statusCode: 409, code: 'INVALID_TRANSITION' });
    });

    it('confirmed → in_transit directly (409)', async () => {
      seedShipment({ status: 'confirmed' });
      await expect(transition(SHIPMENT_ID, 'pickup', {}, context))
        .rejects.toMatchObject({ statusCode: 409, code: 'INVALID_TRANSITION' });
    });

    it('completed → any action (409)', async () => {
      seedShipment({ status: 'completed' });
      await expect(transition(SHIPMENT_ID, 'confirm', {}, context))
        .rejects.toMatchObject({ statusCode: 409, code: 'INVALID_TRANSITION' });
    });

    it('cancelled → any action (409)', async () => {
      seedShipment({ status: 'cancelled' });
      await expect(transition(SHIPMENT_ID, 'confirm', {}, context))
        .rejects.toMatchObject({ statusCode: 409, code: 'INVALID_TRANSITION' });
    });

    it('draft → assigned directly (409)', async () => {
      seedShipment({ status: 'draft' });
      await expect(transition(SHIPMENT_ID, 'assign', { vehicle_id: VEHICLE_ID, driver_id: DRIVER_ID }, context))
        .rejects.toMatchObject({ statusCode: 409, code: 'INVALID_TRANSITION' });
    });
  });

  // ── Guard failures ──────────────────────────────────────────────────────

  describe('Guard failures', () => {
    it('assign with vehicle capacity_kg < cargo_weight_kg (409 GUARD_FAILED)', async () => {
      seedShipment({ status: 'confirmed', cargo_weight_kg: '6000' });
      seedVehicle({ capacity_kg: '5000' });
      seedDriver();
      await expect(transition(SHIPMENT_ID, 'assign', {
        vehicle_id: VEHICLE_ID,
        driver_id: DRIVER_ID,
      }, context)).rejects.toMatchObject({ statusCode: 409, code: 'GUARD_FAILED' });
    });

    it('assign with driver missing required license class (409)', async () => {
      seedShipment({ status: 'confirmed' });
      seedVehicle({ type: 'semi' }); // requires CE
      seedDriver({ license_classes: ['B'] });
      await expect(transition(SHIPMENT_ID, 'assign', {
        vehicle_id: VEHICLE_ID,
        driver_id: DRIVER_ID,
      }, context)).rejects.toMatchObject({ statusCode: 409, code: 'GUARD_FAILED' });
    });

    it('assign with driver HoS exceeded (409)', async () => {
      mockHos.checkHoursAvailable.mockResolvedValueOnce({ available: false, current: 10, max: 9 });
      seedShipment({ status: 'confirmed' });
      seedVehicle();
      seedDriver();
      await expect(transition(SHIPMENT_ID, 'assign', {
        vehicle_id: VEHICLE_ID,
        driver_id: DRIVER_ID,
      }, context)).rejects.toMatchObject({ statusCode: 409, code: 'GUARD_FAILED' });
    });

    it('deliver with no pod_signature_url and no pod_photo_urls (409)', async () => {
      seedShipment({ status: 'in_transit' });
      await expect(transition(SHIPMENT_ID, 'deliver', {}, context))
        .rejects.toMatchObject({ statusCode: 409, code: 'GUARD_FAILED' });
    });

    it('fail with empty failure_reason (409)', async () => {
      seedShipment({ status: 'in_transit' });
      await expect(transition(SHIPMENT_ID, 'fail', { failure_reason: '' }, context))
        .rejects.toMatchObject({ statusCode: 409, code: 'GUARD_FAILED' });
    });

    it('cancel with empty cancellation_reason (409)', async () => {
      seedShipment({ status: 'draft' });
      await expect(transition(SHIPMENT_ID, 'cancel', { cancellation_reason: '' }, context))
        .rejects.toMatchObject({ statusCode: 409, code: 'GUARD_FAILED' });
    });

    it('assign with expired driver license (409)', async () => {
      seedShipment({ status: 'confirmed' });
      seedVehicle();
      seedDriver({ license_expiry: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString() });
      await expect(transition(SHIPMENT_ID, 'assign', {
        vehicle_id: VEHICLE_ID,
        driver_id: DRIVER_ID,
      }, context)).rejects.toMatchObject({ statusCode: 409, code: 'GUARD_FAILED' });
    });
  });

  // ── Side effects ────────────────────────────────────────────────────────

  describe('Side effects', () => {
    it('actual_pickup_at is set on pickup transition', async () => {
      seedShipment({ status: 'assigned' });
      const result = await transition(SHIPMENT_ID, 'pickup', {}, context);
      expect(result.actual_pickup_at).not.toBeNull();
      expect(result.actual_pickup_at).toBeInstanceOf(Date);
    });

    it('actual_delivery_at is set on deliver transition', async () => {
      seedShipment({ status: 'in_transit' });
      const result = await transition(SHIPMENT_ID, 'deliver', {
        pod_signature_url: 'https://example.com/sig.png',
      }, context);
      expect(result.actual_delivery_at).not.toBeNull();
      expect(result.actual_delivery_at).toBeInstanceOf(Date);
    });

    it('POD fields are persisted on deliver', async () => {
      seedShipment({ status: 'in_transit' });
      await transition(SHIPMENT_ID, 'deliver', {
        pod_signature_url: 'https://example.com/sig.png',
        pod_photo_urls: ['https://example.com/photo1.jpg'],
        pod_notes: 'Left at door',
      }, context);

      const shipment = store.shipments[0];
      expect(shipment.pod_signature_url).toBe('https://example.com/sig.png');
      expect(shipment.pod_photo_urls).toEqual(['https://example.com/photo1.jpg']);
      expect(shipment.pod_notes).toBe('Left at door');
    });

    it('shipment_events row is written for every transition', async () => {
      seedShipment({ status: 'draft' });
      await transition(SHIPMENT_ID, 'confirm', {}, context);
      expect(store.shipmentEvents.length).toBeGreaterThanOrEqual(1);
      const event = store.shipmentEvents[0];
      expect(event.from_status).toBe('draft');
      expect(event.to_status).toBe('confirmed');
      expect(event.event_type).toBe('confirm');
    });

    it('reference_code is generated on confirm-from-draft', async () => {
      seedShipment({ status: 'draft' });
      const result = await transition(SHIPMENT_ID, 'confirm', {}, context);
      expect(result.reference_code).toBeDefined();
      expect(result.reference_code).toMatch(/^SHP-\d{8}-\d{5}$/);
    });

    it('failure_reason is cleared on confirm-from-failed', async () => {
      seedShipment({ status: 'failed', failure_reason: 'engine broke' });
      await transition(SHIPMENT_ID, 'confirm', {}, context);
      expect(store.shipments[0].failure_reason).toBeNull();
    });

    it('pickup creates two events (picked_up + auto in_transit)', async () => {
      seedShipment({ status: 'assigned' });
      await transition(SHIPMENT_ID, 'pickup', {}, context);
      expect(store.shipmentEvents.length).toBe(2);
      expect(store.shipmentEvents[0].to_status).toBe('picked_up');
      expect(store.shipmentEvents[1].from_status).toBe('picked_up');
      expect(store.shipmentEvents[1].to_status).toBe('in_transit');
    });
  });

  // ── Unknown action ──────────────────────────────────────────────────────

  it('unknown action returns 400 INVALID_ACTION', async () => {
    seedShipment({ status: 'draft' });
    await expect(transition(SHIPMENT_ID, 'nonexistent', {}, context))
      .rejects.toMatchObject({ statusCode: 400, code: 'INVALID_ACTION' });
  });

  // ── Shipment not found ────────────────────────────────────────────────

  it('non-existent shipment returns 404', async () => {
    await expect(transition(crypto.randomUUID(), 'confirm', {}, context))
      .rejects.toMatchObject({ statusCode: 404, code: 'NOT_FOUND' });
  });
});
