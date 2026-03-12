import pg from 'pg';
import { drizzle } from 'drizzle-orm/node-postgres';
import { sql } from 'drizzle-orm';
import bcrypt from 'bcrypt';
import * as schema from './schema.js';

// ─── Seeded deterministic RNG (seed = 42) ────────────────────────────
// Simple mulberry32 PRNG for reproducible data
function createSeededRng(seed: number) {
  let state = seed;
  return {
    next(): number {
      state |= 0;
      state = (state + 0x6d2b79f5) | 0;
      let t = Math.imul(state ^ (state >>> 15), 1 | state);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    },
    pick<T>(arr: T[]): T {
      return arr[Math.floor(this.next() * arr.length)];
    },
    float(min: number, max: number): number {
      return min + this.next() * (max - min);
    },
    int(min: number, max: number): number {
      return Math.floor(this.float(min, max + 1));
    },
  };
}

const rng = createSeededRng(42);

const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
});

const db = drizzle(pool, { schema });

// ─── NYC landmark coordinates for geofences ──────────────────────────
const NYC_LANDMARKS = {
  timesSquare: { lat: 40.758, lng: -73.9855 },
  centralPark: { lat: 40.7829, lng: -73.9654 },
  empireState: { lat: 40.7484, lng: -73.9857 },
  statueLberty: { lat: 40.6892, lng: -74.0445 },
  brooklynBridge: { lat: 40.7061, lng: -73.9969 },
  jfkAirport: { lat: 40.6413, lng: -73.7781 },
};

// Helper to generate NYC metro coordinates
function nycCoord() {
  return {
    lat: rng.float(40.60, 40.85),
    lng: rng.float(-74.05, -73.75),
  };
}

async function seed() {
  console.log('🌱 Seeding database with deterministic data (seed=42)...');

  // ─── Truncate all tables (idempotent: clean slate each run) ────────
  await db.execute(sql`
    TRUNCATE TABLE
      geofence_events,
      geofences,
      route_stops,
      shipment_events,
      shipments,
      routes,
      vehicle_tokens,
      vehicles,
      drivers,
      webhook_endpoints,
      notifications,
      users,
      tenants
    CASCADE
  `);
  console.log('Truncated all tables.');

  // ─── 1. Tenant ─────────────────────────────────────────────────────
  const [tenant] = await db
    .insert(schema.tenants)
    .values({
      name: 'Acme Logistics',
      slug: 'acme-logistics',
      plan: 'pro',
    })
    .returning();

  console.log(`Created tenant: ${tenant.name} (${tenant.id})`);

  // ─── 2. Users (4 roles, all with Password1!) ──────────────────────
  const passwordHash = await bcrypt.hash('Password1!', 12);

  const userConfigs = [
    { email: 'owner@acmelogistics.com', role: 'owner', first_name: 'Alice', last_name: 'Owner' },
    { email: 'admin@acmelogistics.com', role: 'admin', first_name: 'Bob', last_name: 'Admin' },
    { email: 'dispatcher@acmelogistics.com', role: 'dispatcher', first_name: 'Carol', last_name: 'Dispatcher' },
    { email: 'viewer@acmelogistics.com', role: 'viewer', first_name: 'Dave', last_name: 'Viewer' },
  ];

  const userRows = await db
    .insert(schema.users)
    .values(
      userConfigs.map((u) => ({
        tenant_id: tenant.id,
        email: u.email,
        password_hash: passwordHash,
        role: u.role,
        first_name: u.first_name,
        last_name: u.last_name,
      })),
    )
    .returning();

  const owner = userRows[0];
  console.log(`Created ${userRows.length} users:`);
  for (const u of userRows) {
    console.log(`  ${u.role}: ${u.email}`);
  }

  // ─── 3. Drivers (6) ───────────────────────────────────────────────
  const driverData = [
    { employee_id: 'DRV-001', first_name: 'John', last_name: 'Smith', phone: '+1-555-0101', license_classes: ['B', 'C'], status: 'off_duty' },
    { employee_id: 'DRV-002', first_name: 'Jane', last_name: 'Doe', phone: '+1-555-0102', license_classes: ['B'], status: 'off_duty' },
    { employee_id: 'DRV-003', first_name: 'Mike', last_name: 'Johnson', phone: '+1-555-0103', license_classes: ['B', 'C', 'CE'], status: 'off_duty' },
    { employee_id: 'DRV-004', first_name: 'Sarah', last_name: 'Williams', phone: '+1-555-0104', license_classes: ['B', 'C'], status: 'off_duty' },
    { employee_id: 'DRV-005', first_name: 'Tom', last_name: 'Brown', phone: '+1-555-0105', license_classes: ['B'], status: 'off_duty' },
    { employee_id: 'DRV-006', first_name: 'Lisa', last_name: 'Davis', phone: '+1-555-0106', license_classes: ['B', 'C'], status: 'off_duty' },
  ];

  const drivers = await db
    .insert(schema.drivers)
    .values(
      driverData.map((d) => ({
        tenant_id: tenant.id,
        created_by: owner.id,
        ...d,
        license_number: `LIC-${d.employee_id}`,
        license_expiry: '2027-12-31',
      })),
    )
    .returning();

  console.log(`Created ${drivers.length} drivers`);

  // ─── 4. Vehicles (8) with NYC metro locations ─────────────────────
  const vehicleData = [
    { registration: 'NYC-001', vin: 'WBA3A5C55CF256781', make: 'Mercedes', model: 'Sprinter', year: 2023, type: 'van', capacity_kg: 1500, capacity_m3: 14 },
    { registration: 'NYC-002', vin: 'WBA3A5C55CF256782', make: 'Ford', model: 'Transit', year: 2023, type: 'van', capacity_kg: 1200, capacity_m3: 12 },
    { registration: 'NYC-003', vin: 'WBA3A5C55CF256783', make: 'Volvo', model: 'FH16', year: 2022, type: 'truck', capacity_kg: 8000, capacity_m3: 40 },
    { registration: 'NYC-004', vin: 'WBA3A5C55CF256784', make: 'Scania', model: 'R500', year: 2023, type: 'semi', capacity_kg: 25000, capacity_m3: 80 },
    { registration: 'NYC-005', vin: 'WBA3A5C55CF256785', make: 'Mercedes', model: 'Atego', year: 2022, type: 'refrigerated', capacity_kg: 5000, capacity_m3: 30 },
    { registration: 'NYC-006', vin: 'WBA3A5C55CF256786', make: 'Iveco', model: 'Daily', year: 2024, type: 'van', capacity_kg: 1000, capacity_m3: 10 },
    { registration: 'NYC-007', vin: 'WBA3A5C55CF256787', make: 'MAN', model: 'TGX', year: 2023, type: 'truck', capacity_kg: 10000, capacity_m3: 50 },
    { registration: 'NYC-008', vin: 'WBA3A5C55CF256788', make: 'DAF', model: 'XF', year: 2022, type: 'semi', capacity_kg: 22000, capacity_m3: 75 },
  ];

  const vehicleRows = await db
    .insert(schema.vehicles)
    .values(
      vehicleData.map((v) => ({
          tenant_id: tenant.id,
          created_by: owner.id,
          registration: v.registration,
          vin: v.vin,
          make: v.make,
          model: v.model,
          year: v.year,
          type: v.type,
          capacity_kg: String(v.capacity_kg),
          capacity_m3: String(v.capacity_m3),
          status: 'available',
        })),
    )
    .returning();

  console.log(`Created ${vehicleRows.length} vehicles`);

  // ─── 5. Vehicle tokens ────────────────────────────────────────────
  console.log('\nVehicle API Tokens:');
  // Use deterministic token generation from seeded RNG
  for (const vehicle of vehicleRows) {
    // Generate deterministic "random" bytes from seeded RNG
    const tokenBytes = Array.from({ length: 32 }, () =>
      Math.floor(rng.next() * 256).toString(16).padStart(2, '0')
    ).join('');
    const plaintext = tokenBytes;
    const token_hash = await bcrypt.hash(plaintext, 12);
    const expires_at = new Date('2027-12-31T23:59:59Z');

    await db.insert(schema.vehicleTokens).values({
      tenant_id: tenant.id,
      vehicle_id: vehicle.id,
      token_hash,
      is_active: true,
      expires_at,
    });

    console.log(`  ${vehicle.registration}: ${plaintext}`);
  }

  // ─── 6. Shipments (15) with varied statuses ───────────────────────
  const shipmentStatuses = [
    'draft', 'draft',
    'confirmed', 'confirmed',
    'assigned',
    'in_transit', 'in_transit', 'in_transit',
    'delivered', 'delivered', 'delivered',
    'completed', 'completed',
    'cancelled',
    'failed',
  ];

  const cargoTypes = ['general', 'fragile', 'hazardous', 'perishable'] as const;
  const priorities = ['low', 'normal', 'high', 'critical'] as const;

  const nycAddresses = [
    '350 Fifth Ave, New York, NY 10118',
    '1 World Trade Center, New York, NY 10007',
    '30 Rockefeller Plaza, New York, NY 10112',
    '1000 Fifth Ave, New York, NY 10028',
    '1 E 161st St, Bronx, NY 10451',
    '89 E 42nd St, New York, NY 10017',
    '45 Rockefeller Plaza, New York, NY 10111',
    '11 W 53rd St, New York, NY 10019',
    '1 MetLife Stadium Dr, East Rutherford, NJ 07073',
    '20 W 34th St, New York, NY 10001',
    '1260 6th Ave, New York, NY 10020',
    '77 Water St, New York, NY 10005',
    '200 Central Park West, New York, NY 10024',
    '1 Liberty Island, New York, NY 10004',
    '233 Broadway, New York, NY 10279',
    '4 Pennsylvania Plaza, New York, NY 10001',
    '151 W 34th St, New York, NY 10001',
    '476 5th Ave, New York, NY 10018',
    '1681 Broadway, New York, NY 10019',
    '20 Exchange Pl, New York, NY 10005',
  ];

  const customerNames = [
    'Metro Express Inc', 'Hudson Valley Supplies', 'Brooklyn Bridge Logistics',
    'Manhattan Distribution Co', 'Bronx Freight Services', 'Queens Transport LLC',
    'Harbor Point Trading', 'Liberty Shipping Corp', 'Skyline Movers Inc',
    'Downtown Cargo Systems', 'Riverside Warehousing', 'Gotham Supply Chain',
    'Empire State Freight', 'Central Park Deliveries', 'Wall Street Logistics',
  ];

  const shipmentValues = shipmentStatuses.map((status, i) => {
    // Consume RNG to keep deterministic state consistent
    nycCoord();
    nycCoord();
    const cargoType = rng.pick([...cargoTypes]);
    const priority = rng.pick([...priorities]);
    const requiresTemp = cargoType === 'perishable';
    const today = new Date('2026-03-12');
    const dateStr = `${today.getFullYear()}${String(today.getMonth() + 1).padStart(2, '0')}${String(today.getDate()).padStart(2, '0')}`;

    // Generate reference codes for non-draft shipments
    const refCode = status === 'draft' ? null : `SHP-${dateStr}-${String(i + 1).padStart(5, '0')}`;

    return {
      tenant_id: tenant.id,
      reference_code: refCode,
      status,
      priority,
      customer_name: customerNames[i],
      origin_address: rng.pick(nycAddresses),
      dest_address: rng.pick(nycAddresses),
      cargo_description: `${cargoType} cargo shipment #${i + 1}`,
      cargo_weight_kg: String(rng.int(50, 5000)),
      cargo_volume_m3: String(rng.int(1, 40)),
      cargo_type: cargoType,
      requires_temp_control: requiresTemp,
      temp_min_c: requiresTemp ? String(rng.int(-5, 2)) : null,
      temp_max_c: requiresTemp ? String(rng.int(4, 8)) : null,
      created_by: owner.id,
      scheduled_pickup_at: new Date(today.getTime() + rng.int(1, 72) * 3600000),
      failure_reason: status === 'failed' ? 'Delivery address inaccessible' : null,
      cancellation_reason: status === 'cancelled' ? 'Customer cancelled order' : null,
    };
  });

  const shipmentRows = await db
    .insert(schema.shipments)
    .values(shipmentValues)
    .returning();

  // Set origin/destination locations via raw SQL (PostGIS geometry)
  for (let i = 0; i < shipmentRows.length; i++) {
    const o = nycCoord();
    const d = nycCoord();
    await db.execute(sql`
      UPDATE shipments SET
        origin_location = ST_SetSRID(ST_MakePoint(${o.lng}, ${o.lat}), 4326),
        dest_location = ST_SetSRID(ST_MakePoint(${d.lng}, ${d.lat}), 4326)
      WHERE id = ${shipmentRows[i].id}
    `);
  }

  console.log(`Created ${shipmentRows.length} shipments:`);
  const statusCounts: Record<string, number> = {};
  for (const s of shipmentRows) {
    statusCounts[s.status!] = (statusCounts[s.status!] || 0) + 1;
  }
  for (const [status, count] of Object.entries(statusCounts)) {
    console.log(`  ${status}: ${count}`);
  }

  // ─── 7. Routes (2) ───────────────────────────────────────────────
  const routeValues = [
    {
      tenant_id: tenant.id,
      name: 'Manhattan Morning Route',
      status: 'draft',
      planned_date: '2026-03-13',
      created_by: owner.id,
    },
    {
      tenant_id: tenant.id,
      name: 'Brooklyn Afternoon Route',
      status: 'active',
      vehicle_id: vehicleRows[0].id,
      driver_id: drivers[0].id,
      planned_date: '2026-03-12',
      created_by: owner.id,
    },
  ];

  const routeRows = await db
    .insert(schema.routes)
    .values(routeValues)
    .returning();

  // Create stops for each route
  const confirmedShipments = shipmentRows.filter((s) => s.status !== 'draft' && s.status !== 'cancelled');
  for (let r = 0; r < routeRows.length; r++) {
    const route = routeRows[r];
    const routeShipments = confirmedShipments.slice(r * 3, r * 3 + 3);
    const stops = [];
    let seq = 1;

    for (const shipment of routeShipments) {
      stops.push({
        route_id: route.id,
        shipment_id: shipment.id,
        stop_type: 'pickup',
        sequence_order: seq++,
        address: shipment.origin_address,
        status: 'pending',
      });

      stops.push({
        route_id: route.id,
        shipment_id: shipment.id,
        stop_type: 'delivery',
        sequence_order: seq++,
        address: shipment.dest_address,
        status: 'pending',
      });
    }

    if (stops.length > 0) {
      const stopRows = await db.insert(schema.routeStops).values(stops).returning();

      // Set stop locations via raw SQL
      for (const stop of stopRows) {
        const coord = nycCoord();
        await db.execute(sql`
          UPDATE route_stops SET
            location = ST_SetSRID(ST_MakePoint(${coord.lng}, ${coord.lat}), 4326)
          WHERE id = ${stop.id}
        `);
      }
    }
  }

  console.log(`Created ${routeRows.length} routes with stops`);

  // ─── 8. Geofences (3 NYC landmarks) ───────────────────────────────
  const geofenceData = [
    {
      name: 'Times Square Zone',
      center_lat: String(NYC_LANDMARKS.timesSquare.lat),
      center_lng: String(NYC_LANDMARKS.timesSquare.lng),
      radius_m: '500',
      color: '#3B82F6',
    },
    {
      name: 'Central Park Depot',
      center_lat: String(NYC_LANDMARKS.centralPark.lat),
      center_lng: String(NYC_LANDMARKS.centralPark.lng),
      radius_m: '1000',
      color: '#EF4444',
    },
    {
      name: 'JFK Airport Hub',
      center_lat: String(NYC_LANDMARKS.jfkAirport.lat),
      center_lng: String(NYC_LANDMARKS.jfkAirport.lng),
      radius_m: '750',
      color: '#10B981',
    },
  ];

  const geofenceRows = await db
    .insert(schema.geofences)
    .values(
      geofenceData.map((g) => ({
        tenant_id: tenant.id,
        created_by: owner.id,
        name: g.name,
        center_lat: g.center_lat,
        center_lng: g.center_lng,
        radius_m: g.radius_m,
        color: g.color,
        trigger_on_enter: true,
        trigger_on_exit: true,
      })),
    )
    .returning();

  // Set geofence geometry via raw SQL (buffered circle)
  for (const gf of geofenceRows) {
    await db.execute(sql`
      UPDATE geofences SET
        geometry = ST_Buffer(
          ST_SetSRID(ST_MakePoint(${Number(gf.center_lng)}, ${Number(gf.center_lat)}), 4326)::geography,
          ${Number(gf.radius_m)}
        )::geometry
      WHERE id = ${gf.id}
    `);
  }

  console.log(`Created ${geofenceRows.length} geofences (NYC landmarks)`);

  // ─── Summary ──────────────────────────────────────────────────────
  console.log('\n✅ Seed completed successfully!');
  console.log('  Tenant: Acme Logistics (pro plan)');
  console.log(`  Users: ${userRows.length} (owner, admin, dispatcher, viewer)`);
  console.log(`  Drivers: ${drivers.length}`);
  console.log(`  Vehicles: ${vehicleRows.length}`);
  console.log(`  Shipments: ${shipmentRows.length}`);
  console.log(`  Routes: ${routeRows.length}`);
  console.log(`  Geofences: ${geofenceRows.length}`);
  console.log('  All passwords: Password1!');

  await pool.end();
  process.exit(0);
}

seed().catch((err) => {
  console.error('Seed failed:', err);
  process.exit(1);
});
