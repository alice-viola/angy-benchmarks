import {
  pgTable,
  uuid,
  varchar,
  text,
  boolean,
  timestamp,
  integer,
  numeric,
  date,
  jsonb,
  pgEnum,
  uniqueIndex,
  index,
  customType,
} from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';

// ── PostGIS geometry custom type ─────────────────────────────────────────────

const geometry = <TType extends string>(
  name: string,
  geometryType: TType,
  srid = 4326,
) =>
  customType<{ data: string; dpiType: string }>({
    dataType() {
      return `geometry(${geometryType},${srid})`;
    },
    toDriver(value: string) {
      return value;
    },
    fromDriver(value: unknown) {
      return value as string;
    },
  })(name);

// ── Enums ────────────────────────────────────────────────────────────────────

export const tenantPlanEnum = pgEnum('tenant_plan', [
  'free',
  'pro',
  'enterprise',
]);

export const userRoleEnum = pgEnum('user_role', [
  'owner',
  'admin',
  'dispatcher',
  'viewer',
]);

export const vehicleTypeEnum = pgEnum('vehicle_type', [
  'van',
  'truck',
  'semi',
  'refrigerated',
]);

export const vehicleStatusEnum = pgEnum('vehicle_status', [
  'available',
  'in_transit',
  'idle',
  'maintenance',
  'decommissioned',
]);

export const driverStatusEnum = pgEnum('driver_status', [
  'off_duty',
  'available',
  'driving',
  'on_break',
]);

export const shipmentStatusEnum = pgEnum('shipment_status', [
  'draft',
  'confirmed',
  'assigned',
  'picked_up',
  'in_transit',
  'delivered',
  'completed',
  'failed',
  'cancelled',
]);

export const shipmentPriorityEnum = pgEnum('shipment_priority', [
  'low',
  'normal',
  'high',
  'critical',
]);

export const cargoTypeEnum = pgEnum('cargo_type', [
  'general',
  'fragile',
  'hazardous',
  'perishable',
  'oversized',
]);

export const routeStatusEnum = pgEnum('route_status', [
  'draft',
  'active',
  'optimized',
  'completed',
]);

export const stopTypeEnum = pgEnum('stop_type', [
  'pickup',
  'delivery',
  'depot',
]);

export const stopStatusEnum = pgEnum('stop_status', [
  'pending',
  'arrived',
  'completed',
  'skipped',
]);

export const geofenceEventTypeEnum = pgEnum('geofence_event_type', [
  'enter',
  'exit',
]);

// ── Helper columns ───────────────────────────────────────────────────────────

const timestamps = {
  created_at: timestamp('created_at', { withTimezone: true })
    .notNull()
    .defaultNow(),
  updated_at: timestamp('updated_at', { withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdateFn(() => new Date()),
};

// ── Tables ───────────────────────────────────────────────────────────────────

export const tenants = pgTable('tenants', {
  id: uuid('id')
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  name: varchar('name', { length: 255 }).notNull(),
  slug: varchar('slug', { length: 255 }).notNull().unique(),
  plan: tenantPlanEnum('plan').notNull().default('free'),
  max_vehicles: integer('max_vehicles').notNull().default(10),
  max_drivers: integer('max_drivers').notNull().default(10),
  ...timestamps,
});

export const users = pgTable(
  'users',
  {
    id: uuid('id')
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    tenant_id: uuid('tenant_id')
      .notNull()
      .references(() => tenants.id, { onDelete: 'cascade' }),
    email: varchar('email', { length: 255 }).notNull(),
    password_hash: text('password_hash').notNull(),
    refresh_token: text('refresh_token'),
    role: userRoleEnum('role').notNull().default('viewer'),
    first_name: varchar('first_name', { length: 100 }).notNull(),
    last_name: varchar('last_name', { length: 100 }).notNull(),
    is_active: boolean('is_active').notNull().default(true),
    last_login_at: timestamp('last_login_at', { withTimezone: true }),
    ...timestamps,
  },
  (table) => ({
    tenantEmailIdx: uniqueIndex('users_tenant_email_idx').on(table.tenant_id, table.email),
  }),
);

export const drivers = pgTable(
  'drivers',
  {
    id: uuid('id')
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    tenant_id: uuid('tenant_id')
      .notNull()
      .references(() => tenants.id, { onDelete: 'cascade' }),
    employee_id: varchar('employee_id', { length: 50 }).notNull(),
    first_name: varchar('first_name', { length: 100 }).notNull(),
    last_name: varchar('last_name', { length: 100 }).notNull(),
    phone: varchar('phone', { length: 30 }),
    license_number: varchar('license_number', { length: 50 }).notNull(),
    license_expiry: date('license_expiry').notNull(),
    license_classes: text('license_classes')
      .array()
      .notNull()
      .default(sql`ARRAY[]::text[]`),
    status: driverStatusEnum('status').notNull().default('available'),
    current_vehicle_id: uuid('current_vehicle_id'),
    is_active: boolean('is_active').notNull().default(true),
    current_driving_hours: numeric('current_driving_hours')
      .notNull()
      .default('0'),
    max_driving_hours_day: numeric('max_driving_hours_day')
      .notNull()
      .default('9'),
    ...timestamps,
  },
  (table) => ({
    tenantEmployeeIdx: uniqueIndex('drivers_tenant_employee_id_idx').on(
      table.tenant_id,
      table.employee_id,
    ),
    tenantLicenseIdx: uniqueIndex('drivers_tenant_license_idx').on(
      table.tenant_id,
      table.license_number,
    ),
  }),
);

export const vehicles = pgTable(
  'vehicles',
  {
    id: uuid('id')
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    tenant_id: uuid('tenant_id')
      .notNull()
      .references(() => tenants.id, { onDelete: 'cascade' }),
    registration: varchar('registration', { length: 20 }).notNull(),
    vin: varchar('vin', { length: 17 }).notNull(),
    make: varchar('make', { length: 100 }).notNull(),
    model: varchar('model', { length: 100 }).notNull(),
    year: integer('year').notNull(),
    // CHECK constraint: year BETWEEN 1990 AND 2030 (enforced at DB level via migration)
    type: vehicleTypeEnum('type').notNull(),
    capacity_kg: numeric('capacity_kg'),
    // CHECK constraint: capacity_kg > 0 (enforced at DB level via migration)
    capacity_m3: numeric('capacity_m3'),
    // CHECK constraint: capacity_m3 > 0 (enforced at DB level via migration)
    status: vehicleStatusEnum('status').notNull().default('available'),
    is_active: boolean('is_active').notNull().default(true),
    assigned_driver_id: uuid('assigned_driver_id').references(
      () => drivers.id,
      { onDelete: 'set null' },
    ),
    last_location: geometry('last_location', 'Point'),
    last_location_at: timestamp('last_location_at', { withTimezone: true }),
    last_speed_kmh: numeric('last_speed_kmh'),
    heading: numeric('heading'),
    ...timestamps,
  },
  (table) => ({
    tenantRegistrationIdx: uniqueIndex('vehicles_tenant_registration_idx').on(
      table.tenant_id,
      table.registration,
    ),
    tenantVinIdx: uniqueIndex('vehicles_tenant_vin_idx').on(table.tenant_id, table.vin),
    lastLocationIdx: index('vehicles_last_location_idx').using(
      'gist',
      table.last_location,
    ),
  }),
);

export const shipments = pgTable(
  'shipments',
  {
    id: uuid('id')
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    tenant_id: uuid('tenant_id')
      .notNull()
      .references(() => tenants.id, { onDelete: 'cascade' }),
    reference_code: varchar('reference_code', { length: 50 }),
    status: shipmentStatusEnum('status').notNull().default('draft'),
    priority: shipmentPriorityEnum('priority').notNull().default('normal'),
    customer_name: varchar('customer_name', { length: 255 }).notNull(),
    origin_address: text('origin_address').notNull(),
    origin_lat: numeric('origin_lat').notNull(),
    origin_lng: numeric('origin_lng').notNull(),
    origin_location: geometry('origin_location', 'Point'),
    dest_address: text('dest_address').notNull(),
    dest_lat: numeric('dest_lat').notNull(),
    dest_lng: numeric('dest_lng').notNull(),
    dest_location: geometry('dest_location', 'Point'),
    cargo_description: text('cargo_description').notNull(),
    cargo_weight_kg: numeric('cargo_weight_kg').notNull(),
    // CHECK constraint: cargo_weight_kg > 0 (enforced at DB level via migration)
    cargo_volume_m3: numeric('cargo_volume_m3').notNull(),
    // CHECK constraint: cargo_volume_m3 > 0 (enforced at DB level via migration)
    cargo_type: cargoTypeEnum('cargo_type').notNull().default('general'),
    requires_temp_control: boolean('requires_temp_control')
      .notNull()
      .default(false),
    temp_min_c: numeric('temp_min_c'),
    temp_max_c: numeric('temp_max_c'),
    // CHECK constraint: temp_min_c < temp_max_c when requires_temp_control (enforced at DB level)
    assigned_vehicle_id: uuid('assigned_vehicle_id').references(
      () => vehicles.id,
      { onDelete: 'set null' },
    ),
    assigned_driver_id: uuid('assigned_driver_id').references(() => drivers.id, {
      onDelete: 'set null',
    }),
    assigned_route_id: uuid('assigned_route_id'),
    estimated_arrival_at: timestamp('estimated_arrival_at', { withTimezone: true }),
    scheduled_pickup_at: timestamp('scheduled_pickup_at', {
      withTimezone: true,
    }),
    actual_pickup_at: timestamp('actual_pickup_at', { withTimezone: true }),
    actual_delivery_at: timestamp('actual_delivery_at', { withTimezone: true }),
    pod_signature_url: text('pod_signature_url'),
    pod_photo_urls: text('pod_photo_urls')
      .array()
      .default(sql`ARRAY[]::text[]`),
    pod_notes: text('pod_notes'),
    failure_reason: text('failure_reason'),
    cancellation_reason: text('cancellation_reason'),
    created_by: uuid('created_by').references(() => users.id, {
      onDelete: 'set null',
    }),
    ...timestamps,
  },
  (table) => ({
    originLocationIdx: index('shipments_origin_location_idx').using(
      'gist',
      table.origin_location,
    ),
    destLocationIdx: index('shipments_dest_location_idx').using(
      'gist',
      table.dest_location,
    ),
  }),
);

export const shipmentEvents = pgTable('shipment_events', {
  id: uuid('id')
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  tenant_id: uuid('tenant_id')
    .notNull()
    .references(() => tenants.id, { onDelete: 'cascade' }),
  shipment_id: uuid('shipment_id')
    .notNull()
    .references(() => shipments.id, { onDelete: 'cascade' }),
  from_status: shipmentStatusEnum('from_status'),
  to_status: shipmentStatusEnum('to_status').notNull(),
  event_type: varchar('event_type', { length: 50 }).notNull(),
  performed_by: uuid('performed_by').references(() => users.id, {
    onDelete: 'set null',
  }),
  location: geometry('location', 'Point'),
  metadata: jsonb('metadata'),
  notes: text('notes'),
  created_at: timestamp('created_at', { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const routes = pgTable('routes', {
  id: uuid('id')
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  tenant_id: uuid('tenant_id')
    .notNull()
    .references(() => tenants.id, { onDelete: 'cascade' }),
  name: varchar('name', { length: 255 }).notNull(),
  status: routeStatusEnum('status').notNull().default('draft'),
  planned_date: date('planned_date'),
  vehicle_id: uuid('vehicle_id').references(() => vehicles.id, {
    onDelete: 'set null',
  }),
  driver_id: uuid('driver_id').references(() => drivers.id, {
    onDelete: 'set null',
  }),
  estimated_distance_km: numeric('estimated_distance_km'),
  optimization_score: numeric('optimization_score'),
  polyline: geometry('polyline', 'LineString'),
  ...timestamps,
});

export const routeStops = pgTable('route_stops', {
  id: uuid('id')
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  route_id: uuid('route_id')
    .notNull()
    .references(() => routes.id, { onDelete: 'cascade' }),
  shipment_id: uuid('shipment_id').references(() => shipments.id, {
    onDelete: 'set null',
  }),
  stop_type: stopTypeEnum('stop_type').notNull(),
  sequence_order: integer('sequence_order').notNull(),
  address: text('address').notNull(),
  lat: numeric('lat').notNull(),
  lng: numeric('lng').notNull(),
  planned_arrival: timestamp('planned_arrival', { withTimezone: true }),
  actual_arrival: timestamp('actual_arrival', { withTimezone: true }),
  status: stopStatusEnum('status').notNull().default('pending'),
  pod_signature_url: text('pod_signature_url'),
  pod_photo_urls: text('pod_photo_urls').array(),
  pod_notes: text('pod_notes'),
  completed_at: timestamp('completed_at', { withTimezone: true }),
});

export const geofences = pgTable(
  'geofences',
  {
    id: uuid('id')
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    tenant_id: uuid('tenant_id')
      .notNull()
      .references(() => tenants.id, { onDelete: 'cascade' }),
    name: varchar('name', { length: 255 }).notNull(),
    center: geometry('center', 'Point').notNull(),
    geometry: geometry('geometry', 'Polygon').notNull(),
    radius_m: numeric('radius_m').notNull(),
    color: varchar('color', { length: 10 }).notNull().default('#3B82F6'),
    trigger_on_enter: boolean('trigger_on_enter').notNull().default(true),
    trigger_on_exit: boolean('trigger_on_exit').notNull().default(true),
    is_active: boolean('is_active').notNull().default(true),
    ...timestamps,
  },
  (table) => ({
    geometryIdx: index('geofences_geometry_idx').using('gist', table.geometry),
  }),
);

export const geofenceEvents = pgTable('geofence_events', {
  id: uuid('id')
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  tenant_id: uuid('tenant_id')
    .notNull()
    .references(() => tenants.id, { onDelete: 'cascade' }),
  geofence_id: uuid('geofence_id')
    .notNull()
    .references(() => geofences.id, { onDelete: 'cascade' }),
  vehicle_id: uuid('vehicle_id')
    .notNull()
    .references(() => vehicles.id, { onDelete: 'cascade' }),
  event_type: geofenceEventTypeEnum('event_type').notNull(),
  lat: numeric('lat').notNull(),
  lng: numeric('lng').notNull(),
  triggered_at: timestamp('triggered_at', { withTimezone: true })
    .notNull()
    .defaultNow(),
  acknowledged_at: timestamp('acknowledged_at', { withTimezone: true }),
  acknowledged_by: uuid('acknowledged_by').references(() => users.id, {
    onDelete: 'set null',
  }),
});

export const notifications = pgTable('notifications', {
  id: uuid('id')
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  tenant_id: uuid('tenant_id')
    .notNull()
    .references(() => tenants.id, { onDelete: 'cascade' }),
  user_id: uuid('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  type: varchar('type', { length: 50 }).notNull(),
  title: varchar('title', { length: 255 }).notNull(),
  body: text('body').notNull(),
  data: jsonb('data'),
  read_at: timestamp('read_at', { withTimezone: true }),
  created_at: timestamp('created_at', { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const webhookEndpoints = pgTable('webhook_endpoints', {
  id: uuid('id')
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  tenant_id: uuid('tenant_id')
    .notNull()
    .references(() => tenants.id, { onDelete: 'cascade' }),
  url: text('url').notNull(),
  events: text('events')
    .array()
    .notNull()
    .default(sql`ARRAY[]::text[]`),
  secret: text('secret').notNull(),
  is_active: boolean('is_active').notNull().default(true),
  failure_count: integer('failure_count').notNull().default(0),
  ...timestamps,
});
