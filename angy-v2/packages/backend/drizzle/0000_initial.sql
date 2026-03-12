-- Initial migration: all tables for NexusFleet
-- Prerequisites: PostGIS and uuid-ossp extensions (created by scripts/init-db.sql)

CREATE TABLE IF NOT EXISTS "tenants" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "name" varchar(255) NOT NULL,
  "slug" varchar(100) UNIQUE NOT NULL,
  "plan" varchar(50) NOT NULL DEFAULT 'free',
  "is_active" boolean DEFAULT true,
  "created_at" timestamptz DEFAULT now(),
  "updated_at" timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS "users" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "tenant_id" uuid NOT NULL REFERENCES "tenants"("id"),
  "email" varchar(255) NOT NULL,
  "password_hash" varchar(255) NOT NULL,
  "role" varchar(50) NOT NULL,
  "first_name" varchar(100),
  "last_name" varchar(100),
  "is_active" boolean DEFAULT true,
  "refresh_token_hash" varchar(255),
  "last_login_at" timestamptz,
  "created_at" timestamptz DEFAULT now(),
  "updated_at" timestamptz DEFAULT now(),
  CONSTRAINT "users_tenant_email_unique" UNIQUE("tenant_id", "email")
);

CREATE TABLE IF NOT EXISTS "drivers" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "tenant_id" uuid NOT NULL REFERENCES "tenants"("id"),
  "employee_id" varchar(100) NOT NULL,
  "first_name" varchar(100),
  "last_name" varchar(100),
  "phone" varchar(50),
  "license_number" varchar(100),
  "license_expiry" date,
  "license_classes" text[],
  "status" varchar(50) DEFAULT 'off_duty',
  "current_vehicle_id" uuid,
  "max_driving_hours_day" decimal DEFAULT 9.0,
  "current_driving_hours" decimal DEFAULT 0,
  "is_active" boolean DEFAULT true,
  "created_by" uuid,
  "created_at" timestamptz DEFAULT now(),
  "updated_at" timestamptz DEFAULT now(),
  CONSTRAINT "drivers_tenant_employee_id_unique" UNIQUE("tenant_id", "employee_id")
);

CREATE TABLE IF NOT EXISTS "vehicles" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "tenant_id" uuid NOT NULL REFERENCES "tenants"("id"),
  "registration" varchar(100) NOT NULL,
  "vin" varchar(17) NOT NULL,
  "make" varchar(100),
  "model" varchar(100),
  "year" integer,
  "type" varchar(50),
  "capacity_kg" decimal NOT NULL,
  "capacity_m3" decimal NOT NULL,
  "status" varchar(50) DEFAULT 'available',
  "last_location" geometry(Point,4326),
  "last_location_at" timestamptz,
  "last_speed_kmh" decimal,
  "heading" decimal,
  "assigned_driver_id" uuid REFERENCES "drivers"("id"),
  "is_active" boolean DEFAULT true,
  "created_by" uuid,
  "created_at" timestamptz DEFAULT now(),
  "updated_at" timestamptz DEFAULT now(),
  CONSTRAINT "vehicles_tenant_registration_unique" UNIQUE("tenant_id", "registration"),
  CONSTRAINT "vehicles_tenant_vin_unique" UNIQUE("tenant_id", "vin")
);

CREATE TABLE IF NOT EXISTS "routes" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "tenant_id" uuid NOT NULL REFERENCES "tenants"("id"),
  "name" varchar(255) NOT NULL,
  "status" varchar(50) DEFAULT 'draft',
  "vehicle_id" uuid REFERENCES "vehicles"("id"),
  "driver_id" uuid REFERENCES "drivers"("id"),
  "planned_date" date,
  "estimated_distance_km" decimal,
  "optimization_score" decimal,
  "polyline" geometry(LineString,4326),
  "created_by" uuid,
  "created_at" timestamptz DEFAULT now(),
  "updated_at" timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS "shipments" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "tenant_id" uuid NOT NULL REFERENCES "tenants"("id"),
  "reference_code" varchar(100),
  "status" varchar(50) DEFAULT 'draft',
  "priority" varchar(50) DEFAULT 'normal',
  "customer_name" varchar(255) NOT NULL,
  "origin_address" text NOT NULL,
  "origin_location" geometry(Point,4326),
  "dest_address" text NOT NULL,
  "dest_location" geometry(Point,4326),
  "cargo_description" text,
  "cargo_weight_kg" decimal,
  "cargo_volume_m3" decimal,
  "cargo_type" varchar(50),
  "requires_temp_control" boolean DEFAULT false,
  "temp_min_c" decimal,
  "temp_max_c" decimal,
  "assigned_vehicle_id" uuid REFERENCES "vehicles"("id"),
  "assigned_driver_id" uuid REFERENCES "drivers"("id"),
  "assigned_route_id" uuid REFERENCES "routes"("id"),
  "scheduled_pickup_at" timestamptz,
  "actual_pickup_at" timestamptz,
  "actual_delivery_at" timestamptz,
  "estimated_arrival_at" timestamptz,
  "pod_signature_url" text,
  "pod_photo_urls" text[],
  "pod_notes" text,
  "failure_reason" text,
  "cancellation_reason" text,
  "created_by" uuid,
  "created_at" timestamptz DEFAULT now(),
  "updated_at" timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS "shipment_events" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "tenant_id" uuid NOT NULL REFERENCES "tenants"("id"),
  "shipment_id" uuid NOT NULL REFERENCES "shipments"("id"),
  "event_type" varchar(100) NOT NULL,
  "from_status" varchar(50),
  "to_status" varchar(50),
  "notes" text,
  "metadata" jsonb,
  "created_by" uuid,
  "created_at" timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS "route_stops" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "route_id" uuid NOT NULL REFERENCES "routes"("id"),
  "shipment_id" uuid REFERENCES "shipments"("id"),
  "stop_type" varchar(50) NOT NULL,
  "sequence_order" integer NOT NULL,
  "location" geometry(Point,4326),
  "address" text,
  "planned_arrival" timestamptz,
  "actual_arrival" timestamptz,
  "status" varchar(50) DEFAULT 'pending',
  "created_at" timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS "geofences" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "tenant_id" uuid NOT NULL REFERENCES "tenants"("id"),
  "name" varchar(255) NOT NULL,
  "center_lat" decimal NOT NULL,
  "center_lng" decimal NOT NULL,
  "radius_m" decimal NOT NULL,
  "geometry" geometry(Polygon,4326),
  "color" varchar(7) DEFAULT '#3B82F6',
  "trigger_on_enter" boolean DEFAULT true,
  "trigger_on_exit" boolean DEFAULT true,
  "is_active" boolean DEFAULT true,
  "created_by" uuid,
  "created_at" timestamptz DEFAULT now(),
  "updated_at" timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS "geofence_events" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "tenant_id" uuid NOT NULL REFERENCES "tenants"("id"),
  "geofence_id" uuid NOT NULL REFERENCES "geofences"("id"),
  "vehicle_id" uuid NOT NULL REFERENCES "vehicles"("id"),
  "event_type" varchar(10) NOT NULL,
  "location" geometry(Point,4326),
  "triggered_at" timestamptz,
  "acknowledged_at" timestamptz,
  "acknowledged_by" uuid
);

CREATE TABLE IF NOT EXISTS "notifications" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "tenant_id" uuid NOT NULL REFERENCES "tenants"("id"),
  "user_id" uuid NOT NULL REFERENCES "users"("id"),
  "type" varchar(100),
  "title" varchar(255),
  "body" text,
  "data" jsonb,
  "read_at" timestamptz,
  "created_at" timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS "webhook_endpoints" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "tenant_id" uuid NOT NULL REFERENCES "tenants"("id"),
  "url" text NOT NULL,
  "events" text[],
  "secret_hash" varchar(255) NOT NULL,
  "is_active" boolean DEFAULT true,
  "failure_count" integer DEFAULT 0,
  "created_by" uuid,
  "created_at" timestamptz DEFAULT now(),
  "updated_at" timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS "vehicle_tokens" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "tenant_id" uuid NOT NULL REFERENCES "tenants"("id"),
  "vehicle_id" uuid NOT NULL REFERENCES "vehicles"("id") UNIQUE,
  "token_hash" varchar(255) NOT NULL,
  "is_active" boolean DEFAULT true,
  "created_at" timestamptz DEFAULT now(),
  "expires_at" timestamptz
);

-- Indexes for common query patterns
CREATE INDEX IF NOT EXISTS "idx_users_tenant_id" ON "users"("tenant_id");
CREATE INDEX IF NOT EXISTS "idx_vehicles_tenant_id" ON "vehicles"("tenant_id");
CREATE INDEX IF NOT EXISTS "idx_vehicles_status" ON "vehicles"("tenant_id", "status");
CREATE INDEX IF NOT EXISTS "idx_drivers_tenant_id" ON "drivers"("tenant_id");
CREATE INDEX IF NOT EXISTS "idx_shipments_tenant_id" ON "shipments"("tenant_id");
CREATE INDEX IF NOT EXISTS "idx_shipments_status" ON "shipments"("tenant_id", "status");
CREATE INDEX IF NOT EXISTS "idx_shipments_reference_code" ON "shipments"("reference_code");
CREATE INDEX IF NOT EXISTS "idx_shipment_events_shipment_id" ON "shipment_events"("shipment_id");
CREATE INDEX IF NOT EXISTS "idx_route_stops_route_id" ON "route_stops"("route_id");
CREATE INDEX IF NOT EXISTS "idx_geofences_tenant_id" ON "geofences"("tenant_id");
CREATE INDEX IF NOT EXISTS "idx_notifications_user_id" ON "notifications"("user_id");
CREATE INDEX IF NOT EXISTS "idx_notifications_unread" ON "notifications"("user_id") WHERE "read_at" IS NULL;
CREATE INDEX IF NOT EXISTS "idx_vehicle_tokens_vehicle_id" ON "vehicle_tokens"("vehicle_id");

-- Spatial indexes
CREATE INDEX IF NOT EXISTS "idx_vehicles_last_location" ON "vehicles" USING GIST("last_location");
CREATE INDEX IF NOT EXISTS "idx_shipments_origin_location" ON "shipments" USING GIST("origin_location");
CREATE INDEX IF NOT EXISTS "idx_shipments_dest_location" ON "shipments" USING GIST("dest_location");
CREATE INDEX IF NOT EXISTS "idx_geofences_geometry" ON "geofences" USING GIST("geometry");
CREATE INDEX IF NOT EXISTS "idx_geofence_events_location" ON "geofence_events" USING GIST("location");
