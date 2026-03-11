import { db } from './connection.js';
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
import { eq, sql } from 'drizzle-orm';
import bcrypt from 'bcryptjs';

// Deterministic PRNG (mulberry32) seeded with 42
function mulberry32(seed: number) {
  let s = seed | 0;
  return () => {
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const rng = mulberry32(42);

function randomInRange(min: number, max: number) {
  return min + rng() * (max - min);
}

function randomLat() {
  return Number(randomInRange(40.6, 40.85).toFixed(6));
}

function randomLng() {
  return Number(randomInRange(-74.05, -73.75).toFixed(6));
}

function pad(n: number, len: number) {
  return String(n).padStart(len, '0');
}

async function seed() {
  console.log('Checking if seed data already exists...');

  const existing = await db.select().from(tenants).where(eq(tenants.slug, 'acme-logistics'));
  if (existing.length > 0) {
    console.log('Seed data already exists. Skipping.');
    process.exit(0);
  }

  console.log('Seeding database...');

  // ---- Tenant ----
  console.log('  Creating tenant...');
  const [tenant] = await db
    .insert(tenants)
    .values({
      name: 'Acme Logistics',
      slug: 'acme-logistics',
      plan: 'pro',
      settings: JSON.stringify({ maxVehicles: 50, maxDrivers: 50 }),
    })
    .returning();

  // ---- Users ----
  console.log('  Creating users...');
  const passwordHash = await bcrypt.hash('Password1!', 12);

  const userRows = await db
    .insert(users)
    .values([
      { tenantId: tenant.id, email: 'alice@acme.com', passwordHash, name: 'Alice Johnson', role: 'owner' },
      { tenantId: tenant.id, email: 'bob@acme.com', passwordHash, name: 'Bob Smith', role: 'admin' },
      { tenantId: tenant.id, email: 'carol@acme.com', passwordHash, name: 'Carol Williams', role: 'dispatcher' },
      { tenantId: tenant.id, email: 'dave@acme.com', passwordHash, name: 'Dave Brown', role: 'viewer' },
    ])
    .returning();

  const dispatcherUser = userRows.find((u) => u.role === 'dispatcher')!;

  // ---- Vehicles ----
  console.log('  Creating vehicles...');
  const vehicleDefs = [
    { reg: 'NF-001', vin: '1FTFW1ET5EKD00001', type: 'van', make: 'Ford', model: 'Transit', year: 2024, status: 'available', capKg: '2000', capM3: '12' },
    { reg: 'NF-002', vin: '1FTFW1ET5EKD00002', type: 'van', make: 'Mercedes-Benz', model: 'Sprinter', year: 2023, status: 'available', capKg: '2500', capM3: '14' },
    { reg: 'NF-003', vin: '3AKJHHDR7KSKL0003', type: 'truck', make: 'Freightliner', model: 'M2 106', year: 2022, status: 'in_transit', capKg: '12000', capM3: '45' },
    { reg: 'NF-004', vin: '3AKJHHDR7KSKL0004', type: 'truck', make: 'Kenworth', model: 'T680', year: 2023, status: 'available', capKg: '15000', capM3: '55' },
    { reg: 'NF-005', vin: '3AKJHHDR7KSKL0005', type: 'truck', make: 'Peterbilt', model: '579', year: 2024, status: 'available', capKg: '18000', capM3: '60' },
    { reg: 'NF-006', vin: '1XPWD40X1ED200006', type: 'semi', make: 'Volvo', model: 'VNL', year: 2023, status: 'in_transit', capKg: '25000', capM3: '80' },
    { reg: 'NF-007', vin: '1XPWD40X1ED200007', type: 'semi', make: 'International', model: 'LT', year: 2022, status: 'maintenance', capKg: '28000', capM3: '85' },
    { reg: 'NF-008', vin: '3AKJHHDR7KSKL0008', type: 'refrigerated', make: 'Isuzu', model: 'NRR', year: 2024, status: 'available', capKg: '5000', capM3: '20' },
  ];

  const vehicleRows = await db
    .insert(vehicles)
    .values(
      vehicleDefs.map((v) => ({
        tenantId: tenant.id,
        registration: v.reg,
        vin: v.vin,
        type: v.type,
        make: v.make,
        model: v.model,
        year: v.year,
        status: v.status,
        capacityKg: v.capKg,
        capacityM3: v.capM3,
        lastLocation: sql`ST_SetSRID(ST_MakePoint(${randomLng()}, ${randomLat()}), 4326)`,
        lastLocationAt: new Date(),
        heading: String(Math.floor(rng() * 360)),
        speedKmh: v.status === 'in_transit' ? String(Math.floor(40 + rng() * 60)) : '0',
        isActive: v.status !== 'maintenance',
      })),
    )
    .returning();

  // ---- Drivers ----
  console.log('  Creating drivers...');
  const driverDefs = [
    { eid: 'EMP-001', name: 'James Miller', phone: '+1-212-555-0101', lic: 'DL-NY-100001', classes: ['B', 'C'], status: 'available' },
    { eid: 'EMP-002', name: 'Sarah Davis', phone: '+1-212-555-0102', lic: 'DL-NY-100002', classes: ['B'], status: 'available' },
    { eid: 'EMP-003', name: 'Michael Wilson', phone: '+1-212-555-0103', lic: 'DL-NY-100003', classes: ['B', 'C', 'CE'], status: 'driving' },
    { eid: 'EMP-004', name: 'Emily Taylor', phone: '+1-212-555-0104', lic: 'DL-NY-100004', classes: ['B', 'C'], status: 'driving' },
    { eid: 'EMP-005', name: 'Robert Anderson', phone: '+1-212-555-0105', lic: 'DL-NY-100005', classes: ['B', 'C', 'CE'], status: 'on_break' },
    { eid: 'EMP-006', name: 'Jessica Thomas', phone: '+1-212-555-0106', lic: 'DL-NY-100006', classes: ['B'], status: 'off_duty' },
  ];

  const driverRows = await db
    .insert(drivers)
    .values(
      driverDefs.map((d) => ({
        tenantId: tenant.id,
        employeeId: d.eid,
        name: d.name,
        phone: d.phone,
        licenseNumber: d.lic,
        licenseClasses: d.classes,
        licenseExpiry: new Date('2028-12-31'),
        status: d.status,
      })),
    )
    .returning();

  // ---- Shipments ----
  console.log('  Creating shipments...');
  const statusSeq: string[] = [
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
  const priorities = ['low', 'normal', 'high', 'critical'];
  const cargoTypes = ['general', 'fragile', 'hazardous', 'perishable'];
  const nycAddresses = [
    '350 5th Ave, New York, NY 10118',
    '1 World Trade Center, New York, NY 10007',
    '30 Rockefeller Plaza, New York, NY 10112',
    '11 Wall St, New York, NY 10005',
    '200 Central Park S, New York, NY 10019',
    '20 W 34th St, New York, NY 10001',
    '89 E 42nd St, New York, NY 10017',
    '455 Madison Ave, New York, NY 10022',
    '1 MetLife Stadium Dr, East Rutherford, NJ 07073',
    '75 9th Ave, New York, NY 10011',
    '40 W 57th St, New York, NY 10019',
    '1 Penn Plz, New York, NY 10119',
    '100 Broadway, New York, NY 10005',
    '425 Park Ave, New York, NY 10022',
    '1515 Broadway, New York, NY 10036',
  ];

  const availableVehicle = vehicleRows.find((v) => v.status === 'available')!;
  const transitVehicle = vehicleRows.find((v) => v.status === 'in_transit')!;
  const availableDriver = driverRows.find((d) => d.status === 'available')!;
  const drivingDriver = driverRows.find((d) => d.status === 'driving')!;

  const shipmentValues = statusSeq.map((status, i) => {
    const refCode = `SHP-20260310-${pad(i + 1, 5)}`;
    const needsAssignment = ['assigned', 'picked_up', 'in_transit', 'delivered', 'completed', 'failed'].includes(status);
    const oLat = randomLat();
    const oLng = randomLng();
    const dLat = randomLat();
    const dLng = randomLng();

    return {
      tenantId: tenant.id,
      referenceCode: refCode,
      status,
      priority: priorities[i % priorities.length],
      cargoType: cargoTypes[i % cargoTypes.length],
      cargoDescription: `Cargo shipment #${i + 1}`,
      weightKg: String(500 + Math.floor(rng() * 5000)),
      volumeM3: String(1 + Math.floor(rng() * 20)),
      originAddress: nycAddresses[i % nycAddresses.length],
      originLocation: sql`ST_SetSRID(ST_MakePoint(${oLng}, ${oLat}), 4326)`,
      destAddress: nycAddresses[(i + 7) % nycAddresses.length],
      destLocation: sql`ST_SetSRID(ST_MakePoint(${dLng}, ${dLat}), 4326)`,
      vehicleId: needsAssignment ? (i % 2 === 0 ? transitVehicle.id : availableVehicle.id) : null,
      driverId: needsAssignment ? (i % 2 === 0 ? drivingDriver.id : availableDriver.id) : null,
      recipientName: `Customer ${i + 1}`,
      recipientPhone: `+1-212-555-${pad(200 + i, 4)}`,
      scheduledPickup: new Date('2026-03-11T09:00:00Z'),
      actualPickup: ['picked_up', 'in_transit', 'delivered', 'completed'].includes(status) ? new Date('2026-03-11T09:15:00Z') : null,
      actualDelivery: ['delivered', 'completed'].includes(status) ? new Date('2026-03-11T14:30:00Z') : null,
      podSignature: status === 'delivered' || status === 'completed' ? 'https://example.com/pod/sig-' + (i + 1) + '.png' : null,
      podPhotoUrls: status === 'delivered' || status === 'completed' ? ['https://example.com/pod/photo-' + (i + 1) + '.jpg'] : [],
      failureReason: status === 'failed' ? 'Vehicle breakdown during transit' : null,
      notes: status === 'cancelled' ? 'Customer requested cancellation' : null,
    };
  });

  const shipmentRows = await db.insert(shipments).values(shipmentValues as any).returning();

  // ---- Shipment Events ----
  console.log('  Creating shipment events...');
  const eventValues: any[] = [];
  const now = new Date('2026-03-10T08:00:00Z');

  for (const s of shipmentRows) {
    const chain = getStatusChain(s.status);
    let prev: string | null = null;
    for (let j = 0; j < chain.length; j++) {
      eventValues.push({
        shipmentId: s.id,
        status: chain[j],
        previousStatus: prev,
        actorId: dispatcherUser.id,
        notes: j === 0 ? 'Shipment created' : `Status changed to ${chain[j]}`,
        createdAt: new Date(now.getTime() + j * 3600000),
      });
      prev = chain[j];
    }
  }

  if (eventValues.length > 0) {
    await db.insert(shipmentEvents).values(eventValues);
  }

  // ---- Routes ----
  console.log('  Creating routes...');
  const [draftRoute] = await db
    .insert(routes)
    .values({
      tenantId: tenant.id,
      name: 'Manhattan Morning Route',
      status: 'draft',
      scheduledStart: new Date('2026-03-12T07:00:00Z'),
    })
    .returning();

  const [activeRoute] = await db
    .insert(routes)
    .values({
      tenantId: tenant.id,
      name: 'Brooklyn Afternoon Route',
      status: 'active',
      vehicleId: transitVehicle.id,
      driverId: drivingDriver.id,
      distanceKm: '42.5',
      estimatedDurationMin: 180,
      scheduledStart: new Date('2026-03-10T13:00:00Z'),
      actualStart: new Date('2026-03-10T13:15:00Z'),
    })
    .returning();

  // ---- Route Stops ----
  console.log('  Creating route stops...');
  const draftStops = [
    { order: 1, type: 'pickup', addr: '350 5th Ave, New York, NY', lat: 40.7484, lng: -73.9857 },
    { order: 2, type: 'delivery', addr: '1 World Trade Center, New York, NY', lat: 40.7127, lng: -74.0134 },
    { order: 3, type: 'delivery', addr: '11 Wall St, New York, NY', lat: 40.7074, lng: -74.0112 },
  ];

  await db.insert(routeStops).values(
    draftStops.map((s) => ({
      routeId: draftRoute.id,
      sequenceOrder: s.order,
      type: s.type,
      address: s.addr,
      location: sql`ST_SetSRID(ST_MakePoint(${s.lng}, ${s.lat}), 4326)`,
      status: 'pending',
    })),
  );

  const activeStops = [
    { order: 1, type: 'depot', addr: 'Acme Logistics Depot, Brooklyn, NY', lat: 40.6782, lng: -73.9442, status: 'completed' },
    { order: 2, type: 'pickup', addr: '89 E 42nd St, New York, NY', lat: 40.7527, lng: -73.9772, status: 'completed' },
    { order: 3, type: 'delivery', addr: '455 Madison Ave, New York, NY', lat: 40.7614, lng: -73.9726, status: 'arrived' },
    { order: 4, type: 'pickup', addr: '75 9th Ave, New York, NY', lat: 40.7423, lng: -74.0052, status: 'pending' },
    { order: 5, type: 'delivery', addr: '100 Broadway, New York, NY', lat: 40.7081, lng: -74.0101, status: 'pending' },
  ];

  await db.insert(routeStops).values(
    activeStops.map((s) => ({
      routeId: activeRoute.id,
      sequenceOrder: s.order,
      type: s.type,
      address: s.addr,
      location: sql`ST_SetSRID(ST_MakePoint(${s.lng}, ${s.lat}), 4326)`,
      status: s.status,
      actualArrival: s.status === 'completed' ? new Date('2026-03-10T13:30:00Z') : null,
    })),
  );

  // ---- Geofences ----
  console.log('  Creating geofences...');
  const geofenceDefs = [
    { name: 'JFK Airport', lat: 40.6413, lng: -73.7781, radius: 2000 },
    { name: 'Times Square', lat: 40.758, lng: -73.9855, radius: 500 },
    { name: 'Port Newark', lat: 40.6895, lng: -74.1502, radius: 3000 },
  ];

  await db.insert(geofences).values(
    geofenceDefs.map((g) => ({
      tenantId: tenant.id,
      name: g.name,
      description: `Geofence around ${g.name}`,
      center: sql`ST_SetSRID(ST_MakePoint(${g.lng}, ${g.lat}), 4326)`,
      radiusM: String(g.radius),
      geometry: sql`ST_Buffer(ST_SetSRID(ST_MakePoint(${g.lng}, ${g.lat}), 4326)::geography, ${g.radius})::geometry`,
    })),
  );

  console.log('Seed completed successfully!');
  process.exit(0);
}

function getStatusChain(finalStatus: string): string[] {
  const chains: Record<string, string[]> = {
    draft: ['draft'],
    confirmed: ['draft', 'confirmed'],
    assigned: ['draft', 'confirmed', 'assigned'],
    picked_up: ['draft', 'confirmed', 'assigned', 'picked_up'],
    in_transit: ['draft', 'confirmed', 'assigned', 'picked_up', 'in_transit'],
    delivered: ['draft', 'confirmed', 'assigned', 'picked_up', 'in_transit', 'delivered'],
    completed: ['draft', 'confirmed', 'assigned', 'picked_up', 'in_transit', 'delivered', 'completed'],
    failed: ['draft', 'confirmed', 'assigned', 'picked_up', 'in_transit', 'failed'],
    cancelled: ['draft', 'cancelled'],
  };
  return chains[finalStatus] || ['draft'];
}

seed().catch((err) => {
  console.error('Seed failed:', err);
  process.exit(1);
});
