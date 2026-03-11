-- Custom enum types
DO $$ BEGIN
  CREATE TYPE "public"."tenant_plan" AS ENUM('free', 'pro', 'enterprise');
EXCEPTION WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE "public"."user_role" AS ENUM('owner', 'admin', 'dispatcher', 'viewer');
EXCEPTION WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE "public"."vehicle_type" AS ENUM('van', 'truck', 'semi', 'refrigerated');
EXCEPTION WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE "public"."vehicle_status" AS ENUM('available', 'in_transit', 'idle', 'maintenance', 'decommissioned');
EXCEPTION WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE "public"."driver_status" AS ENUM('off_duty', 'available', 'driving', 'on_break');
EXCEPTION WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE "public"."shipment_status" AS ENUM('draft', 'confirmed', 'assigned', 'picked_up', 'in_transit', 'delivered', 'completed', 'failed', 'cancelled');
EXCEPTION WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE "public"."shipment_priority" AS ENUM('low', 'normal', 'high', 'critical');
EXCEPTION WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE "public"."cargo_type" AS ENUM('general', 'fragile', 'hazardous', 'perishable', 'oversized');
EXCEPTION WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE "public"."route_status" AS ENUM('draft', 'active', 'optimized', 'completed');
EXCEPTION WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE "public"."stop_type" AS ENUM('pickup', 'delivery', 'depot');
EXCEPTION WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE "public"."stop_status" AS ENUM('pending', 'arrived', 'completed', 'skipped');
EXCEPTION WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE "public"."geofence_event_type" AS ENUM('enter', 'exit');
EXCEPTION WHEN duplicate_object THEN null;
END $$;

-- Tenants
CREATE TABLE IF NOT EXISTS "tenants" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "name" varchar(255) NOT NULL,
  "slug" varchar(255) NOT NULL UNIQUE,
  "plan" "tenant_plan" DEFAULT 'free' NOT NULL,
  "max_vehicles" integer DEFAULT 10 NOT NULL,
  "max_drivers" integer DEFAULT 10 NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

-- Users
CREATE TABLE IF NOT EXISTS "users" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "tenant_id" uuid NOT NULL REFERENCES "tenants"("id") ON DELETE CASCADE,
  "email" varchar(255) NOT NULL,
  "password_hash" text NOT NULL,
  "refresh_token" text,
  "role" "user_role" DEFAULT 'viewer' NOT NULL,
  "first_name" varchar(100) NOT NULL,
  "last_name" varchar(100) NOT NULL,
  "is_active" boolean DEFAULT true NOT NULL,
  "last_login_at" timestamp with time zone,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS "users_tenant_email_idx" ON "users" USING btree ("tenant_id", "email");

-- Drivers
CREATE TABLE IF NOT EXISTS "drivers" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "tenant_id" uuid NOT NULL REFERENCES "tenants"("id") ON DELETE CASCADE,
  "employee_id" varchar(50) NOT NULL,
  "first_name" varchar(100) NOT NULL,
  "last_name" varchar(100) NOT NULL,
  "phone" varchar(30),
  "license_number" varchar(50) NOT NULL,
  "license_expiry" date NOT NULL,
  "license_classes" text[] DEFAULT ARRAY[]::text[] NOT NULL,
  "status" "driver_status" DEFAULT 'available' NOT NULL,
  "current_vehicle_id" uuid,
  "is_active" boolean DEFAULT true NOT NULL,
  "current_driving_hours" numeric DEFAULT '0' NOT NULL,
  "max_driving_hours_day" numeric DEFAULT '9' NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS "drivers_tenant_employee_id_idx" ON "drivers" USING btree ("tenant_id", "employee_id");
CREATE UNIQUE INDEX IF NOT EXISTS "drivers_tenant_license_idx" ON "drivers" USING btree ("tenant_id", "license_number");

-- Vehicles
CREATE TABLE IF NOT EXISTS "vehicles" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "tenant_id" uuid NOT NULL REFERENCES "tenants"("id") ON DELETE CASCADE,
  "registration" varchar(20) NOT NULL,
  "vin" varchar(17) NOT NULL,
  "make" varchar(100) NOT NULL,
  "model" varchar(100) NOT NULL,
  "year" integer NOT NULL CHECK ("year" BETWEEN 1990 AND 2030),
  "type" "vehicle_type" NOT NULL,
  "capacity_kg" numeric CHECK ("capacity_kg" > 0),
  "capacity_m3" numeric CHECK ("capacity_m3" > 0),
  "status" "vehicle_status" DEFAULT 'available' NOT NULL,
  "is_active" boolean DEFAULT true NOT NULL,
  "assigned_driver_id" uuid REFERENCES "drivers"("id") ON DELETE SET NULL,
  "last_location" geometry(Point,4326),
  "last_location_at" timestamp with time zone,
  "last_speed_kmh" numeric,
  "heading" numeric,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS "vehicles_tenant_registration_idx" ON "vehicles" USING btree ("tenant_id", "registration");
CREATE UNIQUE INDEX IF NOT EXISTS "vehicles_tenant_vin_idx" ON "vehicles" USING btree ("tenant_id", "vin");
CREATE INDEX IF NOT EXISTS "vehicles_last_location_idx" ON "vehicles" USING gist ("last_location");

-- Shipments
CREATE TABLE IF NOT EXISTS "shipments" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "tenant_id" uuid NOT NULL REFERENCES "tenants"("id") ON DELETE CASCADE,
  "reference_code" varchar(50),
  "status" "shipment_status" DEFAULT 'draft' NOT NULL,
  "priority" "shipment_priority" DEFAULT 'normal' NOT NULL,
  "customer_name" varchar(255) NOT NULL,
  "origin_address" text NOT NULL,
  "origin_lat" numeric NOT NULL,
  "origin_lng" numeric NOT NULL,
  "origin_location" geometry(Point,4326),
  "dest_address" text NOT NULL,
  "dest_lat" numeric NOT NULL,
  "dest_lng" numeric NOT NULL,
  "dest_location" geometry(Point,4326),
  "cargo_description" text NOT NULL,
  "cargo_weight_kg" numeric NOT NULL CHECK ("cargo_weight_kg" > 0),
  "cargo_volume_m3" numeric NOT NULL CHECK ("cargo_volume_m3" > 0),
  "cargo_type" "cargo_type" DEFAULT 'general' NOT NULL,
  "requires_temp_control" boolean DEFAULT false NOT NULL,
  "temp_min_c" numeric,
  "temp_max_c" numeric,
  "assigned_vehicle_id" uuid REFERENCES "vehicles"("id") ON DELETE SET NULL,
  "assigned_driver_id" uuid REFERENCES "drivers"("id") ON DELETE SET NULL,
  "assigned_route_id" uuid,
  "estimated_arrival_at" timestamp with time zone,
  "scheduled_pickup_at" timestamp with time zone,
  "actual_pickup_at" timestamp with time zone,
  "actual_delivery_at" timestamp with time zone,
  "pod_signature_url" text,
  "pod_photo_urls" text[] DEFAULT ARRAY[]::text[],
  "pod_notes" text,
  "failure_reason" text,
  "cancellation_reason" text,
  "created_by" uuid REFERENCES "users"("id") ON DELETE SET NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

ALTER TABLE "shipments" ADD CONSTRAINT "shipments_temp_control_check"
  CHECK (NOT "requires_temp_control" OR ("temp_min_c" IS NOT NULL AND "temp_max_c" IS NOT NULL AND "temp_min_c" < "temp_max_c"));

CREATE INDEX IF NOT EXISTS "shipments_origin_location_idx" ON "shipments" USING gist ("origin_location");
CREATE INDEX IF NOT EXISTS "shipments_dest_location_idx" ON "shipments" USING gist ("dest_location");

-- Shipment Events
CREATE TABLE IF NOT EXISTS "shipment_events" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "tenant_id" uuid NOT NULL REFERENCES "tenants"("id") ON DELETE CASCADE,
  "shipment_id" uuid NOT NULL REFERENCES "shipments"("id") ON DELETE CASCADE,
  "from_status" "shipment_status",
  "to_status" "shipment_status" NOT NULL,
  "event_type" varchar(50) NOT NULL,
  "performed_by" uuid REFERENCES "users"("id") ON DELETE SET NULL,
  "location" geometry(Point,4326),
  "metadata" jsonb,
  "notes" text,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);

-- Routes
CREATE TABLE IF NOT EXISTS "routes" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "tenant_id" uuid NOT NULL REFERENCES "tenants"("id") ON DELETE CASCADE,
  "name" varchar(255) NOT NULL,
  "status" "route_status" DEFAULT 'draft' NOT NULL,
  "planned_date" date,
  "vehicle_id" uuid REFERENCES "vehicles"("id") ON DELETE SET NULL,
  "driver_id" uuid REFERENCES "drivers"("id") ON DELETE SET NULL,
  "estimated_distance_km" numeric,
  "optimization_score" numeric,
  "polyline" geometry(LineString,4326),
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

-- Route Stops
CREATE TABLE IF NOT EXISTS "route_stops" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "route_id" uuid NOT NULL REFERENCES "routes"("id") ON DELETE CASCADE,
  "shipment_id" uuid REFERENCES "shipments"("id") ON DELETE SET NULL,
  "stop_type" "stop_type" NOT NULL,
  "sequence_order" integer NOT NULL,
  "address" text NOT NULL,
  "lat" numeric NOT NULL,
  "lng" numeric NOT NULL,
  "planned_arrival" timestamp with time zone,
  "actual_arrival" timestamp with time zone,
  "status" "stop_status" DEFAULT 'pending' NOT NULL,
  "pod_signature_url" text,
  "pod_photo_urls" text[],
  "pod_notes" text,
  "completed_at" timestamp with time zone
);

-- Geofences
CREATE TABLE IF NOT EXISTS "geofences" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "tenant_id" uuid NOT NULL REFERENCES "tenants"("id") ON DELETE CASCADE,
  "name" varchar(255) NOT NULL,
  "center" geometry(Point,4326) NOT NULL,
  "geometry" geometry(Polygon,4326) NOT NULL,
  "radius_m" numeric NOT NULL,
  "color" varchar(10) DEFAULT '#3B82F6' NOT NULL,
  "trigger_on_enter" boolean DEFAULT true NOT NULL,
  "trigger_on_exit" boolean DEFAULT true NOT NULL,
  "is_active" boolean DEFAULT true NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS "geofences_geometry_idx" ON "geofences" USING gist ("geometry");

-- Geofence Events
CREATE TABLE IF NOT EXISTS "geofence_events" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "tenant_id" uuid NOT NULL REFERENCES "tenants"("id") ON DELETE CASCADE,
  "geofence_id" uuid NOT NULL REFERENCES "geofences"("id") ON DELETE CASCADE,
  "vehicle_id" uuid NOT NULL REFERENCES "vehicles"("id") ON DELETE CASCADE,
  "event_type" "geofence_event_type" NOT NULL,
  "lat" numeric NOT NULL,
  "lng" numeric NOT NULL,
  "triggered_at" timestamp with time zone DEFAULT now() NOT NULL,
  "acknowledged_at" timestamp with time zone,
  "acknowledged_by" uuid REFERENCES "users"("id") ON DELETE SET NULL
);

-- Notifications
CREATE TABLE IF NOT EXISTS "notifications" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "tenant_id" uuid NOT NULL REFERENCES "tenants"("id") ON DELETE CASCADE,
  "user_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "type" varchar(50) NOT NULL,
  "title" varchar(255) NOT NULL,
  "body" text NOT NULL,
  "data" jsonb,
  "read_at" timestamp with time zone,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);

-- Webhook Endpoints
CREATE TABLE IF NOT EXISTS "webhook_endpoints" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "tenant_id" uuid NOT NULL REFERENCES "tenants"("id") ON DELETE CASCADE,
  "url" text NOT NULL,
  "events" text[] DEFAULT ARRAY[]::text[] NOT NULL,
  "secret" text NOT NULL,
  "is_active" boolean DEFAULT true NOT NULL,
  "failure_count" integer DEFAULT 0 NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
