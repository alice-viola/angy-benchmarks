import {
  pgTable,
  uuid,
  varchar,
  boolean,
  timestamp,
  text,
  integer,
  decimal,
  date,
  jsonb,
  unique,
  customType,
} from 'drizzle-orm/pg-core';

// PostGIS geometry custom type — stores as WKB hex, accepts raw SQL for writes
const geometry = <TName extends string>(name: TName, opts: { srid: number; type: string }) =>
  customType<{ data: string; driverParam: string }>({
    dataType() {
      return `geometry(${opts.type},${opts.srid})`;
    },
    toDriver(value: string) {
      return value;
    },
    fromDriver(value: unknown) {
      return value as string;
    },
  })(name);

// ─── Tenants ────────────────────────────────────────────
export const tenants = pgTable('tenants', {
  id: uuid('id').defaultRandom().primaryKey(),
  name: varchar('name', { length: 255 }).notNull(),
  slug: varchar('slug', { length: 100 }).unique().notNull(),
  plan: varchar('plan', { length: 50 }).notNull().default('free'),
  is_active: boolean('is_active').default(true),
  created_at: timestamp('created_at', { withTimezone: true }).defaultNow(),
  updated_at: timestamp('updated_at', { withTimezone: true }).defaultNow(),
});

// ─── Users ──────────────────────────────────────────────
export const users = pgTable(
  'users',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    tenant_id: uuid('tenant_id')
      .notNull()
      .references(() => tenants.id),
    email: varchar('email', { length: 255 }).notNull(),
    password_hash: varchar('password_hash', { length: 255 }).notNull(),
    role: varchar('role', { length: 50 }).notNull(),
    first_name: varchar('first_name', { length: 100 }),
    last_name: varchar('last_name', { length: 100 }),
    is_active: boolean('is_active').default(true),
    refresh_token_hash: varchar('refresh_token_hash', { length: 255 }),
    last_login_at: timestamp('last_login_at', { withTimezone: true }),
    created_at: timestamp('created_at', { withTimezone: true }).defaultNow(),
    updated_at: timestamp('updated_at', { withTimezone: true }).defaultNow(),
  },
  (table) => [unique('users_tenant_email_unique').on(table.tenant_id, table.email)],
);

// ─── Drivers ────────────────────────────────────────────
export const drivers = pgTable(
  'drivers',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    tenant_id: uuid('tenant_id')
      .notNull()
      .references(() => tenants.id),
    employee_id: varchar('employee_id', { length: 100 }).notNull(),
    first_name: varchar('first_name', { length: 100 }),
    last_name: varchar('last_name', { length: 100 }),
    phone: varchar('phone', { length: 50 }),
    license_number: varchar('license_number', { length: 100 }),
    license_expiry: date('license_expiry'),
    license_classes: text('license_classes').array(),
    status: varchar('status', { length: 50 }).default('off_duty'),
    current_vehicle_id: uuid('current_vehicle_id'),
    max_driving_hours_day: decimal('max_driving_hours_day').default('9.0'),
    current_driving_hours: decimal('current_driving_hours').default('0'),
    is_active: boolean('is_active').default(true),
    created_by: uuid('created_by'),
    created_at: timestamp('created_at', { withTimezone: true }).defaultNow(),
    updated_at: timestamp('updated_at', { withTimezone: true }).defaultNow(),
  },
  (table) => [unique('drivers_tenant_employee_id_unique').on(table.tenant_id, table.employee_id)],
);

// ─── Vehicles ───────────────────────────────────────────
export const vehicles = pgTable(
  'vehicles',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    tenant_id: uuid('tenant_id')
      .notNull()
      .references(() => tenants.id),
    registration: varchar('registration', { length: 100 }).notNull(),
    vin: varchar('vin', { length: 17 }).notNull(),
    make: varchar('make', { length: 100 }),
    model: varchar('model', { length: 100 }),
    year: integer('year'),
    type: varchar('type', { length: 50 }),
    capacity_kg: decimal('capacity_kg').notNull(),
    capacity_m3: decimal('capacity_m3').notNull(),
    status: varchar('status', { length: 50 }).default('available'),
    last_location: geometry('last_location', { srid: 4326, type: 'Point' }),
    last_location_at: timestamp('last_location_at', { withTimezone: true }),
    last_speed_kmh: decimal('last_speed_kmh'),
    heading: decimal('heading'),
    assigned_driver_id: uuid('assigned_driver_id').references(() => drivers.id),
    is_active: boolean('is_active').default(true),
    created_by: uuid('created_by'),
    created_at: timestamp('created_at', { withTimezone: true }).defaultNow(),
    updated_at: timestamp('updated_at', { withTimezone: true }).defaultNow(),
  },
  (table) => [
    unique('vehicles_tenant_registration_unique').on(table.tenant_id, table.registration),
    unique('vehicles_tenant_vin_unique').on(table.tenant_id, table.vin),
  ],
);

// ─── Routes ─────────────────────────────────────────────
export const routes = pgTable('routes', {
  id: uuid('id').defaultRandom().primaryKey(),
  tenant_id: uuid('tenant_id')
    .notNull()
    .references(() => tenants.id),
  name: varchar('name', { length: 255 }).notNull(),
  status: varchar('status', { length: 50 }).default('draft'),
  vehicle_id: uuid('vehicle_id').references(() => vehicles.id),
  driver_id: uuid('driver_id').references(() => drivers.id),
  planned_date: date('planned_date'),
  estimated_distance_km: decimal('estimated_distance_km'),
  optimization_score: decimal('optimization_score'),
  polyline: geometry('polyline', { srid: 4326, type: 'LineString' }),
  created_by: uuid('created_by'),
  created_at: timestamp('created_at', { withTimezone: true }).defaultNow(),
  updated_at: timestamp('updated_at', { withTimezone: true }).defaultNow(),
});

// ─── Shipments ──────────────────────────────────────────
export const shipments = pgTable('shipments', {
  id: uuid('id').defaultRandom().primaryKey(),
  tenant_id: uuid('tenant_id')
    .notNull()
    .references(() => tenants.id),
  reference_code: varchar('reference_code', { length: 100 }),
  status: varchar('status', { length: 50 }).default('draft'),
  priority: varchar('priority', { length: 50 }).default('normal'),
  customer_name: varchar('customer_name', { length: 255 }).notNull(),
  origin_address: text('origin_address').notNull(),
  origin_location: geometry('origin_location', { srid: 4326, type: 'Point' }),
  dest_address: text('dest_address').notNull(),
  dest_location: geometry('dest_location', { srid: 4326, type: 'Point' }),
  cargo_description: text('cargo_description'),
  cargo_weight_kg: decimal('cargo_weight_kg'),
  cargo_volume_m3: decimal('cargo_volume_m3'),
  cargo_type: varchar('cargo_type', { length: 50 }),
  requires_temp_control: boolean('requires_temp_control').default(false),
  temp_min_c: decimal('temp_min_c'),
  temp_max_c: decimal('temp_max_c'),
  assigned_vehicle_id: uuid('assigned_vehicle_id').references(() => vehicles.id),
  assigned_driver_id: uuid('assigned_driver_id').references(() => drivers.id),
  assigned_route_id: uuid('assigned_route_id').references(() => routes.id),
  scheduled_pickup_at: timestamp('scheduled_pickup_at', { withTimezone: true }),
  actual_pickup_at: timestamp('actual_pickup_at', { withTimezone: true }),
  actual_delivery_at: timestamp('actual_delivery_at', { withTimezone: true }),
  estimated_arrival_at: timestamp('estimated_arrival_at', { withTimezone: true }),
  pod_signature_url: text('pod_signature_url'),
  pod_photo_urls: text('pod_photo_urls').array(),
  pod_notes: text('pod_notes'),
  failure_reason: text('failure_reason'),
  cancellation_reason: text('cancellation_reason'),
  created_by: uuid('created_by'),
  created_at: timestamp('created_at', { withTimezone: true }).defaultNow(),
  updated_at: timestamp('updated_at', { withTimezone: true }).defaultNow(),
});

// ─── Shipment Events ────────────────────────────────────
export const shipmentEvents = pgTable('shipment_events', {
  id: uuid('id').defaultRandom().primaryKey(),
  tenant_id: uuid('tenant_id')
    .notNull()
    .references(() => tenants.id),
  shipment_id: uuid('shipment_id')
    .notNull()
    .references(() => shipments.id),
  event_type: varchar('event_type', { length: 100 }).notNull(),
  from_status: varchar('from_status', { length: 50 }),
  to_status: varchar('to_status', { length: 50 }),
  notes: text('notes'),
  metadata: jsonb('metadata'),
  created_by: uuid('created_by'),
  created_at: timestamp('created_at', { withTimezone: true }).defaultNow(),
});

// ─── Route Stops ────────────────────────────────────────
export const routeStops = pgTable('route_stops', {
  id: uuid('id').defaultRandom().primaryKey(),
  route_id: uuid('route_id')
    .notNull()
    .references(() => routes.id),
  shipment_id: uuid('shipment_id').references(() => shipments.id),
  stop_type: varchar('stop_type', { length: 50 }).notNull(),
  sequence_order: integer('sequence_order').notNull(),
  location: geometry('location', { srid: 4326, type: 'Point' }),
  address: text('address'),
  planned_arrival: timestamp('planned_arrival', { withTimezone: true }),
  actual_arrival: timestamp('actual_arrival', { withTimezone: true }),
  status: varchar('status', { length: 50 }).default('pending'),
  created_at: timestamp('created_at', { withTimezone: true }).defaultNow(),
});

// ─── Geofences ──────────────────────────────────────────
export const geofences = pgTable('geofences', {
  id: uuid('id').defaultRandom().primaryKey(),
  tenant_id: uuid('tenant_id')
    .notNull()
    .references(() => tenants.id),
  name: varchar('name', { length: 255 }).notNull(),
  center_lat: decimal('center_lat').notNull(),
  center_lng: decimal('center_lng').notNull(),
  radius_m: decimal('radius_m').notNull(),
  geometry: geometry('geometry', { srid: 4326, type: 'Polygon' }),
  color: varchar('color', { length: 7 }).default('#3B82F6'),
  trigger_on_enter: boolean('trigger_on_enter').default(true),
  trigger_on_exit: boolean('trigger_on_exit').default(true),
  is_active: boolean('is_active').default(true),
  created_by: uuid('created_by'),
  created_at: timestamp('created_at', { withTimezone: true }).defaultNow(),
  updated_at: timestamp('updated_at', { withTimezone: true }).defaultNow(),
});

// ─── Geofence Events ────────────────────────────────────
export const geofenceEvents = pgTable('geofence_events', {
  id: uuid('id').defaultRandom().primaryKey(),
  tenant_id: uuid('tenant_id')
    .notNull()
    .references(() => tenants.id),
  geofence_id: uuid('geofence_id')
    .notNull()
    .references(() => geofences.id),
  vehicle_id: uuid('vehicle_id')
    .notNull()
    .references(() => vehicles.id),
  event_type: varchar('event_type', { length: 10 }).notNull(),
  location: geometry('location', { srid: 4326, type: 'Point' }),
  triggered_at: timestamp('triggered_at', { withTimezone: true }),
  acknowledged_at: timestamp('acknowledged_at', { withTimezone: true }),
  acknowledged_by: uuid('acknowledged_by'),
});

// ─── Notifications ──────────────────────────────────────
export const notifications = pgTable('notifications', {
  id: uuid('id').defaultRandom().primaryKey(),
  tenant_id: uuid('tenant_id')
    .notNull()
    .references(() => tenants.id),
  user_id: uuid('user_id')
    .notNull()
    .references(() => users.id),
  type: varchar('type', { length: 100 }),
  title: varchar('title', { length: 255 }),
  body: text('body'),
  data: jsonb('data'),
  read_at: timestamp('read_at', { withTimezone: true }),
  created_at: timestamp('created_at', { withTimezone: true }).defaultNow(),
});

// ─── Webhook Endpoints ──────────────────────────────────
export const webhookEndpoints = pgTable('webhook_endpoints', {
  id: uuid('id').defaultRandom().primaryKey(),
  tenant_id: uuid('tenant_id')
    .notNull()
    .references(() => tenants.id),
  url: text('url').notNull(),
  events: text('events').array(),
  secret: varchar('secret', { length: 255 }).notNull(),
  secret_hash: varchar('secret_hash', { length: 255 }).notNull(),
  is_active: boolean('is_active').default(true),
  failure_count: integer('failure_count').default(0),
  created_by: uuid('created_by'),
  created_at: timestamp('created_at', { withTimezone: true }).defaultNow(),
  updated_at: timestamp('updated_at', { withTimezone: true }).defaultNow(),
});

// ─── Vehicle Tokens ─────────────────────────────────────
export const vehicleTokens = pgTable('vehicle_tokens', {
  id: uuid('id').defaultRandom().primaryKey(),
  tenant_id: uuid('tenant_id')
    .notNull()
    .references(() => tenants.id),
  vehicle_id: uuid('vehicle_id')
    .notNull()
    .references(() => vehicles.id)
    .unique(),
  token_hash: varchar('token_hash', { length: 255 }).notNull(),
  is_active: boolean('is_active').default(true),
  created_at: timestamp('created_at', { withTimezone: true }).defaultNow(),
  expires_at: timestamp('expires_at', { withTimezone: true }),
});
