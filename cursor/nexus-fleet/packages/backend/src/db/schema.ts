import {
  pgTable,
  uuid,
  varchar,
  text,
  timestamp,
  boolean,
  integer,
  decimal,
  uniqueIndex,
  index,
  customType,
} from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';

// ---------------------------------------------------------------------------
// PostGIS geometry custom types
// ---------------------------------------------------------------------------

const pointGeometry = customType<{ data: string; driverParam: string }>({
  dataType() {
    return 'geometry(Point, 4326)';
  },
  toDriver(value: string): string {
    return value;
  },
  fromDriver(value: unknown): string {
    return value as string;
  },
});

const lineStringGeometry = customType<{ data: string; driverParam: string }>({
  dataType() {
    return 'geometry(LineString, 4326)';
  },
  toDriver(value: string): string {
    return value;
  },
  fromDriver(value: unknown): string {
    return value as string;
  },
});

const genericGeometry = customType<{ data: string; driverParam: string }>({
  dataType() {
    return 'geometry(Geometry, 4326)';
  },
  toDriver(value: string): string {
    return value;
  },
  fromDriver(value: unknown): string {
    return value as string;
  },
});

// ---------------------------------------------------------------------------
// Tenants
// ---------------------------------------------------------------------------

export const tenants = pgTable('tenants', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: varchar('name', { length: 255 }).notNull(),
  slug: varchar('slug', { length: 100 }).notNull().unique(),
  plan: varchar('plan', { length: 20 }).notNull().default('free'),
  isActive: boolean('is_active').notNull().default(true),
  settings: text('settings').default('{}'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

// ---------------------------------------------------------------------------
// Users
// ---------------------------------------------------------------------------

export const users = pgTable(
  'users',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    tenantId: uuid('tenant_id')
      .notNull()
      .references(() => tenants.id, { onDelete: 'cascade' }),
    email: varchar('email', { length: 255 }).notNull(),
    passwordHash: text('password_hash').notNull(),
    name: varchar('name', { length: 255 }).notNull(),
    role: varchar('role', { length: 20 }).notNull().default('viewer'),
    isActive: boolean('is_active').notNull().default(true),
    lastLoginAt: timestamp('last_login_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex('users_tenant_email_idx').on(table.tenantId, table.email),
    index('users_tenant_id_idx').on(table.tenantId),
  ],
);

// ---------------------------------------------------------------------------
// Vehicles
// ---------------------------------------------------------------------------

export const vehicles = pgTable(
  'vehicles',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    tenantId: uuid('tenant_id')
      .notNull()
      .references(() => tenants.id, { onDelete: 'cascade' }),
    registration: varchar('registration', { length: 50 }).notNull(),
    vin: varchar('vin', { length: 50 }),
    type: varchar('type', { length: 30 }).notNull(),
    make: varchar('make', { length: 100 }),
    model: varchar('model', { length: 100 }),
    year: integer('year'),
    status: varchar('status', { length: 30 }).notNull().default('available'),
    fuelType: varchar('fuel_type', { length: 30 }),
    capacityKg: decimal('capacity_kg', { precision: 10, scale: 2 }),
    capacityM3: decimal('capacity_m3', { precision: 10, scale: 2 }),
    lastLocation: pointGeometry('last_location'),
    lastLocationAt: timestamp('last_location_at', { withTimezone: true }),
    heading: decimal('heading', { precision: 5, scale: 2 }),
    speedKmh: decimal('speed_kmh', { precision: 6, scale: 2 }),
    currentDriverId: uuid('current_driver_id'),
    isActive: boolean('is_active').notNull().default(true),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex('vehicles_tenant_registration_idx').on(table.tenantId, table.registration),
    uniqueIndex('vehicles_tenant_vin_idx').on(table.tenantId, table.vin),
    index('vehicles_tenant_id_idx').on(table.tenantId),
    index('vehicles_status_idx').on(table.tenantId, table.status),
  ],
);

// ---------------------------------------------------------------------------
// Drivers
// ---------------------------------------------------------------------------

export const drivers = pgTable(
  'drivers',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    tenantId: uuid('tenant_id')
      .notNull()
      .references(() => tenants.id, { onDelete: 'cascade' }),
    employeeId: varchar('employee_id', { length: 100 }).notNull(),
    name: varchar('name', { length: 255 }).notNull(),
    email: varchar('email', { length: 255 }),
    phone: varchar('phone', { length: 50 }),
    licenseNumber: varchar('license_number', { length: 100 }).notNull(),
    licenseClasses: text('license_classes')
      .array()
      .notNull()
      .default([]),
    licenseExpiry: timestamp('license_expiry', { withTimezone: true }),
    status: varchar('status', { length: 30 }).notNull().default('off_duty'),
    isActive: boolean('is_active').notNull().default(true),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex('drivers_tenant_employee_id_idx').on(table.tenantId, table.employeeId),
    uniqueIndex('drivers_tenant_license_number_idx').on(table.tenantId, table.licenseNumber),
    index('drivers_tenant_id_idx').on(table.tenantId),
    index('drivers_status_idx').on(table.tenantId, table.status),
  ],
);

// ---------------------------------------------------------------------------
// Shipments
// ---------------------------------------------------------------------------

export const shipments = pgTable(
  'shipments',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    tenantId: uuid('tenant_id')
      .notNull()
      .references(() => tenants.id, { onDelete: 'cascade' }),
    referenceCode: varchar('reference_code', { length: 100 }).notNull(),
    status: varchar('status', { length: 30 }).notNull().default('draft'),
    priority: varchar('priority', { length: 20 }).notNull().default('normal'),
    cargoType: varchar('cargo_type', { length: 30 }).notNull().default('general'),
    cargoDescription: text('cargo_description'),
    weightKg: decimal('weight_kg', { precision: 10, scale: 2 }),
    volumeM3: decimal('volume_m3', { precision: 10, scale: 2 }),
    originAddress: text('origin_address').notNull(),
    originLocation: pointGeometry('origin_location'),
    destAddress: text('dest_address').notNull(),
    destLocation: pointGeometry('dest_location'),
    vehicleId: uuid('vehicle_id').references(() => vehicles.id, { onDelete: 'set null' }),
    driverId: uuid('driver_id').references(() => drivers.id, { onDelete: 'set null' }),
    scheduledPickup: timestamp('scheduled_pickup', { withTimezone: true }),
    scheduledDelivery: timestamp('scheduled_delivery', { withTimezone: true }),
    actualPickup: timestamp('actual_pickup', { withTimezone: true }),
    actualDelivery: timestamp('actual_delivery', { withTimezone: true }),
    recipientName: varchar('recipient_name', { length: 255 }),
    recipientPhone: varchar('recipient_phone', { length: 50 }),
    podSignature: text('pod_signature'),
    podPhotoUrls: text('pod_photo_urls').array().default([]),
    podNotes: text('pod_notes'),
    failureReason: text('failure_reason'),
    notes: text('notes'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex('shipments_tenant_reference_code_idx').on(table.tenantId, table.referenceCode),
    index('shipments_tenant_id_idx').on(table.tenantId),
    index('shipments_status_idx').on(table.tenantId, table.status),
    index('shipments_vehicle_id_idx').on(table.vehicleId),
    index('shipments_driver_id_idx').on(table.driverId),
    index('shipments_scheduled_pickup_idx').on(table.scheduledPickup),
  ],
);

// ---------------------------------------------------------------------------
// Shipment Events (audit / status history)
// ---------------------------------------------------------------------------

export const shipmentEvents = pgTable(
  'shipment_events',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    shipmentId: uuid('shipment_id')
      .notNull()
      .references(() => shipments.id, { onDelete: 'cascade' }),
    status: varchar('status', { length: 30 }).notNull(),
    previousStatus: varchar('previous_status', { length: 30 }),
    location: pointGeometry('location'),
    notes: text('notes'),
    actorId: uuid('actor_id').references(() => users.id, { onDelete: 'set null' }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index('shipment_events_shipment_id_idx').on(table.shipmentId),
    index('shipment_events_created_at_idx').on(table.createdAt),
  ],
);

// ---------------------------------------------------------------------------
// Routes
// ---------------------------------------------------------------------------

export const routes = pgTable(
  'routes',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    tenantId: uuid('tenant_id')
      .notNull()
      .references(() => tenants.id, { onDelete: 'cascade' }),
    name: varchar('name', { length: 255 }).notNull(),
    status: varchar('status', { length: 30 }).notNull().default('draft'),
    vehicleId: uuid('vehicle_id').references(() => vehicles.id, { onDelete: 'set null' }),
    driverId: uuid('driver_id').references(() => drivers.id, { onDelete: 'set null' }),
    polyline: lineStringGeometry('polyline'),
    distanceKm: decimal('distance_km', { precision: 10, scale: 2 }),
    estimatedDurationMin: integer('estimated_duration_min'),
    scheduledStart: timestamp('scheduled_start', { withTimezone: true }),
    scheduledEnd: timestamp('scheduled_end', { withTimezone: true }),
    actualStart: timestamp('actual_start', { withTimezone: true }),
    actualEnd: timestamp('actual_end', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index('routes_tenant_id_idx').on(table.tenantId),
    index('routes_status_idx').on(table.tenantId, table.status),
    index('routes_vehicle_id_idx').on(table.vehicleId),
  ],
);

// ---------------------------------------------------------------------------
// Route Stops
// ---------------------------------------------------------------------------

export const routeStops = pgTable(
  'route_stops',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    routeId: uuid('route_id')
      .notNull()
      .references(() => routes.id, { onDelete: 'cascade' }),
    sequenceOrder: integer('sequence_order').notNull(),
    type: varchar('type', { length: 20 }).notNull().default('delivery'),
    status: varchar('status', { length: 20 }).notNull().default('pending'),
    address: text('address').notNull(),
    location: pointGeometry('location'),
    shipmentId: uuid('shipment_id').references(() => shipments.id, { onDelete: 'set null' }),
    estimatedArrival: timestamp('estimated_arrival', { withTimezone: true }),
    actualArrival: timestamp('actual_arrival', { withTimezone: true }),
    notes: text('notes'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex('route_stops_route_sequence_idx').on(table.routeId, table.sequenceOrder),
    index('route_stops_route_id_idx').on(table.routeId),
    index('route_stops_shipment_id_idx').on(table.shipmentId),
  ],
);

// ---------------------------------------------------------------------------
// Geofences
// ---------------------------------------------------------------------------

export const geofences = pgTable(
  'geofences',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    tenantId: uuid('tenant_id')
      .notNull()
      .references(() => tenants.id, { onDelete: 'cascade' }),
    name: varchar('name', { length: 255 }).notNull(),
    description: text('description'),
    center: pointGeometry('center').notNull(),
    radiusM: decimal('radius_m', { precision: 10, scale: 2 }),
    geometry: genericGeometry('geometry').notNull(),
    isActive: boolean('is_active').notNull().default(true),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index('geofences_tenant_id_idx').on(table.tenantId),
  ],
);

// ---------------------------------------------------------------------------
// Geofence Events
// ---------------------------------------------------------------------------

export const geofenceEvents = pgTable(
  'geofence_events',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    geofenceId: uuid('geofence_id')
      .notNull()
      .references(() => geofences.id, { onDelete: 'cascade' }),
    vehicleId: uuid('vehicle_id')
      .notNull()
      .references(() => vehicles.id, { onDelete: 'cascade' }),
    eventType: varchar('event_type', { length: 10 }).notNull(),
    location: pointGeometry('location'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index('geofence_events_geofence_id_idx').on(table.geofenceId),
    index('geofence_events_vehicle_id_idx').on(table.vehicleId),
    index('geofence_events_created_at_idx').on(table.createdAt),
  ],
);

// ---------------------------------------------------------------------------
// Notifications
// ---------------------------------------------------------------------------

export const notifications = pgTable(
  'notifications',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    tenantId: uuid('tenant_id')
      .notNull()
      .references(() => tenants.id, { onDelete: 'cascade' }),
    userId: uuid('user_id').references(() => users.id, { onDelete: 'cascade' }),
    title: varchar('title', { length: 255 }).notNull(),
    body: text('body').notNull(),
    type: varchar('type', { length: 50 }).notNull(),
    isRead: boolean('is_read').notNull().default(false),
    metadata: text('metadata').default('{}'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index('notifications_tenant_id_idx').on(table.tenantId),
    index('notifications_user_id_idx').on(table.userId),
    index('notifications_is_read_idx').on(table.userId, table.isRead),
  ],
);

// ---------------------------------------------------------------------------
// Webhook Endpoints
// ---------------------------------------------------------------------------

export const webhookEndpoints = pgTable(
  'webhook_endpoints',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    tenantId: uuid('tenant_id')
      .notNull()
      .references(() => tenants.id, { onDelete: 'cascade' }),
    url: text('url').notNull(),
    secret: text('secret').notNull(),
    events: text('events').array().notNull().default([]),
    isActive: boolean('is_active').notNull().default(true),
    lastTriggeredAt: timestamp('last_triggered_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index('webhook_endpoints_tenant_id_idx').on(table.tenantId),
  ],
);

// ===========================================================================
// Relations
// ===========================================================================

export const tenantsRelations = relations(tenants, ({ many }) => ({
  users: many(users),
  vehicles: many(vehicles),
  drivers: many(drivers),
  shipments: many(shipments),
  routes: many(routes),
  geofences: many(geofences),
  notifications: many(notifications),
  webhookEndpoints: many(webhookEndpoints),
}));

export const usersRelations = relations(users, ({ one, many }) => ({
  tenant: one(tenants, { fields: [users.tenantId], references: [tenants.id] }),
  notifications: many(notifications),
  shipmentEvents: many(shipmentEvents),
}));

export const vehiclesRelations = relations(vehicles, ({ one, many }) => ({
  tenant: one(tenants, { fields: [vehicles.tenantId], references: [tenants.id] }),
  currentDriver: one(drivers, {
    fields: [vehicles.currentDriverId],
    references: [drivers.id],
  }),
  shipments: many(shipments),
  routes: many(routes),
  geofenceEvents: many(geofenceEvents),
}));

export const driversRelations = relations(drivers, ({ one, many }) => ({
  tenant: one(tenants, { fields: [drivers.tenantId], references: [tenants.id] }),
  shipments: many(shipments),
  routes: many(routes),
}));

export const shipmentsRelations = relations(shipments, ({ one, many }) => ({
  tenant: one(tenants, { fields: [shipments.tenantId], references: [tenants.id] }),
  vehicle: one(vehicles, { fields: [shipments.vehicleId], references: [vehicles.id] }),
  driver: one(drivers, { fields: [shipments.driverId], references: [drivers.id] }),
  events: many(shipmentEvents),
  routeStops: many(routeStops),
}));

export const shipmentEventsRelations = relations(shipmentEvents, ({ one }) => ({
  shipment: one(shipments, { fields: [shipmentEvents.shipmentId], references: [shipments.id] }),
  actor: one(users, { fields: [shipmentEvents.actorId], references: [users.id] }),
}));

export const routesRelations = relations(routes, ({ one, many }) => ({
  tenant: one(tenants, { fields: [routes.tenantId], references: [tenants.id] }),
  vehicle: one(vehicles, { fields: [routes.vehicleId], references: [vehicles.id] }),
  driver: one(drivers, { fields: [routes.driverId], references: [drivers.id] }),
  stops: many(routeStops),
}));

export const routeStopsRelations = relations(routeStops, ({ one }) => ({
  route: one(routes, { fields: [routeStops.routeId], references: [routes.id] }),
  shipment: one(shipments, { fields: [routeStops.shipmentId], references: [shipments.id] }),
}));

export const geofencesRelations = relations(geofences, ({ one, many }) => ({
  tenant: one(tenants, { fields: [geofences.tenantId], references: [tenants.id] }),
  events: many(geofenceEvents),
}));

export const geofenceEventsRelations = relations(geofenceEvents, ({ one }) => ({
  geofence: one(geofences, { fields: [geofenceEvents.geofenceId], references: [geofences.id] }),
  vehicle: one(vehicles, { fields: [geofenceEvents.vehicleId], references: [vehicles.id] }),
}));

export const notificationsRelations = relations(notifications, ({ one }) => ({
  tenant: one(tenants, { fields: [notifications.tenantId], references: [tenants.id] }),
  user: one(users, { fields: [notifications.userId], references: [users.id] }),
}));

export const webhookEndpointsRelations = relations(webhookEndpoints, ({ one }) => ({
  tenant: one(tenants, { fields: [webhookEndpoints.tenantId], references: [tenants.id] }),
}));
