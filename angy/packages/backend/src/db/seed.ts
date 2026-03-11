import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { sql } from 'drizzle-orm';
import bcrypt from 'bcrypt';
import * as schema from './schema.js';

// ── Seeded PRNG (mulberry32, seed=42) ────────────────────────────────────────

function mulberry32(seed: number) {
  let s = seed | 0;
  return () => {
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const rand = mulberry32(42);

function randomInt(min: number, max: number): number {
  return Math.floor(rand() * (max - min + 1)) + min;
}

function randomFloat(min: number, max: number, decimals = 6): number {
  return parseFloat((rand() * (max - min) + min).toFixed(decimals));
}

function pick<T>(arr: readonly T[]): T {
  return arr[Math.floor(rand() * arr.length)];
}

function uuid(): string {
  const hex = '0123456789abcdef';
  let s = '';
  for (let i = 0; i < 32; i++) {
    s += hex[Math.floor(rand() * 16)];
  }
  return `${s.slice(0, 8)}-${s.slice(8, 12)}-4${s.slice(13, 16)}-${hex[8 + Math.floor(rand() * 4)]}${s.slice(17, 20)}-${s.slice(20, 32)}`;
}

// ── NYC-area coordinate helpers ──────────────────────────────────────────────

function nycLat(): number {
  return randomFloat(40.6, 40.85);
}

function nycLng(): number {
  return randomFloat(-74.05, -73.85);
}

function pointWkt(lat: number, lng: number): string {
  return `SRID=4326;POINT(${lng} ${lat})`;
}

// ── Main ─────────────────────────────────────────────────────────────────────

async function seed() {
  const databaseUrl =
    process.env.DATABASE_URL ||
    'postgres://nexus:nexus@localhost:5432/nexus_fleet';
  const client = postgres(databaseUrl);
  const db = drizzle(client, { schema });

  console.log('Seeding database...');

  // Clean existing data in order
  await db.execute(sql`TRUNCATE TABLE
    geofence_events, geofences, webhook_endpoints, notifications,
    route_stops, routes, shipment_events, shipments,
    vehicles, drivers, users, tenants
    CASCADE`);

  // ── Tenant ───────────────────────────────────────────────────────────────

  const tenantId = uuid();
  await db.insert(schema.tenants).values({
    id: tenantId,
    name: 'Acme Logistics',
    slug: 'acme-logistics',
    plan: 'pro',
    max_vehicles: 50,
    max_drivers: 30,
  });
  console.log('  Created tenant: Acme Logistics');

  // ── Users ────────────────────────────────────────────────────────────────

  const passwordHash = await bcrypt.hash('Password1!', 10);
  const roles = ['owner', 'admin', 'dispatcher', 'viewer'] as const;
  const userNames = [
    { first: 'Alice', last: 'Johnson' },
    { first: 'Bob', last: 'Smith' },
    { first: 'Carol', last: 'Williams' },
    { first: 'Dave', last: 'Brown' },
  ];

  const userIds: string[] = [];
  for (let i = 0; i < 4; i++) {
    const userId = uuid();
    userIds.push(userId);
    await db.insert(schema.users).values({
      id: userId,
      tenant_id: tenantId,
      email: `${userNames[i].first.toLowerCase()}@acmelogistics.com`,
      password_hash: passwordHash,
      role: roles[i],
      first_name: userNames[i].first,
      last_name: userNames[i].last,
      is_active: true,
    });
  }
  console.log(`  Created ${userIds.length} users`);

  // ── Drivers ──────────────────────────────────────────────────────────────

  const driverData = [
    {
      employee_id: 'EMP-001',
      first_name: 'Mike',
      last_name: 'Torres',
      phone: '+1-212-555-0101',
      license_number: 'DL-NY-100001',
      license_expiry: '2027-06-15',
      license_classes: ['B', 'C'],
      status: 'driving' as const,
    },
    {
      employee_id: 'EMP-002',
      first_name: 'Sarah',
      last_name: 'Chen',
      phone: '+1-212-555-0102',
      license_number: 'DL-NY-100002',
      license_expiry: '2027-03-20',
      license_classes: ['B', 'C', 'CE'],
      status: 'available' as const,
    },
    {
      employee_id: 'EMP-003',
      first_name: 'James',
      last_name: 'Wilson',
      phone: '+1-212-555-0103',
      license_number: 'DL-NY-100003',
      license_expiry: '2026-12-01',
      license_classes: ['B'],
      status: 'driving' as const,
    },
    {
      employee_id: 'EMP-004',
      first_name: 'Elena',
      last_name: 'Rodriguez',
      phone: '+1-212-555-0104',
      license_number: 'DL-NY-100004',
      license_expiry: '2028-01-10',
      license_classes: ['B', 'C'],
      status: 'off_duty' as const,
    },
    {
      employee_id: 'EMP-005',
      first_name: 'David',
      last_name: 'Park',
      phone: '+1-212-555-0105',
      license_number: 'DL-NY-100005',
      license_expiry: '2027-09-30',
      license_classes: ['B', 'C', 'CE'],
      status: 'available' as const,
    },
    {
      employee_id: 'EMP-006',
      first_name: 'Nina',
      last_name: 'Patel',
      phone: '+1-212-555-0106',
      license_number: 'DL-NY-100006',
      license_expiry: '2026-08-15',
      license_classes: ['B', 'C'],
      status: 'on_break' as const,
    },
  ];

  const driverIds: string[] = [];
  for (const d of driverData) {
    const driverId = uuid();
    driverIds.push(driverId);
    await db.insert(schema.drivers).values({
      id: driverId,
      tenant_id: tenantId,
      ...d,
      current_driving_hours: d.status === 'driving' ? String(randomFloat(2, 6, 1)) : '0',
    });
  }
  console.log(`  Created ${driverIds.length} drivers`);

  // ── Vehicles ─────────────────────────────────────────────────────────────

  const vehicleData = [
    {
      registration: 'NY-VAN-001',
      vin: '1HGCM82633A00' + '4001',
      make: 'Ford',
      model: 'Transit',
      year: 2023,
      type: 'van' as const,
      capacity_kg: '1500',
      capacity_m3: '12',
      status: 'in_transit' as const,
      driverIdx: 0,
    },
    {
      registration: 'NY-VAN-002',
      vin: '1HGCM82633A00' + '4002',
      make: 'Mercedes',
      model: 'Sprinter',
      year: 2022,
      type: 'van' as const,
      capacity_kg: '2000',
      capacity_m3: '15',
      status: 'available' as const,
      driverIdx: null,
    },
    {
      registration: 'NY-TRK-001',
      vin: '1HGCM82633A00' + '4003',
      make: 'Volvo',
      model: 'FH16',
      year: 2023,
      type: 'truck' as const,
      capacity_kg: '8000',
      capacity_m3: '40',
      status: 'in_transit' as const,
      driverIdx: 2,
    },
    {
      registration: 'NY-TRK-002',
      vin: '1HGCM82633A00' + '4004',
      make: 'MAN',
      model: 'TGX',
      year: 2021,
      type: 'truck' as const,
      capacity_kg: '10000',
      capacity_m3: '50',
      status: 'maintenance' as const,
      driverIdx: null,
    },
    {
      registration: 'NY-SEM-001',
      vin: '1HGCM82633A00' + '4005',
      make: 'Scania',
      model: 'R500',
      year: 2023,
      type: 'semi' as const,
      capacity_kg: '25000',
      capacity_m3: '80',
      status: 'available' as const,
      driverIdx: null,
    },
    {
      registration: 'NY-SEM-002',
      vin: '1HGCM82633A00' + '4006',
      make: 'DAF',
      model: 'XF',
      year: 2022,
      type: 'semi' as const,
      capacity_kg: '22000',
      capacity_m3: '75',
      status: 'available' as const,
      driverIdx: null,
    },
    {
      registration: 'NY-REF-001',
      vin: '1HGCM82633A00' + '4007',
      make: 'Isuzu',
      model: 'NRR Reefer',
      year: 2023,
      type: 'refrigerated' as const,
      capacity_kg: '5000',
      capacity_m3: '30',
      status: 'in_transit' as const,
      driverIdx: 1,
    },
    {
      registration: 'NY-REF-002',
      vin: '1HGCM82633A00' + '4008',
      make: 'Hino',
      model: '338 Reefer',
      year: 2022,
      type: 'refrigerated' as const,
      capacity_kg: '6000',
      capacity_m3: '35',
      status: 'available' as const,
      driverIdx: null,
    },
  ];

  const vehicleIds: string[] = [];
  for (const v of vehicleData) {
    const vehicleId = uuid();
    vehicleIds.push(vehicleId);
    const lat = nycLat();
    const lng = nycLng();
    const { driverIdx, ...rest } = v;

    await db.execute(sql`
      INSERT INTO vehicles (
        id, tenant_id, registration, vin, make, model, year, type,
        capacity_kg, capacity_m3, status, is_active, assigned_driver_id,
        last_location, last_location_at, last_speed_kmh, heading,
        created_at, updated_at
      ) VALUES (
        ${vehicleId}, ${tenantId}, ${rest.registration}, ${rest.vin},
        ${rest.make}, ${rest.model}, ${rest.year}, ${rest.type}::vehicle_type,
        ${rest.capacity_kg}, ${rest.capacity_m3}, ${rest.status}::vehicle_status,
        true, ${driverIdx !== null ? driverIds[driverIdx] : null},
        ST_GeomFromEWKT(${pointWkt(lat, lng)}),
        NOW(), ${String(randomInt(0, 80))}, ${String(randomInt(0, 359))},
        NOW(), NOW()
      )
    `);

    // Update driver's current_vehicle_id
    if (driverIdx !== null) {
      await db
        .update(schema.drivers)
        .set({ current_vehicle_id: vehicleId })
        .where(sql`id = ${driverIds[driverIdx]}`);
    }
  }
  console.log(`  Created ${vehicleIds.length} vehicles`);

  // ── Shipments ────────────────────────────────────────────────────────────

  const shipmentStates = [
    'draft',
    'confirmed',
    'assigned',
    'picked_up',
    'in_transit',
    'delivered',
    'completed',
    'failed',
    'cancelled',
  ] as const;

  const stateTransitions: Record<string, string[]> = {
    draft: [],
    confirmed: ['confirm'],
    assigned: ['confirm', 'assign'],
    picked_up: ['confirm', 'assign', 'pickup'],
    in_transit: ['confirm', 'assign', 'pickup'],
    delivered: ['confirm', 'assign', 'pickup', 'deliver'],
    completed: ['confirm', 'assign', 'pickup', 'deliver', 'complete'],
    failed: ['confirm', 'assign', 'pickup', 'fail'],
    cancelled: ['confirm', 'cancel'],
  };

  const stateSequences: Record<string, string[]> = {
    draft: ['draft'],
    confirmed: ['draft', 'confirmed'],
    assigned: ['draft', 'confirmed', 'assigned'],
    picked_up: ['draft', 'confirmed', 'assigned', 'picked_up'],
    in_transit: ['draft', 'confirmed', 'assigned', 'picked_up', 'in_transit'],
    delivered: ['draft', 'confirmed', 'assigned', 'picked_up', 'in_transit', 'delivered'],
    completed: ['draft', 'confirmed', 'assigned', 'picked_up', 'in_transit', 'delivered', 'completed'],
    failed: ['draft', 'confirmed', 'assigned', 'picked_up', 'failed'],
    cancelled: ['draft', 'confirmed', 'cancelled'],
  };

  const customers = [
    'Manhattan Bistro',
    'Brooklyn Brewery',
    'Queens Fresh Market',
    'Bronx Auto Parts',
    'Staten Island Grocers',
    'Chelsea Flowers',
    'SoHo Electronics',
    'Harlem Foods',
    'Williamsburg Crafts',
    'Astoria Imports',
    'Murray Hill Medical',
    'Tribeca Design Co',
    'Midtown Office Supply',
    'East Village Books',
    'Park Slope Organics',
  ];

  const baseDate = new Date('2026-03-10T08:00:00Z');
  const shipmentIds: string[] = [];

  // Distribute shipments across all 9 states: 2 each for first 6 states, 1 each for last 3
  const shipmentStateAssignments = [
    'draft', 'draft',
    'confirmed', 'confirmed',
    'assigned', 'assigned',
    'picked_up', 'picked_up',
    'in_transit', 'in_transit',
    'delivered', 'delivered',
    'completed',
    'failed',
    'cancelled',
  ];

  for (let i = 0; i < 15; i++) {
    const shipmentId = uuid();
    shipmentIds.push(shipmentId);
    const status = shipmentStateAssignments[i] as typeof shipmentStates[number];
    const isDraft = status === 'draft';
    const refCode = isDraft
      ? null
      : `SHP-20260310-${String(i + 1).padStart(5, '0')}`;

    const needsAssignment = ['assigned', 'picked_up', 'in_transit', 'delivered', 'completed', 'failed'].includes(status);
    const assignedVehicleId = needsAssignment ? vehicleIds[i % vehicleIds.length] : null;
    const assignedDriverId = needsAssignment ? driverIds[i % driverIds.length] : null;

    const pastPickup = ['picked_up', 'in_transit', 'delivered', 'completed', 'failed'].includes(status);
    const pastDelivery = ['delivered', 'completed'].includes(status);

    const pickupTime = new Date(baseDate.getTime() - randomInt(1, 48) * 3600000);
    const deliveryTime = new Date(pickupTime.getTime() + randomInt(1, 12) * 3600000);

    const isRefrigerated = i % 5 === 0;
    const priority = pick(['low', 'normal', 'high', 'critical'] as const);

    await db.insert(schema.shipments).values({
      id: shipmentId,
      tenant_id: tenantId,
      reference_code: refCode,
      status,
      priority,
      customer_name: customers[i],
      origin_address: `${randomInt(1, 999)} ${pick(['Broadway', 'Madison Ave', '5th Ave', 'Park Ave', 'Lexington Ave'])}, New York, NY`,
      origin_lat: String(nycLat()),
      origin_lng: String(nycLng()),
      dest_address: `${randomInt(1, 999)} ${pick(['Atlantic Ave', 'Fulton St', 'Court St', 'Smith St', 'Bergen St'])}, Brooklyn, NY`,
      dest_lat: String(nycLat()),
      dest_lng: String(nycLng()),
      cargo_description: pick([
        'Office supplies',
        'Restaurant equipment',
        'Frozen goods',
        'Electronics',
        'Medical supplies',
        'Auto parts',
        'Fresh produce',
        'Furniture',
      ]),
      cargo_weight_kg: String(randomInt(50, 5000)),
      cargo_volume_m3: String(randomFloat(0.5, 20, 1)),
      cargo_type: pick(['general', 'fragile', 'perishable', 'hazardous', 'oversized'] as const),
      requires_temp_control: isRefrigerated,
      temp_min_c: isRefrigerated ? '-5' : null,
      temp_max_c: isRefrigerated ? '5' : null,
      assigned_vehicle_id: assignedVehicleId,
      assigned_driver_id: assignedDriverId,
      scheduled_pickup_at: isDraft ? null : pickupTime,
      actual_pickup_at: pastPickup ? pickupTime : null,
      actual_delivery_at: pastDelivery ? deliveryTime : null,
      pod_signature_url: pastDelivery
        ? `https://storage.example.com/pod/sig-${shipmentId}.png`
        : null,
      pod_photo_urls: pastDelivery
        ? [`https://storage.example.com/pod/photo-${shipmentId}-1.jpg`]
        : [],
      pod_notes: pastDelivery
        ? 'Delivered to reception, signed by recipient.'
        : null,
      failure_reason:
        status === 'failed' ? 'Recipient not available at delivery address' : null,
      cancellation_reason:
        status === 'cancelled' ? 'Customer requested cancellation' : null,
      created_by: userIds[2], // dispatcher
    });

    // Create audit trail (shipment_events)
    const actions = stateTransitions[status] ?? [];
    const seq = stateSequences[status] ?? ['draft'];

    for (let j = 0; j < actions.length; j++) {
      const eventTime = new Date(
        baseDate.getTime() - (actions.length - j) * 3600000,
      );
      await db.insert(schema.shipmentEvents).values({
        id: uuid(),
        tenant_id: tenantId,
        shipment_id: shipmentId,
        from_status: seq[j] as any,
        to_status: seq[j + 1] as any,
        event_type: actions[j],
        performed_by: userIds[2],
        notes: `Auto-generated seed event: ${actions[j]}`,
        created_at: eventTime,
      });
    }
  }
  console.log(`  Created ${shipmentIds.length} shipments with audit trails`);

  // ── Routes ───────────────────────────────────────────────────────────────

  // Route 1: Draft
  const route1Id = uuid();
  await db.insert(schema.routes).values({
    id: route1Id,
    tenant_id: tenantId,
    name: 'Morning Manhattan Route',
    status: 'draft',
    planned_date: '2026-03-12',
    estimated_distance_km: '45.2',
  });

  // Route 2: Active with vehicle/driver and stops
  const route2Id = uuid();
  await db.insert(schema.routes).values({
    id: route2Id,
    tenant_id: tenantId,
    name: 'Brooklyn Afternoon Route',
    status: 'active',
    planned_date: '2026-03-11',
    vehicle_id: vehicleIds[0],
    driver_id: driverIds[0],
    estimated_distance_km: '32.8',
    optimization_score: '87.5',
  });

  // Add stops for the active route
  const stops = [
    {
      stop_type: 'depot' as const,
      sequence_order: 0,
      address: '100 Flatbush Ave, Brooklyn, NY',
      lat: '40.6832',
      lng: '-73.9763',
      status: 'completed' as const,
      planned_arrival: new Date('2026-03-11T08:00:00Z'),
      actual_arrival: new Date('2026-03-11T07:55:00Z'),
      completed_at: new Date('2026-03-11T08:10:00Z'),
    },
    {
      stop_type: 'pickup' as const,
      sequence_order: 1,
      address: '200 Atlantic Ave, Brooklyn, NY',
      lat: '40.6862',
      lng: '-73.9785',
      shipment_id: shipmentIds[4], // an assigned shipment
      status: 'completed' as const,
      planned_arrival: new Date('2026-03-11T08:30:00Z'),
      actual_arrival: new Date('2026-03-11T08:35:00Z'),
      completed_at: new Date('2026-03-11T08:50:00Z'),
    },
    {
      stop_type: 'delivery' as const,
      sequence_order: 2,
      address: '350 Court St, Brooklyn, NY',
      lat: '40.6745',
      lng: '-73.9942',
      shipment_id: shipmentIds[5],
      status: 'pending' as const,
      planned_arrival: new Date('2026-03-11T09:15:00Z'),
    },
    {
      stop_type: 'delivery' as const,
      sequence_order: 3,
      address: '500 Smith St, Brooklyn, NY',
      lat: '40.6712',
      lng: '-73.9955',
      shipment_id: shipmentIds[6],
      status: 'pending' as const,
      planned_arrival: new Date('2026-03-11T09:45:00Z'),
    },
  ];

  for (const stop of stops) {
    await db.insert(schema.routeStops).values({
      id: uuid(),
      route_id: route2Id,
      ...stop,
    });
  }
  console.log('  Created 2 routes with stops');

  // ── Geofences ────────────────────────────────────────────────────────────

  const geofenceData = [
    {
      name: 'JFK Airport Zone',
      lat: 40.6413,
      lng: -73.7781,
      radius_m: 2000,
      color: '#EF4444',
    },
    {
      name: 'Times Square Area',
      lat: 40.758,
      lng: -73.9855,
      radius_m: 500,
      color: '#3B82F6',
    },
    {
      name: 'Brooklyn Navy Yard',
      lat: 40.7024,
      lng: -73.9712,
      radius_m: 800,
      color: '#10B981',
    },
  ];

  for (const gf of geofenceData) {
    const gfId = uuid();
    // Use ST_Buffer on geography cast for meter-accurate circle polygons
    await db.execute(sql`
      INSERT INTO geofences (
        id, tenant_id, name, center, geometry, radius_m, color,
        trigger_on_enter, trigger_on_exit, is_active, created_at, updated_at
      ) VALUES (
        ${gfId}, ${tenantId}, ${gf.name},
        ST_SetSRID(ST_MakePoint(${gf.lng}, ${gf.lat}), 4326),
        ST_SetSRID(ST_Buffer(ST_MakePoint(${gf.lng}, ${gf.lat})::geography, ${gf.radius_m})::geometry, 4326),
        ${String(gf.radius_m)}, ${gf.color},
        true, true, true, NOW(), NOW()
      )
    `);
  }
  console.log('  Created 3 geofences');

  // ── Done ─────────────────────────────────────────────────────────────────

  console.log('Seed completed successfully!');
  await client.end();
  process.exit(0);
}

seed().catch((err) => {
  console.error('Seed failed:', err);
  process.exit(1);
});
