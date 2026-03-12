import {
  pgTable,
  uuid,
  varchar,
  text,
  integer,
  numeric,
  boolean,
  timestamp,
  jsonb,
  index,
  uniqueIndex,
} from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';

// ---------------------------------------------------------------------------
// Tenants
// ---------------------------------------------------------------------------

export const tenants = pgTable('tenants', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: varchar('name', { length: 255 }).notNull(),
  slug: varchar('slug', { length: 255 }).notNull().unique(),
  plan: varchar('plan', { length: 50 }).notNull().default('free'),
  is_active: boolean('is_active').notNull().default(true),
  settings: jsonb('settings').default({}),
  created_at: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updated_at: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

export const tenantsRelations = relations(tenants, ({ many }) => ({
  users: many(users),
  vehicles: many(vehicles),
  drivers: many(drivers),
  shipments: many(shipments),
  routes: many(routes),
  geofences: many(geofences),
  webhookEndpoints: many(webhookEndpoints),
}));

// ---------------------------------------------------------------------------
// Users
// ---------------------------------------------------------------------------

export const users = pgTable(
  'users',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    tenant_id: uuid('tenant_id')
      .notNull()
      .references(() => tenants.id, { onDelete: 'cascade' }),
    email: varchar('email', { length: 255 }).notNull(),
    password_hash: text('password_hash').notNull(),
    first_name: varchar('first_name', { length: 255 }).notNull(),
    last_name: varchar('last_name', { length: 255 }).notNull(),
    role: varchar('role', { length: 50 }).notNull().default('viewer'),
    is_active: boolean('is_active').notNull().default(true),
    refresh_token_hash: text('refresh_token_hash'),
    last_login_at: timestamp('last_login_at', { withTimezone: true }),
    created_at: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updated_at: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex('users_tenant_email_idx').on(table.tenant_id, table.email),
    index('users_tenant_id_idx').on(table.tenant_id),
  ],
);

export const usersRelations = relations(users, ({ one }) => ({
  tenant: one(tenants, { fields: [users.tenant_id], references: [tenants.id] }),
}));

// ---------------------------------------------------------------------------
// Vehicles
// ---------------------------------------------------------------------------

export const vehicles = pgTable(
  'vehicles',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    tenant_id: uuid('tenant_id')
      .notNull()
      .references(() => tenants.id, { onDelete: 'cascade' }),
    registration: varchar('registration', { length: 50 }).notNull(),
    vin: varchar('vin', { length: 17 }).notNull(),
    make: varchar('make', { length: 255 }).notNull(),
    model: varchar('model', { length: 255 }).notNull(),
    year: integer('year').notNull(),
    type: varchar('type', { length: 50 }).notNull(),
    status: varchar('status', { length: 50 }).notNull().default('available'),
    capacity_kg: numeric('capacity_kg', { precision: 10, scale: 2 }).notNull(),
    capacity_m3: numeric('capacity_m3', { precision: 10, scale: 2 }).notNull(),
    current_driver_id: uuid('current_driver_id'),
    // PostGIS geometry column - use text placeholder; actual column is geometry(Point, 4326)
    last_location: text('last_location'),
    last_location_lat: numeric('last_location_lat', { precision: 10, scale: 7 }),
    last_location_lng: numeric('last_location_lng', { precision: 10, scale: 7 }),
    last_speed_kmh: numeric('last_speed_kmh', { precision: 6, scale: 2 }),
    last_heading: numeric('last_heading', { precision: 6, scale: 2 }),
    last_location_at: timestamp('last_location_at', { withTimezone: true }),
    fuel_level_pct: integer('fuel_level_pct'),
    odometer_km: numeric('odometer_km', { precision: 12, scale: 2 }),
    is_active: boolean('is_active').notNull().default(true),
    metadata: jsonb('metadata').default({}),
    created_at: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updated_at: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex('vehicles_tenant_registration_idx').on(table.tenant_id, table.registration),
    uniqueIndex('vehicles_tenant_vin_idx').on(table.tenant_id, table.vin),
    index('vehicles_tenant_id_idx').on(table.tenant_id),
    index('vehicles_status_idx').on(table.tenant_id, table.status),
  ],
);

export const vehiclesRelations = relations(vehicles, ({ one, many }) => ({
  tenant: one(tenants, { fields: [vehicles.tenant_id], references: [tenants.id] }),
  currentDriver: one(drivers, {
    fields: [vehicles.current_driver_id],
    references: [drivers.id],
  }),
  shipments: many(shipments),
  routeStops: many(routeStops),
}));

// ---------------------------------------------------------------------------
// Drivers
// ---------------------------------------------------------------------------

export const drivers = pgTable(
  'drivers',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    tenant_id: uuid('tenant_id')
      .notNull()
      .references(() => tenants.id, { onDelete: 'cascade' }),
    employee_id: varchar('employee_id', { length: 100 }).notNull(),
    first_name: varchar('first_name', { length: 255 }).notNull(),
    last_name: varchar('last_name', { length: 255 }).notNull(),
    phone: varchar('phone', { length: 50 }).notNull(),
    license_number: varchar('license_number', { length: 100 }).notNull(),
    license_expiry: timestamp('license_expiry', { withTimezone: true }).notNull(),
    license_classes: jsonb('license_classes').notNull().default([]),
    status: varchar('status', { length: 50 }).notNull().default('off_duty'),
    current_vehicle_id: uuid('current_vehicle_id'),
    current_driving_hours: numeric('current_driving_hours', { precision: 5, scale: 2 })
      .notNull()
      .default('0'),
    max_driving_hours_day: numeric('max_driving_hours_day', { precision: 5, scale: 2 })
      .notNull()
      .default('9'),
    is_active: boolean('is_active').notNull().default(true),
    metadata: jsonb('metadata').default({}),
    created_at: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updated_at: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex('drivers_tenant_employee_id_idx').on(table.tenant_id, table.employee_id),
    index('drivers_tenant_id_idx').on(table.tenant_id),
    index('drivers_status_idx').on(table.tenant_id, table.status),
  ],
);

export const driversRelations = relations(drivers, ({ one, many }) => ({
  tenant: one(tenants, { fields: [drivers.tenant_id], references: [tenants.id] }),
  currentVehicle: one(vehicles, {
    fields: [drivers.current_vehicle_id],
    references: [vehicles.id],
  }),
  shipments: many(shipments),
}));

// ---------------------------------------------------------------------------
// Shipments
// ---------------------------------------------------------------------------

export const shipments = pgTable(
  'shipments',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    tenant_id: uuid('tenant_id')
      .notNull()
      .references(() => tenants.id, { onDelete: 'cascade' }),
    reference_code: varchar('reference_code', { length: 50 }).notNull(),
    status: varchar('status', { length: 50 }).notNull().default('draft'),
    priority: varchar('priority', { length: 20 }).notNull().default('normal'),
    customer_name: varchar('customer_name', { length: 255 }).notNull(),
    origin_address: text('origin_address').notNull(),
    origin_lat: numeric('origin_lat', { precision: 10, scale: 7 }).notNull(),
    origin_lng: numeric('origin_lng', { precision: 10, scale: 7 }).notNull(),
    dest_address: text('dest_address').notNull(),
    dest_lat: numeric('dest_lat', { precision: 10, scale: 7 }).notNull(),
    dest_lng: numeric('dest_lng', { precision: 10, scale: 7 }).notNull(),
    cargo_description: text('cargo_description').notNull(),
    cargo_weight_kg: numeric('cargo_weight_kg', { precision: 10, scale: 2 }).notNull(),
    cargo_volume_m3: numeric('cargo_volume_m3', { precision: 10, scale: 2 }).notNull(),
    cargo_type: varchar('cargo_type', { length: 50 }).notNull().default('general'),
    requires_temp_control: boolean('requires_temp_control').notNull().default(false),
    temp_min_c: numeric('temp_min_c', { precision: 5, scale: 2 }),
    temp_max_c: numeric('temp_max_c', { precision: 5, scale: 2 }),
    vehicle_id: uuid('vehicle_id').references(() => vehicles.id),
    driver_id: uuid('driver_id').references(() => drivers.id),
    scheduled_pickup_at: timestamp('scheduled_pickup_at', { withTimezone: true }),
    actual_pickup_at: timestamp('actual_pickup_at', { withTimezone: true }),
    estimated_delivery_at: timestamp('estimated_delivery_at', { withTimezone: true }),
    actual_delivery_at: timestamp('actual_delivery_at', { withTimezone: true }),
    completed_at: timestamp('completed_at', { withTimezone: true }),
    cancelled_at: timestamp('cancelled_at', { withTimezone: true }),
    failure_reason: text('failure_reason'),
    proof_of_delivery: jsonb('proof_of_delivery'),
    is_deleted: boolean('is_deleted').notNull().default(false),
    metadata: jsonb('metadata').default({}),
    created_at: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updated_at: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex('shipments_reference_code_idx').on(table.reference_code),
    index('shipments_tenant_id_idx').on(table.tenant_id),
    index('shipments_status_idx').on(table.tenant_id, table.status),
    index('shipments_priority_idx').on(table.tenant_id, table.priority),
    index('shipments_vehicle_id_idx').on(table.vehicle_id),
    index('shipments_driver_id_idx').on(table.driver_id),
    index('shipments_created_at_idx').on(table.tenant_id, table.created_at),
  ],
);

export const shipmentsRelations = relations(shipments, ({ one, many }) => ({
  tenant: one(tenants, { fields: [shipments.tenant_id], references: [tenants.id] }),
  vehicle: one(vehicles, { fields: [shipments.vehicle_id], references: [vehicles.id] }),
  driver: one(drivers, { fields: [shipments.driver_id], references: [drivers.id] }),
  events: many(shipmentEvents),
}));

// ---------------------------------------------------------------------------
// Shipment Events (audit trail)
// ---------------------------------------------------------------------------

export const shipmentEvents = pgTable(
  'shipment_events',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    tenant_id: uuid('tenant_id')
      .notNull()
      .references(() => tenants.id, { onDelete: 'cascade' }),
    shipment_id: uuid('shipment_id')
      .notNull()
      .references(() => shipments.id, { onDelete: 'cascade' }),
    from_status: varchar('from_status', { length: 50 }),
    to_status: varchar('to_status', { length: 50 }).notNull(),
    action: varchar('action', { length: 50 }).notNull(),
    actor_id: uuid('actor_id').references(() => users.id),
    data: jsonb('data').default({}),
    created_at: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index('shipment_events_shipment_id_idx').on(table.shipment_id),
    index('shipment_events_tenant_id_idx').on(table.tenant_id),
    index('shipment_events_created_at_idx').on(table.created_at),
  ],
);

export const shipmentEventsRelations = relations(shipmentEvents, ({ one }) => ({
  shipment: one(shipments, {
    fields: [shipmentEvents.shipment_id],
    references: [shipments.id],
  }),
  actor: one(users, { fields: [shipmentEvents.actor_id], references: [users.id] }),
}));

// ---------------------------------------------------------------------------
// Routes
// ---------------------------------------------------------------------------

export const routes = pgTable(
  'routes',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    tenant_id: uuid('tenant_id')
      .notNull()
      .references(() => tenants.id, { onDelete: 'cascade' }),
    name: varchar('name', { length: 255 }).notNull(),
    status: varchar('status', { length: 50 }).notNull().default('draft'),
    vehicle_id: uuid('vehicle_id').references(() => vehicles.id),
    driver_id: uuid('driver_id').references(() => drivers.id),
    planned_date: timestamp('planned_date', { withTimezone: true }).notNull(),
    started_at: timestamp('started_at', { withTimezone: true }),
    completed_at: timestamp('completed_at', { withTimezone: true }),
    total_distance_km: numeric('total_distance_km', { precision: 10, scale: 2 }),
    estimated_duration_min: integer('estimated_duration_min'),
    polyline: text('polyline'),
    metadata: jsonb('metadata').default({}),
    created_at: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updated_at: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index('routes_tenant_id_idx').on(table.tenant_id),
    index('routes_status_idx').on(table.tenant_id, table.status),
    index('routes_planned_date_idx').on(table.tenant_id, table.planned_date),
  ],
);

export const routesRelations = relations(routes, ({ one, many }) => ({
  tenant: one(tenants, { fields: [routes.tenant_id], references: [tenants.id] }),
  vehicle: one(vehicles, { fields: [routes.vehicle_id], references: [vehicles.id] }),
  driver: one(drivers, { fields: [routes.driver_id], references: [drivers.id] }),
  stops: many(routeStops),
}));

// ---------------------------------------------------------------------------
// Route Stops
// ---------------------------------------------------------------------------

export const routeStops = pgTable(
  'route_stops',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    tenant_id: uuid('tenant_id')
      .notNull()
      .references(() => tenants.id, { onDelete: 'cascade' }),
    route_id: uuid('route_id')
      .notNull()
      .references(() => routes.id, { onDelete: 'cascade' }),
    shipment_id: uuid('shipment_id').references(() => shipments.id),
    stop_type: varchar('stop_type', { length: 50 }).notNull(),
    sequence_order: integer('sequence_order').notNull(),
    location_lat: numeric('location_lat', { precision: 10, scale: 7 }).notNull(),
    location_lng: numeric('location_lng', { precision: 10, scale: 7 }).notNull(),
    address: text('address').notNull(),
    status: varchar('status', { length: 50 }).notNull().default('pending'),
    arrived_at: timestamp('arrived_at', { withTimezone: true }),
    completed_at: timestamp('completed_at', { withTimezone: true }),
    estimated_arrival_at: timestamp('estimated_arrival_at', { withTimezone: true }),
    metadata: jsonb('metadata').default({}),
    created_at: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updated_at: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index('route_stops_route_id_idx').on(table.route_id),
    index('route_stops_tenant_id_idx').on(table.tenant_id),
    index('route_stops_sequence_idx').on(table.route_id, table.sequence_order),
  ],
);

export const routeStopsRelations = relations(routeStops, ({ one }) => ({
  route: one(routes, { fields: [routeStops.route_id], references: [routes.id] }),
  shipment: one(shipments, { fields: [routeStops.shipment_id], references: [shipments.id] }),
  vehicle: one(vehicles, { fields: [routeStops.tenant_id], references: [vehicles.tenant_id] }),
}));

// ---------------------------------------------------------------------------
// Geofences
// ---------------------------------------------------------------------------

export const geofences = pgTable(
  'geofences',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    tenant_id: uuid('tenant_id')
      .notNull()
      .references(() => tenants.id, { onDelete: 'cascade' }),
    name: varchar('name', { length: 255 }).notNull(),
    // PostGIS geometry column - actual column is geometry(Polygon, 4326)
    geometry: text('geometry'),
    center_lat: numeric('center_lat', { precision: 10, scale: 7 }).notNull(),
    center_lng: numeric('center_lng', { precision: 10, scale: 7 }).notNull(),
    radius_m: numeric('radius_m', { precision: 10, scale: 2 }).notNull(),
    color: varchar('color', { length: 7 }).notNull().default('#3B82F6'),
    trigger_on_enter: boolean('trigger_on_enter').notNull().default(true),
    trigger_on_exit: boolean('trigger_on_exit').notNull().default(true),
    is_active: boolean('is_active').notNull().default(true),
    metadata: jsonb('metadata').default({}),
    created_at: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updated_at: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index('geofences_tenant_id_idx').on(table.tenant_id),
    index('geofences_active_idx').on(table.tenant_id, table.is_active),
  ],
);

export const geofencesRelations = relations(geofences, ({ one, many }) => ({
  tenant: one(tenants, { fields: [geofences.tenant_id], references: [tenants.id] }),
  events: many(geofenceEvents),
}));

// ---------------------------------------------------------------------------
// Geofence Events
// ---------------------------------------------------------------------------

export const geofenceEvents = pgTable(
  'geofence_events',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    tenant_id: uuid('tenant_id')
      .notNull()
      .references(() => tenants.id, { onDelete: 'cascade' }),
    geofence_id: uuid('geofence_id')
      .notNull()
      .references(() => geofences.id, { onDelete: 'cascade' }),
    vehicle_id: uuid('vehicle_id')
      .notNull()
      .references(() => vehicles.id, { onDelete: 'cascade' }),
    event_type: varchar('event_type', { length: 20 }).notNull(),
    location_lat: numeric('location_lat', { precision: 10, scale: 7 }).notNull(),
    location_lng: numeric('location_lng', { precision: 10, scale: 7 }).notNull(),
    created_at: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index('geofence_events_geofence_id_idx').on(table.geofence_id),
    index('geofence_events_vehicle_id_idx').on(table.vehicle_id),
    index('geofence_events_tenant_id_idx').on(table.tenant_id),
    index('geofence_events_created_at_idx').on(table.created_at),
  ],
);

export const geofenceEventsRelations = relations(geofenceEvents, ({ one }) => ({
  geofence: one(geofences, {
    fields: [geofenceEvents.geofence_id],
    references: [geofences.id],
  }),
  vehicle: one(vehicles, {
    fields: [geofenceEvents.vehicle_id],
    references: [vehicles.id],
  }),
}));

// ---------------------------------------------------------------------------
// Notifications
// ---------------------------------------------------------------------------

export const notifications = pgTable(
  'notifications',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    tenant_id: uuid('tenant_id')
      .notNull()
      .references(() => tenants.id, { onDelete: 'cascade' }),
    user_id: uuid('user_id').references(() => users.id),
    type: varchar('type', { length: 100 }).notNull(),
    title: varchar('title', { length: 500 }).notNull(),
    body: text('body'),
    data: jsonb('data').default({}),
    is_read: boolean('is_read').notNull().default(false),
    read_at: timestamp('read_at', { withTimezone: true }),
    created_at: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index('notifications_tenant_id_idx').on(table.tenant_id),
    index('notifications_user_id_idx').on(table.user_id),
    index('notifications_unread_idx').on(table.user_id, table.is_read),
  ],
);

export const notificationsRelations = relations(notifications, ({ one }) => ({
  user: one(users, { fields: [notifications.user_id], references: [users.id] }),
}));

// ---------------------------------------------------------------------------
// Webhook Endpoints
// ---------------------------------------------------------------------------

export const webhookEndpoints = pgTable(
  'webhook_endpoints',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    tenant_id: uuid('tenant_id')
      .notNull()
      .references(() => tenants.id, { onDelete: 'cascade' }),
    url: varchar('url', { length: 2000 }).notNull(),
    secret: text('secret').notNull(),
    events: jsonb('events').notNull().default([]),
    is_active: boolean('is_active').notNull().default(true),
    consecutive_failures: integer('consecutive_failures').notNull().default(0),
    last_triggered_at: timestamp('last_triggered_at', { withTimezone: true }),
    created_at: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updated_at: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index('webhook_endpoints_tenant_id_idx').on(table.tenant_id),
  ],
);

export const webhookEndpointsRelations = relations(webhookEndpoints, ({ one }) => ({
  tenant: one(tenants, {
    fields: [webhookEndpoints.tenant_id],
    references: [tenants.id],
  }),
}));
