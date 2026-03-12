import { db, sql } from './connection.js';
import {
  tenants,
  users,
  vehicles,
  drivers,
  shipments,
  shipmentEvents,
  routes,
  routeStops,
  geofences,
} from './schema.js';
import bcrypt from 'bcryptjs';
import { v4 as uuidv4 } from 'uuid';

// ---------------------------------------------------------------------------
// Deterministic PRNG (seed = 42)
// ---------------------------------------------------------------------------

function createPRNG(seed: number) {
  let s = seed;
  return {
    next(): number {
      s = (s * 1664525 + 1013904223) & 0xffffffff;
      return (s >>> 0) / 0xffffffff;
    },
    nextInt(min: number, max: number): number {
      return Math.floor(this.next() * (max - min + 1)) + min;
    },
    pick<T>(arr: readonly T[]): T {
      return arr[this.nextInt(0, arr.length - 1)];
    },
  };
}

// Deterministic UUID from seed offset
function deterministicUUID(base: number): string {
  const hex = (n: number) => n.toString(16).padStart(8, '0');
  const a = (base * 2654435761) >>> 0;
  const b = (base * 2246822519) >>> 0;
  const c = (base * 3266489917) >>> 0;
  const d = (base * 668265263) >>> 0;
  const str = hex(a) + hex(b) + hex(c) + hex(d);
  return [
    str.slice(0, 8),
    str.slice(8, 12),
    '4' + str.slice(13, 16),
    '8' + str.slice(17, 20),
    str.slice(20, 32),
  ].join('-');
}

async function seed() {
  const rng = createPRNG(42);

  console.log('Seeding database...');

  const passwordHash = await bcrypt.hash('Password1!', 10);

  // IDs
  const tenantId = deterministicUUID(1);
  const userIds = [
    deterministicUUID(10),
    deterministicUUID(11),
    deterministicUUID(12),
    deterministicUUID(13),
  ];
  const vehicleIds = Array.from({ length: 8 }, (_, i) => deterministicUUID(20 + i));
  const driverIds = Array.from({ length: 6 }, (_, i) => deterministicUUID(30 + i));
  const shipmentIds = Array.from({ length: 15 }, (_, i) => deterministicUUID(40 + i));
  const routeIds = [deterministicUUID(60), deterministicUUID(61)];

  // ---------------------------------------------------------------------------
  // Tenant
  // ---------------------------------------------------------------------------
  await db.insert(tenants).values({
    id: tenantId,
    name: 'Acme Logistics',
    slug: 'acme-logistics',
    plan: 'pro',
    is_active: true,
  });

  console.log('  Created tenant: Acme Logistics');

  // ---------------------------------------------------------------------------
  // Users
  // ---------------------------------------------------------------------------
  const userDefs = [
    { email: 'owner@acme.com', role: 'owner', first_name: 'Alice', last_name: 'Owner' },
    { email: 'admin@acme.com', role: 'admin', first_name: 'Bob', last_name: 'Admin' },
    { email: 'dispatcher@acme.com', role: 'dispatcher', first_name: 'Carol', last_name: 'Dispatch' },
    { email: 'viewer@acme.com', role: 'viewer', first_name: 'Dave', last_name: 'Viewer' },
  ];

  await db.insert(users).values(
    userDefs.map((u, i) => ({
      id: userIds[i],
      tenant_id: tenantId,
      email: u.email,
      password_hash: passwordHash,
      first_name: u.first_name,
      last_name: u.last_name,
      role: u.role,
      is_active: true,
    })),
  );

  console.log('  Created 4 users');

  // ---------------------------------------------------------------------------
  // Vehicles
  // ---------------------------------------------------------------------------
  const vehicleTypes = ['van', 'truck', 'semi', 'refrigerated', 'van', 'truck', 'semi', 'refrigerated'] as const;
  const vehicleMakes = ['Ford', 'Mercedes', 'Volvo', 'Freightliner', 'Ram', 'MAN', 'Scania', 'Isuzu'];
  const vehicleModels = ['Transit', 'Sprinter', 'FH16', 'Cascadia', 'ProMaster', 'TGX', 'R450', 'NPR-HD'];

  // NYC area bounding box: lat 40.5-40.9, lng -74.1--73.7
  const vehicleData = vehicleIds.map((id, i) => ({
    id,
    tenant_id: tenantId,
    registration: `NYC-${String(1000 + i)}`,
    vin: `1HGCM${String(80000 + i * 1111).padStart(5, '0')}${String(100000 + i * 13579).padStart(6, '0')}`,
    make: vehicleMakes[i],
    model: vehicleModels[i],
    year: 2020 + (i % 5),
    type: vehicleTypes[i],
    status: i < 4 ? 'available' : i < 6 ? 'in_transit' : 'idle',
    capacity_kg: String(vehicleTypes[i] === 'semi' ? 25000 : vehicleTypes[i] === 'truck' ? 10000 : 3500),
    capacity_m3: String(vehicleTypes[i] === 'semi' ? 80 : vehicleTypes[i] === 'truck' ? 40 : 15),
    last_location_lat: String(40.5 + rng.next() * 0.4),
    last_location_lng: String(-74.1 + rng.next() * 0.4),
    last_speed_kmh: String(rng.nextInt(0, 80)),
    last_heading: String(rng.nextInt(0, 360)),
    last_location_at: new Date(),
    fuel_level_pct: rng.nextInt(20, 100),
    odometer_km: String(rng.nextInt(10000, 200000)),
    is_active: true,
  }));

  await db.insert(vehicles).values(vehicleData);
  console.log('  Created 8 vehicles');

  // ---------------------------------------------------------------------------
  // Drivers
  // ---------------------------------------------------------------------------
  const driverDefs = [
    { first: 'John', last: 'Smith', status: 'available', classes: ['B', 'C'] },
    { first: 'Maria', last: 'Garcia', status: 'driving', classes: ['B', 'C', 'CE'] },
    { first: 'James', last: 'Wilson', status: 'off_duty', classes: ['B'] },
    { first: 'Sarah', last: 'Johnson', status: 'available', classes: ['B', 'C'] },
    { first: 'Michael', last: 'Brown', status: 'on_break', classes: ['B', 'C', 'CE'] },
    { first: 'Emily', last: 'Davis', status: 'driving', classes: ['B', 'C'] },
  ];

  const driverData = driverIds.map((id, i) => ({
    id,
    tenant_id: tenantId,
    employee_id: `EMP-${String(1000 + i)}`,
    first_name: driverDefs[i].first,
    last_name: driverDefs[i].last,
    phone: `+1555${String(1000 + i).padStart(4, '0')}`,
    license_number: `DL-${String(100000 + i * 11111)}`,
    license_expiry: new Date('2027-06-15'),
    license_classes: driverDefs[i].classes,
    status: driverDefs[i].status,
    current_vehicle_id: i === 1 ? vehicleIds[4] : i === 5 ? vehicleIds[5] : null,
    current_driving_hours: String(driverDefs[i].status === 'driving' ? rng.nextInt(2, 7) : 0),
    max_driving_hours_day: '9',
    is_active: true,
  }));

  await db.insert(drivers).values(driverData);

  // Update vehicles with assigned drivers
  // (Done via raw SQL because drizzle update references are simpler this way)

  console.log('  Created 6 drivers');

  // ---------------------------------------------------------------------------
  // Shipments
  // ---------------------------------------------------------------------------
  const shipmentStatuses = [
    'draft', 'draft', 'confirmed', 'confirmed', 'assigned',
    'picked_up', 'in_transit', 'in_transit', 'in_transit', 'delivered',
    'delivered', 'completed', 'completed', 'failed', 'cancelled',
  ];
  const priorities = ['low', 'normal', 'normal', 'high', 'critical'] as const;
  const cargoTypes = ['general', 'fragile', 'hazardous', 'perishable'] as const;
  const customers = [
    'TechCorp Inc.', 'Fresh Foods Co.', 'BuildRight LLC', 'MediSupply',
    'AutoParts Direct', 'Fashion Forward', 'Electronics Hub', 'Green Gardens',
    'Steel Solutions', 'PackShip Pro', 'Urban Eats', 'SafeChem Ltd.',
    'QuickPrint', 'FurnishNow', 'BioPharm Labs',
  ];

  const nycAddresses = [
    { address: '350 Fifth Avenue, New York, NY', lat: 40.7484, lng: -73.9857 },
    { address: '1 World Trade Center, New York, NY', lat: 40.7127, lng: -74.0134 },
    { address: '30 Rockefeller Plaza, New York, NY', lat: 40.7587, lng: -73.9787 },
    { address: '1000 Fifth Avenue, New York, NY', lat: 40.7794, lng: -73.9632 },
    { address: '200 Central Park West, New York, NY', lat: 40.7812, lng: -73.9730 },
    { address: '600 Atlantic Avenue, Brooklyn, NY', lat: 40.6843, lng: -73.9776 },
    { address: '47-01 111th Street, Queens, NY', lat: 40.7464, lng: -73.8458 },
    { address: '1 MetLife Stadium Dr, East Rutherford, NJ', lat: 40.8128, lng: -74.0742 },
    { address: '150 Greenwich Street, New York, NY', lat: 40.7094, lng: -74.0145 },
    { address: '455 Broadway, New York, NY', lat: 40.7206, lng: -73.9988 },
    { address: '11 Wall Street, New York, NY', lat: 40.7074, lng: -74.0113 },
    { address: '75 9th Avenue, New York, NY', lat: 40.7425, lng: -74.0050 },
    { address: '1 Brookfield Place, New York, NY', lat: 40.7135, lng: -74.0155 },
    { address: '4 Times Square, New York, NY', lat: 40.7557, lng: -73.9863 },
    { address: '800 3rd Avenue, New York, NY', lat: 40.7550, lng: -73.9710 },
  ];

  const shipmentData = shipmentIds.map((id, i) => {
    const originIdx = i % nycAddresses.length;
    const destIdx = (i + 7) % nycAddresses.length;
    const status = shipmentStatuses[i];
    const needsVehicle = ['assigned', 'picked_up', 'in_transit', 'delivered', 'completed', 'failed'].includes(status);
    const needsDriver = needsVehicle;

    return {
      id,
      tenant_id: tenantId,
      reference_code: `SHP-20260310-${String(i + 1).padStart(5, '0')}`,
      status,
      priority: priorities[i % priorities.length],
      customer_name: customers[i],
      origin_address: nycAddresses[originIdx].address,
      origin_lat: String(nycAddresses[originIdx].lat),
      origin_lng: String(nycAddresses[originIdx].lng),
      dest_address: nycAddresses[destIdx].address,
      dest_lat: String(nycAddresses[destIdx].lat),
      dest_lng: String(nycAddresses[destIdx].lng),
      cargo_description: `Cargo shipment ${i + 1} for ${customers[i]}`,
      cargo_weight_kg: String(rng.nextInt(50, 5000)),
      cargo_volume_m3: String(rng.nextInt(1, 50)),
      cargo_type: cargoTypes[i % cargoTypes.length],
      requires_temp_control: cargoTypes[i % cargoTypes.length] === 'perishable',
      temp_min_c: cargoTypes[i % cargoTypes.length] === 'perishable' ? '-5' : null,
      temp_max_c: cargoTypes[i % cargoTypes.length] === 'perishable' ? '5' : null,
      vehicle_id: needsVehicle ? vehicleIds[i % vehicleIds.length] : null,
      driver_id: needsDriver ? driverIds[i % driverIds.length] : null,
      scheduled_pickup_at: new Date(Date.now() + rng.nextInt(-3, 7) * 86400000),
      actual_pickup_at: ['picked_up', 'in_transit', 'delivered', 'completed'].includes(status)
        ? new Date(Date.now() - rng.nextInt(1, 3) * 86400000)
        : null,
      actual_delivery_at: ['delivered', 'completed'].includes(status)
        ? new Date(Date.now() - rng.nextInt(0, 1) * 86400000)
        : null,
      completed_at: status === 'completed' ? new Date() : null,
      cancelled_at: status === 'cancelled' ? new Date() : null,
      failure_reason: status === 'failed' ? 'Recipient not available at delivery address' : null,
      is_deleted: false,
    };
  });

  await db.insert(shipments).values(shipmentData);
  console.log('  Created 15 shipments');

  // ---------------------------------------------------------------------------
  // Shipment Events
  // ---------------------------------------------------------------------------
  const eventRecords: Array<{
    id: string;
    tenant_id: string;
    shipment_id: string;
    from_status: string | null;
    to_status: string;
    action: string;
    actor_id: string;
    data: Record<string, unknown>;
    created_at: Date;
  }> = [];

  shipmentData.forEach((s, i) => {
    const statusFlow: string[] = [];
    const idx = shipmentStatuses.indexOf(s.status);
    const fullFlow = ['draft', 'confirmed', 'assigned', 'picked_up', 'in_transit', 'delivered', 'completed'];
    const cancelledAt = s.status === 'cancelled' ? 1 : -1;
    const failedAt = s.status === 'failed' ? 5 : -1;

    if (s.status === 'cancelled') {
      statusFlow.push('draft', 'cancelled');
    } else if (s.status === 'failed') {
      statusFlow.push('draft', 'confirmed', 'assigned', 'picked_up', 'in_transit', 'failed');
    } else {
      const flowIdx = fullFlow.indexOf(s.status);
      if (flowIdx >= 0) {
        for (let j = 0; j <= flowIdx; j++) {
          statusFlow.push(fullFlow[j]);
        }
      } else {
        statusFlow.push('draft');
      }
    }

    const actions: Record<string, string> = {
      'draft': 'create',
      'confirmed': 'confirm',
      'assigned': 'assign',
      'picked_up': 'pickup',
      'in_transit': 'start_transit',
      'delivered': 'deliver',
      'completed': 'complete',
      'failed': 'fail',
      'cancelled': 'cancel',
    };

    for (let j = 0; j < statusFlow.length; j++) {
      eventRecords.push({
        id: deterministicUUID(100 + i * 10 + j),
        tenant_id: tenantId,
        shipment_id: s.id,
        from_status: j === 0 ? null : statusFlow[j - 1],
        to_status: statusFlow[j],
        action: actions[statusFlow[j]] ?? 'create',
        actor_id: userIds[rng.nextInt(0, 3)],
        data: {},
        created_at: new Date(Date.now() - (statusFlow.length - j) * 3600000),
      });
    }
  });

  if (eventRecords.length > 0) {
    await db.insert(shipmentEvents).values(eventRecords);
  }
  console.log(`  Created ${eventRecords.length} shipment events`);

  // ---------------------------------------------------------------------------
  // Routes
  // ---------------------------------------------------------------------------
  await db.insert(routes).values([
    {
      id: routeIds[0],
      tenant_id: tenantId,
      name: 'Manhattan Morning Route',
      status: 'draft',
      vehicle_id: vehicleIds[0],
      driver_id: driverIds[0],
      planned_date: new Date('2026-03-12'),
      total_distance_km: '45.5',
      estimated_duration_min: 180,
    },
    {
      id: routeIds[1],
      tenant_id: tenantId,
      name: 'Brooklyn Afternoon Route',
      status: 'active',
      vehicle_id: vehicleIds[1],
      driver_id: driverIds[1],
      planned_date: new Date('2026-03-11'),
      started_at: new Date(),
      total_distance_km: '32.8',
      estimated_duration_min: 150,
    },
  ]);

  console.log('  Created 2 routes');

  // ---------------------------------------------------------------------------
  // Route Stops
  // ---------------------------------------------------------------------------
  const routeStopData = [
    // Route 1 stops
    {
      id: deterministicUUID(70),
      tenant_id: tenantId,
      route_id: routeIds[0],
      shipment_id: shipmentIds[0],
      stop_type: 'pickup',
      sequence_order: 0,
      location_lat: '40.7484',
      location_lng: '-73.9857',
      address: '350 Fifth Avenue, New York, NY',
      status: 'pending',
    },
    {
      id: deterministicUUID(71),
      tenant_id: tenantId,
      route_id: routeIds[0],
      shipment_id: shipmentIds[0],
      stop_type: 'delivery',
      sequence_order: 1,
      location_lat: '40.7587',
      location_lng: '-73.9787',
      address: '30 Rockefeller Plaza, New York, NY',
      status: 'pending',
    },
    {
      id: deterministicUUID(72),
      tenant_id: tenantId,
      route_id: routeIds[0],
      shipment_id: shipmentIds[1],
      stop_type: 'pickup',
      sequence_order: 2,
      location_lat: '40.7127',
      location_lng: '-74.0134',
      address: '1 World Trade Center, New York, NY',
      status: 'pending',
    },
    // Route 2 stops
    {
      id: deterministicUUID(73),
      tenant_id: tenantId,
      route_id: routeIds[1],
      shipment_id: shipmentIds[6],
      stop_type: 'pickup',
      sequence_order: 0,
      location_lat: '40.6843',
      location_lng: '-73.9776',
      address: '600 Atlantic Avenue, Brooklyn, NY',
      status: 'completed',
      completed_at: new Date(Date.now() - 3600000),
    },
    {
      id: deterministicUUID(74),
      tenant_id: tenantId,
      route_id: routeIds[1],
      shipment_id: shipmentIds[6],
      stop_type: 'delivery',
      sequence_order: 1,
      location_lat: '40.7206',
      location_lng: '-73.9988',
      address: '455 Broadway, New York, NY',
      status: 'pending',
    },
  ];

  await db.insert(routeStops).values(routeStopData);
  console.log('  Created 5 route stops');

  // ---------------------------------------------------------------------------
  // Geofences
  // ---------------------------------------------------------------------------
  await db.insert(geofences).values([
    {
      id: deterministicUUID(80),
      tenant_id: tenantId,
      name: 'Statue of Liberty Zone',
      center_lat: '40.6892',
      center_lng: '-74.0445',
      radius_m: '500',
      color: '#EF4444',
      trigger_on_enter: true,
      trigger_on_exit: true,
      is_active: true,
    },
    {
      id: deterministicUUID(81),
      tenant_id: tenantId,
      name: 'Central Park Area',
      center_lat: '40.7829',
      center_lng: '-73.9654',
      radius_m: '1500',
      color: '#22C55E',
      trigger_on_enter: true,
      trigger_on_exit: true,
      is_active: true,
    },
    {
      id: deterministicUUID(82),
      tenant_id: tenantId,
      name: 'JFK Airport Zone',
      center_lat: '40.6413',
      center_lng: '-73.7781',
      radius_m: '2000',
      color: '#3B82F6',
      trigger_on_enter: true,
      trigger_on_exit: true,
      is_active: true,
    },
  ]);

  console.log('  Created 3 geofences');

  console.log('\nSeed completed successfully!');
  await sql.end();
  process.exit(0);
}

seed().catch((err) => {
  console.error('Seed failed:', err);
  process.exit(1);
});
