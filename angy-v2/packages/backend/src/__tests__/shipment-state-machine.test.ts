import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  SHIPMENT_TRANSITIONS,
  TERMINAL_STATUSES,
  SHIPMENT_STATUSES,
  VEHICLE_TYPE_LICENSE_MAP,
} from '@nexusfleet/shared';

// ─── Mock DB + Redis before importing the state machine ────────────
const mockTxUpdate = vi.fn().mockReturnValue({ set: vi.fn().mockReturnValue({ where: vi.fn() }) });
const mockTxInsert = vi.fn().mockReturnValue({ values: vi.fn() });
const mockTxSelect = vi.fn();

const mockTx = {
  select: mockTxSelect,
  update: mockTxUpdate,
  insert: mockTxInsert,
};

function buildSelectChain(rows: any[]) {
  // The whereResult needs to be both thenable (for queries without .limit())
  // and have .limit() for queries that chain it.
  const whereResult: any = Promise.resolve(rows);
  whereResult.limit = vi.fn().mockResolvedValue(rows);
  whereResult.orderBy = vi.fn().mockReturnValue({
    limit: vi.fn().mockResolvedValue(rows),
  });

  return {
    from: vi.fn().mockReturnValue({
      where: vi.fn().mockReturnValue(whereResult),
    }),
  };
}

const mockTransaction = vi.fn();

vi.mock('../db/connection.js', () => ({
  db: {
    transaction: (fn: (tx: any) => any) => mockTransaction(fn),
  },
}));

vi.mock('../db/schema.js', () => ({
  shipments: { id: 'id', tenant_id: 'tenant_id', status: 'status', $inferSelect: {} },
  shipmentEvents: {},
  vehicles: { id: 'id', tenant_id: 'tenant_id', status: 'status' },
  drivers: { id: 'id', tenant_id: 'tenant_id', status: 'status' },
}));

vi.mock('ioredis', () => ({
  Redis: vi.fn().mockImplementation(() => ({
    incr: vi.fn().mockResolvedValue(1),
    expire: vi.fn().mockResolvedValue(1),
    connect: vi.fn().mockResolvedValue(undefined),
    publish: vi.fn().mockResolvedValue(1),
  })),
}));

vi.mock('drizzle-orm', () => ({
  eq: vi.fn((_col: any, val: any) => ({ _type: 'eq', val })),
  and: vi.fn((...conditions: any[]) => ({ _type: 'and', conditions })),
  sql: vi.fn(),
}));

import { executeTransition } from '../services/shipment-state-machine.js';

// ─── Helpers ───────────────────────────────────────────
function setupTransaction(shipment: any, additionalSelects: any[][] = []) {
  let selectCallCount = 0;
  mockTransaction.mockImplementation(async (fn) => {
    // Build fresh mock tx for each transaction
    const txUpdate = vi.fn().mockReturnValue({
      set: vi.fn().mockReturnValue({ where: vi.fn() }),
    });
    const txInsert = vi.fn().mockReturnValue({ values: vi.fn() });

    const allSelects = [[shipment], ...additionalSelects];
    const txSelect = vi.fn().mockImplementation(() => {
      const rows = allSelects[selectCallCount] ?? [shipment];
      selectCallCount++;
      return buildSelectChain(rows);
    });

    const tx = { select: txSelect, update: txUpdate, insert: txInsert };
    return fn(tx);
  });
}

function makeShipment(overrides: Record<string, any> = {}) {
  return {
    id: 'shipment-1',
    tenant_id: 'tenant-1',
    status: 'draft',
    reference_code: null,
    pod_signature_url: null,
    pod_photo_urls: null,
    failure_reason: null,
    cancellation_reason: null,
    ...overrides,
  };
}

// ─── Tests ─────────────────────────────────────────────

describe('shipment-state-machine', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ── Valid Transitions ──────────────────────────────────

  describe('valid transitions', () => {
    it('draft → confirmed', async () => {
      const shipment = makeShipment({ status: 'draft' });
      setupTransaction(shipment);

      const result = await executeTransition(
        'shipment-1', 'tenant-1', 'user-1', 'draft', 'confirmed',
      );
      expect(result.code).toBeNull();
    });

    it('draft → cancelled', async () => {
      const shipment = makeShipment({ status: 'draft' });
      setupTransaction(shipment);

      const result = await executeTransition(
        'shipment-1', 'tenant-1', 'user-1', 'draft', 'cancelled',
        { cancellation_reason: 'Changed mind' },
      );
      expect(result.code).toBeNull();
    });

    it('confirmed → assigned (with valid vehicle+driver)', async () => {
      const shipment = makeShipment({ status: 'confirmed' });
      const vehicle = { id: 'v1', tenant_id: 'tenant-1', status: 'available', type: 'van' };
      const driver = {
        id: 'd1', tenant_id: 'tenant-1', status: 'available',
        license_classes: ['B'], current_driving_hours: 2, max_driving_hours_day: 9,
      };

      setupTransaction(shipment, [[vehicle], [driver]]);

      const result = await executeTransition(
        'shipment-1', 'tenant-1', 'user-1', 'confirmed', 'assigned',
        { vehicle_id: 'v1', driver_id: 'd1' },
      );
      expect(result.code).toBeNull();
    });

    it('confirmed → cancelled', async () => {
      const shipment = makeShipment({ status: 'confirmed' });
      setupTransaction(shipment);

      const result = await executeTransition(
        'shipment-1', 'tenant-1', 'user-1', 'confirmed', 'cancelled',
        { cancellation_reason: 'No longer needed' },
      );
      expect(result.code).toBeNull();
    });

    it('assigned → picked_up', async () => {
      const shipment = makeShipment({ status: 'assigned' });
      setupTransaction(shipment);

      const result = await executeTransition(
        'shipment-1', 'tenant-1', 'user-1', 'assigned', 'picked_up',
      );
      expect(result.code).toBeNull();
    });

    it('picked_up → in_transit', async () => {
      const shipment = makeShipment({ status: 'picked_up' });
      setupTransaction(shipment);

      const result = await executeTransition(
        'shipment-1', 'tenant-1', 'user-1', 'picked_up', 'in_transit',
      );
      expect(result.code).toBeNull();
    });

    it('in_transit → delivered (with POD signature)', async () => {
      const shipment = makeShipment({ status: 'in_transit' });
      setupTransaction(shipment);

      const result = await executeTransition(
        'shipment-1', 'tenant-1', 'user-1', 'in_transit', 'delivered',
        { pod_signature_url: 'https://example.com/sig.png' },
      );
      expect(result.code).toBeNull();
    });

    it('in_transit → delivered (with POD photos)', async () => {
      const shipment = makeShipment({ status: 'in_transit' });
      setupTransaction(shipment);

      const result = await executeTransition(
        'shipment-1', 'tenant-1', 'user-1', 'in_transit', 'delivered',
        { pod_photo_urls: ['https://example.com/photo.jpg'] },
      );
      expect(result.code).toBeNull();
    });

    it('in_transit → failed (with failure_reason)', async () => {
      const shipment = makeShipment({ status: 'in_transit' });
      setupTransaction(shipment);

      const result = await executeTransition(
        'shipment-1', 'tenant-1', 'user-1', 'in_transit', 'failed',
        { failure_reason: 'Address not found' },
      );
      expect(result.code).toBeNull();
    });

    it('delivered → completed', async () => {
      const shipment = makeShipment({ status: 'delivered' });
      setupTransaction(shipment);

      const result = await executeTransition(
        'shipment-1', 'tenant-1', 'user-1', 'delivered', 'completed',
      );
      expect(result.code).toBeNull();
    });

    it('failed → confirmed (retry) — clears failure_reason', async () => {
      const shipment = makeShipment({ status: 'failed', failure_reason: 'Address not found' });
      setupTransaction(shipment);

      const result = await executeTransition(
        'shipment-1', 'tenant-1', 'user-1', 'failed', 'confirmed',
      );
      expect(result.code).toBeNull();
    });
  });

  // ── Invalid Transitions ────────────────────────────────

  describe('invalid transitions', () => {
    const invalidPairs = [
      ['draft', 'delivered'],
      ['draft', 'in_transit'],
      ['draft', 'assigned'],
      ['draft', 'completed'],
      ['completed', 'confirmed'],
      ['completed', 'draft'],
      ['cancelled', 'confirmed'],
      ['cancelled', 'draft'],
      ['confirmed', 'picked_up'],
      ['confirmed', 'delivered'],
      ['confirmed', 'in_transit'],
      ['assigned', 'delivered'],
      ['assigned', 'confirmed'],
      ['picked_up', 'delivered'],
      ['in_transit', 'assigned'],
      ['delivered', 'in_transit'],
      ['failed', 'delivered'],
    ];

    for (const [from, to] of invalidPairs) {
      it(`${from} → ${to} should fail`, async () => {
        const shipment = makeShipment({ status: from });
        setupTransaction(shipment);

        const result = await executeTransition(
          'shipment-1', 'tenant-1', 'user-1', from, to,
        );
        expect(result.error).toBeDefined();
        expect(result.code).toBe('TRANSITION_FAILED');
      });
    }
  });

  // ── Guard Conditions ───────────────────────────────────

  describe('guard conditions', () => {
    it('confirmed → assigned with vehicle not available → guard failure', async () => {
      const shipment = makeShipment({ status: 'confirmed' });
      const vehicle = { id: 'v1', tenant_id: 'tenant-1', status: 'in_transit', type: 'van' };
      const driver = {
        id: 'd1', tenant_id: 'tenant-1', status: 'available',
        license_classes: ['B'], current_driving_hours: 2, max_driving_hours_day: 9,
      };

      setupTransaction(shipment, [[vehicle], [driver]]);

      const result = await executeTransition(
        'shipment-1', 'tenant-1', 'user-1', 'confirmed', 'assigned',
        { vehicle_id: 'v1', driver_id: 'd1' },
      );
      expect(result.code).toBe('TRANSITION_FAILED');
      expect(result.guard).toContain('available');
    });

    it('confirmed → assigned with license class mismatch → guard failure', async () => {
      const shipment = makeShipment({ status: 'confirmed' });
      const vehicle = { id: 'v1', tenant_id: 'tenant-1', status: 'available', type: 'semi' };
      const driver = {
        id: 'd1', tenant_id: 'tenant-1', status: 'available',
        license_classes: ['B'], current_driving_hours: 2, max_driving_hours_day: 9,
      };

      setupTransaction(shipment, [[vehicle], [driver]]);

      const result = await executeTransition(
        'shipment-1', 'tenant-1', 'user-1', 'confirmed', 'assigned',
        { vehicle_id: 'v1', driver_id: 'd1' },
      );
      expect(result.code).toBe('TRANSITION_FAILED');
      expect(result.guard).toContain('license class');
    });

    it('confirmed → assigned with driver hours exceeded → guard failure', async () => {
      const shipment = makeShipment({ status: 'confirmed' });
      const vehicle = { id: 'v1', tenant_id: 'tenant-1', status: 'available', type: 'van' };
      const driver = {
        id: 'd1', tenant_id: 'tenant-1', status: 'available',
        license_classes: ['B'], current_driving_hours: 10, max_driving_hours_day: 9,
      };

      setupTransaction(shipment, [[vehicle], [driver]]);

      const result = await executeTransition(
        'shipment-1', 'tenant-1', 'user-1', 'confirmed', 'assigned',
        { vehicle_id: 'v1', driver_id: 'd1' },
      );
      expect(result.code).toBe('TRANSITION_FAILED');
      expect(result.guard).toContain('driving hours');
    });

    it('in_transit → delivered without POD → guard failure', async () => {
      const shipment = makeShipment({ status: 'in_transit' });
      setupTransaction(shipment);

      const result = await executeTransition(
        'shipment-1', 'tenant-1', 'user-1', 'in_transit', 'delivered',
      );
      expect(result.code).toBe('TRANSITION_FAILED');
      expect(result.guard).toContain('pod');
    });

    it('in_transit → failed without failure_reason → guard failure', async () => {
      const shipment = makeShipment({ status: 'in_transit' });
      setupTransaction(shipment);

      const result = await executeTransition(
        'shipment-1', 'tenant-1', 'user-1', 'in_transit', 'failed',
      );
      expect(result.code).toBe('TRANSITION_FAILED');
      expect(result.guard).toContain('failure_reason');
    });
  });

  // ── Auto-chain: pickup action ──────────────────────────

  describe('pickup auto-chain', () => {
    it('assigned → picked_up → in_transit with two event records', async () => {
      const shipment = makeShipment({ status: 'assigned' });
      let insertCount = 0;

      mockTransaction.mockImplementation(async (fn) => {
        const txInsertValues = vi.fn().mockImplementation(() => {
          insertCount++;
        });
        const txInsert = vi.fn().mockReturnValue({ values: txInsertValues });
        const txUpdate = vi.fn().mockReturnValue({
          set: vi.fn().mockReturnValue({ where: vi.fn() }),
        });

        // 1st select: fetch shipment, 2nd: fetch final shipment
        let selectCall = 0;
        const txSelect = vi.fn().mockImplementation(() => {
          selectCall++;
          if (selectCall === 1) return buildSelectChain([shipment]);
          // Final shipment after auto-chain
          return buildSelectChain([{ ...shipment, status: 'in_transit' }]);
        });

        const tx = { select: txSelect, update: txUpdate, insert: txInsert };
        return fn(tx);
      });

      const result = await executeTransition(
        'shipment-1', 'tenant-1', 'user-1',
        'assigned', 'picked_up',
        undefined,
        { nextTo: 'in_transit' },
      );

      expect(result.code).toBeNull();
      expect(result.shipment?.status).toBe('in_transit');
      // Two inserts = two shipment_events records
      expect(insertCount).toBe(2);
    });
  });

  // ── Retry action ───────────────────────────────────────

  describe('retry action', () => {
    it('failed → confirmed clears failure_reason', async () => {
      const shipment = makeShipment({ status: 'failed', failure_reason: 'Bad address' });
      let capturedSetArgs: any = null;

      mockTransaction.mockImplementation(async (fn) => {
        const txUpdate = vi.fn().mockReturnValue({
          set: vi.fn().mockImplementation((setData: any) => {
            capturedSetArgs = setData;
            return { where: vi.fn() };
          }),
        });
        const txInsert = vi.fn().mockReturnValue({ values: vi.fn() });

        let selectCall = 0;
        const txSelect = vi.fn().mockImplementation(() => {
          selectCall++;
          if (selectCall === 1) return buildSelectChain([shipment]);
          return buildSelectChain([{ ...shipment, status: 'confirmed', failure_reason: null }]);
        });

        const tx = { select: txSelect, update: txUpdate, insert: txInsert };
        return fn(tx);
      });

      const result = await executeTransition(
        'shipment-1', 'tenant-1', 'user-1', 'failed', 'confirmed',
      );

      expect(result.code).toBeNull();
      // The set call should include failure_reason: null
      expect(capturedSetArgs).toHaveProperty('failure_reason', null);
    });
  });

  // ── Terminal States ────────────────────────────────────

  describe('terminal states', () => {
    for (const terminal of TERMINAL_STATUSES) {
      const targets = SHIPMENT_STATUSES.filter((s) => s !== terminal);
      for (const target of targets) {
        it(`${terminal} → ${target} should fail`, async () => {
          const shipment = makeShipment({ status: terminal });
          setupTransaction(shipment);

          const result = await executeTransition(
            'shipment-1', 'tenant-1', 'user-1', terminal, target,
          );
          expect(result.code).toBe('TRANSITION_FAILED');
        });
      }
    }
  });

  // ── Shipment not found ─────────────────────────────────

  describe('edge cases', () => {
    it('returns NOT_FOUND when shipment does not exist', async () => {
      mockTransaction.mockImplementation(async (fn) => {
        const txSelect = vi.fn().mockImplementation(() => buildSelectChain([]));
        const tx = {
          select: txSelect,
          update: vi.fn(),
          insert: vi.fn(),
        };
        return fn(tx);
      });

      const result = await executeTransition(
        'nonexistent', 'tenant-1', 'user-1', 'draft', 'confirmed',
      );
      expect(result.code).toBe('NOT_FOUND');
    });

    it('returns TRANSITION_FAILED when current status mismatches fromStatus', async () => {
      const shipment = makeShipment({ status: 'confirmed' });
      setupTransaction(shipment);

      const result = await executeTransition(
        'shipment-1', 'tenant-1', 'user-1', 'draft', 'confirmed',
      );
      expect(result.code).toBe('TRANSITION_FAILED');
      expect(result.guard).toContain('confirmed');
    });
  });

  // ── Transition map completeness ────────────────────────

  describe('transition map completeness', () => {
    it('all SHIPMENT_TRANSITIONS keys are present', () => {
      const keys = Object.keys(SHIPMENT_TRANSITIONS);
      expect(keys.length).toBeGreaterThanOrEqual(11);
    });

    it('includes failed:confirmed (retry)', () => {
      expect(SHIPMENT_TRANSITIONS['failed:confirmed']).toBeDefined();
      expect(SHIPMENT_TRANSITIONS['failed:confirmed'].action).toBe('retry');
    });

    it('cancelled and completed have no outgoing transitions', () => {
      const outgoing = Object.keys(SHIPMENT_TRANSITIONS).filter(
        (k) => k.startsWith('cancelled:') || k.startsWith('completed:'),
      );
      expect(outgoing).toHaveLength(0);
    });
  });
});
