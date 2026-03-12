// Schemas
export {
  registerRequestSchema,
  loginRequestSchema,
  registerResponseSchema,
  loginResponseSchema,
  refreshResponseSchema,
  meResponseSchema,
} from './schemas/auth.js';

export {
  shipmentRequestSchema,
  shipmentUpdateRequestSchema,
  shipmentTransitionRequestSchema,
  shipmentResponseSchema,
  shipmentEventResponseSchema,
  cargoTypeEnum,
  priorityEnum,
  transitionActionEnum,
} from './schemas/shipment.js';

export {
  vehicleRequestSchema,
  vehicleUpdateRequestSchema,
  vehicleResponseSchema,
  vehicleTypeEnum,
} from './schemas/vehicle.js';

export {
  driverRequestSchema,
  driverUpdateRequestSchema,
  assignVehicleRequestSchema,
  driverResponseSchema,
  licenseClassEnum,
} from './schemas/driver.js';

export {
  routeRequestSchema,
  routeUpdateRequestSchema,
  routeStopRequestSchema,
  bulkStopReorderRequestSchema,
  stopCompleteRequestSchema,
  routeResponseSchema,
  stopTypeEnum,
} from './schemas/route.js';

export {
  geofenceRequestSchema,
  geofenceUpdateRequestSchema,
  geofenceResponseSchema,
  geofenceEventResponseSchema,
} from './schemas/geofence.js';

export {
  webhookRequestSchema,
  webhookUpdateRequestSchema,
  webhookResponseSchema,
  webhookTestResponseSchema,
  webhookEventEnum,
} from './schemas/webhook.js';

export {
  userCreateRequestSchema,
  userUpdateRequestSchema,
  userResponseSchema,
} from './schemas/user.js';

export {
  notificationResponseSchema,
  notificationListMetaSchema,
  markAllReadResponseSchema,
} from './schemas/notification.js';

export {
  paginationQuerySchema,
  paginationMetaSchema,
  successResponseSchema,
  paginatedResponseSchema,
  errorResponseSchema,
  sortQuerySchema,
} from './schemas/common.js';

// Types
export type {
  RegisterRequest,
  LoginRequest,
  RegisterResponse,
  LoginResponse,
  RefreshResponse,
  MeResponse,
  ShipmentRequest,
  ShipmentUpdateRequest,
  ShipmentTransitionRequest,
  ShipmentResponse,
  ShipmentEventResponse,
  VehicleRequest,
  VehicleUpdateRequest,
  VehicleResponse,
  DriverRequest,
  DriverUpdateRequest,
  AssignVehicleRequest,
  DriverResponse,
  RouteRequest,
  RouteUpdateRequest,
  RouteStopRequest,
  BulkStopReorderRequest,
  StopCompleteRequest,
  RouteResponse,
  GeofenceRequest,
  GeofenceUpdateRequest,
  GeofenceResponse,
  GeofenceEventResponse,
  WebhookRequest,
  WebhookUpdateRequest,
  WebhookResponse,
  WebhookTestResponse,
  UserCreateRequest,
  UserUpdateRequest,
  UserResponse,
  NotificationResponse,
  NotificationListMeta,
  MarkAllReadResponse,
  PaginationQuery,
  PaginationMeta,
  ErrorResponse,
} from './types/index.js';

// Constants
export {
  SHIPMENT_STATUSES,
  TERMINAL_STATUSES,
  SHIPMENT_TRANSITIONS,
  ACTION_TO_TRANSITION,
  AVAILABLE_ACTIONS,
} from './constants/shipment-states.js';
export type { ShipmentStatus } from './constants/shipment-states.js';

export {
  VEHICLE_STATUSES,
  VEHICLE_TYPE_LICENSE_MAP,
} from './constants/vehicle-statuses.js';
export type { VehicleStatus } from './constants/vehicle-statuses.js';

export { DRIVER_STATUSES } from './constants/driver-statuses.js';
export type { DriverStatus } from './constants/driver-statuses.js';

export { ROLES } from './constants/roles.js';
export type { Role } from './constants/roles.js';

export {
  RATE_LIMITS_BY_PLAN,
  AUTH_RATE_LIMIT,
  WS_CONNECTION_LIMITS_BY_PLAN,
} from './constants/rate-limits.js';

// Utils
export { haversine } from './utils/haversine.js';
