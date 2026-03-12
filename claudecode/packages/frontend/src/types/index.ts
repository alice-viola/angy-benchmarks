import type {
  ShipmentStatus,
  VehicleStatus,
  DriverStatus,
  RouteStatus,
  StopStatus,
  VehicleType,
  CargoType,
  Priority,
  UserRole,
  TenantPlan,
} from '@nexus-fleet/shared';

// ---------------------------------------------------------------------------
// Entity types (as returned by the API)
// ---------------------------------------------------------------------------

export interface User {
  id: string;
  email: string;
  first_name: string;
  last_name: string;
  role: UserRole;
  tenant_id: string;
  created_at: string;
  updated_at: string;
}

export interface Tenant {
  id: string;
  name: string;
  plan: TenantPlan;
  created_at: string;
  updated_at: string;
}

export interface Vehicle {
  id: string;
  tenant_id: string;
  registration: string;
  vin: string;
  make: string;
  model: string;
  year: number;
  type: VehicleType;
  status: VehicleStatus;
  capacity_kg: number;
  capacity_m3: number;
  current_driver_id?: string;
  current_lat?: number;
  current_lng?: number;
  created_at: string;
  updated_at: string;
}

export interface Driver {
  id: string;
  tenant_id: string;
  employee_id: string;
  first_name: string;
  last_name: string;
  phone: string;
  status: DriverStatus;
  license_number: string;
  license_expiry: string;
  license_classes: string[];
  max_driving_hours_day: number;
  current_vehicle_id?: string;
  created_at: string;
  updated_at: string;
}

export interface Shipment {
  id: string;
  tenant_id: string;
  reference_code: string;
  status: ShipmentStatus;
  customer_name: string;
  origin_address: string;
  origin_lat: number;
  origin_lng: number;
  dest_address: string;
  dest_lat: number;
  dest_lng: number;
  cargo_description: string;
  cargo_weight_kg: number;
  cargo_volume_m3: number;
  cargo_type: CargoType;
  requires_temp_control: boolean;
  temp_min_c?: number;
  temp_max_c?: number;
  priority: Priority;
  scheduled_pickup_at?: string;
  actual_pickup_at?: string;
  actual_delivery_at?: string;
  assigned_vehicle_id?: string;
  assigned_driver_id?: string;
  route_id?: string;
  created_at: string;
  updated_at: string;
}

export interface ShipmentEvent {
  id: string;
  shipment_id: string;
  event_type: string;
  from_status?: ShipmentStatus;
  to_status?: ShipmentStatus;
  user_id?: string;
  user_name?: string;
  notes?: string;
  metadata?: Record<string, unknown>;
  created_at: string;
}

export interface Route {
  id: string;
  tenant_id: string;
  name: string;
  status: RouteStatus;
  vehicle_id?: string;
  driver_id?: string;
  planned_date: string;
  estimated_distance_km?: number;
  estimated_duration_min?: number;
  stops: RouteStop[];
  created_at: string;
  updated_at: string;
}

export interface RouteStop {
  id: string;
  route_id: string;
  shipment_id?: string;
  stop_type: string;
  status: StopStatus;
  location_lat: number;
  location_lng: number;
  address: string;
  sequence_order: number;
  estimated_arrival?: string;
  actual_arrival?: string;
}

export interface Geofence {
  id: string;
  tenant_id: string;
  name: string;
  center_lat: number;
  center_lng: number;
  radius_m: number;
  color: string;
  trigger_on_enter: boolean;
  trigger_on_exit: boolean;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface GeofenceEvent {
  id: string;
  geofence_id: string;
  geofence_name: string;
  vehicle_id: string;
  vehicle_registration?: string;
  event_type: 'enter' | 'exit';
  lat: number;
  lng: number;
  created_at: string;
}

export interface Webhook {
  id: string;
  tenant_id: string;
  url: string;
  events: string[];
  is_active: boolean;
  secret: string;
  created_at: string;
  updated_at: string;
}

export interface Notification {
  id: string;
  tenant_id: string;
  user_id?: string;
  title: string;
  message: string;
  type: 'info' | 'warning' | 'error' | 'success';
  is_read: boolean;
  metadata?: Record<string, unknown>;
  created_at: string;
}

// ---------------------------------------------------------------------------
// DataTable column definition
// ---------------------------------------------------------------------------

export interface ColumnDef<T> {
  key: keyof T | string;
  label: string;
  sortable?: boolean;
  filterable?: boolean;
  render?: (value: any, row: T) => string;
}

// ---------------------------------------------------------------------------
// Toast
// ---------------------------------------------------------------------------

export type ToastType = 'success' | 'error' | 'warning' | 'info';

export interface Toast {
  id: string;
  type: ToastType;
  message: string;
  duration?: number;
}

// ---------------------------------------------------------------------------
// Dashboard stats
// ---------------------------------------------------------------------------

export interface FleetStats {
  totalVehicles: number;
  activeVehicles: number;
  availableVehicles: number;
  maintenanceVehicles: number;
  totalDrivers: number;
  onDutyDrivers: number;
  offDutyDrivers: number;
  activeShipments: number;
  deliveredToday: number;
}
