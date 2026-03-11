import { describe, it, expect, vi, beforeEach } from 'vitest';
import { SHIPMENT_TRANSITIONS, SHIPMENT_STATUSES } from '@nexus-fleet/shared';
import type { ShipmentStatus } from '@nexus-fleet/shared';

// ---------------------------------------------------------------------------
// Re-implement guard functions from the state machine for unit testing
// (the originals are module-private and tightly coupled to DB/Redis)
// ---------------------------------------------------------------------------

interface MockShipment {
  id: string;
  status: ShipmentStatus;
  originAddress: string | null;
  destAddress: string | null;
  weightKg: number | null;
  cargoType: string;
  cargoDescription: string | null;
  scheduledPickup: string | null;
  referenceCode: string;
  vehicleId: string | null;
  driverId: string | null;
}

interface TransitionData {
  vehicleId?: string;
  driverId?: string;
  cancellationReason?: string;
  failureReason?: string;
  podSignature?: string;
  podPhotoUrls?: string[];
  podNotes?: string;
  notes?: string;
}

interface TransitionContext {
  shipment: MockShipment;
  data: TransitionData;
  now: Date;
}

type GuardFn = (ctx: TransitionContext) => string | null;

const requireFields: GuardFn = (ctx) => {
  if (!ctx.shipment.originAddress) return 'Origin address is required';
  if (!ctx.shipment.destAddress) return 'Destination address is required';
  if (!ctx.shipment.weightKg) return 'Cargo weight is required';
  return null;
};

const maxWeight: GuardFn = (ctx) => {
  const weight = Number(ctx.shipment.weightKg);
  if (weight > 50_000) return `Cargo weight ${weight}kg exceeds maximum 50,000kg`;
  return null;
};

const tempControlCheck: GuardFn = (ctx) => {
  if (ctx.shipment.cargoType === 'perishable' && !ctx.shipment.cargoDescription) {
    return 'Perishable cargo requires a cargo description with temperature control info';
  }
  return null;
};

const requireCancellationReason: GuardFn = (ctx) => {
  if (!ctx.data.cancellationReason) return 'Cancellation reason is required';
  return null;
};

const requireVehicleAndDriver: GuardFn = (ctx) => {
  if (!ctx.data.vehicleId) return 'Vehicle ID is required for assignment';
  if (!ctx.data.driverId) return 'Driver ID is required for assignment';
  return null;
};

const requirePOD: GuardFn = (ctx) => {
  if (!ctx.data.podSignature && (!ctx.data.podPhotoUrls || ctx.data.podPhotoUrls.length === 0)) {
    return 'Proof of delivery required (signature URL or photo)';
  }
  return null;
};

const requireFailureReason: GuardFn = (ctx) => {
  if (!ctx.data.failureReason) return 'Failure reason is required';
  return null;
};

const validatePickupWindow: GuardFn = (ctx) => {
  if (!ctx.shipment.scheduledPickup) return null;
  const scheduled = new Date(ctx.shipment.scheduledPickup).getTime();
  const now = ctx.now.getTime();
  const twoHoursMs = 2 * 60 * 60 * 1000;
  if (Math.abs(now - scheduled) > twoHoursMs) {
    return 'Pickup must be within 2 hours of the scheduled pickup time';
  }
  return null;
};

const GUARD_MAP: Record<string, GuardFn[]> = {
  'draft:confirmed': [requireFields, maxWeight, tempControlCheck],
  'draft:cancelled': [requireCancellationReason],
  'confirmed:assigned': [requireVehicleAndDriver],
  'confirmed:cancelled': [requireCancellationReason],
  'assigned:picked_up': [validatePickupWindow],
  'assigned:cancelled': [requireCancellationReason],
  'picked_up:in_transit': [],
  'in_transit:delivered': [requirePOD],
  'in_transit:failed': [requireFailureReason],
  'delivered:completed': [],
  'failed:confirmed': [],
};

function isTransitionAllowed(from: string, to: string): boolean {
  const allowed = SHIPMENT_TRANSITIONS[from];
  return !!allowed && allowed.includes(to);
}

function runGuards(from: string, to: string, ctx: TransitionContext): string | null {
  const guards = GUARD_MAP[`${from}:${to}`];
  if (!guards) return `No transition definition for '${from}:${to}'`;
  for (const guard of guards) {
    const err = guard(ctx);
    if (err) return err;
  }
  return null;
}

function makeShipment(overrides: Partial<MockShipment> = {}): MockShipment {
  return {
    id: 'shp-001',
    status: 'draft',
    originAddress: '123 Pickup St',
    destAddress: '456 Delivery Ave',
    weightKg: 500,
    cargoType: 'general',
    cargoDescription: null,
    scheduledPickup: new Date().toISOString(),
    referenceCode: 'SHP-20260101-00001',
    vehicleId: null,
    driverId: null,
    ...overrides,
  };
}

function makeCtx(
  shipment: MockShipment,
  data: TransitionData = {},
  now?: Date,
): TransitionContext {
  return { shipment, data, now: now ?? new Date() };
}

// ===========================================================================
// Tests
// ===========================================================================

describe('SHIPMENT_TRANSITIONS constant', () => {
  it('contains all expected statuses as keys', () => {
    for (const status of SHIPMENT_STATUSES) {
      expect(SHIPMENT_TRANSITIONS).toHaveProperty(status);
    }
  });

  it('has no unknown status keys', () => {
    const statusSet = new Set<string>(SHIPMENT_STATUSES);
    for (const key of Object.keys(SHIPMENT_TRANSITIONS)) {
      expect(statusSet.has(key)).toBe(true);
    }
  });

  it('has no unknown statuses in transition targets', () => {
    const statusSet = new Set<string>(SHIPMENT_STATUSES);
    for (const targets of Object.values(SHIPMENT_TRANSITIONS)) {
      for (const t of targets) {
        expect(statusSet.has(t)).toBe(true);
      }
    }
  });
});

describe('Valid transitions', () => {
  const validTransitions: [string, string][] = [
    ['draft', 'confirmed'],
    ['draft', 'cancelled'],
    ['confirmed', 'assigned'],
    ['confirmed', 'cancelled'],
    ['assigned', 'picked_up'],
    ['assigned', 'cancelled'],
    ['picked_up', 'in_transit'],
    ['in_transit', 'delivered'],
    ['in_transit', 'failed'],
    ['delivered', 'completed'],
    ['failed', 'confirmed'],
  ];

  it.each(validTransitions)('%s → %s is allowed', (from, to) => {
    expect(isTransitionAllowed(from, to)).toBe(true);
  });
});

describe('Invalid transitions', () => {
  const invalidTransitions: [string, string][] = [
    ['draft', 'delivered'],
    ['draft', 'in_transit'],
    ['confirmed', 'delivered'],
    ['assigned', 'delivered'],
    ['picked_up', 'cancelled'],
    ['delivered', 'draft'],
    ['completed', 'draft'],
    ['cancelled', 'draft'],
  ];

  it.each(invalidTransitions)('%s → %s is NOT allowed', (from, to) => {
    expect(isTransitionAllowed(from, to)).toBe(false);
  });
});

describe('Terminal states have no outgoing transitions', () => {
  it('completed has no transitions', () => {
    expect(SHIPMENT_TRANSITIONS['completed']).toEqual([]);
  });

  it('cancelled has no transitions', () => {
    expect(SHIPMENT_TRANSITIONS['cancelled']).toEqual([]);
  });
});

describe('Guard: draft → confirmed', () => {
  it('passes with all required fields', () => {
    const ctx = makeCtx(makeShipment());
    expect(runGuards('draft', 'confirmed', ctx)).toBeNull();
  });

  it('fails without origin address', () => {
    const ctx = makeCtx(makeShipment({ originAddress: null }));
    expect(runGuards('draft', 'confirmed', ctx)).toBe('Origin address is required');
  });

  it('fails without destination address', () => {
    const ctx = makeCtx(makeShipment({ destAddress: null }));
    expect(runGuards('draft', 'confirmed', ctx)).toBe('Destination address is required');
  });

  it('fails without weight', () => {
    const ctx = makeCtx(makeShipment({ weightKg: null }));
    expect(runGuards('draft', 'confirmed', ctx)).toBe('Cargo weight is required');
  });

  it('fails when weight exceeds 50,000 kg', () => {
    const ctx = makeCtx(makeShipment({ weightKg: 60_000 }));
    const err = runGuards('draft', 'confirmed', ctx);
    expect(err).toContain('exceeds maximum 50,000kg');
  });

  it('fails for perishable cargo without description', () => {
    const ctx = makeCtx(makeShipment({ cargoType: 'perishable', cargoDescription: null }));
    expect(runGuards('draft', 'confirmed', ctx)).toBe(
      'Perishable cargo requires a cargo description with temperature control info',
    );
  });

  it('passes for perishable cargo with description', () => {
    const ctx = makeCtx(
      makeShipment({ cargoType: 'perishable', cargoDescription: 'Keep at -18C' }),
    );
    expect(runGuards('draft', 'confirmed', ctx)).toBeNull();
  });
});

describe('Guard: confirmed → assigned', () => {
  it('fails without vehicle_id', () => {
    const ctx = makeCtx(makeShipment({ status: 'confirmed' }), { driverId: 'drv-1' });
    expect(runGuards('confirmed', 'assigned', ctx)).toBe(
      'Vehicle ID is required for assignment',
    );
  });

  it('fails without driver_id', () => {
    const ctx = makeCtx(makeShipment({ status: 'confirmed' }), { vehicleId: 'veh-1' });
    expect(runGuards('confirmed', 'assigned', ctx)).toBe(
      'Driver ID is required for assignment',
    );
  });

  it('passes with both vehicle_id and driver_id', () => {
    const ctx = makeCtx(makeShipment({ status: 'confirmed' }), {
      vehicleId: 'veh-1',
      driverId: 'drv-1',
    });
    expect(runGuards('confirmed', 'assigned', ctx)).toBeNull();
  });
});

describe('Guard: assigned → picked_up (pickup window)', () => {
  it('passes when within 2-hour window', () => {
    const now = new Date('2026-06-15T10:00:00Z');
    const scheduledPickup = new Date('2026-06-15T10:30:00Z').toISOString();
    const ctx = makeCtx(makeShipment({ status: 'assigned', scheduledPickup }), {}, now);
    expect(runGuards('assigned', 'picked_up', ctx)).toBeNull();
  });

  it('fails when outside 2-hour window', () => {
    const now = new Date('2026-06-15T14:00:00Z');
    const scheduledPickup = new Date('2026-06-15T10:00:00Z').toISOString();
    const ctx = makeCtx(makeShipment({ status: 'assigned', scheduledPickup }), {}, now);
    expect(runGuards('assigned', 'picked_up', ctx)).toBe(
      'Pickup must be within 2 hours of the scheduled pickup time',
    );
  });

  it('passes when no scheduled pickup is set', () => {
    const ctx = makeCtx(makeShipment({ status: 'assigned', scheduledPickup: null }));
    expect(runGuards('assigned', 'picked_up', ctx)).toBeNull();
  });

  it('passes at exactly the 2-hour boundary', () => {
    const now = new Date('2026-06-15T12:00:00Z');
    const scheduledPickup = new Date('2026-06-15T10:00:00Z').toISOString();
    const ctx = makeCtx(makeShipment({ status: 'assigned', scheduledPickup }), {}, now);
    expect(runGuards('assigned', 'picked_up', ctx)).toBeNull();
  });
});

describe('Guard: in_transit → delivered (POD)', () => {
  it('fails without any proof of delivery', () => {
    const ctx = makeCtx(makeShipment({ status: 'in_transit' }));
    expect(runGuards('in_transit', 'delivered', ctx)).toBe(
      'Proof of delivery required (signature URL or photo)',
    );
  });

  it('passes with pod signature', () => {
    const ctx = makeCtx(makeShipment({ status: 'in_transit' }), {
      podSignature: 'https://example.com/sig.png',
    });
    expect(runGuards('in_transit', 'delivered', ctx)).toBeNull();
  });

  it('passes with pod photo URLs', () => {
    const ctx = makeCtx(makeShipment({ status: 'in_transit' }), {
      podPhotoUrls: ['https://example.com/photo1.jpg'],
    });
    expect(runGuards('in_transit', 'delivered', ctx)).toBeNull();
  });

  it('fails with empty pod photo array', () => {
    const ctx = makeCtx(makeShipment({ status: 'in_transit' }), { podPhotoUrls: [] });
    expect(runGuards('in_transit', 'delivered', ctx)).toBe(
      'Proof of delivery required (signature URL or photo)',
    );
  });
});

describe('Guard: in_transit → failed', () => {
  it('fails without failure reason', () => {
    const ctx = makeCtx(makeShipment({ status: 'in_transit' }));
    expect(runGuards('in_transit', 'failed', ctx)).toBe('Failure reason is required');
  });

  it('passes with failure reason', () => {
    const ctx = makeCtx(makeShipment({ status: 'in_transit' }), {
      failureReason: 'Road blocked',
    });
    expect(runGuards('in_transit', 'failed', ctx)).toBeNull();
  });
});

describe('Guard: cancellation transitions', () => {
  const cancellableFrom: ShipmentStatus[] = ['draft', 'confirmed', 'assigned'];

  it.each(cancellableFrom)('%s → cancelled fails without reason', (from) => {
    const ctx = makeCtx(makeShipment({ status: from }));
    expect(runGuards(from, 'cancelled', ctx)).toBe('Cancellation reason is required');
  });

  it.each(cancellableFrom)('%s → cancelled passes with reason', (from) => {
    const ctx = makeCtx(makeShipment({ status: from }), {
      cancellationReason: 'Customer request',
    });
    expect(runGuards(from, 'cancelled', ctx)).toBeNull();
  });
});

describe('Guard-free transitions', () => {
  it('picked_up → in_transit has no guards', () => {
    const ctx = makeCtx(makeShipment({ status: 'picked_up' }));
    expect(runGuards('picked_up', 'in_transit', ctx)).toBeNull();
  });

  it('delivered → completed has no guards', () => {
    const ctx = makeCtx(makeShipment({ status: 'delivered' }));
    expect(runGuards('delivered', 'completed', ctx)).toBeNull();
  });

  it('failed → confirmed has no guards', () => {
    const ctx = makeCtx(makeShipment({ status: 'failed' }));
    expect(runGuards('failed', 'confirmed', ctx)).toBeNull();
  });
});

describe('Edge cases', () => {
  it('draft → draft is not an allowed transition', () => {
    expect(isTransitionAllowed('draft', 'draft')).toBe(false);
  });

  it('nonexistent status is not allowed', () => {
    expect(isTransitionAllowed('nonexistent', 'confirmed')).toBe(false);
  });

  it('the happy path draft→confirmed→assigned→picked_up→in_transit→delivered→completed is fully valid', () => {
    const path: ShipmentStatus[] = [
      'draft',
      'confirmed',
      'assigned',
      'picked_up',
      'in_transit',
      'delivered',
      'completed',
    ];
    for (let i = 0; i < path.length - 1; i++) {
      expect(isTransitionAllowed(path[i], path[i + 1])).toBe(true);
    }
  });

  it('failed shipments can be retried through confirmed', () => {
    expect(isTransitionAllowed('failed', 'confirmed')).toBe(true);
    expect(isTransitionAllowed('confirmed', 'assigned')).toBe(true);
  });
});
